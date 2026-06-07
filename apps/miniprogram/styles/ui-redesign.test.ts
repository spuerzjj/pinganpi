import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const projectRoot = process.cwd();
const miniprogramRoot = join(projectRoot, "apps", "miniprogram");

function readMiniprogramFile(relativePath: string): string {
  return readFileSync(join(miniprogramRoot, relativePath), "utf-8");
}

describe("miniprogram non-retro UI redesign", () => {
  test("uses quiet modern design tokens instead of retro paper and seal tokens", () => {
    const tokens = readMiniprogramFile(join("styles", "tokens.wxss"));

    expect(tokens).toContain("--app-bg");
    expect(tokens).toContain("--surface-raised");
    expect(tokens).toContain("--text-primary");
    expect(tokens).toContain("--accent");
    expect(tokens).toContain("--radius-md");
    expect(tokens).not.toContain("--paper");
    expect(tokens).not.toContain("--seal");
  });

  test("removes vintage ledger component class names from miniprogram UI files", () => {
    const uiFiles = [
      "app.wxss",
      "pages/account/index.wxml",
      "pages/account/index.wxss",
      "pages/pair/index.wxml",
      "pages/pair/index.wxss",
      "pages/today/index.wxml",
      "pages/write/index.wxml",
      "pages/write/index.wxss",
      "pages/scribes/index.wxml",
      "pages/wallet/index.wxml",
      "pages/mailbox/index.wxml",
      "pages/archive/index.wxml",
    ];
    const combined = uiFiles.map(readMiniprogramFile).join("\n");

    expect(combined).not.toMatch(/\barchive-panel\b/);
    expect(combined).not.toMatch(/\bstamp\b/);
    expect(combined).not.toMatch(/\bledger-button\b/);
    expect(combined).not.toMatch(/\bpaper-input\b/);
  });

  test("applies the non-retro navigation palette in app configuration", () => {
    const appConfig = JSON.parse(readMiniprogramFile("app.json")) as {
      window: { navigationBarBackgroundColor: string; backgroundColor: string };
      tabBar: { color: string; selectedColor: string; backgroundColor: string };
    };

    expect(appConfig.window.navigationBarBackgroundColor).toBe("#f7f8f5");
    expect(appConfig.window.backgroundColor).toBe("#f7f8f5");
    expect(appConfig.tabBar.backgroundColor).toBe("#ffffff");
    expect(appConfig.tabBar.selectedColor).toBe("#31543f");
    expect(appConfig.tabBar.color).toBe("#7a8378");
  });
});
