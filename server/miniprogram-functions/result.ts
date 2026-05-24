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

export function readMiniAction(event: PinganpiMiniFunctionEvent, fallback = "health"): string {
  const action = typeof event.action === "string" ? event.action.trim() : "";

  return action.length === 0 ? fallback : action;
}

export function miniOk<TData>(action: string, data: TData): PinganpiMiniFunctionResult<TData> {
  return { ok: true, action, data };
}

export function miniFail(
  action: string,
  reason: string,
  message: string,
  statusCode?: number
): PinganpiMiniFunctionResult<never> {
  return { ok: false, action, reason, message, ...(statusCode === undefined ? {} : { statusCode }) };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
