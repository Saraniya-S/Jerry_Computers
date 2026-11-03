CREATE TYPE "public"."leave_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
ALTER TABLE "engineer_leave" ADD COLUMN "status" "leave_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "engineer_leave" ADD COLUMN "decided_by_id" uuid;--> statement-breakpoint
ALTER TABLE "engineer_leave" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "engineer_leave" ADD COLUMN "decision_note" text;--> statement-breakpoint
ALTER TABLE "engineer_leave" ADD CONSTRAINT "engineer_leave_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "engineer_leave_status_idx" ON "engineer_leave" USING btree ("status");--> statement-breakpoint
-- Leave booked before approvals existed was already in effect, so it counts as approved.
UPDATE "engineer_leave" SET "status" = 'approved', "decided_at" = "created_at";
