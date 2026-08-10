export type ErrorClass = "retryable" | "fatal" | "system";

export function classifyError(errorMessage: string): ErrorClass {
  if (
    errorMessage.includes("401") ||
    errorMessage.includes("403") ||
    errorMessage.includes("invalid") ||
    errorMessage.includes("not found") ||
    errorMessage.includes("not configured")
  ) {
    return "system";
  }

  if (
    errorMessage.includes("429") ||
    errorMessage.includes("500") ||
    errorMessage.includes("502") ||
    errorMessage.includes("503") ||
    errorMessage.includes("504") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("ECONNREFUSED") ||
    errorMessage.includes("ETIMEDOUT") ||
    errorMessage.includes("ENOTFOUND") ||
    errorMessage.includes("network") ||
    errorMessage.includes("Empty Gemini") ||
    errorMessage.includes("Invalid JSON")
  ) {
    return "retryable";
  }

  return "fatal";
}

const RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 16000];

export function backoffDelay(attempt: number): number {
  const idx = Math.min(attempt, RETRY_DELAYS_MS.length - 1);
  return RETRY_DELAYS_MS[idx];
}

export function shouldPauseJob(
  failedCount: number,
  completedCount: number,
  minItems: number = 5
): boolean {
  const total = failedCount + completedCount;
  if (total < minItems) return false;
  return failedCount / total > 0.5;
}
