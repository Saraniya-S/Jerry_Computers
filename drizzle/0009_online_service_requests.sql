ALTER TABLE "service_requests" ADD COLUMN "service_id" uuid;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "problem_type" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "preferred_date" date;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "preferred_window" text;--> statement-breakpoint
ALTER TABLE "service_requests" ADD COLUMN "client_request_id" uuid;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_service_id_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."services"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "service_requests_client_request_key" ON "service_requests" USING btree ("customer_id","client_request_id") WHERE "service_requests"."client_request_id" is not null;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_preferred_window" CHECK ("service_requests"."preferred_window" is null or "service_requests"."preferred_window" in ('morning', 'afternoon', 'evening'));