# 平安批最小 AI 服务端代理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 为已购买的 Xiaomi MiMo 模型建立一个本地可测、后续可迁移到云函数的最小 AI 服务端代理，确保 AI key 不进入移动端 / Vite 客户端。

**Architecture:** 新增 `server/ai-scribe-proxy/`，把 MiMo OpenAI-compatible 调用、环境变量读取、本地 HTTP 代理和连接验证脚本放在服务端目录。阶段 12 已通过 App 层 AI adapter 调用该代理；密钥只从服务端环境变量读取，不使用 `VITE_` 前缀。

**Tech Stack:** TypeScript, Node 22 built-in `fetch`, Vitest, `tsx` dev runner, Xiaomi MiMo OpenAI-compatible `/v1/chat/completions` API.

---

## Context

参考文档：

- `docs/superpowers/specs/2026-05-23-pinganpi-ai-scribe-design.md`
- `docs/pinganpi-roadmap.md`
- Xiaomi MiMo OpenAI API 文档：`https://platform.xiaomimimo.com/docs/zh-CN/api/chat/openai-api`
- Xiaomi MiMo 官方 FAQ：`https://platform.xiaomimimo.com/docs/en-US/faq`

官方文档说明：

- OpenAI-compatible 接口示例为 `https://api.xiaomimimo.com/v1/chat/completions`。
- API key 可通过 `api-key: $MIMO_API_KEY` 或 `Authorization: Bearer $MIMO_API_KEY` 请求头传递。
- 当前示例模型为 `mimo-v2.5-pro`。
- 请求体可显式设置 `thinking: { type: "disabled" }` 关闭思考模式，本地代理采用该配置，保持短文本起稿响应稳定。
- Base URL 仍应以订阅管理页提供为准，并区分 OpenAI-compatible 和 Anthropic-compatible 两类。
- Token Plan key 格式通常为 `tp-xxxxx`，按量 key 格式通常为 `sk-xxxxx`，两者不能混用。
- 国内 / 海外账号返回不同 Base URL 和 Key，不能互通。

本计划不要求把真实 key 写入仓库。实施时由用户在本机或云函数 secret 中设置：

```bash
export MIMO_API_BASE_URL="https://api.xiaomimimo.com/v1"
export MIMO_MODEL_ID="mimo-v2.5-pro"
export MIMO_API_KEY="replace-with-secret-from-subscription-page"
```

`MIMO_API_BASE_URL` 和 `MIMO_MODEL_ID` 需要以用户订阅管理页实际显示为准。上面的值只用于说明变量格式。

## Implementation Status

本计划已按子 agent 审阅结果做了实施期调整：

- `vitest.config.ts` 已加入 `server/**/*.test.ts`，确保服务端测试会被真实执行。
- `server/ai-scribe-proxy/dev-server.ts` 使用 `IncomingMessage` / `ServerResponse` 类型，避免 `Parameters<typeof createServer>` 类型错误。
- MiMo client 已加入默认 30 秒超时，可通过 `MIMO_REQUEST_TIMEOUT_MS` 调整。
- 本地代理已补充 `prompt.test.ts` 和 `dev-server.test.ts`，用 fake requester 覆盖 prompt、health、CORS 预检、成功响应和校验错误。
- 代码审查后已补充本地 Origin 限制、32 KB 请求体限制和固定 provider 错误响应，避免任意网页借用本机代理消耗 MiMo 额度或看到 provider 原始错误。
- 当前仓库只完成阶段 11 本地可测代理脚手架；真实 MiMo env 连通验证、费用告警和 CloudBase / 云函数落点已拆到阶段 13 独立推进。

## File Structure

- Modify: `package.json`
  - 新增 `ai-proxy:dev`、`ai-proxy:check` 脚本。
  - 显式加入 `tsx` dev dependency。
- Modify: `tsconfig.json`
  - 将 `server/**/*.ts` 纳入 typecheck。
- Modify: `vitest.config.ts`
  - 将 `server/**/*.test.ts` 纳入 Vitest。
- Modify: `.gitignore`
  - 忽略 `.env.local`、`.env.*.local`、`.env.ai.local`。
- Create: `.env.example`
  - 记录非密钥 env 名称和安全注释。
- Create: `server/ai-scribe-proxy/config.ts`
  - 读取并校验服务端环境变量。
- Create: `server/ai-scribe-proxy/mimo-client.ts`
  - 封装 MiMo OpenAI-compatible 调用。
- Create: `server/ai-scribe-proxy/prompt.ts`
  - 生成最小烟测 prompt，不包含真实用户口述。
- Create: `server/ai-scribe-proxy/dev-server.ts`
  - 本地 HTTP 代理，提供 `POST /ai/scribe-draft` 和 `GET /health`。
- Create: `server/ai-scribe-proxy/check-mimo.ts`
  - 用环境变量执行一次只读连通检查。
- Create: `server/ai-scribe-proxy/config.test.ts`
  - 覆盖 env 缺失、`VITE_` key 禁止和正常配置。
- Create: `server/ai-scribe-proxy/mimo-client.test.ts`
  - 使用 fake fetch 覆盖请求头、路径、成功解析和错误归一。
- Create: `server/ai-scribe-proxy/prompt.test.ts`
  - 覆盖提示词素材构造。
- Create: `server/ai-scribe-proxy/dev-server.test.ts`
  - 使用 fake requester 覆盖本地代理的 health、CORS、成功响应和校验错误。

---

### Task 1: 安全环境变量与脚本

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Modify: `.gitignore`
- Create: `.env.example`

- [x] **Step 1: Update `package.json` scripts and dev dependency**

Add these scripts:

```json
{
  "ai-proxy:dev": "tsx server/ai-scribe-proxy/dev-server.ts",
  "ai-proxy:check": "tsx server/ai-scribe-proxy/check-mimo.ts"
}
```

Add `tsx` as a dev dependency:

```json
"tsx": "^4.20.6"
```

Run:

```bash
npm install
```

Expected:

- `package.json` and `package-lock.json` update.
- No runtime dependency is added.

- [x] **Step 2: Include server TypeScript in typecheck**

Modify `tsconfig.json` include:

```json
"include": [
  "src/**/*.ts",
  "src/**/*.vue",
  "server/**/*.ts",
  "vite.config.ts",
  "vitest.config.ts",
  "capacitor.config.ts"
]
```

- [x] **Step 3: Ignore local secret env files**

Append to `.gitignore`:

```gitignore
# Local secrets
.env.local
.env.*.local
.env.ai.local
```

- [x] **Step 4: Create `.env.example`**

Create `.env.example`:

```bash
# Pinganpi AI proxy server env.
# Copy values into a local secret file or shell environment.
# Do not commit real keys.

MIMO_API_BASE_URL=https://api.xiaomimimo.com/v1
MIMO_MODEL_ID=mimo-v2.5
MIMO_API_KEY=replace-with-secret-from-subscription-page
PINGANPI_AI_PROXY_PORT=8787
MIMO_REQUEST_TIMEOUT_MS=30000
```

- [x] **Step 5: Verify package scripts are visible**

Run:

```bash
npm run
```

Expected:

- Output lists `ai-proxy:dev`.
- Output lists `ai-proxy:check`.

- [x] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json .gitignore .env.example
git commit -m "build: 添加 AI 代理开发脚本"
```

---

### Task 2: 代理配置读取与密钥防线

**Files:**
- Create: `server/ai-scribe-proxy/config.ts`
- Create: `server/ai-scribe-proxy/config.test.ts`

- [x] **Step 1: Write failing tests**

Create `server/ai-scribe-proxy/config.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readAiProxyConfig } from "./config.js";

describe("AI proxy config", () => {
  it("reads MiMo server env without exposing Vite keys", () => {
    const config = readAiProxyConfig({
      MIMO_API_BASE_URL: "https://api.xiaomimimo.com/v1",
      MIMO_MODEL_ID: "mimo-v2.5",
      MIMO_API_KEY: "tp-test-key",
      PINGANPI_AI_PROXY_PORT: "8787"
    });

    expect(config).toEqual({
      baseUrl: "https://api.xiaomimimo.com/v1",
      modelId: "mimo-v2.5",
      apiKey: "tp-test-key",
      port: 8787
    });
  });

  it("rejects VITE-prefixed MiMo keys", () => {
    expect(() =>
      readAiProxyConfig({
        MIMO_API_BASE_URL: "https://api.xiaomimimo.com/v1",
        MIMO_MODEL_ID: "mimo-v2.5",
        VITE_MIMO_API_KEY: "tp-leaked-key"
      })
    ).toThrow("Do not expose MiMo API keys through VITE_ variables.");
  });

  it("requires the server-side API key", () => {
    expect(() =>
      readAiProxyConfig({
        MIMO_API_BASE_URL: "https://api.xiaomimimo.com/v1",
        MIMO_MODEL_ID: "mimo-v2.5"
      })
    ).toThrow("Missing MIMO_API_KEY.");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- server/ai-scribe-proxy/config.test.ts
```

Expected:

- FAIL because `server/ai-scribe-proxy/config.ts` does not exist.

- [x] **Step 3: Implement config reader**

Create `server/ai-scribe-proxy/config.ts`:

```ts
export interface AiProxyConfig {
  baseUrl: string;
  modelId: string;
  apiKey: string;
  port: number;
}

export type EnvSource = Record<string, string | undefined>;

export function readAiProxyConfig(env: EnvSource): AiProxyConfig {
  if (env.VITE_MIMO_API_KEY !== undefined || env.VITE_XIAOMI_MIMO_API_KEY !== undefined) {
    throw new Error("Do not expose MiMo API keys through VITE_ variables.");
  }

  const baseUrl = readRequired(env, "MIMO_API_BASE_URL").replace(/\/+$/u, "");
  const modelId = readRequired(env, "MIMO_MODEL_ID");
  const apiKey = readRequired(env, "MIMO_API_KEY");
  const port = readPort(env.PINGANPI_AI_PROXY_PORT);

  return {
    baseUrl,
    modelId,
    apiKey,
    port
  };
}

function readRequired(env: EnvSource, key: string): string {
  const value = env[key]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing ${key}.`);
  }

  return value;
}

function readPort(value: string | undefined): number {
  if (value === undefined || value.trim().length === 0) {
    return 8787;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PINGANPI_AI_PROXY_PORT must be an integer from 1 to 65535.");
  }

  return port;
}
```

- [x] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- server/ai-scribe-proxy/config.test.ts
```

Expected:

- PASS for 3 tests.

- [x] **Step 5: Commit**

```bash
git add server/ai-scribe-proxy/config.ts server/ai-scribe-proxy/config.test.ts
git commit -m "feat(ai): 添加 MiMo 代理配置读取"
```

---

### Task 3: MiMo OpenAI-compatible client

**Files:**
- Create: `server/ai-scribe-proxy/mimo-client.ts`
- Create: `server/ai-scribe-proxy/mimo-client.test.ts`

- [x] **Step 1: Write failing tests**

Create `server/ai-scribe-proxy/mimo-client.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { requestMimoChatCompletion } from "./mimo-client.js";

describe("MiMo client", () => {
  it("calls OpenAI-compatible chat completions with server key", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetcher: typeof fetch = async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });

      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "兰卿：见字如晤。" } }],
          usage: { prompt_tokens: 10, completion_tokens: 8 }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    };

    const result = await requestMimoChatCompletion(
      {
        baseUrl: "https://api.xiaomimimo.com/v1",
        modelId: "mimo-v2.5",
        apiKey: "tp-test-key",
        port: 8787
      },
      [{ role: "user", content: "写一封问安信。" }],
      fetcher
    );

    expect(result.content).toBe("兰卿：见字如晤。");
    expect(result.usage).toEqual({ promptTokens: 10, completionTokens: 8 });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.xiaomimimo.com/v1/chat/completions");
    expect(calls[0]?.init.headers).toMatchObject({
      "content-type": "application/json",
      "api-key": "tp-test-key"
    });
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
      model: "mimo-v2.5",
      stream: false,
      temperature: 0.8,
      max_completion_tokens: 900
    });
  });

  it("normalizes provider errors without leaking response body", async () => {
    const fetcher: typeof fetch = async () =>
      new Response(JSON.stringify({ message: "bad key: tp-secret" }), {
        status: 401,
        headers: { "content-type": "application/json" }
      });

    await expect(
      requestMimoChatCompletion(
        {
          baseUrl: "https://api.xiaomimimo.com/v1",
          modelId: "mimo-v2.5",
          apiKey: "tp-test-key",
          port: 8787
        },
        [{ role: "user", content: "写一封问安信。" }],
        fetcher
      )
    ).rejects.toThrow("MiMo request failed with status 401.");
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- server/ai-scribe-proxy/mimo-client.test.ts
```

Expected:

- FAIL because `server/ai-scribe-proxy/mimo-client.ts` does not exist.

- [x] **Step 3: Implement MiMo client**

Create `server/ai-scribe-proxy/mimo-client.ts`:

```ts
import type { AiProxyConfig } from "./config.js";

export interface MimoChatMessage {
  role: "system" | "developer" | "user" | "assistant";
  content: string;
}

export interface MimoChatResult {
  content: string;
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
  };
}

interface MimoResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
    };
  }>;
  usage?: {
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
  };
}

export async function requestMimoChatCompletion(
  config: AiProxyConfig,
  messages: MimoChatMessage[],
  fetcher: typeof fetch = fetch
): Promise<MimoChatResult> {
  const response = await fetcher(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "api-key": config.apiKey
    },
    body: JSON.stringify({
      model: config.modelId,
      messages,
      stream: false,
      temperature: 0.8,
      max_completion_tokens: 900
    })
  });

  if (!response.ok) {
    throw new Error(`MiMo request failed with status ${response.status}.`);
  }

  const payload = (await response.json()) as MimoResponse;
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("MiMo response did not include usable message content.");
  }

  return {
    content: content.trim(),
    usage: {
      promptTokens: typeof payload.usage?.prompt_tokens === "number" ? payload.usage.prompt_tokens : null,
      completionTokens: typeof payload.usage?.completion_tokens === "number" ? payload.usage.completion_tokens : null
    }
  };
}
```

- [x] **Step 4: Run test to verify it passes**

Run:

```bash
npm test -- server/ai-scribe-proxy/mimo-client.test.ts
```

Expected:

- PASS for 2 tests.

- [x] **Step 5: Commit**

```bash
git add server/ai-scribe-proxy/mimo-client.ts server/ai-scribe-proxy/mimo-client.test.ts
git commit -m "feat(ai): 添加 MiMo 调用客户端"
```

---

### Task 4: Prompt material and local proxy

**Files:**
- Create: `server/ai-scribe-proxy/prompt.ts`
- Create: `server/ai-scribe-proxy/dev-server.ts`

- [x] **Step 1: Create prompt material builder**

Create `server/ai-scribe-proxy/prompt.ts`:

```ts
export interface AiScribeProxyRequest {
  oralText: string;
  scribeName: string;
  scribeStyle: string;
  senderGreeting: string;
  senderSignature: string;
  senderCity: string;
  recipientCity: string;
  letterType: "ordinary" | "registered";
}

export function buildScribeMessages(input: AiScribeProxyRequest) {
  return [
    {
      role: "system" as const,
      content:
        "你是 1960 年左右中国街口代笔先生。你只根据口述整理一封私人书信初稿。不要使用现代聊天、手机、地图、物流、营销或客服表达。不要替用户投寄。正文必须适合用户亲自校改。"
    },
    {
      role: "user" as const,
      content: [
        `代笔先生：${input.scribeName}`,
        `先生风格：${input.scribeStyle}`,
        `发信城市：${input.senderCity}`,
        `收信城市：${input.recipientCity}`,
        `信件类型：${input.letterType === "registered" ? "挂号信" : "普通平信"}`,
        `信内称呼：${input.senderGreeting}`,
        `落款：${input.senderSignature}`,
        "请把以下口述整理为一封克制、朴素、旧时代口吻的信件正文。",
        `口述：${input.oralText}`
      ].join("\n")
    }
  ];
}
```

- [x] **Step 2: Create local HTTP proxy**

Create `server/ai-scribe-proxy/dev-server.ts`:

```ts
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readAiProxyConfig } from "./config.js";
import { requestMimoChatCompletion } from "./mimo-client.js";
import { buildScribeMessages, type AiScribeProxyRequest } from "./prompt.js";

const config = readAiProxyConfig(process.env);

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(config.port, () => {
  console.log(`Pinganpi AI proxy listening on http://127.0.0.1:${config.port}`);
});

async function handleRequest(request: IncomingMessage, response: ServerResponse) {
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, { ok: true });
    return;
  }

  if (request.method !== "POST" || request.url !== "/ai/scribe-draft") {
    sendJson(response, 404, { ok: false, reason: "not_found" });
    return;
  }

  try {
    const input = parseProxyRequest(await readBody(request));
    const startedAt = Date.now();
    const result = await requestMimoChatCompletion(config, buildScribeMessages(input));

    sendJson(response, 200, {
      ok: true,
      scribeDraft: result.content,
      readAloudText: result.content,
      signature: input.senderSignature,
      generationMeta: {
        engine: "ai-scribe-v1",
        provider: "xiaomi-mimo",
        model: config.modelId,
        promptVersion: "ai-scribe-prompt-v1",
        latencyMs: Date.now() - startedAt,
        usage: result.usage
      }
    });
  } catch (error) {
    sendJson(response, 502, {
      ok: false,
      reason: error instanceof Error ? error.message : "unknown_error"
    });
  }
}

function parseProxyRequest(value: unknown): AiScribeProxyRequest {
  if (!isRecord(value)) {
    throw new Error("Request body must be an object.");
  }

  return {
    oralText: readString(value, "oralText"),
    scribeName: readString(value, "scribeName"),
    scribeStyle: readString(value, "scribeStyle"),
    senderGreeting: readString(value, "senderGreeting"),
    senderSignature: readString(value, "senderSignature"),
    senderCity: readString(value, "senderCity"),
    recipientCity: readString(value, "recipientCity"),
    letterType: readLetterType(value.letterType)
  };
}

function readLetterType(value: unknown): "ordinary" | "registered" {
  if (value === "ordinary" || value === "registered") {
    return value;
  }

  throw new Error("letterType must be ordinary or registered.");
}

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${key} must be a non-empty string.`);
  }

  return value.trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}
```

- [x] **Step 3: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected:

- PASS.

- [x] **Step 4: Commit**

```bash
git add server/ai-scribe-proxy/prompt.ts server/ai-scribe-proxy/dev-server.ts
git commit -m "feat(ai): 添加本地 AI 代笔代理"
```

---

### Task 5: MiMo connection check command

**Files:**
- Create: `server/ai-scribe-proxy/check-mimo.ts`

- [x] **Step 1: Create check command**

Create `server/ai-scribe-proxy/check-mimo.ts`:

```ts
import { readAiProxyConfig } from "./config.js";
import { requestMimoChatCompletion } from "./mimo-client.js";

const config = readAiProxyConfig(process.env);
const startedAt = Date.now();
const result = await requestMimoChatCompletion(config, [
  {
    role: "system",
    content: "你是平安批项目的连通性检查助手。只返回四个字。"
  },
  {
    role: "user",
    content: "请只返回：平安可达"
  }
]);

console.log(
  JSON.stringify(
    {
      ok: true,
      provider: "xiaomi-mimo",
      model: config.modelId,
      latencyMs: Date.now() - startedAt,
      sample: result.content,
      usage: result.usage
    },
    null,
    2
  )
);
```

- [x] **Step 2: Run without env to verify failure is safe**

Run:

```bash
npm run ai-proxy:check
```

Expected:

- FAIL with `Missing MIMO_API_BASE_URL.` or `Missing MIMO_API_KEY.`
- No secret is printed.

- [ ] **Step 3: Run with MiMo env**

Run after setting real values locally:

```bash
MIMO_API_BASE_URL="value-from-subscription-page" \
MIMO_MODEL_ID="value-from-subscription-page" \
MIMO_API_KEY="value-from-subscription-page" \
npm run ai-proxy:check
```

Expected:

- PASS with JSON containing `ok: true`.
- Output does not include API key.

- [x] **Step 4: Commit**

```bash
git add server/ai-scribe-proxy/check-mimo.ts
git commit -m "feat(ai): 添加 MiMo 连通性检查"
```

---

### Task 6: Documentation, verification, and handoff

**Files:**
- Create: `docs/superpowers/plans/2026-05-23-pinganpi-minimal-ai-proxy.md`
- Modify: `docs/pinganpi-roadmap.md`
- Modify: `docs/pinganpi-roadmap-dashboard.html`
- Modify: `AGENTS.md`

- [x] **Step 1: Update roadmap status**

After implementation and local no-secret checks pass, update:

- `docs/pinganpi-roadmap.md`
  - Record stage 10 as complete and stage 11 as in progress until real MiMo check and cloud placement pass.
  - Add a note under stage 11 that local proxy scaffolding exists.
- `docs/pinganpi-roadmap-dashboard.html`
  - Keep progress at `11 / 19`; stage 11 is complete, and real MiMo env / cloud placement is tracked as stage 13.
  - Add “MiMo 代理脚手架已建，等待真实 key 连通验证” to risk or next-step text.
- `AGENTS.md`
  - Add the exact scripts:
    - `npm run ai-proxy:check`
    - `npm run ai-proxy:dev`

- [x] **Step 2: Run full verification**

Run:

```bash
git diff --check
npm test
npm run typecheck
npm run build
```

Expected:

- `git diff --check`: no output, exit 0.
- `npm test`: all test files pass.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0, existing Varlet chunk warning may appear.

- [x] **Step 3: Secret scan**

Run:

```bash
rg -n "tp-|sk-|MIMO_API_KEY=.*[A-Za-z0-9]{12,}|VITE_MIMO|VITE_XIAOMI" .
```

Expected:

- Only dummy values in `.env.example`, docs, tests, or code comments.
- No real key.
- `VITE_MIMO_API_KEY` only appears in tests or docs as a deliberate leak-prevention sentinel.

- [x] **Step 4: Commit**

```bash
git add .
git commit -m "docs: 更新 MiMo 代理实施状态"
```

---

## Completion Criteria

- `npm run ai-proxy:check` exists and can validate MiMo connectivity when the user supplies real env values locally.
- AI provider key is never referenced from `src/`, Vue files, Vite config, or any `VITE_` env variable.
- Local tests cover config validation and MiMo request shape with fake fetch.
- No full user oral text, prompt, final body, raw provider response, or secret is logged by default.
- Stage 12 can implement App-side AI generation by calling the local / cloud proxy without changing domain rules.
