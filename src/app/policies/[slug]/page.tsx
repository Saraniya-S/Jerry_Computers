import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { policyLinks } from "@/config/site";
import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

const slugOf = (href: string) => href.split("/").pop()!;

export function generateStaticParams() {
  return policyLinks.map((p) => ({ slug: slugOf(p.href) }));
}

export async function generateMetadata({ params }: PageProps<"/policies/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  return { title: policyLinks.find((p) => slugOf(p.href) === slug)?.label ?? "Policy" };
}

const notice = "This policy has not been published yet. Its content will be added once it has been prepared and approved by Jerry Computers.";

// The slug is URL data, so it's read inside a Suspense boundary; the shell shows straight away on navigation.
export default function PolicyPage({ params }: PageProps<"/policies/[slug]">) {
  return (
    <Suspense fallback={<PlaceholderPage eyebrow="Policies" title="Policy" notice={notice} />}>
      <Policy params={params} />
    </Suspense>
  );
}

async function Policy({ params }: Pick<PageProps<"/policies/[slug]">, "params">) {
  const { slug } = await params;
  const policy = policyLinks.find((p) => slugOf(p.href) === slug);
  if (!policy) notFound();

  return <PlaceholderPage eyebrow="Policies" title={policy.label.replace(/^./, (c) => c.toUpperCase())} notice={notice} />;
}
