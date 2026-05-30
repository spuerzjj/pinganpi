import { createRequire } from "node:module";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const projectRoot = resolve(import.meta.dirname, "../..");
const script = require(resolve(projectRoot, "tools/scripts/init-miniprogram-cloudbase.cjs")) as {
  buildDevtoolsDeployArgs(input: {
    cliPath: string;
    envId: string;
    functionPath: string;
    projectPath: string;
    devtoolsPort: string;
  }): string[];
  buildInitFunctionSource(input: {
    token: string;
    collections: string[];
  }): string;
  isCreatingStateDeployFailure(output: string): boolean;
  isSuccessfulDeployOutput(output: string): boolean;
  requiredCollections: string[];
};

describe("miniprogram CloudBase init script", () => {
  it("initializes all account, pair and sync collections explicitly", () => {
    expect(script.requiredCollections).toEqual([
      "pinganpi_accounts",
      "pinganpi_households",
      "pinganpi_members",
      "pinganpi_invites",
      "pinganpi_sync_snapshots",
    ]);
  });

  it("generates a token-guarded maintenance function instead of changing business functions", () => {
    const source = script.buildInitFunctionSource({
      token: "init-token-test",
      collections: script.requiredCollections,
    });

    expect(source).toContain("init-token-test");
    expect(source).toContain("unauthorized");
    expect(source).toContain("createCollection");
    expect(source).toContain("pinganpi_sync_snapshots");
  });

  it("deploys only the maintenance function through WeChat DevTools CLI", () => {
    expect(
      script.buildDevtoolsDeployArgs({
        cliPath: "/Applications/wechatwebdevtools.app/Contents/MacOS/cli",
        envId: "cloud1-test",
        functionPath: "/repo/cloudbase/functions/pinganpi-init-db",
        projectPath: "/repo/apps/miniprogram",
        devtoolsPort: "24248",
      }),
    ).toEqual([
      "cloud",
      "functions",
      "deploy",
      "--env",
      "cloud1-test",
      "--paths",
      "/repo/cloudbase/functions/pinganpi-init-db",
      "--project",
      "/repo/apps/miniprogram",
      "--port",
      "24248",
      "--lang",
      "zh",
    ]);
  });

  it("detects WeChat cloud function creating-state deploy failures for retry", () => {
    expect(script.isCreatingStateDeployFailure("当前函数处于Creating状态，无法进行此操作，请稍后重试。")).toBe(
      true,
    );
    expect(script.isSuccessfulDeployOutput("│ pinganpi-init-db │  true   │")).toBe(true);
    expect(script.isSuccessfulDeployOutput("│ pinganpi-init-db │  false  │")).toBe(false);
  });
});
