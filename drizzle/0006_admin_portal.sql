CREATE TYPE "public"."assignment_method" AS ENUM('auto', 'manual', 'transfer', 'unassigned');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('laptop', 'desktop', 'cctv', 'printer', 'ups', 'other');--> statement-breakpoint
CREATE TYPE "public"."inventory_reason" AS ENUM('opening_balance', 'restock', 'correction', 'damaged', 'customer_return', 'order_placed', 'order_cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('payment', 'refund');--> statement-breakpoint
CREATE TYPE "public"."service_location" AS ENUM('in_shop', 'on_site');--> statement-breakpoint
CREATE TYPE "public"."service_priority" AS ENUM('low', 'normal', 'high', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."service_source" AS ENUM('online', 'walk_in', 'phone');--> statement-breakpoint
CREATE TYPE "public"."service_status" AS ENUM('open', 'assigned', 'in_progress', 'awaiting_parts', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('in_transit', 'out_for_delivery', 'delivered', 'returned', 'lost');--> statement-breakpoint
CREATE TYPE "public"."transfer_status" AS ENUM('pending', 'approved', 'rejected', 'withdrawn');--> statement-breakpoint
-- payment_status gains refund_pending. Recreated via text because migrations run in one transaction,
-- where a value added with ADD VALUE can't be used yet. Existing "refunded" rows were cancelled paid
-- orders shown as "Refund due" with no refund recorded, so they become refund_pending.
ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DEFAULT 'pending'::text;--> statement-breakpoint
DROP TYPE "public"."payment_status";--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'paid', 'refund_pending', 'refunded');--> statement-breakpoint
UPDATE "orders" SET "payment_status" = 'refund_pending' WHERE "payment_status" = 'refunded';--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DEFAULT 'pending'::"public"."payment_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "payment_status" SET DATA TYPE "public"."payment_status" USING "payment_status"::"public"."payment_status";--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"summary" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"parent_id" uuid,
	"is_department" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engineer_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"is_available" boolean DEFAULT true NOT NULL,
	"skills" "device_type"[] DEFAULT '{}' NOT NULL,
	"takes_on_site" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"variant_id" uuid,
	"delta" integer NOT NULL,
	"stock_after" integer NOT NULL,
	"reason" "inventory_reason" NOT NULL,
	"note" text,
	"order_id" uuid,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" "payment_kind" NOT NULL,
	"method" "payment_method" NOT NULL,
	"amount_paise" integer NOT NULL,
	"provider" text DEFAULT 'manual' NOT NULL,
	"reference" text,
	"note" text,
	"recorded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"attributes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_paise" integer,
	"stock" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variants_stock_nonnegative" CHECK ("product_variants"."stock" >= 0),
	CONSTRAINT "product_variants_price_positive" CHECK ("product_variants"."price_paise" is null or "product_variants"."price_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "service_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"engineer_id" uuid,
	"previous_engineer_id" uuid,
	"method" "assignment_method" NOT NULL,
	"active_jobs_before" integer,
	"reason" text,
	"decided_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"from_status" "service_status",
	"to_status" "service_status",
	"note" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" serial NOT NULL,
	"customer_id" uuid,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"contact_email" text,
	"source" "service_source" NOT NULL,
	"location" "service_location" NOT NULL,
	"service_address" jsonb,
	"device_type" "device_type" NOT NULL,
	"device_brand" text,
	"device_model" text,
	"serial_number" text,
	"accessories" text,
	"issue" text NOT NULL,
	"priority" "service_priority" DEFAULT 'normal' NOT NULL,
	"status" "service_status" DEFAULT 'open' NOT NULL,
	"assigned_engineer_id" uuid,
	"assigned_at" timestamp with time zone,
	"resolution" text,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_requests_on_site_address" CHECK ("service_requests"."location" = 'in_shop' or "service_requests"."service_address" is not null)
);
--> statement-breakpoint
CREATE TABLE "shipment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"status" "shipment_status" NOT NULL,
	"note" text,
	"location" text,
	"source" text DEFAULT 'staff' NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"recorded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"courier_code" text NOT NULL,
	"courier_name" text NOT NULL,
	"tracking_number" text NOT NULL,
	"tracking_url" text,
	"status" "shipment_status" DEFAULT 'in_transit' NOT NULL,
	"dispatched_at" timestamp with time zone NOT NULL,
	"delivered_at" timestamp with time zone,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfer_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"from_engineer_id" uuid NOT NULL,
	"to_engineer_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "transfer_status" DEFAULT 'pending' NOT NULL,
	"decided_by_id" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "transfer_requests_different_engineers" CHECK ("transfer_requests"."from_engineer_id" <> "transfer_requests"."to_engineer_id")
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancelled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "cancel_reason" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sku" text;--> statement-breakpoint
-- Existing products get their web address as SKU; admins can change it.
UPDATE "products" SET "sku" = upper("slug") WHERE "sku" IS NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "sku" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "brand_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "subcategory_id" uuid;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "low_stock_threshold" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "engineer_profiles" ADD CONSTRAINT "engineer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_variant_id_product_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_engineer_id_users_id_fk" FOREIGN KEY ("engineer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_previous_engineer_id_users_id_fk" FOREIGN KEY ("previous_engineer_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_assignments" ADD CONSTRAINT "service_assignments_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_events" ADD CONSTRAINT "service_events_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_events" ADD CONSTRAINT "service_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customer_id_users_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_assigned_engineer_id_users_id_fk" FOREIGN KEY ("assigned_engineer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_events" ADD CONSTRAINT "shipment_events_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_request_id_service_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."service_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_from_engineer_id_users_id_fk" FOREIGN KEY ("from_engineer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_to_engineer_id_users_id_fk" FOREIGN KEY ("to_engineer_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfer_requests" ADD CONSTRAINT "transfer_requests_decided_by_id_users_id_fk" FOREIGN KEY ("decided_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs" USING btree ("actor_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_slug_key" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_slug_key" ON "categories" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "categories_parent_idx" ON "categories" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "inventory_movements_product_idx" ON "inventory_movements" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "inventory_movements_created_idx" ON "inventory_movements" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "payments_order_idx" ON "payments" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "payments_created_idx" ON "payments" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_variants_product_idx" ON "product_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "service_assignments_request_idx" ON "service_assignments" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "service_assignments_engineer_idx" ON "service_assignments" USING btree ("engineer_id","created_at");--> statement-breakpoint
CREATE INDEX "service_events_request_idx" ON "service_events" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "service_requests_seq_key" ON "service_requests" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "service_requests_status_idx" ON "service_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "service_requests_engineer_idx" ON "service_requests" USING btree ("assigned_engineer_id","status");--> statement-breakpoint
CREATE INDEX "service_requests_customer_idx" ON "service_requests" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "service_requests_created_idx" ON "service_requests" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "shipment_events_shipment_idx" ON "shipment_events" USING btree ("shipment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "shipments_order_idx" ON "shipments" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shipments_courier_tracking_key" ON "shipments" USING btree ("courier_code","tracking_number");--> statement-breakpoint
CREATE INDEX "transfer_requests_status_idx" ON "transfer_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "transfer_requests_one_pending_key" ON "transfer_requests" USING btree ("request_id") WHERE "transfer_requests"."status" = 'pending';--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_subcategory_id_categories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_created_at_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_payment_idx" ON "orders" USING btree ("payment_method","payment_status");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_key" ON "products" USING btree ("sku");--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_stock_nonnegative" CHECK ("products"."stock" >= 0);--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_price_positive" CHECK ("products"."price_paise" is null or "products"."price_paise" > 0);--> statement-breakpoint
-- Store departments become the top of the category tree (names match src/data/products.ts).
INSERT INTO "categories" ("slug","name","is_department","sort_order") VALUES
  ('laptops','Laptops',true,0),('desktops','Desktops',true,1),('components','Components',true,2),('cctv','CCTV Systems',true,3),
  ('printers','Printers',true,4),('ups','UPS Devices',true,5),('accessories','Accessories',true,6)
  ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
-- Brands from the brand names already typed on products.
INSERT INTO "brands" ("name","slug")
  SELECT DISTINCT ON (lower(trim("brand"))) trim("brand"), trim(both '-' from regexp_replace(lower(trim("brand")), '[^a-z0-9]+', '-', 'g'))
  FROM "products" WHERE coalesce(trim("brand"), '') <> ''
  ON CONFLICT ("slug") DO NOTHING;--> statement-breakpoint
UPDATE "products" p SET "brand_id" = b."id" FROM "brands" b
  WHERE b."slug" = trim(both '-' from regexp_replace(lower(trim(p."brand")), '[^a-z0-9]+', '-', 'g'));--> statement-breakpoint
-- Stock history starts here: one opening-balance row per product with its current count.
INSERT INTO "inventory_movements" ("product_id","delta","stock_after","reason","note")
  SELECT "id", "stock", "stock", 'opening_balance', 'Stock on hand when movement history started' FROM "products";--> statement-breakpoint
-- Payment rows for orders already marked paid (amount, method and reference from the order).
INSERT INTO "payments" ("order_id","kind","method","amount_paise","provider","reference","note","recorded_by_id","created_at")
  SELECT o."id", 'payment', o."payment_method", o."total_paise", 'manual', o."payment_reference", 'Copied from the order when payment records were introduced',
    (SELECT i."sent_by_id" FROM "invoices" i WHERE i."order_id" = o."id"), coalesce(o."paid_at", o."updated_at")
  FROM "orders" o WHERE o."payment_status" IN ('paid', 'refund_pending') AND o."total_paise" > 0;--> statement-breakpoint
-- Shipments for orders that already have a courier and tracking number.
INSERT INTO "shipments" ("order_id","courier_code","courier_name","tracking_number","status","dispatched_at","delivered_at")
  SELECT "id", 'other', "courier_name", "tracking_number",
    CASE WHEN "status" = 'delivered' THEN 'delivered'::"shipment_status" ELSE 'in_transit'::"shipment_status" END,
    "updated_at", CASE WHEN "status" = 'delivered' THEN "updated_at" END
  FROM "orders" WHERE "tracking_number" IS NOT NULL AND "courier_name" IS NOT NULL
  ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "shipment_events" ("shipment_id","status","note","occurred_at")
  SELECT "id", "status", 'Copied from the order when shipment records were introduced', "dispatched_at" FROM "shipments";--> statement-breakpoint
INSERT INTO "engineer_profiles" ("user_id") SELECT "id" FROM "users" WHERE "role" = 'engineer' ON CONFLICT DO NOTHING;
