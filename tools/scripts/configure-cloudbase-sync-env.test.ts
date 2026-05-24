import { describe, expect, it } from "vitest";
import {
  buildCloudBaseConfigWithFunctionEnv,
  buildSyncProxyEnvVariables,
  redactSecretValues
} from "./configure-cloudbase-sync-env.js";

describe("configure cloudbase sync env helpers", () => {
  it("builds sync-proxy env variables from shell env", () => {
    const variables = buildSyncProxyEnvVariables({
      PINGANPI_SYNC_MEMBER_TOKENS: '{"household-main":{"member-zhou":"secret-token"}}'
    });

    expect(variables).toEqual({
      PINGANPI_SYNC_SNAPSHOT_COLLECTION: "pinganpi_sync_snapshots",
      PINGANPI_SYNC_MEMBER_TOKENS_B64: Buffer.from(
        '{"household-main":{"member-zhou":"secret-token"}}',
        "utf8"
      ).toString("base64")
    });
  });

  it("requires member tokens so sync requests fail closed unless configured intentionally", () => {
    expect(() => buildSyncProxyEnvVariables({})).toThrow("Missing PINGANPI_SYNC_MEMBER_TOKENS.");
  });

  it("adds env variables only to the sync-proxy function config", () => {
    const config = buildCloudBaseConfigWithFunctionEnv(
      {
        envId: "{{env.CLOUDBASE_ENV_ID}}",
        functions: [
          { name: "ai-scribe-proxy", envVariables: { EXISTING: "keep" } },
          { name: "sync-proxy" }
        ]
      },
      {
        envId: "pinganpi-d7gml1f6sbcc172ea",
        functionName: "sync-proxy",
        envVariables: {
          PINGANPI_SYNC_MEMBER_TOKENS: '{"household-main":{"member-zhou":"secret-token"}}'
        }
      }
    );

    expect(config.envId).toBe("pinganpi-d7gml1f6sbcc172ea");
    expect(config.functions).toEqual([
      { name: "ai-scribe-proxy", envVariables: { EXISTING: "keep" } },
      {
        name: "sync-proxy",
        envVariables: {
          PINGANPI_SYNC_MEMBER_TOKENS: '{"household-main":{"member-zhou":"secret-token"}}'
        }
      }
    ]);
  });

  it("redacts configured secret values from CloudBase CLI output", () => {
    const output = redactSecretValues("updated secret-token in sync-proxy", ["secret-token"]);

    expect(output).toBe("updated [redacted] in sync-proxy");
  });
});
