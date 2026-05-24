import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { auditProjectStructure } from "./audit-project-structure.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("project structure audit", () => {
  it("passes for the current repository structure", async () => {
    const result = await auditProjectStructure(process.cwd());

    expect(result).toEqual({ ok: true, errors: [] });
  });

  it("rejects old roadmap data locations", async () => {
    const root = await createCompliantFixture();
    await writeFile(join(root, "docs", "pinganpi-roadmap-dashboard.html"), "<!doctype html>\n", "utf8");
    await writeFile(join(root, "docs", "roadmap-data.json"), "{}\n", "utf8");

    const result = await auditProjectStructure(root);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("旧静态 roadmap 页面仍存在：docs/pinganpi-roadmap-dashboard.html");
    expect(result.errors).toContain("roadmap 结构化数据仍放在 docs 根目录：docs/roadmap-data.json");
  });

  it("rejects old root-level project directories", async () => {
    const root = await createCompliantFixture();
    await mkdir(join(root, "server"), { recursive: true });
    await mkdir(join(root, "miniprogram"), { recursive: true });
    await writeFile(join(root, "vite.config.ts"), "export default {};\n", "utf8");

    const result = await auditProjectStructure(root);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("服务端模块仍在根目录：server");
    expect(result.errors).toContain("小程序工程仍在根目录：miniprogram");
    expect(result.errors).toContain("旧 Vue App Vite 配置仍在根目录：vite.config.ts");
  });

  it("requires the WeChat TypeScript compiler plugin", async () => {
    const root = await createCompliantFixture();
    await writeJson(join(root, "apps", "miniprogram", "project.config.json"), {
      compileType: "miniprogram",
      miniprogramRoot: "./",
      setting: {
        useCompilerPlugins: [],
      },
    });

    const result = await auditProjectStructure(root);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("apps/miniprogram/project.config.json 必须启用 TypeScript 编译插件");
  });

  it("requires the root Capacitor config to route to the archived app", async () => {
    const root = await createCompliantFixture();
    await writeFile(join(root, "capacitor.config.ts"), "export default { webDir: 'dist' };\n", "utf8");

    const result = await auditProjectStructure(root);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'capacitor.config.ts 未指向旧 App 归档路径：webDir: "apps/legacy-capacitor/dist"',
    );
    expect(result.errors).toContain(
      'capacitor.config.ts 未指向旧 App 归档路径：path: "apps/legacy-capacitor/android"',
    );
  });

  it("reports missing high-level automation scripts", async () => {
    const root = await createCompliantFixture();
    await writeJson(join(root, "package.json"), {
      scripts: {
        "miniprogram:check": "echo ok",
      },
    });

    const result = await auditProjectStructure(root);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("package.json 缺少 npm script：structure:audit");
    expect(result.errors).toContain("package.json 缺少 npm script：roadmap:dev");
  });
});

async function createCompliantFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "pinganpi-structure-"));
  tempRoots.push(root);

  for (const dir of [
    "apps/miniprogram/shared/domain",
    "apps/miniprogram/config",
    "apps/legacy-capacitor/src",
    "services/miniprogram-functions",
    "services/account-pair",
    "services/ai-scribe-proxy",
    "services/sync-proxy",
    "packages/domain/src",
    "tools/scripts",
    "tools/roadmap-viewer/src",
    "docs",
  ]) {
    await mkdir(join(root, dir), { recursive: true });
  }

  await writeFile(join(root, "docs", "pinganpi-roadmap.md"), "# 平安批开发路线图\n", "utf8");
  await writeFile(join(root, "docs", "agent-collaboration.md"), "# 平安批多 Agent 协作规则\n", "utf8");
  await writeFile(
    join(root, "capacitor.config.ts"),
    [
      'export default {',
      '  webDir: "apps/legacy-capacitor/dist",',
      '  android: { path: "apps/legacy-capacitor/android" },',
      '  ios: { path: "apps/legacy-capacitor/ios" },',
      '};',
      '',
    ].join("\n"),
    "utf8",
  );
  await writeFile(join(root, "tools", "roadmap-viewer", "src", "roadmap-data.json"), "{}\n", "utf8");
  await writeFile(
    join(root, "tools", "roadmap-viewer", "src", "App.vue"),
    "import roadmapData from './roadmap-data.json';\n",
    "utf8",
  );

  await writeJson(join(root, "package.json"), {
    scripts: {
      "miniprogram:check": "echo ok",
      "miniprogram:sync-shared": "echo ok",
      "cloudbase:build:miniprogram": "echo ok",
      "cloudbase:deploy:miniprogram": "echo ok",
      "cloudbase:smoke:miniprogram": "echo ok",
      "roadmap:dev": "echo ok",
      "roadmap:build": "echo ok",
      "structure:audit": "echo ok",
      "cap:sync": "echo ok",
      "cap:doctor": "echo ok",
      "cap:open:ios": "echo ok",
      "cap:open:android": "echo ok",
    },
  });

  await writeFile(
    join(root, ".gitignore"),
    [
      ".worktrees",
      ".worktrees/",
      "node_modules/",
      "dist/",
      "apps/legacy-capacitor/dist/",
      "tools/roadmap-viewer/dist/",
      "cloudbase/functions/",
      ".env.*.local",
      ".env.ai.local",
      "apps/miniprogram/project.private.config.json",
      "apps/miniprogram/miniprogram_npm/",
      "",
    ].join("\n"),
    "utf8",
  );

  await writeJson(join(root, "tsconfig.json"), {
    include: ["services/**/*.ts", "packages/**/*.ts"],
  });

  await writeJson(join(root, "tsconfig.miniprogram.json"), {
    extends: "./tsconfig.json",
    include: ["apps/miniprogram/**/*.ts", "apps/miniprogram/**/*.d.ts"],
  });

  await writeJson(join(root, "apps", "miniprogram", "project.config.json"), {
    compileType: "miniprogram",
    miniprogramRoot: "./",
    setting: {
      useCompilerPlugins: ["typescript"],
    },
  });

  for (const file of ["pinganpi-account.ts", "pinganpi-ai.ts", "pinganpi-pair.ts", "pinganpi-sync.ts"]) {
    await writeFile(join(root, "services", "miniprogram-functions", file), "export {};\n", "utf8");
  }

  return root;
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
