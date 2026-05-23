# AI 起稿流式体验优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让代笔先生起稿时边生成边显字，完成前不可进入校改或投寄，并保留现有非流式 AI 起稿接口作为兜底。

**Architecture:** 在现有 `server/ai-scribe-proxy` 代理中新增受控 SSE 流式接口，继续复用 MiMo 配置、prompt、CORS、请求体限制和错误归一边界。App 侧在现有 `AiScribeAdapter` 上增加 streaming 方法，写信页只把流式中间文本作为“未完成稿”展示，最终 `done` 后才写入可保存、可投寄的 AI draft metadata。

**Tech Stack:** TypeScript、Vue 3、Vite、Vitest、Node HTTP、CloudBase HTTP Web Server、Tailwind CSS、Varlet。

---

## Guardrails

- 不改 `src/domain`，不重复实现时间、钱匣、邮资、信件状态规则。
- 不移除现有 `POST /ai/scribe-draft` 非流式接口。
- 新增流式接口建议为 `POST /ai/scribe-draft/stream`，CloudBase 路由下对应 `POST /api/ai/scribe-draft/stream`。
- 服务端只输出受控 SSE 事件：`delta`、`done`、`error`；不透传 provider 原始 chunk、完整 prompt、真实 key 或 provider body。
- MiMo stream client 必须收到 provider `data: [DONE]` 才能正常完成；partial delta 后 EOF 要转为受控失败。
- App 在 `done` 前不能进入校改、不能投寄、不能把中间文本保存成有效 AI 初稿。
- 流式中断后允许保留页面上的未完成文本提示，但保存草稿时只能保存口述，不保存未完成 `scribeDraft`、`draftSource` 或 `generationMeta`。
- AI 起稿未完成或失败时，保存草稿不得回落到本地模板正文；只能落为口述草稿。
- 真实 CloudBase / MiMo 控制台费用告警、默认角色收敛和 key 轮换入口仍属于阶段 13 用户介入事项，不阻塞本阶段代码实现。

## Files

- Modify: `server/ai-scribe-proxy/mimo-client.ts`
- Modify: `server/ai-scribe-proxy/mimo-client.test.ts`
- Modify: `server/ai-scribe-proxy/handler.ts`
- Modify: `server/ai-scribe-proxy/handler.test.ts`
- Modify: `server/ai-scribe-proxy/dev-server.ts`
- Modify: `server/ai-scribe-proxy/dev-server.test.ts`
- Modify: `server/ai-scribe-proxy/cloudbase-http-server.ts`
- Modify: `server/ai-scribe-proxy/cloudbase-http-server.test.ts`
- Modify: `src/app/ai-scribe-adapter.ts`
- Modify: `src/app/ai-scribe-adapter.test.ts`
- Modify: `src/app/pages/WriteLetterPage.vue`
- Modify: `src/app/write-letter-service.ts`
- Modify: `src/app/write-letter-service.test.ts`
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

## Task 1: MiMo Streaming Client

**Files:**
- Modify: `server/ai-scribe-proxy/mimo-client.ts`
- Modify: `server/ai-scribe-proxy/mimo-client.test.ts`

- [ ] **Step 1: Write failing streaming request test**

Add a test proving the streaming client sends `stream: true`, disables thinking, keeps the configured max token guard, and never exposes the API key outside request headers:

```ts
it("streams OpenAI-compatible chat completion deltas", async () => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init ?? {} });

    return new Response(
      [
        'data: {"choices":[{"delta":{"content":"兰卿："}}]}',
        "",
        'data: {"choices":[{"delta":{"content":"见字如晤。"}}]}',
        "",
        "data: [DONE]",
        "",
        ""
      ].join("\n"),
      { status: 200, headers: { "content-type": "text/event-stream" } }
    );
  };

  const chunks: string[] = [];
  for await (const event of requestMimoChatCompletionStream(config, [{ role: "user", content: "写一封问安信。" }], fetcher)) {
    chunks.push(event.delta);
  }

  expect(chunks).toEqual(["兰卿：", "见字如晤。"]);
  expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
    model: "mimo-v2.5-pro",
    stream: true,
    thinking: { type: "disabled" },
    max_completion_tokens: 900
  });
  expect(calls[0]?.init.headers).toMatchObject({ "api-key": "tp-test-key" });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- server/ai-scribe-proxy/mimo-client.test.ts
```

Expected: fail because `requestMimoChatCompletionStream` is not implemented.

- [ ] **Step 3: Implement minimal async iterable parser**

In `mimo-client.ts`, add:

```ts
export interface MimoChatStreamDelta {
  type: "delta";
  delta: string;
}

export async function* requestMimoChatCompletionStream(
  config: AiProxyConfig,
  messages: MimoChatMessage[],
  fetcher: typeof fetch = fetch
): AsyncIterable<MimoChatStreamDelta> {
  // Same timeout, URL, auth header and request options as requestMimoChatCompletion,
  // except body.stream must be true.
  // Parse text/event-stream data lines. Yield only non-empty choices[0].delta.content strings.
  // Stop on data: [DONE]. Throw normalized errors for non-OK, missing body and timeout.
}
```

Keep parsing provider chunks internal to the server package. Do not export raw provider payload types to `src/app`.

- [ ] **Step 4: Add parser edge tests**

Add tests for:

- comments / blank lines between SSE events are ignored.
- provider non-OK throws `MiMo request failed with status <status>.` without leaking body.
- timeout throws `MiMo request timed out.`
- malformed JSON chunk throws a generic stream parse error without including provider body.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npm test -- server/ai-scribe-proxy/mimo-client.test.ts
```

Expected: pass.

## Task 2: Shared Streaming Handler

**Files:**
- Modify: `server/ai-scribe-proxy/handler.ts`
- Modify: `server/ai-scribe-proxy/handler.test.ts`

- [ ] **Step 1: Write failing handler test for controlled SSE events**

Add a test that calls the new stream handler with a fake stream requester and expects only controlled event payloads:

```ts
it("streams controlled draft events without provider chunks", async () => {
  const response = await handleAiProxyStreamRequest(
    config,
    {
      method: "POST",
      url: "/ai/scribe-draft/stream",
      headers: { origin: "http://localhost:5173", "content-type": "application/json" },
      body: validBody()
    },
    async function* () {
      yield { type: "delta", delta: "兰卿：" };
      yield { type: "delta", delta: "见字如晤。" };
    }
  );

  expect(response.statusCode).toBe(200);
  expect(response.headers["content-type"]).toBe("text/event-stream; charset=utf-8");

  const body = await collectStreamBody(response.body);
  expect(body).toContain('event: delta');
  expect(body).toContain('"delta":"兰卿："');
  expect(body).toContain('event: done');
  expect(body).toContain('"scribeDraft":"兰卿：见字如晤。"');
  expect(body).not.toContain("choices");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- server/ai-scribe-proxy/handler.test.ts
```

Expected: fail because `handleAiProxyStreamRequest` does not exist.

- [ ] **Step 3: Implement stream response types and endpoint guard**

In `handler.ts`, add:

```ts
export type StreamingCompletionRequester = (
  config: AiProxyConfig,
  messages: MimoChatMessage[]
) => AsyncIterable<MimoChatStreamDelta>;

export interface AiProxyStreamHandlerResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: AsyncIterable<string> | string;
}

export function shouldHandleAiProxyStreamRequest(method: string | undefined, url: string | undefined): boolean {
  return method === "POST" && normalizeAiProxyPathname(new URL(url ?? "/", "http://127.0.0.1").pathname) === "/ai/scribe-draft/stream";
}
```

`handleAiProxyStreamRequest` should reuse the same origin checks, body size guard and request parsing as the non-stream handler. On validation errors before streaming, return JSON error responses. On success, return `text/event-stream`.

- [ ] **Step 4: Implement controlled SSE serializer**

Serialize exactly:

```txt
event: delta
data: {"delta":"...","text":"..."}

event: done
data: {"ok":true,"scribeDraft":"...","readAloudText":"...","signature":"...","generationMeta":{...}}

event: error
data: {"ok":false,"reason":"provider_error","message":"AI provider request failed."}
```

The `done` metadata must use:

- `engine: "ai-scribe-v1"`
- `provider: "xiaomi-mimo"`
- `model: config.modelId`
- `promptVersion: "ai-scribe-prompt-v1"`
- `latencyMs`
- `usage: { promptTokens: null, completionTokens: null }` unless a future stream parser can supply usage safely.

- [ ] **Step 5: Add handler failure tests**

Cover:

- invalid origin returns `403` before stream requester is called.
- invalid body returns JSON `400`.
- provider throws after stream starts and the emitted body contains controlled `event: error`, not raw provider detail.
- non-stream `handleAiProxyRequest` still serves `POST /ai/scribe-draft`.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- server/ai-scribe-proxy/handler.test.ts
```

Expected: pass.

## Task 3: Node Dev Server and CloudBase Web Server Streaming Bridge

**Files:**
- Modify: `server/ai-scribe-proxy/dev-server.ts`
- Modify: `server/ai-scribe-proxy/dev-server.test.ts`
- Modify: `server/ai-scribe-proxy/cloudbase-http-server.ts`
- Modify: `server/ai-scribe-proxy/cloudbase-http-server.test.ts`

- [ ] **Step 1: Write failing dev server stream test**

Add a test that starts `createAiProxyServer` with a fake streaming requester and fetches `/ai/scribe-draft/stream`, then reads text and verifies delta/done events.

- [ ] **Step 2: Write failing CloudBase `/api` stream test**

Add a test that starts `createCloudBaseHttpServer` and fetches `/api/ai/scribe-draft/stream`, verifying the same controlled events and CORS headers.

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
npm test -- server/ai-scribe-proxy/dev-server.test.ts server/ai-scribe-proxy/cloudbase-http-server.test.ts
```

Expected: fail because servers still route every request through the non-stream JSON handler.

- [ ] **Step 4: Update server factories with disjoint requesters**

Update server factory signatures to accept optional streaming requester while preserving existing test call sites:

```ts
export function createAiProxyServer(
  config: AiProxyConfig,
  requestCompletion: CompletionRequester = requestMimoChatCompletion,
  requestStreamingCompletion: StreamingCompletionRequester = requestMimoChatCompletionStream
): Server
```

Apply the same pattern to `createCloudBaseHttpServer`.

- [ ] **Step 5: Stream async iterable chunks to `ServerResponse`**

If `shouldHandleAiProxyStreamRequest(method, url)` is true, call `handleAiProxyStreamRequest`. Write headers once, then:

```ts
for await (const chunk of handlerResponse.body) {
  response.write(chunk);
}
response.end();
```

If the body is a string, write it once and end.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- server/ai-scribe-proxy/dev-server.test.ts server/ai-scribe-proxy/cloudbase-http-server.test.ts
```

Expected: pass.

## Task 4: App Streaming Adapter

**Files:**
- Modify: `src/app/ai-scribe-adapter.ts`
- Modify: `src/app/ai-scribe-adapter.test.ts`

- [ ] **Step 1: Write failing adapter stream test**

Add a test that fakes a `text/event-stream` response and verifies `onDelta` receives progressive text while final result maps to `ScribeDraftResult`:

```ts
const deltas: string[] = [];
const result = await adapter.generateDraftStream(
  input,
  {
    onDelta: (_delta, text) => deltas.push(text)
  }
);

expect(deltas).toEqual(["兰卿：", "兰卿：见字如晤。"]);
expect(result).toMatchObject({
  scribeDraft: "兰卿：见字如晤。",
  draftSource: "ai",
  generationMeta: { provider: "xiaomi-mimo", model: "mimo-v2.5" }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- src/app/ai-scribe-adapter.test.ts
```

Expected: fail because `generateDraftStream` does not exist.

- [ ] **Step 3: Extend adapter interface**

Add:

```ts
export interface AiScribeStreamHandlers {
  onDelta?: (delta: string, text: string) => void;
  signal?: AbortSignal;
}

export interface AiScribeAdapter {
  generateDraft(input: AiScribeDraftInput): Promise<ScribeDraftResult>;
  generateDraftStream(input: AiScribeDraftInput, handlers?: AiScribeStreamHandlers): Promise<ScribeDraftResult>;
}
```

- [ ] **Step 4: Implement controlled SSE parser**

`generateDraftStream` should POST to `${proxyUrl}/ai/scribe-draft/stream`, parse only controlled `delta`、`done`、`error` events, and map done payload through the same metadata validation used by `generateDraft`.

Errors:

- network failure -> `network_unavailable`
- non-OK JSON failure -> existing `proxyFailureToError`
- missing stream body -> `invalid_response`
- stream `error` event -> normalized `AiScribeDraftError`
- stream closes before `done` -> `invalid_response`

- [ ] **Step 5: Add adapter failure tests**

Cover:

- stream `error` event becomes `AiScribeDraftError`.
- stream closes after delta but before done, and does not return a result.
- response body never needs provider key.
- existing non-stream tests still pass.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npm test -- src/app/ai-scribe-adapter.test.ts
```

Expected: pass.

## Task 5: Write Letter Page Streaming UX

**Files:**
- Modify: `src/app/pages/WriteLetterPage.vue`

- [ ] **Step 1: Add page-only streaming preview state**

Add:

```ts
const streamingDraftText = ref("");
```

This value is only for the 起稿 panel. It must not be read by `letterPreviewText` and must not be sent through `buildInput()`.

- [ ] **Step 2: Wire streaming adapter**

In `generateDraft`, keep the existing request marker and pending guard. For AI scribes, call:

```ts
return aiScribeAdapter.generateDraftStream(aiInput, {
  onDelta: (_delta, text) => {
    if (wizard.value.oralText === requestMarker.oralText && wizard.value.selectedScribeId === requestMarker.scribeId) {
      streamingDraftText.value = text;
    }
  }
});
```

For handwritten mode, continue using local `createScribeDraftResult`.

- [ ] **Step 3: Keep done-only finalization**

Only after `generateDraftStream` resolves should `markDraftGenerated` run. If it throws or the request marker changed, do not copy `streamingDraftText` into wizard state; show the existing failure message and allow retry.

- [ ] **Step 4: Update pending copy without changing visual system**

Use the existing draft panel. While pending, show `streamingDraftText || wizard.scribeDraft || "请先生依口述起一份初稿。"` in the 起稿 panel; the right-side 誊清预览 continues to show only `finalText || scribeDraft`.

- [ ] **Step 5: Typecheck**

Run:

```bash
npm run typecheck
```

Expected: pass.

## Task 6: Full Verification and Documentation

**Files:**
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

- [ ] **Step 1: Run full automated verification**

Run:

```bash
git diff --check
npm test
npm run typecheck
npm run build
```

Expected:

- Tests pass.
- Typecheck passes.
- Build passes.
- Existing Varlet chunk size warning may remain non-blocking.

- [ ] **Step 2: Run local stream smoke**

Start local proxy:

```bash
npm run ai-proxy:dev
```

In another shell, call:

```bash
curl -N \
  -H 'content-type: application/json' \
  -H 'origin: http://localhost:5173' \
  --data '{"oralText":"请替我问她近来安好。","scribeName":"许鹤年","scribeStyle":"老先生","senderGreeting":"兰卿","senderSignature":"明远","senderCity":"杭州","recipientCity":"西安","letterType":"ordinary"}' \
  http://127.0.0.1:8787/ai/scribe-draft/stream
```

Expected: visible `event: delta` chunks followed by one `event: done`; no raw `choices` provider payload.

- [ ] **Step 3: Browser smoke**

Start App with local or cloud proxy:

```bash
VITE_PINGANPI_AI_PROXY_URL=http://127.0.0.1:8787 npm run dev
```

Open the local Vite URL, go to 写信 -> 起稿. Expected:

- text appears progressively in the 起稿 panel.
- while generating, 上一步 / 存作草稿 / 下一步 are disabled.
- after done, 下一步 becomes available.
- if the proxy is stopped mid-stream, the partial draft remains unavailable for 校改/投寄 and the user can retry.

- [ ] **Step 4: Update roadmap, dashboard and AGENTS**

Record:

- stage 14 status and implemented scope.
- new streaming endpoint `/ai/scribe-draft/stream` and CloudBase `/api/ai/scribe-draft/stream`.
- updated verification baseline and test count.
- stage 13 remaining user-intervention items are still batched for later.

- [ ] **Step 5: Commit**

Use Conventional Commits:

```bash
git add server/ai-scribe-proxy src/app docs/pinganpi-roadmap.md docs/pinganpi-roadmap-dashboard.html AGENTS.md docs/superpowers/plans/2026-05-24-pinganpi-ai-scribe-streaming.md
git commit -m "feat(ai): 添加流式起稿体验"
```

## Final User-Intervention Backlog

Batch these for the user after code work, not during the main implementation:

- Xiaomi MiMo 控制台：费用告警、额度上限、余额提醒、key 撤销 / 轮换入口确认。
- CloudBase 控制台：函数调用量、出网流量、错误率和费用告警确认。
- CloudBase 控制台：默认 `TCB_QcsRole` 是否能收敛为更细粒度角色。
- iOS Safari Web Inspector 手工确认。
- 真机验证。
