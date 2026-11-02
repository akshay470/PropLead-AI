ALTER TABLE "handoffs" ADD COLUMN "conversation_id" uuid;--> statement-breakpoint
ALTER TABLE "handoffs" ADD COLUMN "reason" varchar(50) DEFAULT 'buyer_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "latency_ms" integer;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "fact_ids" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "payload" text;--> statement-breakpoint
ALTER TABLE "handoffs" ADD CONSTRAINT "handoffs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE set null ON UPDATE no action;