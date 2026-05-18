import { Effect, Logger, LogLevel } from "effect";

import { env } from "@/env";

const ENV_TO_LEVEL = {
  all: LogLevel.All,
  debug: LogLevel.Debug,
  error: LogLevel.Error,
  fatal: LogLevel.Fatal,
  info: LogLevel.Info,
  none: LogLevel.None,
  trace: LogLevel.Trace,
  warning: LogLevel.Warning,
} satisfies Record<NonNullable<typeof env.LOG_LEVEL>, LogLevel.LogLevel>;

const minimumLogLevel = env.LOG_LEVEL ? ENV_TO_LEVEL[env.LOG_LEVEL] : LogLevel.Info;

const isDebugEnabled = LogLevel.lessThanEqual(minimumLogLevel, LogLevel.Debug);

export const logChatStream = (tag: string, payload: unknown) => {
  if (!isDebugEnabled) return;

  Effect.runSync(
    Effect.logDebug(tag, payload).pipe(
      Logger.withMinimumLogLevel(minimumLogLevel),
      Effect.provide(Logger.pretty),
    ),
  );
};
