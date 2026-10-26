"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { primaryButton } from "./buttons";

export function SaveButton({ children = "Save changes" }: { children?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${primaryButton} disabled:opacity-80`}>
      {pending && <LoaderCircle className="size-4 animate-spin" aria-hidden />}
      {pending ? "Saving…" : children}
    </button>
  );
}
