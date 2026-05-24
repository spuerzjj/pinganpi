export const PINGANPI_ACCOUNT_FUNCTION = "pinganpi-account";
export const PINGANPI_PAIR_FUNCTION = "pinganpi-pair";
export const PINGANPI_SYNC_FUNCTION = "pinganpi-sync";
export const PINGANPI_AI_FUNCTION = "pinganpi-ai";

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

export class PinganpiCloudFunctionError extends Error {
  override name = "PinganpiCloudFunctionError";

  readonly functionName: string;
  readonly action: string;
  readonly reason: string;
  readonly statusCode?: number;

  constructor(options: {
    functionName: string;
    action: string;
    reason: string;
    message: string;
    statusCode?: number;
  }) {
    super(options.message);
    Object.setPrototypeOf(this, PinganpiCloudFunctionError.prototype);
    this.functionName = options.functionName;
    this.action = options.action;
    this.reason = options.reason;

    if (options.statusCode !== undefined) {
      this.statusCode = options.statusCode;
    }
  }
}

export async function callPinganpiCloudFunction<TData = unknown>(
  name: string,
  action: string,
  payload?: unknown,
): Promise<TData> {
  const cloud = readWxCloud(name, action);
  const response = await cloud.callFunction<PinganpiMiniFunctionResult<TData>>({
    name,
    data: payload === undefined ? { action } : { action, payload },
  });
  const result = response.result;

  if (!isRecord(result) || typeof result.ok !== "boolean") {
    throw new PinganpiCloudFunctionError({
      functionName: name,
      action,
      reason: "malformed_response",
      message: "云函数返回格式不正确。",
    });
  }

  if (result.ok === true) {
    return result.data as TData;
  }

  const statusCode = typeof result.statusCode === "number" ? result.statusCode : undefined;

  throw new PinganpiCloudFunctionError({
    functionName: name,
    action: typeof result.action === "string" ? result.action : action,
    reason: typeof result.reason === "string" ? result.reason : "unknown_error",
    message: typeof result.message === "string" ? result.message : "云函数调用失败。",
    ...(statusCode === undefined ? {} : { statusCode }),
  });
}

export function callPinganpiAccount<TData = unknown>(action: string, payload?: unknown): Promise<TData> {
  return callPinganpiCloudFunction<TData>(PINGANPI_ACCOUNT_FUNCTION, action, payload);
}

export function callPinganpiPair<TData = unknown>(action: string, payload?: unknown): Promise<TData> {
  return callPinganpiCloudFunction<TData>(PINGANPI_PAIR_FUNCTION, action, payload);
}

export function callPinganpiSync<TData = unknown>(action: string, payload?: unknown): Promise<TData> {
  return callPinganpiCloudFunction<TData>(PINGANPI_SYNC_FUNCTION, action, payload);
}

export function callPinganpiAi<TData = unknown>(action: string, payload?: unknown): Promise<TData> {
  return callPinganpiCloudFunction<TData>(PINGANPI_AI_FUNCTION, action, payload);
}

function readWxCloud(functionName: string, action: string): NonNullable<WechatMiniprogram.Wx["cloud"]> {
  const cloud = (globalThis as { wx?: WechatMiniprogram.Wx }).wx?.cloud;

  if (cloud === undefined || typeof cloud.callFunction !== "function") {
    throw new PinganpiCloudFunctionError({
      functionName,
      action,
      reason: "cloud_unavailable",
      message: "当前微信云开发调用能力不可用。",
    });
  }

  return cloud;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
