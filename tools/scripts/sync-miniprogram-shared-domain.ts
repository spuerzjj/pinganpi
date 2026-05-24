import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export interface SyncMiniprogramSharedDomainOptions {
  sourceDir?: string;
  targetDir?: string;
  checkOnly?: boolean;
}

export interface SyncMiniprogramSharedDomainResult {
  ok: boolean;
  errors: string[];
  copied: string[];
}

export async function syncMiniprogramSharedDomain(
  options: SyncMiniprogramSharedDomainOptions = {},
): Promise<SyncMiniprogramSharedDomainResult> {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
  const sourceDir = options.sourceDir ?? join(repoRoot, "packages", "domain", "src");
  const targetDir = options.targetDir ?? join(repoRoot, "apps", "miniprogram", "shared", "domain");
  const checkOnly = options.checkOnly ?? false;
  const errors: string[] = [];
  const copied: string[] = [];
  const sourceFiles = await listTypeScriptFiles(sourceDir);

  if (sourceFiles === undefined) {
    return {
      ok: false,
      errors: [`源目录缺失：${formatDirPath(sourceDir, "packages")}`],
      copied,
    };
  }

  if (sourceFiles.length === 0) {
    return {
      ok: false,
      errors: [`源目录没有 TypeScript 文件：${formatDirPath(sourceDir, "packages")}`],
      copied,
    };
  }

  if (!checkOnly) {
    await mkdir(targetDir, { recursive: true });
  }

  for (const file of sourceFiles) {
    const sourcePath = join(sourceDir, file);
    const targetPath = join(targetDir, file);
    const sourceContent = await readText(sourcePath);

    if (sourceContent === undefined) {
      errors.push(`源文件缺失：${formatSourcePath(sourceDir, file)}`);
      continue;
    }

    if (checkOnly) {
      const targetContent = await readText(targetPath);

      if (targetContent === undefined) {
        errors.push(`缺少副本：${formatTargetPath(targetDir, file)}`);
      } else if (targetContent !== sourceContent) {
        errors.push(`内容不一致：${formatTargetPath(targetDir, file)}`);
      }

      continue;
    }

    await writeFile(targetPath, sourceContent, "utf8");
    copied.push(formatTargetPath(targetDir, file));
  }

  const extras = await findExtraTargetFiles(targetDir, sourceFiles);
  for (const file of extras) {
    errors.push(`多余文件：${formatTargetPath(targetDir, file)}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    copied,
  };
}

async function readText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function listTypeScriptFiles(dir: string): Promise<string[] | undefined> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".ts"))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function findExtraTargetFiles(targetDir: string, sourceFiles: readonly string[]): Promise<string[]> {
  const targetFiles = await listTypeScriptFiles(targetDir);
  if (targetFiles === undefined) {
    return [];
  }

  const expected = new Set<string>(sourceFiles);
  return targetFiles.filter((file) => !expected.has(file));
}

function formatSourcePath(sourceDir: string, file: string): string {
  return formatRepoLikePath(sourceDir, file, "packages");
}

function formatTargetPath(targetDir: string, file: string): string {
  return formatRepoLikePath(targetDir, file, "apps");
}

function formatDirPath(dir: string, anchor: string): string {
  return formatRepoLikePath(dir, "", anchor).replace(/\/$/, "");
}

function formatRepoLikePath(dir: string, file: string, anchor: string): string {
  const parts = dir.split(sep);
  const anchorIndex = parts.lastIndexOf(anchor);

  if (anchorIndex >= 0) {
    return [...parts.slice(anchorIndex), file].join("/");
  }

  return relative(process.cwd(), join(dir, file)).split(sep).join("/");
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

async function main(): Promise<void> {
  const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--check");

  if (unknownArgs.length > 0) {
    console.error(`未知参数：${unknownArgs.join(" ")}`);
    process.exitCode = 2;
    return;
  }

  const result = await syncMiniprogramSharedDomain({
    checkOnly: process.argv.includes("--check"),
  });

  if (!result.ok) {
    console.error("小程序共享领域副本检查失败：");
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  if (process.argv.includes("--check")) {
    console.log("小程序共享领域副本与 packages/domain/src 一致。");
    return;
  }

  console.log(`已同步 ${result.copied.length} 个共享领域文件到 apps/miniprogram/shared/domain。`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  void main();
}
