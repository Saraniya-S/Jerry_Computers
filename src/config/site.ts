/**
 * Business details for Jerry Computers.
 *
 * Every field set to `null` is information we have not been given yet.
 * Fill these in with verified details and the homepage, contact section
 * and footer will pick them up automatically. Do not add guesses here.
 */
export type SocialLink = { label: string; href: string };

export type BusinessHours = { days: string; hours: string };

export type SiteConfig = {
  name: string;
  shortName: string;
  description: string;
  contact: {
    /** Full street address, shown as written. */
    address: string | null;
    /** A Google Maps (or similar) link for the verified address. */
    mapUrl: string | null;
    /** Display format, e.g. "+91 98765 43210". */
    phone: string | null;
    email: string | null;
    serviceEmail: string | null;
    hours: BusinessHours[] | null;
  };
  social: SocialLink[];
};

export const site: SiteConfig = {
  name: "Jerry Computers",
  shortName: "Jerry",
  description:
    "Laptops, desktops, custom PC builds, components, CCTV, printers and UPS — with repair, installation and technical support from the same team.",
  contact: {
    address: null,
    mapUrl: null,
    phone: null,
    email: null,
    serviceEmail: null,
    hours: null,
  },
  social: [],
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
