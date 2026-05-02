import type { TextStreamPart, ToolSet } from "ai";

import { Effect } from "effect";

import type { DatabaseError } from "@/lib/errors";

import { chatEvent } from "@/db/schemas/chat-schema";
import { appRuntime, Database, runQuery } from "@/db/service";
import { ValidationError } from "@/lib/errors";

import type { MapStreamPartContext } from "./event-mapper";
import type { ChatEventInput } from "./events";

import { createSegmentBuffer, mapStreamPartToEvent } from "./event-mapper";
import { validateEventPayload } from "./events";

interface AppendChatEventArgs {
  conversationId: string;
  event: ChatEventInput;
  modelId: null | string;
}

export const appendChatEvent = (
  args: AppendChatEventArgs,
): Effect.Effect<void, DatabaseError | ValidationError, Database> => {
  return Effect.gen(function* () {
    const validatedPayload = yield* Effect.try({
      catch: (cause) => {
        return new ValidationError({
          message: cause instanceof Error ? cause.message : String(cause),
        });
      },
      try: () => validateEventPayload(args.event.eventType, args.event.payload),
    });

    const db = yield* Database;

    yield* runQuery(() => {
      return db.insert(chatEvent).values({
        conversationId: args.conversationId,
        eventType: args.event.eventType,
        messageId: args.event.messageId,
        modelId: args.modelId,
        payload: validatedPayload,
        role: args.event.role,
      });
    });
  });
};

const persistChatEvent = (args: AppendChatEventArgs) => {
  return appRuntime.runPromise(appendChatEvent(args));
};

interface PersistStreamArgs {
  conversationId: string;
  fullStream: AsyncIterable<TextStreamPart<ToolSet>>;
  messageId: string;
  modelId: null | string;
  onEventError?: (error: unknown, event: ChatEventInput) => void;
}

const buildContext = (messageId: string, modelId: null | string): MapStreamPartContext => {
  return { buffer: createSegmentBuffer(), messageId, modelId };
};

const isPreliminaryToolOutput = (event: ChatEventInput): boolean => {
  if (event.eventType !== "tool-output-available") return false;

  const payload = event.payload as { preliminary?: boolean };

  return payload.preliminary === true;
};

export const persistChatStream = async (args: PersistStreamArgs): Promise<void> => {
  const ctx = buildContext(args.messageId, args.modelId);

  for await (const part of args.fullStream) {
    const event = mapStreamPartToEvent(part, ctx);

    if (event === null) continue;

    if (isPreliminaryToolOutput(event)) continue;

    try {
      await persistChatEvent({
        conversationId: args.conversationId,
        event,
        modelId: args.modelId,
      });
    } catch (error) {
      args.onEventError?.(error, event);
    }
  }
};
