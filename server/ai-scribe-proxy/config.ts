export interface AiProxyConfig {
  baseUrl: string;
  modelId: string;
  apiKey: string;
  port: number;
  requestTimeoutMs: number;
}

export type EnvSource = Record<string, string | undefined>;

export function readAiProxyConfig(env: EnvSource): AiProxyConfig {
  if (env.VITE_MIMO_API_KEY !== undefined || env.VITE_XIAOMI_MIMO_API_KEY !== undefined) {
    throw new Error("Do not expose MiMo API keys through VITE_ variables.");
  }

  return {
    baseUrl: readRequired(env, "MIMO_API_BASE_URL").replace(/\/+$/u, ""),
    modelId: readRequired(env, "MIMO_MODEL_ID"),
    apiKey: readRequired(env, "MIMO_API_KEY"),
    port: readInteger(env.PINGANPI_AI_PROXY_PORT, {
      defaultValue: 8787,
      name: "PINGANPI_AI_PROXY_PORT",
      min: 1,
      max: 65535
    }),
    requestTimeoutMs: readInteger(env.MIMO_REQUEST_TIMEOUT_MS, {
      defaultValue: 30000,
      name: "MIMO_REQUEST_TIMEOUT_MS",
      min: 1000,
      max: 120000
    })
  };
}

function readRequired(env: EnvSource, key: string): string {
  const value = env[key]?.trim();

  if (value === undefined || value.length === 0) {
    throw new Error(`Missing ${key}.`);
  }

  return value;
}

function readInteger(
  value: string | undefined,
  options: {
    defaultValue: number;
    name: string;
    min: number;
    max: number;
  }
): number {
  if (value === undefined || value.trim().length === 0) {
    return options.defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < options.min || parsed > options.max) {
    throw new Error(`${options.name} must be an integer from ${options.min} to ${options.max}.`);
  }

  return parsed;
}
