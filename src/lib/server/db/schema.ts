import { sql } from "drizzle-orm";
import { type AnyPgColumn, boolean, check, index, integer, jsonb, pgEnum, pgTable, primaryKey, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["customer", "engineer", "ecommerce_staff", "admin"]);
export const otpPurpose = pgEnum("otp_purpose", ["register", "login"]);
export const customerType = pgEnum("customer_type", ["personal", "business"]);
/** Fulfilment progress. Payment is tracked separately in paymentStatus. */
export const orderStatus = pgEnum("order_status", ["placed", "packed", "shipped", "delivered", "cancelled"]);
/** refund_pending: a paid order was cancelled and the money still has to go back; refunded: a refund is recorded. */
export const paymentStatus = pgEnum("payment_status", ["pending", "paid", "refund_pending", "refunded"]);
export const tokenPurpose = pgEnum("token_purpose", ["invite", "reset"]);
export const paymentMethod = pgEnum("payment_method", ["cod", "online"]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    role: userRole("role").notNull().default("customer"),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull().default(""),
    /** Stored lower-cased; unique. */
    email: text("email").notNull(),
    phone: text("phone"),
    /** Null for accounts that only sign in with Google. */
    passwordHash: text("password_hash"),
    /** Google's stable account id, for customers who use Google sign-in. */
    googleSub: text("google_sub"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    customerType: customerType("customer_type").notNull().default("personal"),
    companyName: text("company_name"),
    /** Indian GST number, for business invoices. */
    gstin: text("gstin"),
    whatsappUpdates: boolean("whatsapp_updates").notNull().default(false),
    /** Product categories the customer cares about (ProductCategoryId values). */
    interests: text("interests").array().notNull().default([]),
    /** Set when the customer finishes the welcome steps after registering. */
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    /** The owner account: an admin that can also manage other admins and staff. */
    isSuperAdmin: boolean("is_super_admin").notNull().default(false),
    /** Set when an admin switches the account off; it can't sign in. */
    disabledAt: timestamp("disabled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email), uniqueIndex("users_google_sub_key").on(t.googleSub).where(sql`${t.googleSub} is not null`)],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the cookie token; the token itself is never stored. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_id_idx").on(t.userId)],
);

/** A one-time code emailed to finish registration or login. */
export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: otpPurpose("purpose").notNull(),
    /** HMAC of the code with AUTH_SECRET. */
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    sendCount: integer("send_count").notNull().default(1),
    lastSentAt: timestamp("last_sent_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("otp_challenges_user_id_idx").on(t.userId)],
);

/** Delivery and on-site service addresses. */
export const addresses = pgTable(
  "addresses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    recipientName: text("recipient_name").notNull(),
    phone: text("phone").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    landmark: text("landmark"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    postalCode: text("postal_code").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("addresses_user_id_idx").on(t.userId),
    // At most one default address per customer.
    uniqueIndex("addresses_one_default_key").on(t.userId).where(sql`${t.isDefault}`),
  ],
);

export const cartItems = pgTable(
  "cart_items",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Product slug from the catalogue. */
    productSlug: text("product_slug").notNull(),
    quantity: integer("quantity").notNull(),
    addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.productSlug] })],
);

/** Delivery address copied onto the order, so later edits to the address book don't change it. */
export type AddressSnapshot = {
  label: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  postalCode: string;
};

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Running number for display, e.g. JC-000042. */
    seq: serial("seq").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: orderStatus("status").notNull().default("placed"),
    paymentMethod: paymentMethod("payment_method").notNull(),
    paymentStatus: paymentStatus("payment_status").notNull().default("pending"),
    /** UPI / bank reference, or a note such as "cash collected". */
    paymentReference: text("payment_reference"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    /** Sum of item prices (GST inclusive), shipping and total, fixed when the order is placed. */
    itemsTotalPaise: integer("items_total_paise").notNull(),
    shippingPaise: integer("shipping_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull(),
    shippingAddress: jsonb("shipping_address").$type<AddressSnapshot>().notNull(),
    customerNote: text("customer_note"),
    /** Latest shipment's courier and tracking number, copied here for the customer's order pages. */
    courierName: text("courier_name"),
    trackingNumber: text("tracking_number"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("orders_seq_key").on(t.seq),
    index("orders_user_id_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    index("orders_created_at_idx").on(t.createdAt),
    index("orders_payment_idx").on(t.paymentMethod, t.paymentStatus),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productSlug: text("product_slug").notNull(),
    /** Name and category at the time of ordering. */
    productName: text("product_name").notNull(),
    categoryLabel: text("category_label").notNull(),
    quantity: integer("quantity").notNull(),
    /** GST-inclusive price per unit when ordered, in paise. */
    unitPricePaise: integer("unit_price_paise").notNull(),
    /** GST rate in basis points (1800 = 18%) when ordered. */
    gstRateBp: integer("gst_rate_bp").notNull(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.productSlug] })],
);

/** One invoice row. Amounts are GST inclusive; taxable value and tax are split out for the bill. */
export type InvoiceLine = {
  name: string;
  category: string;
  quantity: number;
  unitPricePaise: number;
  gstRateBp: number;
  taxablePaise: number;
  gstPaise: number;
  amountPaise: number;
};

/** The invoice actually sent for an order. Lines and totals are frozen when it is sent. */
export const invoices = pgTable(
  "invoices",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    seq: serial("seq").notNull(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    lines: jsonb("lines").$type<InvoiceLine[]>().notNull(),
    taxablePaise: integer("taxable_paise").notNull(),
    gstPaise: integer("gst_paise").notNull(),
    /** CGST + SGST when the customer is in the shop's state, otherwise IGST. */
    intraState: boolean("intra_state").notNull(),
    shippingPaise: integer("shipping_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull(),
    /** Buyer details as printed: name, company, GSTIN, email. */
    billedTo: jsonb("billed_to").$type<{ name: string; email: string; companyName: string | null; gstin: string | null }>().notNull(),
    sentTo: text("sent_to").notNull(),
    sentById: uuid("sent_by_id").references(() => users.id, { onDelete: "set null" }),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("invoices_seq_key").on(t.seq), uniqueIndex("invoices_order_id_key").on(t.orderId)],
);

export type ProductSpec = { label: string; value: string };

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    /** Stock-keeping unit, unique across products and variants (checked in the app). Stored upper-cased. */
    sku: text("sku").notNull(),
    /** Brand name shown in the store; kept in step with brands.name when brandId is set. */
    brand: text("brand"),
    brandId: uuid("brand_id").references(() => brands.id, { onDelete: "set null" }),
    /** A ProductCategoryId from src/data/products.ts: the store department. */
    category: text("category").notNull(),
    /** Optional sub-category under the department (a categories row whose parent is that department). */
    subcategoryId: uuid("subcategory_id").references(() => categories.id, { onDelete: "set null" }),
    summary: text("summary").notNull(),
    description: text("description").notNull().default(""),
    uses: text("uses").array().notNull().default([]),
    specs: jsonb("specs").$type<ProductSpec[]>().notNull().default([]),
    /** Uploaded image URLs, first is the main image. */
    images: text("images").array().notNull().default([]),
    /** Artwork variant (0–2) used when there is no image. */
    artVariant: integer("art_variant").notNull().default(0),
    /** Selling price including GST, in paise. Null means it can't be bought online yet. */
    pricePaise: integer("price_paise"),
    /** Optional MRP shown struck through. */
    mrpPaise: integer("mrp_paise"),
    gstRateBp: integer("gst_rate_bp").notNull().default(1800),
    /** Units on the shelf that can still be sold. Placing an order takes units off; only inventory.ts changes it otherwise. */
    stock: integer("stock").notNull().default(0),
    /** "Low stock" at or below this many units. */
    lowStockThreshold: integer("low_stock_threshold").notNull().default(2),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    /** Archived products are hidden everywhere in the admin lists by default and can't be shown in the store. */
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("products_slug_key").on(t.slug),
    uniqueIndex("products_sku_key").on(t.sku),
    index("products_category_idx").on(t.category),
    check("products_stock_nonnegative", sql`${t.stock} >= 0`),
    check("products_price_positive", sql`${t.pricePaise} is null or ${t.pricePaise} > 0`),
  ],
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    /** Short name used in menus, e.g. "Laptops". */
    label: text("label").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    includes: text("includes").array().notNull().default([]),
    /** Which illustration to draw (a ServiceVisual kind). */
    visual: text("visual").notNull().default("diagnostics"),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("services_slug_key").on(t.slug)],
);

/** Editable site content and shop details, one JSON document per key. */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  updatedById: uuid("updated_by_id").references(() => users.id, { onDelete: "set null" }),
});

/** One-time links for staff invitations and password resets. Only the hash is stored. */
export const passwordTokens = pgTable(
  "password_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: tokenPurpose("purpose").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("password_tokens_hash_key").on(t.tokenHash), index("password_tokens_user_id_idx").on(t.userId)],
);

/* Catalogue structure */

/**
 * Category tree. Top-level rows are the store departments (slug = a ProductCategoryId) and are
 * fixed because the storefront is built around them; admins add sub-categories under them.
 */
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, { onDelete: "restrict" }),
    /** True for the seeded store departments. */
    isDepartment: boolean("is_department").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("categories_slug_key").on(t.slug), index("categories_parent_idx").on(t.parentId)],
);

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [uniqueIndex("brands_slug_key").on(t.slug)],
);

/**
 * A sellable option of a product (e.g. 16 GB / 512 GB) with its own SKU, price and stock.
 * Kept in the admin and inventory for now; the store and cart sell the base product only.
 */
export const productVariants = pgTable(
  "product_variants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    /** e.g. [{ label: "RAM", value: "16 GB" }]. */
    attributes: jsonb("attributes").$type<ProductSpec[]>().notNull().default([]),
    /** Null means the product's price. */
    pricePaise: integer("price_paise"),
    stock: integer("stock").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("product_variants_sku_key").on(t.sku),
    index("product_variants_product_idx").on(t.productId),
    check("product_variants_stock_nonnegative", sql`${t.stock} >= 0`),
    check("product_variants_price_positive", sql`${t.pricePaise} is null or ${t.pricePaise} > 0`),
  ],
);

export const inventoryReason = pgEnum("inventory_reason", [
  "opening_balance",
  "restock",
  "correction",
  "damaged",
  "customer_return",
  "order_placed",
  "order_cancelled",
]);

/** Every change to stock, with who made it and why. stockAfter is the shelf count right after the change. */
export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    stockAfter: integer("stock_after").notNull(),
    reason: inventoryReason("reason").notNull(),
    note: text("note"),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inventory_movements_product_idx").on(t.productId, t.createdAt), index("inventory_movements_created_idx").on(t.createdAt)],
);

/* Payments and shipping */

export const paymentKind = pgEnum("payment_kind", ["payment", "refund"]);

/**
 * Money actually received or returned for an order. Rows are only written by a staff member
 * recording it, or later by a verified payment-gateway webhook; never from the browser.
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    kind: paymentKind("kind").notNull(),
    method: paymentMethod("method").notNull(),
    amountPaise: integer("amount_paise").notNull(),
    /** "manual" for staff-recorded; a gateway id (e.g. "razorpay") once one is connected. */
    provider: text("provider").notNull().default("manual"),
    reference: text("reference"),
    note: text("note"),
    recordedById: uuid("recorded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("payments_order_idx").on(t.orderId), index("payments_created_idx").on(t.createdAt), check("payments_amount_positive", sql`${t.amountPaise} > 0`)],
);

export const shipmentStatus = pgEnum("shipment_status", ["in_transit", "out_for_delivery", "delivered", "returned", "lost"]);

/** A parcel handed to a courier for an order. */
export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    /** A courier id from src/lib/couriers.ts, or "other". */
    courierCode: text("courier_code").notNull(),
    courierName: text("courier_name").notNull(),
    trackingNumber: text("tracking_number").notNull(),
    trackingUrl: text("tracking_url"),
    status: shipmentStatus("status").notNull().default("in_transit"),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }).notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("shipments_order_idx").on(t.orderId), uniqueIndex("shipments_courier_tracking_key").on(t.courierCode, t.trackingNumber)],
);

/** Shipment status history. source says who reported it: staff, or a courier API once configured. */
export const shipmentEvents = pgTable(
  "shipment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    status: shipmentStatus("status").notNull(),
    note: text("note"),
    location: text("location"),
    source: text("source").notNull().default("staff"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    recordedById: uuid("recorded_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("shipment_events_shipment_idx").on(t.shipmentId, t.occurredAt)],
);

/* Service desk */

export const deviceType = pgEnum("device_type", ["laptop", "desktop", "cctv", "printer", "ups", "other"]);
export const servicePriority = pgEnum("service_priority", ["low", "normal", "high", "urgent"]);
export const serviceLocation = pgEnum("service_location", ["in_shop", "on_site"]);
export const serviceSource = pgEnum("service_source", ["online", "walk_in", "phone"]);
/**
 * open: nobody assigned yet. assigned / in_progress / awaiting_parts count as an engineer's
 * active workload (see ACTIVE_SERVICE_STATUSES). completed and cancelled are closed.
 */
export const serviceStatus = pgEnum("service_status", ["open", "assigned", "in_progress", "awaiting_parts", "completed", "cancelled"]);

/** Engineer-only settings. Every engineer gets a row; eligibility for new jobs reads it. */
export const engineerProfiles = pgTable("engineer_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Off while on leave or busy: no new automatic assignments. */
  isAvailable: boolean("is_available").notNull().default(true),
  /** Device types this engineer takes. Empty means all. */
  skills: deviceType("skills").array().notNull().default([]),
  takesOnSite: boolean("takes_on_site").notNull().default(true),
  notes: text("notes").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ServiceAddress = AddressSnapshot & { mapsUrl: string | null };

export const serviceRequests = pgTable(
  "service_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Running number for display, e.g. SR-000042. */
    seq: serial("seq").notNull(),
    /** Null for walk-in customers without an account. */
    customerId: uuid("customer_id").references(() => users.id, { onDelete: "restrict" }),
    /** Contact details as given for this job (copied from the account when there is one). */
    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    contactEmail: text("contact_email"),
    source: serviceSource("source").notNull(),
    location: serviceLocation("location").notNull(),
    /** Where the engineer goes, for on-site jobs. */
    serviceAddress: jsonb("service_address").$type<ServiceAddress>(),
    deviceType: deviceType("device_type").notNull(),
    deviceBrand: text("device_brand"),
    deviceModel: text("device_model"),
    serialNumber: text("serial_number"),
    /** What the customer left with the device, e.g. "charger, bag". */
    accessories: text("accessories"),
    issue: text("issue").notNull(),
    priority: servicePriority("priority").notNull().default("normal"),
    status: serviceStatus("status").notNull().default("open"),
    assignedEngineerId: uuid("assigned_engineer_id").references(() => users.id, { onDelete: "restrict" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    resolution: text("resolution"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    uniqueIndex("service_requests_seq_key").on(t.seq),
    index("service_requests_status_idx").on(t.status),
    index("service_requests_engineer_idx").on(t.assignedEngineerId, t.status),
    index("service_requests_customer_idx").on(t.customerId),
    index("service_requests_created_idx").on(t.createdAt),
    check("service_requests_on_site_address", sql`${t.location} = 'in_shop' or ${t.serviceAddress} is not null`),
  ],
);

/** Progress log for a job: status changes and notes, by whom. */
export const serviceEvents = pgTable(
  "service_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    fromStatus: serviceStatus("from_status"),
    toStatus: serviceStatus("to_status"),
    note: text("note"),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("service_events_request_idx").on(t.requestId, t.createdAt)],
);

export const assignmentMethod = pgEnum("assignment_method", ["auto", "manual", "transfer", "unassigned"]);

/** Every assignment decision for a job, including who or what made it and the workload it saw. */
export const serviceAssignments = pgTable(
  "service_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    engineerId: uuid("engineer_id").references(() => users.id, { onDelete: "set null" }),
    previousEngineerId: uuid("previous_engineer_id").references(() => users.id, { onDelete: "set null" }),
    method: assignmentMethod("method").notNull(),
    /** The chosen engineer's active job count just before this assignment. */
    activeJobsBefore: integer("active_jobs_before"),
    reason: text("reason"),
    decidedById: uuid("decided_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("service_assignments_request_idx").on(t.requestId, t.createdAt), index("service_assignments_engineer_idx").on(t.engineerId, t.createdAt)],
);

export const transferStatus = pgEnum("transfer_status", ["pending", "approved", "rejected", "withdrawn"]);

/** An engineer asking to hand a job to another engineer. Takes effect only when an admin approves. */
export const transferRequests = pgTable(
  "transfer_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    requestId: uuid("request_id")
      .notNull()
      .references(() => serviceRequests.id, { onDelete: "cascade" }),
    fromEngineerId: uuid("from_engineer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    toEngineerId: uuid("to_engineer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    status: transferStatus("status").notNull().default("pending"),
    decidedById: uuid("decided_by_id").references(() => users.id, { onDelete: "set null" }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decisionNote: text("decision_note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transfer_requests_status_idx").on(t.status, t.createdAt),
    // One open transfer request per job at a time.
    uniqueIndex("transfer_requests_one_pending_key").on(t.requestId).where(sql`${t.status} = 'pending'`),
    check("transfer_requests_different_engineers", sql`${t.fromEngineerId} <> ${t.toEngineerId}`),
  ],
);

/* Audit */

/** Sensitive admin changes: who did what to which record. Written in the same transaction as the change where possible. */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    /** e.g. "product.update", "user.role_change". */
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    summary: text("summary").notNull(),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_logs_created_idx").on(t.createdAt), index("audit_logs_entity_idx").on(t.entityType, t.entityId), index("audit_logs_actor_idx").on(t.actorId, t.createdAt)],
);

export type Category = typeof categories.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type InventoryReason = (typeof inventoryReason.enumValues)[number];
export type Payment = typeof payments.$inferSelect;
export type PaymentStatus = (typeof paymentStatus.enumValues)[number];
export type Shipment = typeof shipments.$inferSelect;
export type ShipmentStatus = (typeof shipmentStatus.enumValues)[number];
export type ServiceRequest = typeof serviceRequests.$inferSelect;
export type ServiceStatus = (typeof serviceStatus.enumValues)[number];
export type DeviceType = (typeof deviceType.enumValues)[number];
export type ServicePriority = (typeof servicePriority.enumValues)[number];
export type TransferStatus = (typeof transferStatus.enumValues)[number];

export type ProductRow = typeof products.$inferSelect;
export type ServiceRow = typeof services.$inferSelect;
export type User = typeof users.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderStatus = (typeof orderStatus.enumValues)[number];
export type Invoice = typeof invoices.$inferSelect;
export type Address = typeof addresses.$inferSelect;
export type UserRole = (typeof userRole.enumValues)[number];
export type OtpPurpose = (typeof otpPurpose.enumValues)[number];
