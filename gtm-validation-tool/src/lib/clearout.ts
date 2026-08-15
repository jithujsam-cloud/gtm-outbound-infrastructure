const CLEAROUT_TIMEOUT_MS = 45000;

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
  rawError: unknown;

  constructor(message: string, httpStatus?: number | null, rawError?: unknown) {
    super(message);
    this.name = "ClearoutError";
    this.httpStatus = httpStatus ?? null;
    this.rawError = rawError ?? null;
  }
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
      const err = await res.text();
      let rawError: unknown = err;
      try {
        rawError = JSON.parse(err);
      } catch {}

      throw new ClearoutError(
        `Clearout API error (${res.status}): ${err.slice(0, 200)}`,
        res.status,
        rawError
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
