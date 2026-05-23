/* eslint-disable unicorn/throw-new-error -- false positive: Schema.TaggedError is a class factory, not a thrown error */
import { Schema } from "effect";

export class UnauthorizedError extends Schema.TaggedError<UnauthorizedError>()(
  "UnauthorizedError",
  {
    message: Schema.String,
  },
) {}

export class ForbiddenError extends Schema.TaggedError<ForbiddenError>()("ForbiddenError", {
  message: Schema.String,
}) {}

export class ValidationError extends Schema.TaggedError<ValidationError>()("ValidationError", {
  cause: Schema.optional(Schema.String),
  message: Schema.String,
}) {}

export class AgentNotFoundError extends Schema.TaggedError<AgentNotFoundError>()(
  "AgentNotFoundError",
  { agentId: Schema.String, message: Schema.String },
) {}

export class AgentVersionNotFoundError extends Schema.TaggedError<AgentVersionNotFoundError>()(
  "AgentVersionNotFoundError",
  { agentId: Schema.String, message: Schema.String, versionId: Schema.String },
) {}

export class ConversationNotFoundError extends Schema.TaggedError<ConversationNotFoundError>()(
  "ConversationNotFoundError",
  { conversationId: Schema.String, message: Schema.String },
) {}

export class EvalNotFoundError extends Schema.TaggedError<EvalNotFoundError>()(
  "EvalNotFoundError",
  { evalId: Schema.String, message: Schema.String },
) {}

export class UnknownToolError extends Schema.TaggedError<UnknownToolError>()("UnknownToolError", {
  message: Schema.String,
  toolId: Schema.String,
}) {}

export class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  cause: Schema.Unknown,
  message: Schema.String,
}) {}

export class LLMError extends Schema.TaggedError<LLMError>()("LLMError", {
  cause: Schema.optional(Schema.String),
  message: Schema.String,
}) {}

export class MessageConversionError extends Schema.TaggedError<MessageConversionError>()(
  "MessageConversionError",
  { cause: Schema.optional(Schema.String), message: Schema.String },
) {}

export class AgentCycleError extends Schema.TaggedError<AgentCycleError>()("AgentCycleError", {
  cycle: Schema.Array(Schema.String),
  message: Schema.String,
}) {}

export class RateLimitCheckError extends Schema.TaggedError<RateLimitCheckError>()(
  "RateLimitCheckError",
  { cause: Schema.optional(Schema.String), message: Schema.String },
) {}
/* eslint-enable unicorn/throw-new-error -- re-enable after Schema.TaggedError declarations */
