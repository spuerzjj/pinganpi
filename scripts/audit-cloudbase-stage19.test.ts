import { describe, expect, it } from "vitest";
import {
  createFunctionAudit,
  createUsageAudit,
  extractJsonObject,
  redactEnvValue
} from "./audit-cloudbase-stage19.js";

describe("stage 19 cloudbase audit", () => {
  it("redacts sensitive cloud function environment values", () => {
    const audit = createFunctionAudit({
      data: {
        FunctionName: "ai-scribe-proxy",
        Runtime: "Nodejs20.19",
        Status: "Active",
        AvailableStatus: "Available",
        Role: "TCB_QcsRole",
        Type: "HTTP",
        VpcConfig: {
          VpcId: "",
          SubnetId: ""
        },
        Triggers: [],
        PublicNetConfig: {
          PublicNetStatus: "ENABLE"
        },
        Environment: {
          Variables: [
            {
              Key: "MIMO_API_KEY",
              Value: "sk-real-secret"
            },
            {
              Key: "PINGANPI_SYNC_MEMBER_TOKENS_B64",
              Value: "base64-secret"
            },
            {
              Key: "MIMO_MODEL_ID",
              Value: "mimo-v2.5-pro"
            }
          ]
        }
      }
    });

    expect(audit.env).toEqual([
      { key: "MIMO_API_KEY", value: "<redacted>" },
      { key: "PINGANPI_SYNC_MEMBER_TOKENS_B64", value: "<redacted>" },
      { key: "MIMO_MODEL_ID", value: "mimo-v2.5-pro" }
    ]);
    expect(JSON.stringify(audit)).not.toContain("sk-real-secret");
    expect(JSON.stringify(audit)).not.toContain("base64-secret");
  });

  it("summarizes usage without losing current credit numbers", () => {
    const audit = createUsageAudit({
      data: {
        envId: "pinganpi-d7gml1f6sbcc172ea",
        billingCycle: {
          startDate: "2026-05-23",
          endDate: "2026-06-23"
        },
        summary: {
          totalCredits: 3000,
          usedCredits: 1.67
        },
        usages: [
          { moduleName: "Cloud function", creditsValue: 0.98 },
          { moduleName: "NoSQL Database", creditsValue: 0.52 }
        ]
      }
    });

    expect(audit).toEqual({
      envId: "pinganpi-d7gml1f6sbcc172ea",
      billingCycle: "2026-05-23 ~ 2026-06-23",
      totalCredits: 3000,
      usedCredits: 1.67,
      modules: [
        { moduleName: "Cloud function", creditsValue: 0.98 },
        { moduleName: "NoSQL Database", creditsValue: 0.52 }
      ]
    });
  });

  it("extracts JSON from CloudBase CLI output with progress lines", () => {
    const parsed = extractJsonObject("- Loading data...\n{\"data\":{\"ok\":true}}\n");

    expect(parsed).toEqual({ data: { ok: true } });
  });

  it("marks empty non-sensitive values without printing undefined", () => {
    expect(redactEnvValue("MIMO_MODEL_ID", undefined)).toBe("<empty>");
    expect(redactEnvValue("MIMO_MODEL_ID", "")).toBe("<empty>");
  });

  it("does not redact non-secret token count guards", () => {
    expect(redactEnvValue("MIMO_MAX_COMPLETION_TOKENS", "900")).toBe("900");
  });
});
