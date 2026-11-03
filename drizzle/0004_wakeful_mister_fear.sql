CREATE TABLE "executive_projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"executive_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "visit_slots" ADD COLUMN "blocked_reason" text;--> statement-breakpoint
ALTER TABLE "executive_projects" ADD CONSTRAINT "executive_projects_executive_id_users_id_fk" FOREIGN KEY ("executive_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "executive_projects" ADD CONSTRAINT "executive_projects_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exec_project_unique_idx" ON "executive_projects" USING btree ("executive_id","project_id");--> statement-breakpoint
CREATE INDEX "exec_projects_exec_idx" ON "executive_projects" USING btree ("executive_id");--> statement-breakpoint
CREATE INDEX "exec_projects_proj_idx" ON "executive_projects" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "leads_created_idx" ON "leads" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "slots_starts_at_idx" ON "visit_slots" USING btree ("starts_at");