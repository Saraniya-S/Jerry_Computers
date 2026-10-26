import type { ReactNode } from "react";
import { AuthLayout } from "@/components/auth/AuthLayout";

/** Shared by /login and /register so the reel and card stay mounted when switching between them. */
export default function Layout({ children }: { children: ReactNode }) {
  return <AuthLayout>{children}</AuthLayout>;
}
