import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(import.meta.dirname, "../..");
const cloudbaseConfigPath = resolve(projectRoot, "cloudbaserc.json");
const functionName = readOptionalEnv("PINGANPI_CLOUDBASE_AI_FUNCTION_NAME", "ai-scribe-proxy");

const envId = readRequiredEnv("CLOUDBASE_ENV_ID");
const mode = readMode();
const envVariables = buildEnvVariables(mode);

if (mode === "disabled") {
  console.log("Configuring CloudBase AI proxy in disabled mode: MIMO_API_KEY will be removed.");
}

const tempDir = await mkdtemp(resolve(tmpdir(), "pinganpi-cloudbase-ai-env-"));

try {
  const config = JSON.parse(await readFile(cloudbaseConfigPath, "utf8")) as CloudBaseConfig;
  const targetFunction = config.functions.find((item) => item.name === functionName);

  if (targetFunction === undefined) {
    throw new Error(`Missing ${functionName} in cloudbaserc.json.`);
  }

  const tempConfigPath = resolve(tempDir, "cloudbaserc.json");
  const nextConfig: CloudBaseConfig = {
    ...config,
    envId,
    functions: config.functions.map((item) =>
      item.name === functionName
        ? {
            ...item,
            envVariables
          }
        : item
    )
  };

  await writeFile(tempConfigPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  runCloudBaseConfigUpdate(tempConfigPath);
  console.log(
    `Configured CloudBase env variables for ${functionName}: ${Object.keys(envVariables).join(", ")}`
  );
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

type ConfigureMode = "enabled" | "disabled";

function buildEnvVariables(configureMode: ConfigureMode): Record<string, string> {
  const variables: Record<string, string> = {
    MIMO_API_BASE_URL: readRequiredEnv("MIMO_API_BASE_URL"),
    MIMO_MODEL_ID: readRequiredEnv("MIMO_MODEL_ID"),
    MIMO_REQUEST_TIMEOUT_MS: readOptionalEnv("MIMO_REQUEST_TIMEOUT_MS", "30000"),
    PINGANPI_AI_MAX_ORAL_TEXT_CHARS: readOptionalEnv("PINGANPI_AI_MAX_ORAL_TEXT_CHARS", "800"),
    MIMO_MAX_COMPLETION_TOKENS: readOptionalEnv("MIMO_MAX_COMPLETION_TOKENS", "900")
  };

  if (configureMode === "enabled") {
    variables.MIMO_API_KEY = readRequiredEnv("MIMO_API_KEY");
  }

  return variables;
}

function readMode(): ConfigureMode {
  const modeValue = process.env.PINGANPI_CLOUDBASE_AI_ENV_MODE?.trim();

  if (modeValue === undefined || modeValue.length === 0 || modeValue === "enabled") {
    return "enabled";
  }

  if (modeValue === "disabled") {
    return "disabled";
  }

  throw new Error("PINGANPI_CLOUDBASE_AI_ENV_MODE must be enabled or disabled.");
}

interface CloudBaseConfig {
  envId: string;
  functions: CloudBaseFunctionConfig[];
  [key: string]: unknown;
}

interface CloudBaseFunctionConfig {
  name: string;
  [key: string]: unknown;
}

function runCloudBaseConfigUpdate(tempConfigPath: string): void {
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

  writeSanitized(process.stdout, result.stdout);
  writeSanitized(process.stderr, result.stderr);

  if (result.error !== undefined) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`CloudBase config update failed with status ${result.status ?? "unknown"}.`);
  }
}

function writeSanitized(stream: NodeJS.WriteStream, value: string | null | undefined): void {
  if (value === undefined || value === null || value.length === 0) {
    return;
  }

  stream.write(redactSecretValues(value));
}

function redactSecretValues(value: string): string {
  return Object.values(envVariables).reduce(
    (result, secret) => result.replaceAll(secret, "[redacted]"),
    value
  );
}

function readRequiredEnv(key: string): string {
  const value = process.env[key]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing ${key}.`);
  }

  return value;
}

function readOptionalEnv(key: string, fallback: string): string {
  const value = process.env[key]?.trim();

  if (value === undefined || value.length === 0) {
    return fallback;
  }

  return value;
}
