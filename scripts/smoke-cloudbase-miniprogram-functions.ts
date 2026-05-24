import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCallback);

export const MINI_PROGRAM_EVENT_FUNCTIONS = [
  "pinganpi-ai",
  "pinganpi-account",
  "pinganpi-pair",
  "pinganpi-sync",
] as const;

export type MiniProgramEventFunctionName = (typeof MINI_PROGRAM_EVENT_FUNCTIONS)[number];

export interface CloudBaseInvokeCommand {
  command: "cloudbase";
  args: string[];
}

export interface MiniProgramSmokeConfig {
  envId: string;
  aiDraft: boolean;
}

export interface MiniProgramSmokeResult {
  checked: MiniProgramEventFunctionName[];
  aiDraftChecked: boolean;
}

export interface PinganpiMiniFunctionEvent<TPayload = unknown> {
  action?: string;
  payload?: TPayload;
}

export type PinganpiMiniFunctionResult<TData = unknown> =
  | {
      ok: true;
      action: string;
      data: TData;
    }
  | {
      ok: false;
      action: string;
      reason: string;
      message: string;
      statusCode?: number;
    };

export type MiniProgramFunctionInvoker = (
  name: MiniProgramEventFunctionName,
  event: PinganpiMiniFunctionEvent,
) => Promise<PinganpiMiniFunctionResult>;

type ExecFileFn = (
  command: string,
  args: string[],
) => Promise<{
  stdout: string;
  stderr: string;
}>;

export function buildCloudBaseInvokeCommand(
  name: MiniProgramEventFunctionName,
  event: PinganpiMiniFunctionEvent,
): CloudBaseInvokeCommand {
  return {
    command: "cloudbase",
    args: ["fn", "invoke", name, "-d", JSON.stringify(event), "--json"],
  };
}

export function buildMiniProgramSmokeConfig(env: Record<string, string | undefined>): MiniProgramSmokeConfig {
  const envId = env.CLOUDBASE_ENV_ID?.trim();

  if (envId === undefined || envId.length === 0) {
    throw new Error("Missing CLOUDBASE_ENV_ID.");
  }

  return {
    envId,
    aiDraft: env.PINGANPI_MINIPROGRAM_SMOKE_AI_DRAFT === "1",
  };
}

export async function invokeCloudBaseMiniProgramFunction(
  name: MiniProgramEventFunctionName,
  event: PinganpiMiniFunctionEvent,
  execFileFn: ExecFileFn = (command, args) => execFile(command, args),
): Promise<PinganpiMiniFunctionResult> {
  const { command, args } = buildCloudBaseInvokeCommand(name, event);

  try {
    const { stdout } = await execFileFn(command, args);

    return parseCloudBaseInvokeResult(stdout);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    throw new Error(sanitizeSmokeLog(`CloudBase function ${name} invoke failed: ${message}`));
  }
}

export function parseCloudBaseInvokeResult(stdout: string): PinganpiMiniFunctionResult {
  const parsed = parseJsonText(stdout);
  const result = unwrapCloudBaseResult(parsed);

  if (isMiniFunctionResult(result)) {
    return result;
  }

  throw new Error("CloudBase function invoke returned malformed result.");
}

export async function runMiniProgramFunctionSmokeTest(
  env: Record<string, string | undefined>,
  invoke: MiniProgramFunctionInvoker = invokeCloudBaseMiniProgramFunction,
): Promise<MiniProgramSmokeResult> {
  const config = buildMiniProgramSmokeConfig(env);
  const checked: MiniProgramEventFunctionName[] = [];

  void config.envId;

  for (const name of MINI_PROGRAM_EVENT_FUNCTIONS) {
    const result = await invoke(name, { action: "health" });
    assertMiniFunctionOk(name, "health", result, env);
    checked.push(name);
  }

  if (config.aiDraft) {
    const result = await invoke("pinganpi-ai", createSmokeAiDraftEvent());
    assertMiniFunctionOk("pinganpi-ai", "scribeDraft", result, env);

    return { checked, aiDraftChecked: true };
  }

  return { checked, aiDraftChecked: false };
}

export function sanitizeSmokeLog(value: unknown, env: Record<string, string | undefined> = process.env): string {
  let text = typeof value === "string" ? value : JSON.stringify(value);

  if (text === undefined) {
    return "";
  }

  text = text.replace(/provider raw body:\s*.*$/gim, "provider raw body: [redacted-provider-body]");
  text = text.replace(/\b1[3-9]\d{9}\b/g, "[redacted-phone]");
  text = text.replace(/\b[A-Z0-9]{4}-[A-Z0-9]{4}\b/g, "[redacted-invite]");
  text = text.replace(/\b(?:sk|tp)-[A-Za-z0-9_-]{6,}\b/g, "[redacted-secret]");

  for (const [key, rawValue] of Object.entries(env)) {
    const value = rawValue?.trim();

    if (
      value !== undefined &&
      value.length >= 4 &&
      /(KEY|TOKEN|SECRET|PHONE|INVITE|CODE)/iu.test(key)
    ) {
      text = text.split(value).join("[redacted]");
    }
  }

  return text;
}

function createSmokeAiDraftEvent(): PinganpiMiniFunctionEvent {
  return {
    action: "scribeDraft",
    payload: {
      oralText: "请代问近来安好，家中一切平安。",
      scribeName: "许鹤年",
      scribeStyle: "街口代书",
      senderGreeting: "兰卿",
      senderSignature: "远行人",
      senderCity: "杭州",
      recipientCity: "西安",
      letterType: "ordinary",
    },
  };
}

function assertMiniFunctionOk(
  name: MiniProgramEventFunctionName,
  action: string,
  result: PinganpiMiniFunctionResult,
  env: Record<string, string | undefined>,
): void {
  if (result.ok === true) {
    return;
  }

  throw new Error(
    sanitizeSmokeLog(
      `${name} ${action} failed: ${result.reason}${result.statusCode === undefined ? "" : ` HTTP ${result.statusCode}`} ${result.message}`,
      env,
    ),
  );
}

function parseJsonText(text: string): unknown {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const jsonLine = trimmed
      .split(/\r?\n/u)
      .reverse()
      .find((line) => line.trim().startsWith("{"));

    if (jsonLine !== undefined) {
      return JSON.parse(jsonLine) as unknown;
    }

    throw new Error("CloudBase function invoke returned malformed JSON.");
  }
}

function unwrapCloudBaseResult(value: unknown, depth = 0): unknown {
  if (depth > 8) {
    return value;
  }

  if (typeof value === "string") {
    return unwrapCloudBaseResult(parseJsonText(value), depth + 1);
  }

  if (isMiniFunctionResult(value)) {
    return value;
  }

  if (!isRecord(value)) {
    return value;
  }

  if (value.RetMsg !== undefined) {
    return unwrapCloudBaseResult(value.RetMsg, depth + 1);
  }

  if (value.result !== undefined) {
    return unwrapCloudBaseResult(value.result, depth + 1);
  }

  if (value.Result !== undefined) {
    return unwrapCloudBaseResult(value.Result, depth + 1);
  }

  if (value.Response !== undefined) {
    return unwrapCloudBaseResult(value.Response, depth + 1);
  }

  return value;
}

function isMiniFunctionResult(value: unknown): value is PinganpiMiniFunctionResult {
  return isRecord(value) && typeof value.ok === "boolean" && typeof value.action === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function main(): Promise<void> {
  try {
    const result = await runMiniProgramFunctionSmokeTest(process.env);

    console.log(
      [
        "CloudBase miniprogram function smoke passed.",
        `functions=${result.checked.join(",")}`,
        `aiDraft=${result.aiDraftChecked ? "checked" : "skipped"}`,
      ].join(" "),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(sanitizeSmokeLog(message));
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
