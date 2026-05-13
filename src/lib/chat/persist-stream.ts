import type { TextStreamPart, ToolSet } from "ai";

import { eq } from "drizzle-orm";
import { Effect } from "effect";

import type { DatabaseError } from "@/lib/errors";

import { chatEvent } from "@/db/schemas/chat-schema";
import { modelPricing } from "@/db/schemas/model-pricing-schema";
import { appRuntime, Database, runMutation, runQuery } from "@/db/service";
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
};

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

const lookupPricing = async (modelId: string): Promise<null | PricingEntry> => {
  const cached = pricingCache.get(modelId);

  if (cached && Date.now() - cached.fetchedAt < PRICING_CACHE_TTL_MS) return cached.value;

  try {
    const rows = await appRuntime.runPromise(
      Effect.gen(function* () {
        const db = yield* Database;

        return yield* runQuery(() => {
          return db
            .select({ inputCost: modelPricing.inputCost, outputCost: modelPricing.outputCost })
            .from(modelPricing)
            .where(eq(modelPricing.modelId, modelId))
            .limit(1);
        });
      }),
    );

    const row = rows.at(0);

    if (!row) return null;

    const entry: PricingEntry = {
      inputCost: Number.parseFloat(row.inputCost),
      outputCost: Number.parseFloat(row.outputCost),
    };

    pricingCache.set(modelId, { fetchedAt: Date.now(), value: entry });

    return entry;
  } catch {
    return cached?.value ?? null;
  }
};

interface TotalUsage {
  completionTokens?: number;
  promptTokens?: number;
}

const computeCostMicrodollars = async (
  modelId: null | string,
  totalUsage: TotalUsage,
): Promise<null | number> => {
  if (!modelId) return null;

  const pricing = await lookupPricing(modelId);

  if (!pricing) return null;

  const promptTokens = totalUsage.promptTokens ?? 0;
  const completionTokens = totalUsage.completionTokens ?? 0;

  return Math.round(promptTokens * pricing.inputCost + completionTokens * pricing.outputCost);
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
        costMicrodollars = await computeCostMicrodollars(args.modelId, payload.totalUsage);
        totalCostMicrodollars = costMicrodollars;
      }
    }

    try {
      await persistChatEvent({
        conversationId: args.conversationId,
        costMicrodollars,
        event,
        modelId: args.modelId,
        parentToolCallId: args.parentToolCallId,
      });
    } catch (error) {
      args.onEventError?.(error, event);
    }
  }

  return { costMicrodollars: totalCostMicrodollars };
};
