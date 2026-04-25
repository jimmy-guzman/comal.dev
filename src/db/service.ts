import { Context, Effect, Layer } from "effect";

import { db } from "./client";

export class Database extends Context.Tag("Database")<Database, typeof db>() {}

export const DatabaseLive = Layer.succeed(Database, db);

export const runWithDb = <A, E>(effect: Effect.Effect<A, E, Database>): Promise<A> => {
  return Effect.runPromise(Effect.provide(effect, DatabaseLive));
};
