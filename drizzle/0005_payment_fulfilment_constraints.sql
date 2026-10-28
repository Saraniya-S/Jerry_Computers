ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'placed'::text;--> statement-breakpoint
DROP TYPE "public"."order_status";--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('placed', 'packed', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'placed'::"public"."order_status";--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "status" SET DATA TYPE "public"."order_status" USING "status"::"public"."order_status";--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "taxable_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "intra_state" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "unit_price_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "order_items" ALTER COLUMN "gst_rate_bp" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "items_total_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ALTER COLUMN "total_paise" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "subtotal_paise";--> statement-breakpoint
ALTER TABLE "invoices" DROP COLUMN "gst_rate_bp";