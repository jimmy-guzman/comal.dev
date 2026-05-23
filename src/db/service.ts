import { Context, Effect, Layer, Schedule } from "effect";

import { DatabaseError } from "@/lib/errors";

import { db } from "./client";
import { isRetryableDbError } from "./errors";

export class Database extends Context.Tag("Database")<Database, typeof db>() {}

export const AppLive = Layer.succeed(Database, db);

const retrySchedule = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(3)),
  Schedule.whileInput((error: DatabaseError) => isRetryableDbError(error.cause)),
);

/**
 * Wraps a read query in an Effect with retry on transient connection failures.
 * Only use for idempotent operations (selects, or writes that are safe to repeat).
 */
export const runQuery = <A>(query: () => Promise<A>) => {
  return Effect.tryPromise({
    catch: (cause) => {
      return new DatabaseError({
        cause,
        message: cause instanceof Error ? cause.message : String(cause),
      });
    },
    try: query,
  }).pipe(
    Effect.tapError((error) => {
      if (!isRetryableDbError(error.cause)) return Effect.void;

      return Effect.logWarning("Retrying transient database error", { cause: error.cause });
    }),
    Effect.retry(retrySchedule),
  );
};

/**
 * Wraps a write/transaction in an Effect without retry. Use for non-idempotent
 * mutations where replaying the closure could cause duplicates.
 */
export const runMutation = <A>(query: () => Promise<A>) => {
  return Effect.tryPromise({
    catch: (cause) => {
      return new DatabaseError({
        cause,
        message: cause instanceof Error ? cause.message : String(cause),
      });
    },
    try: query,
  });
};
