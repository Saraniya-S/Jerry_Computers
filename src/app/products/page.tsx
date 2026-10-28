import type { Metadata } from "next";
import { Suspense } from "react";
import { HomeFooter } from "@/components/home/HomeFooter";
import { Navbar } from "@/components/navigation/Navbar";
import { Catalogue } from "@/components/products/catalogue/Catalogue";
import { getCatalogue } from "@/lib/server/catalogue";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <>
      <Navbar />
      <main id="main" className="flex-1 bg-ink-950">
        {/* Filters come from the URL, which is only known per request; the shell around it stays static. */}
        <Suspense fallback={<CatalogueSkeleton />}>
          <CatalogueWithData />
        </Suspense>
      </main>
      <HomeFooter />
    </>
  );
}

async function CatalogueWithData() {
  return <Catalogue products={await getCatalogue()} />;
}

function CatalogueSkeleton() {
  return (
    <div className="mx-auto max-w-[1320px] animate-pulse px-4 pb-24 pt-28 sm:px-6 sm:pt-32" aria-busy="true" aria-label="Loading products">
      <div className="h-9 w-56 rounded-lg bg-ink-900" />
      <div className="mt-3 h-4 w-32 rounded bg-ink-900" />
      <div className="mt-8 grid gap-10 lg:grid-cols-[256px_1fr]">
        <div className="hidden space-y-3 lg:block">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-8 rounded-lg bg-ink-900" />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="aspect-[4/5] rounded-2xl bg-ink-900" />
          ))}
        </div>
      </div>
    </div>
  );
}
