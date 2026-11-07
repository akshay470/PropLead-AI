CREATE TYPE "public"."buying_timeline" AS ENUM('within_1_month', '1_to_3_months', '3_to_6_months', 'exploring', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."lead_tier" AS ENUM('hot', 'warm', 'cold');--> statement-breakpoint
CREATE TABLE "lead_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"total" integer NOT NULL,
	"tier" "lead_tier" NOT NULL,
	"breakdown" jsonb NOT NULL,
	"data_completeness" varchar(50) NOT NULL,
	"score_version" varchar(20) DEFAULT 'v1' NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "buying_timeline" "buying_timeline" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "lead_scores" ADD CONSTRAINT "lead_scores_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "lead_scores_lead_id_idx" ON "lead_scores" USING btree ("lead_id");--> statement-breakpoint
CREATE INDEX "lead_scores_tier_idx" ON "lead_scores" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "lead_scores_total_idx" ON "lead_scores" USING btree ("total");--> statement-breakpoint
CREATE INDEX "lead_scores_computed_at_idx" ON "lead_scores" USING btree ("computed_at");