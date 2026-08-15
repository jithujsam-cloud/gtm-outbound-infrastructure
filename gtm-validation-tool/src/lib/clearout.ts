const CLEAROUT_TIMEOUT_MS = 45000;
const CLEAROUT_RATE_LIMIT_FALLBACK_MS = 15 * 60 * 1000;

export interface ClearoutParsed {
  status: string;
  safe_to_send: boolean;
  smtp_provider: string | null;
  mx_record: string | null;
  score: number | null;
  account: string | null;
  domain: string | null;
}

export class ClearoutError extends Error {
  httpStatus: number | null;
  errorCode: number | null;
  resetAt: string | null;
  rawError: unknown;

  constructor(
    message: string,
    httpStatus?: number | null,
    rawError?: unknown,
    errorCode?: number | null,
    resetAt?: string | null
  ) {
    super(message);
    this.name = "ClearoutError";
    this.httpStatus = httpStatus ?? null;
    this.errorCode = errorCode ?? null;
    this.resetAt = resetAt ?? null;
    this.rawError = rawError ?? null;
  }
}

export function isClearoutProviderRateLimit(error: unknown): error is ClearoutError {
  if (!(error instanceof ClearoutError)) return false;
  return error.httpStatus === 429 && error.errorCode === 1030;
}

function extractResetAt(body: any): string | null {
  const candidates: string[] = [];

  const code = body?.error?.code ?? body?.code;
  if (typeof code === "string") candidates.push(code);
  if (typeof code === "number") candidates.push(String(code));

  const message = body?.error?.message ?? body?.message;
  if (typeof message === "string") candidates.push(message);

  for (const text of candidates) {
    const match = text.match(/\b\w{3}\s+\w{3}\s+\d{2}\s+\d{4}\s+\d{2}:\d{2}:\d{2}\s+GMT[+-]\d{4}\b/);
    if (match) {
      const parsed = new Date(match[0]);
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
    }
  }

  return null;
}

export async function callClearout(
  apiKey: string,
  email: string,
  timeoutMs: number = CLEAROUT_TIMEOUT_MS
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("https://api.clearout.io/v2/email_verify/instant", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ email }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      let rawError: unknown = text;
      try {
        rawError = JSON.parse(text);
      } catch {}

      const errorCode = (rawError as any)?.error?.code ?? (rawError as any)?.code ?? null;
      const resetAt = extractResetAt(rawError);

      throw new ClearoutError(
        `Clearout API error (${res.status}): ${text.slice(0, 200)}`,
        res.status,
        rawError,
        typeof errorCode === "number" ? errorCode : null,
        resetAt
      );
    }

    return await res.json();
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ClearoutError(
        `Clearout API timeout after ${timeoutMs}ms`,
        null,
        { timeout: true }
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function clearoutRateLimitResetAt(error: ClearoutError): string {
  if (error.resetAt) return error.resetAt;
  return new Date(Date.now() + CLEAROUT_RATE_LIMIT_FALLBACK_MS).toISOString();
}

export function parseClearout(data: any): ClearoutParsed {
  return {
    status: data?.data?.status || data?.status || "unknown",
    safe_to_send: data?.data?.safe_to_send ?? false,
    smtp_provider: data?.data?.smtp_provider || null,
    mx_record: data?.data?.mx_record || null,
    score: data?.data?.score ?? data?.score ?? null,
    account: data?.data?.account || null,
    domain: data?.data?.domain || null,
  };
}
