import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { syncMiniprogramSharedDomain } from "./sync-miniprogram-shared-domain.js";

const domainFiles = [
  "china-calendar.ts",
  "time.ts",
  "money.ts",
  "scribes.ts",
  "wallet.ts",
  "postal.ts",
  "index.ts",
] as const;

const tempRoots: string[] = [];

async function createFixture() {
  const root = await mkdtemp(join(tmpdir(), "pinganpi-miniprogram-domain-"));
  tempRoots.push(root);

  const sourceDir = join(root, "shared", "domain");
  const targetDir = join(root, "miniprogram", "shared", "domain");
  await mkdir(sourceDir, { recursive: true });

  for (const file of domainFiles) {
    await writeFile(join(sourceDir, file), `export const ${file.replace(/[-.]/g, "_")} = "${file}";\n`, "utf8");
  }

  return { sourceDir, targetDir };
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("sync miniprogram shared domain", () => {
  it("writes shared domain copies and passes check when target matches", async () => {
    const { sourceDir, targetDir } = await createFixture();

    const writeResult = await syncMiniprogramSharedDomain({ sourceDir, targetDir, checkOnly: false });
    const checkResult = await syncMiniprogramSharedDomain({ sourceDir, targetDir, checkOnly: true });

    expect(writeResult.ok).toBe(true);
    expect(checkResult.ok).toBe(true);
    await expect(readFile(join(targetDir, "time.ts"), "utf8")).resolves.toBe(
      'export const time_ts = "time.ts";\n',
    );
  });

  it("reports missing and changed copies in check mode without writing files", async () => {
    const { sourceDir, targetDir } = await createFixture();
    await syncMiniprogramSharedDomain({ sourceDir, targetDir, checkOnly: false });
    await writeFile(join(targetDir, "time.ts"), "changed\n", "utf8");
    await rm(join(targetDir, "money.ts"));

    const result = await syncMiniprogramSharedDomain({ sourceDir, targetDir, checkOnly: true });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual([
      "缺少副本：miniprogram/shared/domain/money.ts",
      "内容不一致：miniprogram/shared/domain/time.ts",
    ]);
    await expect(readFile(join(targetDir, "time.ts"), "utf8")).resolves.toBe("changed\n");
  });

  it("reports extra TypeScript files in the target directory", async () => {
    const { sourceDir, targetDir } = await createFixture();
    await syncMiniprogramSharedDomain({ sourceDir, targetDir, checkOnly: false });
    await writeFile(join(targetDir, "extra.ts"), "export {};\n", "utf8");

    const result = await syncMiniprogramSharedDomain({ sourceDir, targetDir, checkOnly: true });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(["多余文件：miniprogram/shared/domain/extra.ts"]);
  });

  it("discovers new source TypeScript files and reports missing target copies", async () => {
    const { sourceDir, targetDir } = await createFixture();
    await syncMiniprogramSharedDomain({ sourceDir, targetDir, checkOnly: false });
    await writeFile(join(sourceDir, "new-helper.ts"), "export const newHelper = true;\n", "utf8");

    const result = await syncMiniprogramSharedDomain({ sourceDir, targetDir, checkOnly: true });

    expect(result.ok).toBe(false);
    expect(result.errors).toEqual(["缺少副本：miniprogram/shared/domain/new-helper.ts"]);
  });
});
