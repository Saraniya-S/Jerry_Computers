import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardList, LogIn } from "lucide-react";
import { Suspense } from "react";
import { PageHeader } from "@/components/account/PageHeader";
import { RequestDashboard, type RequestAccount, type RequestService, type ShopInfo } from "@/components/services/request/RequestDashboard";
import { LogoMark } from "@/components/ui/Logo";
import { listAddresses } from "@/lib/server/customer";
import { getServices } from "@/lib/server/services";
import { getSessionUser } from "@/lib/server/session";
import { getSettings } from "@/lib/server/settings";

export const metadata: Metadata = {
  title: "Request a service",
  description: "Choose the service you need, tell us about the issue, and submit your service request.",
};

/**
 * Public service request page, in the same app frame as the dashboards: a slim top bar with
 * breadcrumbs and the page in an inset panel. Anyone can fill it in; sending needs a verified
 * customer account, checked on the server.
 */
export default function ServiceRequestPage({ searchParams }: PageProps<"/services/request">) {
  return (
    <div className="flex min-h-dvh flex-col bg-ink-900">
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-ink-900/85 px-3 backdrop-blur-md sm:px-4">
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
          <Link href="/" className="flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-1 font-semibold tracking-[-0.01em] text-fg hover:bg-ink-800">
            <LogoMark className="size-7" />
            <span className="hidden sm:inline">Jerry Computers</span>
          </Link>
          <ChevronRight className="size-4 shrink-0 text-fg-dim" aria-hidden />
          <Link href="/#services" className="hidden shrink-0 rounded-lg px-1.5 py-1 text-fg-muted hover:bg-ink-800 hover:text-fg sm:inline">
            Services
          </Link>
          <ChevronRight className="hidden size-4 shrink-0 text-fg-dim sm:block" aria-hidden />
          <span aria-current="page" className="truncate px-1.5 py-1 font-medium text-fg">
            Request a service
          </span>
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={null}>
            <AccountLink />
          </Suspense>
        </div>
      </header>
      <main id="main" className="flex-1 p-2 sm:p-3">
        <div className="mx-auto min-h-full max-w-[1280px] rounded-2xl border border-line bg-ink-850 shadow-[0_1px_3px_var(--line)]">
          <PageHeader title="Request a Service" description="Choose the service you need, tell us about the issue, and submit your service request." />
          <Suspense fallback={<DashboardSkeleton />}>
            <Dashboard searchParams={searchParams} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}

async function AccountLink() {
  const user = await getSessionUser();
  const cls = "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong px-3.5 text-sm text-fg transition-colors hover:bg-ink-850";
  if (!user)
    return (
      <Link href="/login?next=/services/request" className={cls}>
        <LogIn className="size-3.5" aria-hidden /> Log in
      </Link>
    );
  return user.role === "customer" ? (
    <Link href="/account/services" className={cls}>
      <ClipboardList className="size-3.5" aria-hidden /> <span className="sm:hidden">My requests</span>
      <span className="hidden sm:inline">My service requests</span>
    </Link>
  ) : null;
}

async function Dashboard({ searchParams }: Pick<PageProps<"/services/request">, "searchParams">) {
  const [services, shop, user, sp] = await Promise.all([getServices(), getSettings("shop"), getSessionUser(), searchParams]);
  const addresses = user?.role === "customer" ? await listAddresses(user.id) : [];

  const account: RequestAccount | null =
    user && user.role === "customer"
      ? {
          firstName: user.firstName,
          verified: Boolean(user.emailVerifiedAt),
          phone: user.phone,
          addresses: addresses.map((a) => ({
            id: a.id,
            label: a.label,
            recipientName: a.recipientName,
            phone: a.phone,
            line1: a.line1,
            line2: a.line2 ?? "",
            landmark: a.landmark ?? "",
            city: a.city,
            state: a.state,
            postalCode: a.postalCode,
            isDefault: a.isDefault,
          })),
        }
      : null;
  const shopInfo: ShopInfo | null = shop.address
    ? {
        name: shop.legalName || "Jerry Computers",
        address: shop.address,
        place: [shop.city, shop.state, shop.postalCode].filter(Boolean).join(", "),
        phone: shop.phone,
        email: shop.serviceEmail || shop.email,
        mapUrl: shop.mapUrl,
        hours: shop.hours.filter((h) => h.days && h.hours),
      }
    : null;
  const list: RequestService[] = services.map((s) => ({ slug: s.slug, label: s.label, title: s.title, description: s.description, includes: s.includes, visual: s.visual }));
  const preselect = typeof sp.service === "string" && list.some((s) => s.slug === sp.service) ? sp.service : null;

  return <RequestDashboard services={list} shop={shopInfo} account={account} signedInAsStaff={Boolean(user && user.role !== "customer")} preselect={preselect} />;
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse p-5 sm:p-7" aria-busy="true" aria-label="Loading services">
      <div className="h-10 w-full max-w-xl rounded-xl bg-ink-900" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-40 rounded-xl bg-ink-900" />
        ))}
      </div>
    </div>
  );
}
