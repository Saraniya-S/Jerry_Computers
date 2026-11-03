import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, ChevronRight, KeyRound, MapPin, Package, ShoppingBag, Sparkles, Store, Truck, Wrench } from "lucide-react";
import { Suspense } from "react";
import { outlineButton, primaryButton } from "@/components/account/buttons";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { PaymentBadge, StatusBadge } from "@/components/orders/OrderParts";
import { productCategories } from "@/data/products";
import { formatPaise, orderNumber } from "@/lib/money";
import { requireCustomer } from "@/lib/server/auth";
import { listAddresses } from "@/lib/server/customer";
import { listMyServiceRequests } from "@/lib/server/customer-service-requests";
import { listCustomerOrders } from "@/lib/server/orders";
import { deviceTypeLabel, serviceNumber } from "@/lib/service-desk";
import { customerStatusLabel } from "@/lib/service-request-form";

export default function AccountOverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview />
    </Suspense>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
/** How many of each the overview shows; the full lists are a click away. */
const RECENT = 5;

async function Overview() {
  const viewer = await requireCustomer();
  const methods = [viewer.hasPassword && "Email & password", viewer.hasGoogle && "Google"].filter(Boolean).join(" · ");
  const [addresses, orders, requests] = await Promise.all([listAddresses(viewer.id), listCustomerOrders(viewer.id), listMyServiceRequests(viewer.id)]);
  const primary = addresses.find((a) => a.isDefault);

  return (
    <>
      <PageHeader
        title={`Welcome, ${viewer.firstName}`}
        description="Your orders, repairs and account in one place."
      />

      {!viewer.onboardedAt && (
        <div className="mx-5 mt-5 flex flex-wrap items-center gap-4 rounded-xl border border-brand/20 bg-gradient-to-r from-mint-soft to-ink-850 px-4 py-3.5 sm:mx-7 sm:mt-7">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-ink-850 text-brand shadow-[0_1px_2px_var(--line)]">
            <Sparkles className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-fg">Finish setting up your account</p>
            <p className="text-xs text-fg-muted">Add your mobile number and delivery address so orders and engineer visits go smoothly.</p>
          </div>
          <Link href="/onboarding" className={primaryButton}>
            Continue setup <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      )}

      <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-3">
        <QuickAction
          href="/products"
          icon={<ShoppingBag className="size-5" aria-hidden />}
          title="Shop hardware"
          text="Laptops, desktops, components, CCTV, printers, UPS and accessories."
        />
        <QuickAction
          href="/services/request"
          icon={<Wrench className="size-5" aria-hidden />}
          title="Book a repair"
          text="Bring it to the shop, or ask for an engineer to visit."
        />
        <QuickAction
          href="/account/orders"
          icon={<Truck className="size-5" aria-hidden />}
          title="Track a delivery"
          text="Courier and tracking number appear on each order once it ships."
        />
      </div>

      <div className="grid gap-4 px-5 pb-7 sm:px-7 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-4">
          <Panel title="Recent orders" href="/account/orders" linkLabel={orders.length > RECENT ? `View all ${orders.length}` : "View all"}>
            {orders.length ? (
              <ul className="divide-y divide-line">
                {orders.slice(0, RECENT).map((o) => {
                  const items = o.items.reduce((n, i) => n + i.quantity, 0);
                  return (
                    <ListRow key={o.id} href={`/account/orders/${o.id}`}>
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium text-fg group-hover:text-brand">{orderNumber(o.seq)}</span>
                        <span className="block truncate text-xs text-fg-dim">
                          {dateFmt.format(o.placedAt ?? o.createdAt)} · {items} item{items === 1 ? "" : "s"}
                          {o.items[0] && ` · ${o.items[0].productName}${o.items.length > 1 ? ` +${o.items.length - 1} more` : ""}`}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        <StatusBadge status={o.status} />
                        <PaymentBadge status={o.paymentStatus} />
                        <span className="w-20 text-right text-sm tabular-nums text-fg">{formatPaise(o.totalPaise)}</span>
                      </span>
                    </ListRow>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={<Package className="size-5" aria-hidden />} title="No orders yet" action={<Link href="/products" className={outlineButton}>Browse products</Link>}>
                When you order from the store, its status and courier tracking will show here.
              </EmptyState>
            )}
          </Panel>
          <Panel title="Service requests" href="/account/services" linkLabel={requests.length > RECENT ? `View all ${requests.length}` : "View all"}>
            {requests.length ? (
              <ul className="divide-y divide-line">
                {requests.slice(0, RECENT).map(({ r, serviceLabel }) => (
                  <ListRow key={r.id} href={`/account/services/${r.id}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-fg group-hover:text-brand">
                        {serviceNumber(r.seq)} <span className="font-normal text-fg-muted">· {serviceLabel ?? deviceTypeLabel[r.deviceType]}</span>
                      </span>
                      <span className="flex items-center gap-1.5 truncate text-xs text-fg-dim">
                        {r.location === "on_site" ? <MapPin className="size-3 shrink-0" aria-hidden /> : <Store className="size-3 shrink-0" aria-hidden />}
                        {dateFmt.format(r.createdAt)} · {[r.deviceBrand, r.deviceModel].filter(Boolean).join(" ") || deviceTypeLabel[r.deviceType]}
                      </span>
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.status === "completed" ? "bg-mint-soft text-leaf" : r.status === "cancelled" ? "bg-ink-900 text-fg-dim" : r.status === "awaiting_customer" ? "bg-amber-100 text-amber-800" : "bg-brand/10 text-brand"
                      }`}
                    >
                      {customerStatusLabel[r.status]}
                    </span>
                  </ListRow>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={<Wrench className="size-5" aria-hidden />}
                title="No service requests"
                action={<Link href="/services/request" className={outlineButton}>Book a service</Link>}
              >
                Track repairs from drop-off or engineer visit through to pickup.
              </EmptyState>
            )}
          </Panel>
        </div>

        <div className="grid content-start gap-4">
          <Panel title="Your account" href="/account/profile" linkLabel="Manage">
            <dl className="divide-y divide-line text-sm">
              <Row icon={<BadgeCheck className="size-4 text-leaf-mid" aria-hidden />} label="Email">
                <span className="block truncate text-fg">{viewer.email}</span>
                <span className="text-xs text-leaf-mid">
                  {viewer.emailVerifiedAt ? `Verified ${dateFmt.format(viewer.emailVerifiedAt)}` : "Not verified"}
                </span>
              </Row>
              <Row icon={<KeyRound className="size-4 text-fg-dim" aria-hidden />} label="Sign-in">
                <span className="text-fg">{methods}</span>
              </Row>
              <Row icon={<MapPin className="size-4 text-fg-dim" aria-hidden />} label="Default address">
                {primary ? (
                  <span className="block text-fg">
                    {primary.line1}, {primary.city} {primary.postalCode}
                  </span>
                ) : (
                  <Link href="/account/addresses" className="text-brand hover:underline">
                    Add an address
                  </Link>
                )}
              </Row>
              <Row icon={<CalendarDays className="size-4 text-fg-dim" aria-hidden />} label="Member since">
                <span className="text-fg">{dateFmt.format(viewer.createdAt)}</span>
              </Row>
            </dl>
          </Panel>

          <Panel title="Shop by category" href="/products" linkLabel="All">
            <ul className="flex flex-wrap gap-2 p-4">
              {productCategories.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/products?category=${c.id}`}
                    className="inline-flex h-8 items-center rounded-full border border-line bg-ink-950 px-3 text-xs text-fg-muted transition-colors hover:border-brand/40 hover:text-fg"
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}

function QuickAction({ href, icon, title, text }: { href: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="group relative rounded-xl border border-line bg-ink-950 p-4 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_12px_30px_-18px_var(--shadow)]"
    >
      <div className="grid size-10 place-items-center rounded-xl bg-ink-850 text-brand shadow-[0_1px_2px_var(--line)]">{icon}</div>
      <p className="mt-3 font-medium text-fg">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-fg-muted">{text}</p>
      <ArrowUpRight className="absolute right-4 top-4 size-4 text-fg-dim transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden />
    </Link>
  );
}

function Panel({ title, href, linkLabel = "View all", children }: { title: string; href: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-line">
      <div className="flex items-center justify-between border-b border-line bg-ink-950 px-4 py-3">
        <h2 className="text-sm font-medium text-fg">{title}</h2>
        <Link href={href} className="text-xs text-fg-muted hover:text-brand">
          {linkLabel}
        </Link>
      </div>
      {children}
    </section>
  );
}

function ListRow({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} className="group flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-ink-950">
        {children}
        <ChevronRight className="size-4 shrink-0 text-fg-dim group-hover:text-brand" aria-hidden />
      </Link>
    </li>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5">{icon}</span>
      <dt className="sr-only">{label}</dt>
      <dd className="min-w-0 flex-1">
        <span className="block text-xs text-fg-dim">{label}</span>
        {children}
      </dd>
    </div>
  );
}
