CREATE TABLE "service_job_helpers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"engineer_id" uuid NOT NULL,
	"added_by_id" uuid,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "service_job_helpers" ADD CONSTRAINT "service_job_helpers_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_job_helpers" ADD CONSTRAINT "service_job_helpers_engineer_id_users_id_fk" FOREIGN KEY ("engineer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_job_helpers" ADD CONSTRAINT "service_job_helpers_added_by_id_users_id_fk" FOREIGN KEY ("added_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_job_helpers_active_key" ON "service_job_helpers" USING btree ("request_id","engineer_id") WHERE "service_job_helpers"."removed_at" is null;--> statement-breakpoint
CREATE INDEX "service_job_helpers_engineer_idx" ON "service_job_helpers" USING btree ("engineer_id") WHERE "service_job_helpers"."removed_at" is null;