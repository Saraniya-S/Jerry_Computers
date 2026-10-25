import type { Metadata } from "next";
import { PlaceholderPage } from "@/components/layout/PlaceholderPage";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <PlaceholderPage
      eyebrow="Account"
      title="Customer login"
      intro="Track orders and service requests from your account."
      notice="Customer accounts are not available yet. Sign-in will be enabled here when the store and service portal launch."
    />
  );
}
