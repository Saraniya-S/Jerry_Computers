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

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}
