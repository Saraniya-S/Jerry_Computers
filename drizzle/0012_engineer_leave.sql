CREATE TABLE "engineer_leave" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"engineer_id" uuid NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "engineer_leave_dates_check" CHECK ("engineer_leave"."ends_on" >= "engineer_leave"."starts_on")
);
--> statement-breakpoint
ALTER TABLE "engineer_leave" ADD CONSTRAINT "engineer_leave_engineer_id_users_id_fk" FOREIGN KEY ("engineer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "engineer_leave_engineer_idx" ON "engineer_leave" USING btree ("engineer_id","ends_on");