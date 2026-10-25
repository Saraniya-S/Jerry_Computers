import type { Metadata } from "next";
import { notFound } from "next/navigation";
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

export default async function PolicyPage({ params }: PageProps<"/policies/[slug]">) {
  const { slug } = await params;
  const policy = policyLinks.find((p) => slugOf(p.href) === slug);
  if (!policy) notFound();

  return (
    <PlaceholderPage
      eyebrow="Policies"
      title={policy.label.replace(/^./, (c) => c.toUpperCase())}
      notice="This policy has not been published yet. Its content will be added once it has been prepared and approved by Jerry Computers."
    />
  );
}
