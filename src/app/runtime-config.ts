export function readAiProxyUrl(): string {
  const configuredUrl = import.meta.env.VITE_PINGANPI_AI_PROXY_URL;

  return typeof configuredUrl === "string" && configuredUrl.trim().length > 0 ? configuredUrl.trim() : "http://127.0.0.1:8787";
}

export function readSyncProxyUrl(): string | null {
  const configuredUrl = import.meta.env.VITE_PINGANPI_SYNC_PROXY_URL;

  return typeof configuredUrl === "string" && configuredUrl.trim().length > 0 ? configuredUrl.trim() : null;
}

export function readSyncMemberToken(): string | null {
  const configuredToken = import.meta.env.VITE_PINGANPI_SYNC_MEMBER_TOKEN;

  return typeof configuredToken === "string" && configuredToken.trim().length > 0 ? configuredToken.trim() : null;
}
