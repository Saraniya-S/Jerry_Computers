import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { HomeForm } from "@/components/admin/SettingsForms";
import { requireStaff } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Homepage" };

export default function HomepageEditorPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Homepage />
    </Suspense>
  );
}

async function Homepage() {
  await requireStaff(["admin"]);
  const home = await getSettings("home");
  return (
    <>
      <PageHeader
        title="Homepage"
        description="Headlines, text and photos on the homepage. Products and services come from their own sections."
        actions={
          <Link href="/" target="_blank" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
            View homepage <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        }
      />
      <HomeForm initial={home} />
    </>
  );
}
