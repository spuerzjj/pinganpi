import { access, readFile } from "node:fs/promises";
import { join } from "node:path";

interface StructureCheck {
  label: string;
  path: string;
}

interface JsonRecord {
  [key: string]: unknown;
}

export interface ProjectStructureAuditResult {
  ok: boolean;
  errors: string[];
}

const requiredPaths: StructureCheck[] = [
  { label: "小程序主线目录", path: "apps/miniprogram" },
  { label: "旧 App 归档目录", path: "apps/legacy-capacitor" },
  { label: "共享领域真实实现", path: "packages/domain/src" },
  { label: "小程序领域副本", path: "apps/miniprogram/shared/domain" },
  { label: "小程序云函数入口", path: "services/miniprogram-functions" },
  { label: "账号关系服务", path: "services/account-pair" },
  { label: "AI 起稿服务", path: "services/ai-scribe-proxy" },
  { label: "同步服务", path: "services/sync-proxy" },
  { label: "工具脚本目录", path: "tools/scripts" },
  { label: "Roadmap Viewer", path: "tools/roadmap-viewer/src" },
  { label: "详细路线图", path: "docs/pinganpi-roadmap.md" },
  { label: "多 Agent 协作规则", path: "docs/agent-collaboration.md" },
  { label: "Capacitor 根路由配置", path: "capacitor.config.ts" },
];

const requiredPackageScripts = [
  "miniprogram:check",
  "miniprogram:sync-shared",
  "cloudbase:build:miniprogram",
  "cloudbase:deploy:miniprogram",
  "cloudbase:smoke:miniprogram",
  "roadmap:dev",
  "roadmap:build",
  "structure:audit",
  "cap:sync",
  "cap:doctor",
  "cap:open:ios",
  "cap:open:android",
] as const;

const forbiddenRootPaths = [
  { path: "src", message: "旧 Vue App 源码仍在根目录" },
  { path: "android", message: "旧 Android 工程仍在根目录" },
  { path: "ios", message: "旧 iOS 工程仍在根目录" },
  { path: "miniprogram", message: "小程序工程仍在根目录" },
  { path: "server", message: "服务端模块仍在根目录" },
  { path: "scripts", message: "自动化脚本仍在根目录" },
  { path: "shared", message: "共享领域仍在根目录" },
  { path: "roadmap-viewer", message: "Roadmap Viewer 仍在根目录" },
  { path: "index.html", message: "旧 Vue App 入口仍在根目录" },
  { path: "vite.config.ts", message: "旧 Vue App Vite 配置仍在根目录" },
] as const;

const requiredGitignoreEntries = [
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
] as const;

const miniprogramFunctionFiles = [
  "services/miniprogram-functions/pinganpi-account.ts",
  "services/miniprogram-functions/pinganpi-ai.ts",
  "services/miniprogram-functions/pinganpi-pair.ts",
  "services/miniprogram-functions/pinganpi-sync.ts",
] as const;

export async function auditProjectStructure(rootDir = process.cwd()): Promise<ProjectStructureAuditResult> {
  const errors: string[] = [];

  await checkRequiredPaths(rootDir, errors);
  await checkForbiddenRootPaths(rootDir, errors);
  await checkAbsentPath(rootDir, "docs/pinganpi-roadmap-dashboard.html", "旧静态 roadmap 页面仍存在", errors);
  await checkAbsentPath(rootDir, "docs/roadmap-data.json", "roadmap 结构化数据仍放在 docs 根目录", errors);
  await checkRoadmapViewer(rootDir, errors);
  await checkPackageScripts(rootDir, errors);
  await checkGitignore(rootDir, errors);
  await checkTypescriptConfig(rootDir, errors);
  await checkCapacitorConfig(rootDir, errors);
  await checkMiniprogramProjectConfig(rootDir, errors);
  await checkMiniprogramFunctionEntries(rootDir, errors);

  return { ok: errors.length === 0, errors };
}

async function main(): Promise<void> {
  const result = await auditProjectStructure();

  if (!result.ok) {
    console.error("Project structure audit failed:");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log("Project structure audit passed.");
}

async function checkRequiredPaths(rootDir: string, errors: string[]): Promise<void> {
  for (const entry of requiredPaths) {
    if (!(await pathExists(rootDir, entry.path))) {
      errors.push(`${entry.label} 缺失：${entry.path}`);
    }
  }
}

async function checkAbsentPath(rootDir: string, path: string, message: string, errors: string[]): Promise<void> {
  if (await pathExists(rootDir, path)) {
    errors.push(`${message}：${path}`);
  }
}

async function checkForbiddenRootPaths(rootDir: string, errors: string[]): Promise<void> {
  for (const entry of forbiddenRootPaths) {
    if (await pathExists(rootDir, entry.path)) {
      errors.push(`${entry.message}：${entry.path}`);
    }
  }
}

async function checkRoadmapViewer(rootDir: string, errors: string[]): Promise<void> {
  if (!(await pathExists(rootDir, "tools/roadmap-viewer/src/roadmap-data.json"))) {
    errors.push("Roadmap Viewer 数据源缺失：tools/roadmap-viewer/src/roadmap-data.json");
  }

  const appVue = await readTextIfExists(rootDir, "tools/roadmap-viewer/src/App.vue");
  if (appVue === undefined) {
    errors.push("Roadmap Viewer 入口缺失：tools/roadmap-viewer/src/App.vue");
    return;
  }

  if (!appVue.includes("./roadmap-data.json")) {
    errors.push("Roadmap Viewer 未从 ./roadmap-data.json 读取结构化数据");
  }

  if (appVue.includes("../../docs/roadmap-data.json") || appVue.includes("../docs/roadmap-data.json")) {
    errors.push("Roadmap Viewer 仍引用 docs 下的旧 roadmap 数据源");
  }
}

async function checkPackageScripts(rootDir: string, errors: string[]): Promise<void> {
  const packageJson = await readJson(rootDir, "package.json", errors);
  const scripts = readRecord(packageJson?.scripts);

  for (const scriptName of requiredPackageScripts) {
    if (typeof scripts[scriptName] !== "string" || scripts[scriptName].trim().length === 0) {
      errors.push(`package.json 缺少 npm script：${scriptName}`);
    }
  }
}

async function checkGitignore(rootDir: string, errors: string[]): Promise<void> {
  const gitignore = await readTextIfExists(rootDir, ".gitignore");
  if (gitignore === undefined) {
    errors.push(".gitignore 缺失");
    return;
  }

  const lines = new Set(gitignore.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  for (const entry of requiredGitignoreEntries) {
    if (!lines.has(entry)) {
      errors.push(`.gitignore 缺少规则：${entry}`);
    }
  }
}

async function checkTypescriptConfig(rootDir: string, errors: string[]): Promise<void> {
  const rootTsconfig = await readJson(rootDir, "tsconfig.json", errors);
  const rootIncludes = readStringArray(rootTsconfig?.include);
  for (const include of ["services/**/*.ts", "packages/**/*.ts"]) {
    if (!rootIncludes.includes(include)) {
      errors.push(`tsconfig.json include 缺少：${include}`);
    }
  }

  const miniprogramTsconfig = await readJson(rootDir, "tsconfig.miniprogram.json", errors);
  if (miniprogramTsconfig?.extends !== "./tsconfig.json") {
    errors.push("tsconfig.miniprogram.json 必须 extends ./tsconfig.json");
  }

  const miniprogramIncludes = readStringArray(miniprogramTsconfig?.include);
  for (const include of ["apps/miniprogram/**/*.ts", "apps/miniprogram/**/*.d.ts"]) {
    if (!miniprogramIncludes.includes(include)) {
      errors.push(`tsconfig.miniprogram.json include 缺少：${include}`);
    }
  }
}

async function checkCapacitorConfig(rootDir: string, errors: string[]): Promise<void> {
  const config = await readTextIfExists(rootDir, "capacitor.config.ts");
  if (config === undefined) {
    errors.push("Capacitor 根路由配置缺失：capacitor.config.ts");
    return;
  }

  for (const requiredText of [
    'webDir: "apps/legacy-capacitor/dist"',
    'path: "apps/legacy-capacitor/android"',
    'path: "apps/legacy-capacitor/ios"',
  ]) {
    if (!config.includes(requiredText)) {
      errors.push(`capacitor.config.ts 未指向旧 App 归档路径：${requiredText}`);
    }
  }
}

async function checkMiniprogramProjectConfig(rootDir: string, errors: string[]): Promise<void> {
  const projectConfig = await readJson(rootDir, "apps/miniprogram/project.config.json", errors);
  if (projectConfig?.compileType !== "miniprogram") {
    errors.push("apps/miniprogram/project.config.json compileType 必须是 miniprogram");
  }

  if (projectConfig?.miniprogramRoot !== "./") {
    errors.push("apps/miniprogram/project.config.json miniprogramRoot 必须是 ./");
  }

  const compilerPlugins = readStringArray(readRecord(projectConfig?.setting).useCompilerPlugins);
  if (!compilerPlugins.includes("typescript")) {
    errors.push("apps/miniprogram/project.config.json 必须启用 TypeScript 编译插件");
  }
}

async function checkMiniprogramFunctionEntries(rootDir: string, errors: string[]): Promise<void> {
  for (const path of miniprogramFunctionFiles) {
    if (!(await pathExists(rootDir, path))) {
      errors.push(`小程序云函数入口缺失：${path}`);
    }
  }
}

async function readJson(rootDir: string, path: string, errors: string[]): Promise<JsonRecord | undefined> {
  const text = await readTextIfExists(rootDir, path);
  if (text === undefined) {
    errors.push(`JSON 文件缺失：${path}`);
    return undefined;
  }

  try {
    return JSON.parse(text) as JsonRecord;
  } catch (error) {
    errors.push(`JSON 文件无法解析：${path}（${error instanceof Error ? error.message : String(error)}）`);
    return undefined;
  }
}

async function readTextIfExists(rootDir: string, path: string): Promise<string | undefined> {
  try {
    return await readFile(join(rootDir, path), "utf8");
  } catch {
    return undefined;
  }
}

async function pathExists(rootDir: string, path: string): Promise<boolean> {
  try {
    await access(join(rootDir, path));
    return true;
  } catch {
    return false;
  }
}

function readRecord(value: unknown): JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : {};
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}
