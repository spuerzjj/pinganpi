import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = resolve(import.meta.dirname, "../..");
const functionNames = ["pinganpi-ai", "pinganpi-sync", "pinganpi-account", "pinganpi-pair"];

describe("build CloudBase miniprogram functions", () => {
  it("writes an explicit 30 second timeout for every event function", () => {
    execFileSync(process.execPath, ["--import", "tsx", "tools/scripts/build-cloudbase-miniprogram-functions.ts"], {
      cwd: projectRoot,
      stdio: "pipe",
    });

    for (const functionName of functionNames) {
      const packageJson = JSON.parse(
        readFileSync(resolve(projectRoot, "cloudbase/functions", functionName, "package.json"), "utf8"),
      ) as Record<string, unknown>;

      expect(packageJson["cloudfunction-config"], functionName).toMatchObject({
        timeout: 30,
      });
    }
  });
});
