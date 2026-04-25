import type { UIMessage } from "ai";
import { count, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { z } from "zod";

const textPartSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
  state: z.enum(["streaming", "done"]).optional(),
});

const reasoningPartSchema = z.object({
  type: z.literal("reasoning"),
  text: z.string(),
  state: z.enum(["streaming", "done"]).optional(),
});

const stepStartPartSchema = z.object({
  type: z.literal("step-start"),
});

const toolStateSchema = z.enum([
  "input-streaming",
  "input-available",
  "approval-requested",
  "output-available",
  "output-error",
]);

const dynamicToolPartSchema = z.object({
  type: z.literal("dynamic-tool"),
  toolName: z.string(),
  toolCallId: z.string(),
  state: toolStateSchema,
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  errorText: z.string().optional(),
});

const filePartSchema = z.object({
  type: z.literal("file"),
  mediaType: z.string(),
  url: z.string(),
  filename: z.string().optional(),
});

const sourceUrlPartSchema = z.object({
  type: z.literal("source-url"),
  sourceId: z.string(),
  url: z.string(),
  title: z.string().optional(),
});

const toolCallPartSchema = z.object({
  type: z.literal("tool-call"),
  toolCallId: z.string(),
  toolName: z.string(),
  args: z.unknown(),
});

const toolResultPartSchema = z.object({
  type: z.literal("tool-result"),
  toolCallId: z.string(),
  toolName: z.string(),
  result: z.unknown(),
});

const uiMessagePartSchema = z.union([
  textPartSchema,
  reasoningPartSchema,
  stepStartPartSchema,
  dynamicToolPartSchema,
  toolCallPartSchema,
  toolResultPartSchema,
  filePartSchema,
  sourceUrlPartSchema,
  z.object({ type: z.string() }).passthrough(),
]);

const uiMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["system", "user", "assistant"]),
  parts: z.array(uiMessagePartSchema),
});

export const parseStoredMessages = (
  rows: Array<{ id: string; role: string; parts: unknown }>,
): UIMessage[] =>
  rows.flatMap((row) => {
    const result = uiMessageSchema.safeParse(row);
    return result.success ? [result.data as UIMessage] : [];
  });

import { and } from "drizzle-orm";

import { db } from "@/db/client";
import { chatMessage, conversation } from "@/db/schemas/chat-schema";

export const listConversationsForAgent = async (userId: string, agentId: string) => {
  return db
    .select({
      id: conversation.id,
      title: conversation.title,
      modelId: conversation.modelId,
      createdAt: conversation.createdAt,
    })
    .from(conversation)
    .where(and(eq(conversation.userId, userId), eq(conversation.agentId, agentId)))
    .orderBy(desc(conversation.createdAt))
    .limit(20);
};

export const createConversation = async ({
  userId,
  agentId,
  title,
  modelId,
}: {
  userId: string;
  agentId: string;
  title: string;
  modelId: string;
}) => {
  const id = nanoid();
  await db.insert(conversation).values({ id, userId, agentId, modelId, title });
  return { id };
};

export const getConversationWithMessages = async (userId: string, conversationId: string) => {
  const [conv] = await db
    .select()
    .from(conversation)
    .where(eq(conversation.id, conversationId))
    .limit(1);

  if (!conv || conv.userId !== userId) return null;

  const messages = await db
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.conversationId, conversationId))
    .orderBy(chatMessage.createdAt);

  return { ...conv, messages };
};

export const assertConversationAccess = async (userId: string, conversationId: string) => {
  const [conv] = await db
    .select({ userId: conversation.userId })
    .from(conversation)
    .where(eq(conversation.id, conversationId))
    .limit(1);

  return conv?.userId === userId;
};

export const getConversationAgent = async (conversationId: string) => {
  const [conv] = await db
    .select({ agentId: conversation.agentId, modelId: conversation.modelId })
    .from(conversation)
    .where(eq(conversation.id, conversationId))
    .limit(1);

  return conv ?? null;
};

export const updateConversationTitle = async (conversationId: string, title: string) => {
  await db.update(conversation).set({ title }).where(eq(conversation.id, conversationId));
};

export const updateConversationModel = async (conversationId: string, modelId: string) => {
  await db.update(conversation).set({ modelId }).where(eq(conversation.id, conversationId));
};

export const getConversationMessageCount = async (conversationId: string) => {
  const [result] = await db
    .select({ count: count() })
    .from(chatMessage)
    .where(eq(chatMessage.conversationId, conversationId));

  return result?.count ?? 0;
};

export const insertChatMessage = async ({
  id,
  conversationId,
  role,
  parts,
  modelId,
}: {
  id?: string;
  conversationId: string;
  role: string;
  parts: unknown;
  modelId?: string | null;
}) => {
  await db.insert(chatMessage).values({
    id: id ?? nanoid(),
    conversationId,
    role,
    parts: parts as Record<string, unknown>,
    modelId: modelId ?? null,
  });
};

export const migrateAnonymousUserData = async ({
  anonymousUserId,
  newUserId,
}: {
  anonymousUserId: string;
  newUserId: string;
}) => {
  await db
    .update(conversation)
    .set({ userId: newUserId })
    .where(eq(conversation.userId, anonymousUserId));
};
