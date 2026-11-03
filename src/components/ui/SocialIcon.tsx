import { Globe } from "lucide-react";

/**
 * Outline brand marks drawn to match the lucide icons used across the site (24px grid, 2px
 * stroke). Lucide dropped brand icons, so the common ones live here.
 */
const brands = {
  instagram: (
    <>
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <path d="M17.5 6.5h.01" />
    </>
  ),
  facebook: <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />,
  youtube: (
    <>
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <path d="m10 15 5-3-5-3z" />
    </>
  ),
  x: (
    <>
      <path d="M4 4l11.733 16H20L8.267 4z" />
      <path d="M4 20l6.768-6.768m2.46-2.46L20 4" />
    </>
  ),
  linkedin: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </>
  ),
  whatsapp: (
    <>
      <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
      <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
    </>
  ),
};
type Brand = keyof typeof brands;

const hosts: [RegExp, Brand][] = [
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)(facebook\.com|fb\.com|fb\.me)$/, "facebook"],
  [/(^|\.)(youtube\.com|youtu\.be)$/, "youtube"],
  [/(^|\.)(x\.com|twitter\.com)$/, "x"],
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)(wa\.me|whatsapp\.com)$/, "whatsapp"],
];

/** Which brand a link belongs to: by its address first, then by the name the admin gave it. */
export function socialBrand(href: string, label = ""): Brand | null {
  try {
    const host = new URL(href).hostname.toLowerCase();
    const found = hosts.find(([re]) => re.test(host));
    if (found) return found[1];
  } catch {
    /* not a full URL: fall back to the label */
  }
  const name = label.trim().toLowerCase();
  if (name === "twitter") return "x";
  return name in brands ? (name as Brand) : null;
}

export function SocialIcon({ href, label, className = "size-[18px]" }: { href: string; label: string; className?: string }) {
  const brand = socialBrand(href, label);
  if (!brand) return <Globe className={className} aria-hidden />;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      {brands[brand]}
    </svg>
  );
}
