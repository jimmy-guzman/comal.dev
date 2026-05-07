CREATE TABLE "agent" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"default_model_id" text NOT NULL,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"name" text NOT NULL,
	"system_prompt" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_subagent" (
	"alias" text NOT NULL,
	"child_agent_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"description_override" text,
	"parent_agent_id" text NOT NULL,
	CONSTRAINT "agent_subagent_parent_agent_id_child_agent_id_pk" PRIMARY KEY("parent_agent_id","child_agent_id"),
	CONSTRAINT "agent_subagent_parent_alias_unique" UNIQUE("parent_agent_id","alias"),
	CONSTRAINT "agent_subagent_no_self" CHECK ("agent_subagent"."parent_agent_id" <> "agent_subagent"."child_agent_id")
);
--> statement-breakpoint
CREATE TABLE "agent_tool" (
	"agent_id" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"tool_id" text NOT NULL,
	CONSTRAINT "agent_tool_agent_id_tool_id_pk" PRIMARY KEY("agent_id","tool_id")
);
--> statement-breakpoint
CREATE TABLE "account" (
	"access_token" text,
	"access_token_expires_at" timestamp,
	"account_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"id_token" text,
	"password" text,
	"provider_id" text NOT NULL,
	"refresh_token" text,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"updated_at" timestamp NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"inviter_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"logo" text,
	"metadata" text,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"updated_at" timestamp,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"active_organization_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"ip_address" text,
	"token" text NOT NULL,
	"updated_at" timestamp NOT NULL,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"image" text,
	"is_anonymous" boolean DEFAULT false,
	"name" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_event" (
	"conversation_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"event_type" text NOT NULL,
	"message_id" text,
	"model_id" text,
	"payload" jsonb NOT NULL,
	"role" text NOT NULL,
	"sequence" bigserial NOT NULL,
	CONSTRAINT "chat_event_conversation_id_sequence_pk" PRIMARY KEY("conversation_id","sequence")
);
--> statement-breakpoint
CREATE TABLE "conversation" (
	"agent_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"model_id" text NOT NULL,
	"title" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_eval" (
	"agent_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expected" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"input" text NOT NULL,
	"name" text NOT NULL,
	"scorer" text NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agent_eval_scorer_valid" CHECK ("agent_eval"."scorer" IN ('contains', 'exact'))
);
--> statement-breakpoint
CREATE TABLE "agent_eval_run" (
	"created_at" timestamp DEFAULT now() NOT NULL,
	"eval_id" text NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"output" text NOT NULL,
	"score" integer NOT NULL,
	CONSTRAINT "agent_eval_run_score_valid" CHECK ("agent_eval_run"."score" IN (0, 1))
);
--> statement-breakpoint
ALTER TABLE "agent" ADD CONSTRAINT "agent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_subagent" ADD CONSTRAINT "agent_subagent_child_agent_id_agent_id_fk" FOREIGN KEY ("child_agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_subagent" ADD CONSTRAINT "agent_subagent_parent_agent_id_agent_id_fk" FOREIGN KEY ("parent_agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_tool" ADD CONSTRAINT "agent_tool_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_event" ADD CONSTRAINT "chat_event_conversation_id_conversation_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_eval" ADD CONSTRAINT "agent_eval_agent_id_agent_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agent"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_eval_run" ADD CONSTRAINT "agent_eval_run_eval_id_agent_eval_id_fk" FOREIGN KEY ("eval_id") REFERENCES "public"."agent_eval"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_userId_idx" ON "agent" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "agent_createdAt_idx" ON "agent" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_user_system_unique" ON "agent" USING btree ("user_id") WHERE "agent"."is_system" = true;--> statement-breakpoint
CREATE INDEX "agent_subagent_child_idx" ON "agent_subagent" USING btree ("child_agent_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "organization_slug_idx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_activeOrganizationId_idx" ON "session" USING btree ("active_organization_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "chat_event_messageId_idx" ON "chat_event" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "chat_event_createdAt_idx" ON "chat_event" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "conversation_userId_idx" ON "conversation" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "conversation_agentId_idx" ON "conversation" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "conversation_createdAt_idx" ON "conversation" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "agent_eval_agentId_idx" ON "agent_eval" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "agent_eval_run_evalId_idx" ON "agent_eval_run" USING btree ("eval_id");