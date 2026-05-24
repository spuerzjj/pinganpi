import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "esbuild";

const projectRoot = resolve(import.meta.dirname, "../..");
const outDir = resolve(projectRoot, "cloudbase/functions/sync-proxy");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

await build({
  entryPoints: [resolve(projectRoot, "services/sync-proxy/cloudbase-bootstrap.ts")],
  outfile: resolve(outDir, "index.js"),
  bundle: true,
  platform: "node",
  target: "node20",
  format: "cjs",
  sourcemap: false,
  minify: false
});

await writeFile(
  resolve(outDir, "package.json"),
  `${JSON.stringify(
    {
      name: "pinganpi-sync-proxy",
      version: "0.1.0",
      private: true,
      main: "index.js"
    },
    null,
    2
  )}\n`,
  "utf8"
);

await writeFile(resolve(outDir, "scf_bootstrap"), "#!/bin/bash\nnode index.js\n", "utf8");
await chmod(resolve(outDir, "scf_bootstrap"), 0o755);

await writeFile(
  resolve(outDir, "README.md"),
  [
    "# pinganpi-sync-proxy",
    "",
    "Generated CloudBase function bundle. Do not edit this directory by hand.",
    "Run `npm run cloudbase:build:sync` from the repository root to regenerate.",
    ""
  ].join("\n"),
  "utf8"
);
