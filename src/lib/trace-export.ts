import { Effect } from "effect";

import type { TraceEventRow } from "@/lib/chat/store";
import type { ConversationNotFoundError, DatabaseError, ForbiddenError } from "@/lib/errors";

import { ChatStoreService } from "./chat/store";

interface TraceExportData {
  agentId: string;
  createdAt: Date;
  events: TraceEventRow[];
  id: string;
  kind: string;
  modelId: string;
  title: string;
}

interface TraceExport {
  exportedAt: string;
  schemaVersion: 1;
  trace: TraceExportData;
}

export const buildTraceExport = (
  conversationId: string,
  userId: string,
): Effect.Effect<
  TraceExport,
  ConversationNotFoundError | DatabaseError | ForbiddenError,
  ChatStoreService
> => {
  return Effect.gen(function* () {
    const trace = yield* ChatStoreService.getConversationTrace(userId, conversationId);

    return {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      trace: {
        agentId: trace.agentId,
        createdAt: trace.conversationCreatedAt,
        events: trace.events,
        id: trace.id,
        kind: trace.kind,
        modelId: trace.modelId,
        title: trace.title,
      },
    } satisfies TraceExport;
  });
};
