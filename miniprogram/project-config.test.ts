import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const miniprogramRoot = dirname(fileURLToPath(import.meta.url));

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(join(miniprogramRoot, path), "utf8")) as T;
}

describe("miniprogram project config", () => {
  it("enables the WeChat TypeScript compiler plugin for TypeScript entrypoints", async () => {
    const app = await readJson<{ pages: string[] }>("app.json");
    const project = await readJson<{ setting?: { useCompilerPlugins?: unknown } }>("project.config.json");
    const entrypoints = ["app", ...app.pages];
    const typescriptEntrypoints = entrypoints.filter((entrypoint) =>
      existsSync(join(miniprogramRoot, `${entrypoint}.ts`)),
    );

    expect(typescriptEntrypoints).toContain("app");
    expect(typescriptEntrypoints).toContain("pages/account/index");
    expect(project.setting?.useCompilerPlugins).toEqual(expect.arrayContaining(["typescript"]));
  });
});
