/**
 * Fixed site identity. Contact details, opening hours, social links and the GSTIN are edited in
 * Admin → Shop settings and read with getSettings("shop").
 */
export type SiteConfig = {
  name: string;
  shortName: string;
  description: string;
};

export const site: SiteConfig = {
  name: "Jerry Computers",
  shortName: "Jerry",
  description:
    "Laptops, desktops, custom PC builds, components, CCTV, printers and UPS — with repair, installation and technical support from the same team.",
};

export type NavLink = { label: string; href: string; section: string };

export const navLinks: NavLink[] = [
  { label: "Home", href: "/#home", section: "home" },
  { label: "About", href: "/#about", section: "about" },
  { label: "Services", href: "/#services", section: "services" },
  { label: "Products", href: "/#products", section: "products" },
  { label: "Contact", href: "/#contact", section: "contact" },
];

export const policyLinks = [
  { label: "Privacy policy", href: "/policies/privacy" },
  { label: "Terms of use", href: "/policies/terms" },
  { label: "Shipping policy", href: "/policies/shipping" },
  { label: "Returns policy", href: "/policies/returns" },
  { label: "Service policy", href: "/policies/service" },
] as const;

/** A dialable link for one number. A bare 10-digit Indian mobile gets +91 so it dials from anywhere. */
export function telHref(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `tel:${/^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : digits}`;
}

/** A number as shown on the site: Indian mobiles as "+91 97912 30446"; anything else as typed. */
export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const mobile = /^(?:91)?([6-9]\d{9})$/.exec(digits)?.[1];
  return mobile ? `+91 ${mobile.slice(0, 5)} ${mobile.slice(5)}` : phone.trim();
}

/** The separate numbers in a phone field such as "97912-30446, 97915-93446" (comma, slash, semicolon or "or"). */
export function phoneNumbers(phone: string | null | undefined) {
  return (phone ?? "")
    .split(/\s*(?:[,;/|]|\bor\b)\s*/i)
    .map((p) => p.trim())
    .filter((p) => p.replace(/\D/g, "").length >= 6);
}
