CREATE TYPE "public"."collection_method" AS ENUM('cash', 'upi', 'card', 'bank_transfer');--> statement-breakpoint
CREATE TABLE "service_collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"amount_paise" integer NOT NULL,
	"method" "collection_method" NOT NULL,
	"note" text,
	"recorded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_collections_amount_nonzero" CHECK ("service_collections"."amount_paise" <> 0)
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "gateway_order_id" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "status" text DEFAULT 'succeeded' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "cod_available" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "service_collections" ADD CONSTRAINT "service_collections_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_collections" ADD CONSTRAINT "service_collections_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "service_collections_request_idx" ON "service_collections" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "service_collections_created_idx" ON "service_collections" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_gateway_order_key" ON "orders" USING btree ("gateway_order_id") WHERE "orders"."gateway_order_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "payments_gateway_reference_key" ON "payments" USING btree ("provider","kind","reference") WHERE "payments"."provider" <> 'manual' and "payments"."reference" is not null;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_status" CHECK ("payments"."status" in ('pending', 'succeeded', 'failed'));