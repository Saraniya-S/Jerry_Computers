import Link from "next/link";
import { ArrowRight, ArrowUpRight, BadgeCheck, CalendarDays, KeyRound, MapPin, Package, ShoppingBag, Sparkles, Truck, Wrench } from "lucide-react";
import { Suspense } from "react";
import { outlineButton, primaryButton } from "@/components/account/buttons";
import { EmptyState, PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { productCategories } from "@/data/products";
import { requireCustomer } from "@/lib/server/auth";
import { listAddresses } from "@/lib/server/customer";

export default function AccountOverviewPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview />
    </Suspense>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

async function Overview() {
  const viewer = await requireCustomer();
  const methods = [viewer.hasPassword && "Email & password", viewer.hasGoogle && "Google"].filter(Boolean).join(" · ");
  const primary = (await listAddresses(viewer.id)).find((a) => a.isDefault);

  return (
    <>
      <PageHeader
        title={`Welcome, ${viewer.firstName}`}
        description="Your orders, repairs and account in one place."
        actions={
          <>
            <Link href="/products" className={outlineButton}>
              <ShoppingBag className="size-4" aria-hidden /> Shop
            </Link>
            <Link href="/services/request" className={primaryButton}>
              <Wrench className="size-4" aria-hidden /> Book a service
            </Link>
          </>
        }
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
          <Panel title="Recent orders" href="/account/orders">
            <EmptyState icon={<Package className="size-5" aria-hidden />} title="No orders yet" action={<Link href="/products" className={outlineButton}>Browse products</Link>}>
              When you order from the store, its status and courier tracking will show here.
            </EmptyState>
          </Panel>
          <Panel title="Service requests" href="/account/services">
            <EmptyState
              icon={<Wrench className="size-5" aria-hidden />}
              title="No service requests"
              action={<Link href="/services/request" className={outlineButton}>Book a service</Link>}
            >
              Track repairs from drop-off or engineer visit through to pickup.
            </EmptyState>
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
