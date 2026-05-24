import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(import.meta.dirname, "../..");
const cloudbaseConfigPath = resolve(projectRoot, "cloudbaserc.json");
const functionName = "sync-proxy";

export interface CloudBaseConfig {
  envId: string;
  functions: CloudBaseFunctionConfig[];
  [key: string]: unknown;
}

export interface CloudBaseFunctionConfig {
  name: string;
  [key: string]: unknown;
}

export function buildSyncProxyEnvVariables(env: Record<string, string | undefined>): Record<string, string> {
  const rawMemberTokens = readRequiredEnv(env, "PINGANPI_SYNC_MEMBER_TOKENS");

  return {
    PINGANPI_SYNC_SNAPSHOT_COLLECTION: readOptionalEnv(env, "PINGANPI_SYNC_SNAPSHOT_COLLECTION", "pinganpi_sync_snapshots"),
    PINGANPI_SYNC_MEMBER_TOKENS_B64: Buffer.from(rawMemberTokens, "utf8").toString("base64")
  };
}

export function buildCloudBaseConfigWithFunctionEnv(
  config: CloudBaseConfig,
  options: {
    envId: string;
    functionName: string;
    envVariables: Record<string, string>;
  }
): CloudBaseConfig {
  if (!config.functions.some((item) => item.name === options.functionName)) {
    throw new Error(`Missing ${options.functionName} in cloudbaserc.json.`);
  }

  return {
    ...config,
    envId: options.envId,
    functions: config.functions.map((item) =>
      item.name === options.functionName
        ? {
            ...item,
            envVariables: options.envVariables
          }
        : item
    )
  };
}

export function redactSecretValues(value: string, secrets: string[]): string {
  return secrets.reduce((result, secret) => {
    if (secret.length === 0) {
      return result;
    }

    return result.replaceAll(secret, "[redacted]");
  }, value);
}

async function main(): Promise<void> {
  const envId = readRequiredEnv(process.env, "CLOUDBASE_ENV_ID");
  const envVariables = buildSyncProxyEnvVariables(process.env);
  const tempDir = await mkdtemp(resolve(tmpdir(), "pinganpi-cloudbase-sync-env-"));

  try {
    const config = JSON.parse(await readFile(cloudbaseConfigPath, "utf8")) as CloudBaseConfig;
    const tempConfigPath = resolve(tempDir, "cloudbaserc.json");
    const nextConfig = buildCloudBaseConfigWithFunctionEnv(config, {
      envId,
      functionName,
      envVariables
    });

    await writeFile(tempConfigPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
    runCloudBaseConfigUpdate(tempConfigPath, Object.values(envVariables));
    console.log(`Configured CloudBase env variables for ${functionName}: ${Object.keys(envVariables).join(", ")}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

function runCloudBaseConfigUpdate(tempConfigPath: string, secrets: string[]): void {
  const cloudbaseBin = resolve(projectRoot, "node_modules/.bin/cloudbase");
  const result = spawnSync(
    cloudbaseBin,
    ["--yes", "--config-file", tempConfigPath, "config", "update", "fn", functionName],
    {
      cwd: projectRoot,
      env: process.env,
      encoding: "utf8"
    }
  );

  writeSanitized(process.stdout, result.stdout, secrets);
  writeSanitized(process.stderr, result.stderr, secrets);

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`CloudBase config update failed with status ${result.status ?? "unknown"}.`);
  }
}

function writeSanitized(stream: NodeJS.WriteStream, value: string | null | undefined, secrets: string[]): void {
  if (value === undefined || value === null || value.length === 0) {
    return;
  }

  stream.write(redactSecretValues(value, secrets));
}

function readRequiredEnv(env: Record<string, string | undefined>, key: string): string {
  const value = env[key]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing ${key}.`);
  }

  return value;
}

function readOptionalEnv(env: Record<string, string | undefined>, key: string, fallback: string): string {
  const value = env[key]?.trim();

  if (value === undefined || value.length === 0) {
    return fallback;
  }

  return value;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
