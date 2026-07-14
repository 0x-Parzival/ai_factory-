export async function readProviderJson(response: Response, provider: string, maxBytes = 2_000_000): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > maxBytes) throw new Error(`${provider} response exceeded the ${maxBytes} byte limit`);
  const text = await response.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new Error(`${provider} response exceeded the ${maxBytes} byte limit`);
  const payload = text ? JSON.parse(text) as Record<string, unknown> : {};
  if (!response.ok) {
    const nested = payload.error && typeof payload.error === "object" ? payload.error as Record<string, unknown> : undefined;
    const message = nested?.message || nested?.description || payload.message || payload.error;
    throw new Error(`${provider}: ${typeof message === "string" ? message : `HTTP ${response.status}`}`);
  }
  return payload;
}

export function safeInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(Math.trunc(parsed), maximum));
}

export function requireIsoTimestamp(value: unknown, field: string) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new Error(`${field} must be an ISO timestamp`);
  return new Date(value).toISOString();
}
