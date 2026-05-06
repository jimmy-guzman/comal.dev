import { Context, Effect, Layer, ManagedRuntime, Schedule } from "effect";

import { DatabaseError } from "@/lib/errors";

import { db } from "./client";
import { isRetryableDbError } from "./errors";

export class Database extends Context.Tag("Database")<Database, typeof db>() {}

const AppLive = Layer.succeed(Database, db);

export const appRuntime = ManagedRuntime.make(AppLive);

const retrySchedule = Schedule.exponential("100 millis").pipe(
  Schedule.jittered,
  Schedule.intersect(Schedule.recurs(3)),
  Schedule.whileInput((error: DatabaseError) => isRetryableDbError(error.cause)),
);

/**
 * Wraps a database query in an Effect with retry on transient connection failures.
 * For multi-statement atomic writes, pass a `db.transaction(...)` call as the query.
 */
export const runQuery = <A>(query: () => Promise<A>) => {
  return Effect.tryPromise({
    catch: (cause) => new DatabaseError({ cause }),
    try: query,
  }).pipe(
    Effect.tapError((error) => {
      if (!isRetryableDbError(error.cause)) return Effect.void;

      return Effect.logWarning("Retrying transient database error", { cause: error.cause });
    }),
    Effect.retry(retrySchedule),
  );
};
