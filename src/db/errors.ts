import { NeonDbError } from "@neondatabase/serverless";

const RETRYABLE_SQLSTATE_PREFIXES = ["08", "57P"] as const;

const RETRYABLE_NETWORK_CODES = new Set([
  "EAI_AGAIN",
  "ECONNREFUSED",
  "ECONNRESET",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "EPIPE",
  "ETIMEDOUT",
]);

const isNetworkErrorCode = (value: unknown) => {
  return typeof value === "string" && RETRYABLE_NETWORK_CODES.has(value);
};

const hasRetryableSqlState = (code: string | undefined) => {
  if (!code) return false;

  return RETRYABLE_SQLSTATE_PREFIXES.some((prefix) => code.startsWith(prefix));
};

export const isRetryableDbError = (error: unknown) => {
  if (error instanceof NeonDbError) {
    if (hasRetryableSqlState(error.code)) return true;

    const source = error.sourceError;

    if (source instanceof Error) {
      if (source instanceof TypeError) return true;

      if (isNetworkErrorCode(Reflect.get(source, "code"))) return true;
    }

    return false;
  }

  if (error instanceof TypeError) return true;

  if (error instanceof Error && isNetworkErrorCode(Reflect.get(error, "code"))) return true;

  return false;
};
