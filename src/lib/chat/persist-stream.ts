import type { TextStreamPart, ToolSet } from "ai";

import { eq } from "drizzle-orm";
import { Effect } from "effect";

import { appRuntime } from "@/db/runtime";
import { chatEvent } from "@/db/schemas/chat-schema";
import { modelPricing } from "@/db/schemas/model-pricing-schema";
import { Database, runMutation, runQuery } from "@/db/service";
import { ValidationError } from "@/lib/errors";

import type { MapStreamPartContext } from "./event-mapper";
import type { ChatEventInput } from "./events";

import { createSegmentBuffer, mapStreamPartToEvent } from "./event-mapper";
import { validateEventPayload } from "./events";

interface AppendChatEventArgs {
  conversationId: string;
  costMicrodollars?: null | number;
  event: ChatEventInput;
  modelId: null | string;
  parentToolCallId?: null | string;
}

interface PricingEntry {
  inputCost: number;
  outputCost: number;
}

interface CachedPricing {
  fetchedAt: number;
  value: PricingEntry;
}

const PRICING_CACHE_TTL_MS = 10 * 60 * 1000;

const pricingCache = new Map<string, CachedPricing>();

interface TotalUsage {
  inputTokens?: number;
  outputTokens?: number;
}

export class ChatPersistService extends Effect.Service<ChatPersistService>()("ChatPersistService", {
  accessors: true,
  effect: Effect.gen(function* () {
    const db = yield* Database;

    const appendChatEvent = Effect.fn("ChatPersistService.appendChatEvent")(function* (
      args: AppendChatEventArgs,
    ) {
      yield* Effect.annotateCurrentSpan("conversationId", args.conversationId);
      yield* Effect.annotateCurrentSpan("eventType", args.event.eventType);

      const validatedPayload = yield* Effect.try({
        catch: (cause) => {
          return new ValidationError({
            message: cause instanceof Error ? cause.message : String(cause),
          });
        },
        try: () => {
          return validateEventPayload(args.event.eventType, args.event.payload);
        },
      });

      yield* runMutation(() => {
        return db.insert(chatEvent).values({
          conversationId: args.conversationId,
          costMicrodollars: args.costMicrodollars ?? null,
          endedAt: args.event.endedAt,
          eventType: args.event.eventType,
          messageId: args.event.messageId,
          modelId: args.modelId,
          parentToolCallId: args.parentToolCallId ?? null,
          payload: validatedPayload,
          role: args.event.role,
          startedAt: args.event.startedAt,
        });
      });
    });

    const lookupPricing = Effect.fn("ChatPersistService.lookupPricing")(function* (
      modelId: string,
    ) {
      yield* Effect.annotateCurrentSpan("modelId", modelId);

      const cached = pricingCache.get(modelId);

      if (cached && Date.now() - cached.fetchedAt < PRICING_CACHE_TTL_MS) return cached.value;

      const rows = yield* runQuery(() => {
        return db
          .select({ inputCost: modelPricing.inputCost, outputCost: modelPricing.outputCost })
          .from(modelPricing)
          .where(eq(modelPricing.modelId, modelId))
          .limit(1);
      });

      const row = rows.at(0);

      if (!row) return null;

      const inputCost = Number.parseFloat(row.inputCost);
      const outputCost = Number.parseFloat(row.outputCost);

      if (
        !Number.isFinite(inputCost) ||
        inputCost < 0 ||
        !Number.isFinite(outputCost) ||
        outputCost < 0
      )
        return null;

      const entry: PricingEntry = { inputCost, outputCost };

      pricingCache.set(modelId, { fetchedAt: Date.now(), value: entry });

      return entry;
    });

    const computeCostMicrodollars = Effect.fn("ChatPersistService.computeCostMicrodollars")(
      function* (modelId: null | string, totalUsage: TotalUsage) {
        if (!modelId) return null;

        const inputTokens = Math.max(
          0,
          Number.isFinite(totalUsage.inputTokens) ? (totalUsage.inputTokens ?? 0) : 0,
        );
        const outputTokens = Math.max(
          0,
          Number.isFinite(totalUsage.outputTokens) ? (totalUsage.outputTokens ?? 0) : 0,
        );

        if (inputTokens === 0 && outputTokens === 0) return null;

        const pricing = yield* lookupPricing(modelId).pipe(
          Effect.catchAll(() => Effect.succeed(null)),
        );

        if (!pricing) return null;

        return Math.round(inputTokens * pricing.inputCost + outputTokens * pricing.outputCost);
      },
    );

    return { appendChatEvent, computeCostMicrodollars, lookupPricing };
  }),
}) {}

interface PersistStreamArgs {
  conversationId: string;
  fullStream: AsyncIterable<TextStreamPart<ToolSet>>;
  messageId: string;
  modelId: null | string;
  onEventError?: (error: unknown, event: ChatEventInput) => void;
  parentToolCallId?: null | string;
}

const buildContext = (messageId: string, modelId: null | string): MapStreamPartContext => {
  return {
    buffer: createSegmentBuffer(),
    messageId,
    modelId,
    toolStartTimes: new Map(),
  };
};

const isPreliminaryToolOutput = (event: ChatEventInput): boolean => {
  if (event.eventType !== "tool-output-available") return false;

  const payload = event.payload as { preliminary?: boolean };

  return payload.preliminary === true;
};

interface PersistStreamResult {
  costMicrodollars: null | number;
}

export const persistChatStream = async (args: PersistStreamArgs): Promise<PersistStreamResult> => {
  const ctx = buildContext(args.messageId, args.modelId);

  let totalCostMicrodollars: null | number = null;

  for await (const part of args.fullStream) {
    const event = mapStreamPartToEvent(part, ctx);

    if (event === null) continue;

    if (isPreliminaryToolOutput(event)) continue;

    let costMicrodollars: null | number = null;

    if (event.eventType === "assistant-turn-finish") {
      const payload = event.payload as { totalUsage?: TotalUsage };

      if (payload.totalUsage) {
        costMicrodollars = await appRuntime.runPromise(
          ChatPersistService.computeCostMicrodollars(args.modelId, payload.totalUsage),
        );
      }
    }

    try {
      await appRuntime.runPromise(
        ChatPersistService.appendChatEvent({
          conversationId: args.conversationId,
          costMicrodollars,
          event,
          modelId: args.modelId,
          parentToolCallId: args.parentToolCallId,
        }),
      );

      if (event.eventType === "assistant-turn-finish" && costMicrodollars !== null) {
        totalCostMicrodollars = costMicrodollars;
      }
    } catch (error) {
      args.onEventError?.(error, event);
    }
  }

  return { costMicrodollars: totalCostMicrodollars };
};
