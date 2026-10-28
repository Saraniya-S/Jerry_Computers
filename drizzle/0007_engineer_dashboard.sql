CREATE TYPE "public"."service_note_kind" AS ENUM('note', 'inspection', 'diagnosis', 'work_done', 'parts_used', 'parts_required', 'customer_feedback', 'completion', 'follow_up');--> statement-breakpoint
ALTER TYPE "public"."service_status" ADD VALUE 'accepted' BEFORE 'in_progress';--> statement-breakpoint
ALTER TYPE "public"."service_status" ADD VALUE 'awaiting_customer' BEFORE 'completed';--> statement-breakpoint
ALTER TYPE "public"."service_status" ADD VALUE 'unable_to_complete' BEFORE 'completed';--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "service_events" ADD COLUMN "kind" "service_note_kind" DEFAULT 'note' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "scheduled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("user_id") WHERE "notifications"."read_at" is null;--> statement-breakpoint
CREATE INDEX "service_requests_scheduled_idx" ON "service_requests" USING btree ("assigned_engineer_id","scheduled_at");