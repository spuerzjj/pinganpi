import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

interface MiniProgramFunctionBuildEntry {
  name: string;
  entry: string;
  description: string;
}

const projectRoot = resolve(import.meta.dirname, "../..");

const entries: MiniProgramFunctionBuildEntry[] = [
  {
    name: "pinganpi-ai",
    entry: "services/miniprogram-functions/pinganpi-ai.ts",
    description: "平安批小程序 AI event 云函数",
  },
  {
    name: "pinganpi-sync",
    entry: "services/miniprogram-functions/pinganpi-sync.ts",
    description: "平安批小程序同步 event 云函数",
  },
  {
    name: "pinganpi-account",
    entry: "services/miniprogram-functions/pinganpi-account.ts",
    description: "平安批小程序账号 event 云函数",
  },
  {
    name: "pinganpi-pair",
    entry: "services/miniprogram-functions/pinganpi-pair.ts",
    description: "平安批小程序双人关系 event 云函数",
  },
];

for (const entry of entries) {
  await buildMiniProgramFunction(entry);
}

async function buildMiniProgramFunction(entry: MiniProgramFunctionBuildEntry): Promise<void> {
  const outDir = resolve(projectRoot, "cloudbase/functions", entry.name);

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  await build({
    entryPoints: [resolve(projectRoot, entry.entry)],
    outfile: resolve(outDir, "index.js"),
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    sourcemap: false,
    minify: false,
  });

  await writeFile(
    resolve(outDir, "package.json"),
    `${JSON.stringify(
      {
        name: `pinganpi-${entry.name}`,
        version: "0.1.0",
        private: true,
        main: "index.js",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );

  await writeFile(
    resolve(outDir, "README.md"),
    [
      `# ${entry.name}`,
      "",
      entry.description,
      "",
      "Generated CloudBase event function bundle. Do not edit this directory by hand.",
      "Run `npm run cloudbase:build:miniprogram` from the repository root to regenerate.",
      "",
    ].join("\n"),
    "utf8",
  );
}
