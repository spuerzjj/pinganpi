import { describe, expect, it } from "vitest";
import { createHttpAiScribeAdapter, AiScribeDraftError } from "./ai-scribe-adapter.js";
import { createDefaultAppState, settleAppState } from "./app-state.js";

const now = new Date("2026-05-23T04:00:00.000Z");
const state = settleAppState(createDefaultAppState(), now).state;
const sender = state.members.find((member) => member.id === state.currentMemberId);
const recipient = state.members.find((member) => member.id === state.recipientMemberId);
const scribe = state.scribes.find((candidate) => candidate.id === "scribe-xu");

if (sender === undefined || recipient === undefined || scribe === undefined) {
  throw new Error("Missing test fixtures");
}

describe("AI scribe adapter", () => {
  const draftInput = {
    oralText: "请替我问她近来安好。",
    scribe,
    sender,
    recipient,
    senderCity: sender.city,
    recipientCity: recipient.city,
    letterType: "ordinary" as const,
    sceneTags: ["问安"]
  };

  it("calls the local proxy without provider keys", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const adapter = createHttpAiScribeAdapter({
      proxyUrl: "http://127.0.0.1:8787",
      fetcher: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });

        return new Response(
          JSON.stringify({
            ok: true,
            scribeDraft: "兰卿：见字如晤。近来安好否。",
            readAloudText: "兰卿：见字如晤。近来安好否。",
            signature: "阿平",
            generationMeta: {
              engine: "ai-scribe-v1",
              provider: "xiaomi-mimo",
              model: "mimo-v2.5",
              promptVersion: "ai-scribe-prompt-v1",
              latencyMs: 1234,
              usage: { promptTokens: 21, completionTokens: 13 }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
    });

    const result = await adapter.generateDraft(draftInput);

    expect(result).toMatchObject({
      oralText: "请替我问她近来安好。",
      scribeDraft: "兰卿：见字如晤。近来安好否。",
      readAloudText: "兰卿：见字如晤。近来安好否。",
      signature: "阿平",
      draftSource: "ai",
      generationMeta: {
        engine: "ai-scribe-v1",
        provider: "xiaomi-mimo",
        model: "mimo-v2.5",
        promptVersion: "ai-scribe-prompt-v1",
        scribeId: "scribe-xu",
        sceneTags: ["问安"],
        letterType: "ordinary",
        senderCity: "杭州",
        recipientCity: "西安",
        latencyMs: 1234
      }
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://127.0.0.1:8787/ai/scribe-draft");
    expect(calls[0]?.init.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({
      oralText: "请替我问她近来安好。",
      scribeName: "许鹤年",
      scribeStyle: "老先生",
      senderGreeting: "兰卿",
      senderSignature: "明远",
      senderCity: "杭州",
      recipientCity: "西安",
      letterType: "ordinary"
    });
    expect(String(calls[0]?.init.body)).not.toContain("MIMO_API_KEY");
  });

  it("streams progressive draft text and resolves the completed AI draft", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const adapter = createHttpAiScribeAdapter({
      proxyUrl: "http://127.0.0.1:8787",
      fetcher: async (url, init) => {
        calls.push({ url: String(url), init: init ?? {} });

        return new Response(
          [
            'event: delta\ndata: {"delta":"兰卿：","text":"兰卿："}',
            'event: delta\ndata: {"delta":"见字如晤。","text":"兰卿：见字如晤。"}',
            'event: done\ndata: {"ok":true,"scribeDraft":"兰卿：见字如晤。","readAloudText":"兰卿：见字如晤。","signature":"阿平","generationMeta":{"engine":"ai-scribe-v1","provider":"xiaomi-mimo","model":"mimo-v2.5","promptVersion":"ai-scribe-prompt-v1","latencyMs":1234}}',
            ""
          ].join("\n\n"),
          { status: 200, headers: { "content-type": "text/event-stream" } }
        );
      }
    });

    const progressiveText: string[] = [];
    const result = await adapter.generateDraftStream?.(draftInput, {
      onDelta: (_delta, text) => progressiveText.push(text)
    });

    expect(progressiveText).toEqual(["兰卿：", "兰卿：见字如晤。"]);
    expect(result).toMatchObject({
      oralText: "请替我问她近来安好。",
      scribeDraft: "兰卿：见字如晤。",
      readAloudText: "兰卿：见字如晤。",
      signature: "阿平",
      draftSource: "ai",
      generationMeta: {
        provider: "xiaomi-mimo",
        model: "mimo-v2.5",
        scribeId: "scribe-xu",
        sceneTags: ["问安"],
        letterType: "ordinary"
      }
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("http://127.0.0.1:8787/ai/scribe-draft/stream");
    expect(calls[0]?.init.headers).toEqual({ "content-type": "application/json" });
    expect(String(calls[0]?.init.body)).not.toContain("MIMO_API_KEY");
  });

  it("normalizes stream error events", async () => {
    const adapter = createHttpAiScribeAdapter({
      proxyUrl: "http://127.0.0.1:8787",
      fetcher: async () =>
        new Response('event: error\ndata: {"ok":false,"reason":"provider_error","message":"AI provider request failed."}\n\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" }
        })
    });

    await expect(adapter.generateDraftStream?.(draftInput)).rejects.toMatchObject({
      code: "provider_error",
      message: "AI provider request failed."
    });
  });

  it("rejects streams that close before the done event", async () => {
    const adapter = createHttpAiScribeAdapter({
      proxyUrl: "http://127.0.0.1:8787",
      fetcher: async () =>
        new Response('event: delta\ndata: {"delta":"兰卿：","text":"兰卿："}\n\n', {
          status: 200,
          headers: { "content-type": "text/event-stream" }
        })
    });

    await expect(adapter.generateDraftStream?.(draftInput)).rejects.toMatchObject({
      code: "invalid_response"
    });
  });

  it("normalizes proxy failures", async () => {
    const adapter = createHttpAiScribeAdapter({
      proxyUrl: "http://127.0.0.1:8787/",
      fetcher: async () =>
        new Response(
          JSON.stringify({
            ok: false,
            reason: "provider_error",
            message: "AI provider request failed."
          }),
          { status: 502, headers: { "content-type": "application/json" } }
        )
    });

    await expect(
      adapter.generateDraft(draftInput)
    ).rejects.toMatchObject({
      code: "provider_error",
      message: "AI provider request failed."
    });
  });

  it("normalizes network failures and invalid responses", async () => {
    const networkAdapter = createHttpAiScribeAdapter({
      proxyUrl: "http://127.0.0.1:8787",
      fetcher: async () => {
        throw new TypeError("fetch failed");
      }
    });

    await expect(
      networkAdapter.generateDraft(draftInput)
    ).rejects.toBeInstanceOf(AiScribeDraftError);

    const invalidAdapter = createHttpAiScribeAdapter({
      proxyUrl: "http://127.0.0.1:8787",
      fetcher: async () => new Response(JSON.stringify({ ok: true, scribeDraft: "" }), { status: 200 })
    });

    await expect(
      invalidAdapter.generateDraft(draftInput)
    ).rejects.toMatchObject({
      code: "invalid_response"
    });
  });
});
