import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, PageSkeleton } from "@/components/account/PageHeader";
import { CategoryManager } from "@/components/admin/CategoryManager";
import { listCategoryTree } from "@/lib/server/admin/catalogue";
import { requirePermission } from "@/lib/server/permissions";

export const metadata: Metadata = { title: "Categories" };

export default function CategoriesPage({ searchParams }: PageProps<"/admin/categories">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Categories searchParams={searchParams} />
    </Suspense>
  );
}

async function Categories({ searchParams }: Pick<PageProps<"/admin/categories">, "searchParams">) {
  await requirePermission("catalogue.manage");
  const { q } = await searchParams;
  const tree = await listCategoryTree();
  const total = tree.reduce((n, d) => n + d.children.length, 0);
  return (
    <>
      <PageHeader title="Categories" count={total} description="Store departments and the sub-categories inside them. Products sit in a department and, optionally, one sub-category." />
      <CategoryManager tree={tree} initialQuery={typeof q === "string" ? q : ""} />
    </>
  );
}
