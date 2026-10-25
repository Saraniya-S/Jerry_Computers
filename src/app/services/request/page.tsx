import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/PlaceholderPage";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Request a service" };

export default function ServiceRequestPage() {
  return (
    <PlaceholderPage
      eyebrow="Book a service"
      title="Request a service"
      intro="Tell us what needs attention — a laptop, desktop, CCTV system, printer or UPS."
      notice="Online service booking is still being built and cannot accept requests yet. Please use the contact details on the homepage to arrange a service in the meantime."
    >
      <ButtonLink href="/#contact">Go to contact details</ButtonLink>
    </PlaceholderPage>
  );
}
