import { and, desc, eq } from "drizzle-orm";
import { Effect } from "effect";
import { nanoid } from "nanoid";

import { agent } from "@/db/schemas/agent-schema";
import { chatEvent, conversation } from "@/db/schemas/chat-schema";
import { Database, runMutation, runQuery } from "@/db/service";
import { validateEventPayload } from "@/lib/chat/events";
import { ConversationNotFoundError, ForbiddenError, ValidationError } from "@/lib/errors";

export class ChatService extends Effect.Service<ChatService>()("ChatService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const db = yield* Database;

    const listRecentForUser = Effect.fn("ChatService.listRecentForUser")(function* (
      userId: string,
      limit: number,
    ) {
      yield* Effect.annotateCurrentSpan("userId", userId);

      return yield* runQuery(() => {
        return db
          .select({
            agentId: conversation.agentId,
            agentName: agent.name,
            createdAt: conversation.createdAt,
            id: conversation.id,
            title: conversation.title,
          })
          .from(conversation)
          .innerJoin(agent, and(eq(agent.id, conversation.agentId), eq(agent.userId, userId)))
          .where(and(eq(conversation.userId, userId), eq(conversation.kind, "chat")))
          .orderBy(desc(conversation.createdAt))
          .limit(limit);
      });
    });

    const listForAgent = Effect.fn("ChatService.listForAgent")(function* (
      userId: string,
      agentId: string,
    ) {
      yield* Effect.annotateCurrentSpan("agentId", agentId);
      yield* Effect.annotateCurrentSpan("userId", userId);

      return yield* runQuery(() => {
        return db
          .select({
            createdAt: conversation.createdAt,
            id: conversation.id,
            modelId: conversation.modelId,
            title: conversation.title,
          })
          .from(conversation)
          .where(
            and(
              eq(conversation.userId, userId),
              eq(conversation.agentId, agentId),
              eq(conversation.kind, "chat"),
            ),
          )
          .orderBy(desc(conversation.createdAt))
          .limit(20);
      });
    });

    const createWithFirstUserMessage = Effect.fn("ChatService.createWithFirstUserMessage")(
      function* (input: {
        agentId: string;
        agentVersionId?: null | string;
        kind?: "chat" | "eval";
        modelId: string;
        title: string;
        userId: string;
        userMessage: { id: string; parts: unknown[] };
      }) {
        yield* Effect.annotateCurrentSpan("agentId", input.agentId);
        yield* Effect.annotateCurrentSpan("userId", input.userId);

        const validatedPayload = yield* Effect.try({
          catch: (cause) => {
            return new ValidationError({
              message: cause instanceof Error ? cause.message : String(cause),
            });
          },
          try: () => {
            return validateEventPayload("user-message", { parts: input.userMessage.parts });
          },
        });

        const id = nanoid();

        yield* runMutation(() => {
          return db.transaction(async (tx) => {
            await tx.insert(conversation).values({
              agentId: input.agentId,
              agentVersionId: input.agentVersionId ?? null,
              id,
              kind: input.kind ?? "chat",
              modelId: input.modelId,
              title: input.title,
              userId: input.userId,
            });
            await tx.insert(chatEvent).values({
              conversationId: id,
              eventType: "user-message",
              messageId: input.userMessage.id,
              modelId: input.modelId,
              payload: validatedPayload,
              role: "user",
            });
          });
        });

        return { id };
      },
    );

    const setAgentVersion = Effect.fn("ChatService.setAgentVersion")(function* (
      conversationId: string,
      agentVersionId: null | string,
    ) {
      yield* Effect.annotateCurrentSpan("conversationId", conversationId);

      yield* runMutation(() => {
        return db
          .update(conversation)
          .set({ agentVersionId })
          .where(eq(conversation.id, conversationId));
      });
    });

    const assertAccess = Effect.fn("ChatService.assertAccess")(function* (
      userId: string,
      conversationId: string,
    ) {
      yield* Effect.annotateCurrentSpan("conversationId", conversationId);
      yield* Effect.annotateCurrentSpan("userId", userId);

      const rows = yield* runQuery(() => {
        return db
          .select({ userId: conversation.userId })
          .from(conversation)
          .where(eq(conversation.id, conversationId))
          .limit(1);
      });

      yield* Effect.when(
        Effect.fail(
          new ForbiddenError({ message: "You do not have access to this conversation." }),
        ),
        () => rows[0]?.userId !== userId,
      );
    });

    const getAgent = Effect.fn("ChatService.getAgent")(function* (conversationId: string) {
      yield* Effect.annotateCurrentSpan("conversationId", conversationId);

      const rows = yield* runQuery(() => {
        return db
          .select({ agentId: conversation.agentId, modelId: conversation.modelId })
          .from(conversation)
          .where(eq(conversation.id, conversationId))
          .limit(1);
      });

      const conv = rows.at(0);

      if (conv === undefined) {
        return yield* Effect.fail(
          new ConversationNotFoundError({ conversationId, message: "Conversation not found." }),
        );
      }

      return conv;
    });

    const remove = Effect.fn("ChatService.delete")(function* (conversationId: string) {
      yield* Effect.annotateCurrentSpan("conversationId", conversationId);

      yield* runQuery(() => {
        return db.delete(conversation).where(eq(conversation.id, conversationId));
      });
    });

    const updateTitle = Effect.fn("ChatService.updateTitle")(function* (
      conversationId: string,
      title: string,
    ) {
      yield* Effect.annotateCurrentSpan("conversationId", conversationId);

      yield* runQuery(() => {
        return db.update(conversation).set({ title }).where(eq(conversation.id, conversationId));
      });
    });

    const updateModel = Effect.fn("ChatService.updateModel")(function* (
      conversationId: string,
      modelId: string,
    ) {
      yield* Effect.annotateCurrentSpan("conversationId", conversationId);
      yield* Effect.annotateCurrentSpan("modelId", modelId);

      yield* runQuery(() => {
        return db.update(conversation).set({ modelId }).where(eq(conversation.id, conversationId));
      });
    });

    const updateAgent = Effect.fn("ChatService.updateAgent")(function* (
      conversationId: string,
      agentId: string,
    ) {
      yield* Effect.annotateCurrentSpan("conversationId", conversationId);
      yield* Effect.annotateCurrentSpan("agentId", agentId);

      yield* runQuery(() => {
        return db.update(conversation).set({ agentId }).where(eq(conversation.id, conversationId));
      });
    });

    return {
      assertAccess,
      createWithFirstUserMessage,
      delete: remove,
      getAgent,
      listForAgent,
      listRecentForUser,
      setAgentVersion,
      updateAgent,
      updateModel,
      updateTitle,
    };
  }),
}) {}

export const migrateAnonymousUserData = async ({
  anonymousUserId,
  newUserId,
}: {
  anonymousUserId: string;
  newUserId: string;
}) => {
  const { db } = await import("@/db/client");

  await db
    .update(conversation)
    .set({ userId: newUserId })
    .where(eq(conversation.userId, anonymousUserId));
};
