import { readAiProxyConfig } from "./config.js";
import { requestMimoChatCompletion } from "./mimo-client.js";

try {
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
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        provider: "xiaomi-mimo",
        reason: error instanceof Error ? error.message : "unknown_error"
      },
      null,
      2
    )
  );
  process.exitCode = 1;
}
