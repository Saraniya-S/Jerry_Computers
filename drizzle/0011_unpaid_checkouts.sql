ALTER TABLE "orders" ADD COLUMN "placed_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "orders_unpaid_checkout_idx" ON "orders" USING btree ("created_at") WHERE "orders"."placed_at" is null;--> statement-breakpoint
-- Every existing order counts as placed, except online orders still waiting for their payment:
-- those become unpaid checkouts, which staff no longer see and which expire like new ones.
UPDATE "orders" SET "placed_at" = "created_at" WHERE NOT ("payment_method" = 'online' AND "payment_status" = 'pending' AND "status" = 'placed');
