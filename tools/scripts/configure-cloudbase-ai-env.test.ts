import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");

describe("configure CloudBase AI env script", () => {
  it("can target the miniprogram event AI function without duplicating secret logic", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(projectRoot, "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
    };
    const scriptSource = readFileSync(
      resolve(projectRoot, "tools/scripts/configure-cloudbase-ai-env.ts"),
      "utf8",
    );

    expect(scriptSource).toContain("PINGANPI_CLOUDBASE_AI_FUNCTION_NAME");
    expect(packageJson.scripts["cloudbase:configure:miniprogram-ai-env"]).toBe(
      "PINGANPI_CLOUDBASE_AI_FUNCTION_NAME=pinganpi-ai node --env-file-if-exists=.env.ai.local --import tsx tools/scripts/configure-cloudbase-ai-env.ts",
    );
  });
});
