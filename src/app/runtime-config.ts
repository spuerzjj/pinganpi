export function readAiProxyUrl(): string {
  const configuredUrl = import.meta.env.VITE_PINGANPI_AI_PROXY_URL;

  return typeof configuredUrl === "string" && configuredUrl.trim().length > 0 ? configuredUrl.trim() : "http://127.0.0.1:8787";
}
