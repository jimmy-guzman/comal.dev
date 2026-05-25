import { and, cosineDistance, desc, eq, isNotNull, isNull, lte, sql } from "drizzle-orm";
import { Effect, Schema } from "effect";
import { nanoid } from "nanoid";

import { agent } from "@/db/schemas/agent-schema";
import { memory, userMemorySettings } from "@/db/schemas/memory-schema";
import { Database, runMutation, runQuery } from "@/db/service";

const DEFAULT_CAP = 500;
const MAX_CAP = 10_000;

export interface MemoryListItem {
  content: string;
  createdAt: Date;
  id: string;
  sourceAgentId: null | string;
  sourceAgentName: null | string;
}

interface MemorySearchHit {
  content: string;
  id: string;
  similarity: number;
}

// eslint-disable-next-line unicorn/throw-new-error -- false positive: Schema.TaggedError is a class factory
class MemoryCapReachedError extends Schema.TaggedError<MemoryCapReachedError>()(
  "MemoryCapReachedError",
  { cap: Schema.Number, current: Schema.Number, message: Schema.String },
) {}

// eslint-disable-next-line unicorn/throw-new-error -- false positive: Schema.TaggedError is a class factory
class MemoryNotFoundError extends Schema.TaggedError<MemoryNotFoundError>()("MemoryNotFoundError", {
  memoryId: Schema.String,
  message: Schema.String,
}) {}

export class MemoryService extends Effect.Service<MemoryService>()("MemoryService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const db = yield* Database;

    const getCap = Effect.fn("MemoryService.getCap")(function* (userId: string) {
      yield* Effect.annotateCurrentSpan("userId", userId);

      const rows = yield* runQuery(() => {
        return db
          .select({ cap: userMemorySettings.cap })
          .from(userMemorySettings)
          .where(eq(userMemorySettings.userId, userId))
          .limit(1);
      });

      return rows.at(0)?.cap ?? DEFAULT_CAP;
    });

    const countForUser = Effect.fn("MemoryService.countForUser")(function* (userId: string) {
      yield* Effect.annotateCurrentSpan("userId", userId);

      const rows = yield* runQuery(() => {
        return db
          .select({ count: sql<number>`count(*)::int` })
          .from(memory)
          .where(eq(memory.userId, userId));
      });

      return rows.at(0)?.count ?? 0;
    });

    const listForUser = Effect.fn("MemoryService.listForUser")(function* (userId: string) {
      yield* Effect.annotateCurrentSpan("userId", userId);

      return yield* runQuery(() => {
        return db
          .select({
            content: memory.content,
            createdAt: memory.createdAt,
            id: memory.id,
            sourceAgentId: memory.sourceAgentId,
            sourceAgentName: agent.name,
          })
          .from(memory)
          .leftJoin(agent, eq(agent.id, memory.sourceAgentId))
          .where(eq(memory.userId, userId))
          .orderBy(desc(memory.createdAt));
      });
    });

    const add = Effect.fn("MemoryService.add")(function* (input: {
      content: string;
      sourceAgentId: null | string;
      userId: string;
    }) {
      yield* Effect.annotateCurrentSpan("userId", input.userId);

      const id = nanoid();

      const outcome = yield* runMutation(() => {
        return db.transaction(async (tx) => {
          await tx
            .insert(userMemorySettings)
            .values({ cap: DEFAULT_CAP, userId: input.userId })
            .onConflictDoNothing({ target: userMemorySettings.userId });

          const settings = await tx
            .select({ cap: userMemorySettings.cap })
            .from(userMemorySettings)
            .where(eq(userMemorySettings.userId, input.userId))
            .for("update")
            .limit(1);

          const cap = settings.at(0)?.cap ?? DEFAULT_CAP;

          const counts = await tx
            .select({ count: sql<number>`count(*)::int` })
            .from(memory)
            .where(eq(memory.userId, input.userId));

          const current = counts.at(0)?.count ?? 0;

          if (current >= cap) {
            return { cap, current, kind: "cap-reached" as const };
          }

          await tx.insert(memory).values({
            content: input.content,
            id,
            sourceAgentId: input.sourceAgentId,
            userId: input.userId,
          });

          return { kind: "ok" as const };
        });
      });

      if (outcome.kind === "cap-reached") {
        return yield* Effect.fail(
          new MemoryCapReachedError({
            cap: outcome.cap,
            current: outcome.current,
            message: `Memory cap reached (${outcome.current}/${outcome.cap}).`,
          }),
        );
      }

      return { id };
    });

    const remove = Effect.fn("MemoryService.remove")(function* (memoryId: string, userId: string) {
      yield* Effect.annotateCurrentSpan("memoryId", memoryId);
      yield* Effect.annotateCurrentSpan("userId", userId);

      const result = yield* runMutation(() => {
        return db
          .delete(memory)
          .where(and(eq(memory.id, memoryId), eq(memory.userId, userId)))
          .returning({ id: memory.id });
      });

      if (result.length === 0) {
        return yield* Effect.fail(
          new MemoryNotFoundError({ memoryId, message: "Memory not found." }),
        );
      }

      return { id: memoryId };
    });

    const updateCap = Effect.fn("MemoryService.updateCap")(function* (userId: string, cap: number) {
      yield* Effect.annotateCurrentSpan("userId", userId);

      const clamped = Math.max(1, Math.min(MAX_CAP, Math.floor(cap)));

      yield* runMutation(() => {
        return db
          .insert(userMemorySettings)
          .values({ cap: clamped, userId })
          .onConflictDoUpdate({
            set: { cap: clamped, updatedAt: new Date() },
            target: userMemorySettings.userId,
          });
      });

      return { cap: clamped };
    });

    const listPendingEmbeddings = Effect.fn("MemoryService.listPendingEmbeddings")(function* (
      userId: string,
    ) {
      yield* Effect.annotateCurrentSpan("userId", userId);

      return yield* runQuery(() => {
        return db
          .select({ content: memory.content, id: memory.id })
          .from(memory)
          .where(and(eq(memory.userId, userId), isNull(memory.embedding)));
      });
    });

    const setEmbeddings = Effect.fn("MemoryService.setEmbeddings")(function* (
      updates: { embedding: number[]; id: string }[],
    ) {
      if (updates.length === 0) return;

      yield* runMutation(() => {
        return db.transaction(async (tx) => {
          for (const update of updates) {
            await tx
              .update(memory)
              .set({ embedding: update.embedding })
              .where(eq(memory.id, update.id));
          }
        });
      });
    });

    const search = Effect.fn("MemoryService.search")(function* (
      userId: string,
      embedding: number[],
      options: { limit?: number; threshold?: number } = {},
    ) {
      yield* Effect.annotateCurrentSpan("userId", userId);

      const limit = Math.min(Math.max(options.limit ?? 5, 1), 20);
      const threshold = options.threshold ?? 0.4;
      const distance = cosineDistance(memory.embedding, embedding);
      const maxDistance = 1 - threshold;

      const rows = yield* runQuery(() => {
        return db
          .select({
            content: memory.content,
            id: memory.id,
            similarity: sql<number>`1 - (${distance})`,
          })
          .from(memory)
          .where(
            and(eq(memory.userId, userId), isNotNull(memory.embedding), lte(distance, maxDistance)),
          )
          .orderBy(distance)
          .limit(limit);
      });

      return rows satisfies MemorySearchHit[];
    });

    return {
      add,
      countForUser,
      getCap,
      listForUser,
      listPendingEmbeddings,
      remove,
      search,
      setEmbeddings,
      updateCap,
    };
  }),
}) {}
