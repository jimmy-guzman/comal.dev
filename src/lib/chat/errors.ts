import { APICallError } from "@ai-sdk/provider";

export type ChatErrorKind =
  | "auth"
  | "context-length"
  | "model-unavailable"
  | "network"
  | "rate-limit"
  | "unknown";

export interface ChatErrorInfo {
  kind: ChatErrorKind;
  message: string;
  retryable: boolean;
  statusCode?: number;
  suggestModelSwitch: boolean;
  title: string;
}

interface ChatErrorCopy {
  message: string;
  retryable: boolean;
  suggestModelSwitch: boolean;
  title: string;
}

const CHAT_ERROR_COPY = {
  auth: {
    message: "The provider rejected the request as unauthorized. Verify your API key.",
    retryable: false,
    suggestModelSwitch: false,
    title: "Authentication failed",
  },
  "context-length": {
    message:
      "This conversation is too long for the selected model's context window. Switch to a model with a larger window or start a new conversation.",
    retryable: false,
    suggestModelSwitch: true,
    title: "Conversation too long",
  },
  "model-unavailable": {
    message: "The selected model is unavailable. Try a different model.",
    retryable: false,
    suggestModelSwitch: true,
    title: "Model unavailable",
  },
  network: {
    message: "A network error interrupted the request. Check your connection and retry.",
    retryable: true,
    suggestModelSwitch: false,
    title: "Network error",
  },
  "rate-limit": {
    message: "The provider is rate-limiting requests. Wait a moment and retry.",
    retryable: true,
    suggestModelSwitch: false,
    title: "Rate limited",
  },
  unknown: {
    message: "Something went wrong while generating a response. Retry or switch model.",
    retryable: true,
    suggestModelSwitch: false,
    title: "Generation failed",
  },
} as const satisfies Record<ChatErrorKind, ChatErrorCopy>;

const CONTEXT_LENGTH_PATTERNS = [
  "context_length_exceeded",
  "maximum context length",
  "context window",
  "too many tokens",
  "reduce the length of the messages",
];

const MODEL_UNAVAILABLE_PATTERNS = [
  "model not found",
  "model_not_found",
  "no such model",
  "model is not available",
];

const NETWORK_PATTERNS = ["fetch failed", "network", "econnreset", "etimedout", "socket hang up"];

const matchesAny = (haystack: string, needles: readonly string[]): boolean => {
  const lower = haystack.toLowerCase();

  return needles.some((needle) => lower.includes(needle));
};

const detectFromMessage = (message: string): ChatErrorKind | null => {
  if (matchesAny(message, CONTEXT_LENGTH_PATTERNS)) return "context-length";

  if (matchesAny(message, MODEL_UNAVAILABLE_PATTERNS)) return "model-unavailable";

  if (matchesAny(message, NETWORK_PATTERNS)) return "network";

  return null;
};

const detectFromStatus = (statusCode: number): ChatErrorKind | null => {
  if (statusCode === 401 || statusCode === 403) return "auth";

  if (statusCode === 404) return "model-unavailable";

  if (statusCode === 429) return "rate-limit";

  if (statusCode >= 500 && statusCode < 600) return "network";

  return null;
};

const extractApiError = (error: unknown): null | { responseBody?: string; statusCode?: number } => {
  if (APICallError.isInstance(error)) {
    return { responseBody: error.responseBody, statusCode: error.statusCode };
  }

  if (
    error !== null &&
    typeof error === "object" &&
    "name" in error &&
    error.name === "AI_APICallError"
  ) {
    const candidate = error as { responseBody?: unknown; statusCode?: unknown };

    return {
      responseBody: typeof candidate.responseBody === "string" ? candidate.responseBody : undefined,
      statusCode: typeof candidate.statusCode === "number" ? candidate.statusCode : undefined,
    };
  }

  return null;
};

const errorMessageOf = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  if (typeof error === "string") return error;

  return "Unknown error";
};

export const classifyChatError = (error: unknown): ChatErrorInfo => {
  const apiError = extractApiError(error);
  const message = errorMessageOf(error);
  const composite = apiError?.responseBody ? `${message} ${apiError.responseBody}` : message;

  const detected =
    detectFromMessage(composite) ??
    (apiError?.statusCode === undefined ? null : detectFromStatus(apiError.statusCode)) ??
    "unknown";

  const copy = CHAT_ERROR_COPY[detected];

  return {
    kind: detected,
    message: copy.message,
    retryable: copy.retryable,
    statusCode: apiError?.statusCode,
    suggestModelSwitch: copy.suggestModelSwitch,
    title: copy.title,
  } satisfies ChatErrorInfo;
};

export const chatErrorCopyFor = (kind: ChatErrorKind): ChatErrorInfo => {
  const copy = CHAT_ERROR_COPY[kind];

  return {
    kind,
    message: copy.message,
    retryable: copy.retryable,
    suggestModelSwitch: copy.suggestModelSwitch,
    title: copy.title,
  } satisfies ChatErrorInfo;
};
