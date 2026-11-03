"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "@/components/ui/Logo";

/**
 * A branded loading screen over the home page while it loads. CSS keeps it invisible for the first
 * 400 ms, so quick loads never see it, and hides it after 10 s whatever happens (globals.css,
 * .jc-preloader). Once React is running it waits for the page to finish loading, then fades out,
 * or simply disappears if it never showed. Navigating back to the home page removes it at once.
 */
export function Preloader() {
  const [state, setState] = useState<"loading" | "leaving" | "gone">("loading");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = () => {
      const el = document.getElementById("jc-preloader");
      const showing = el ? Number(getComputedStyle(el).opacity) > 0.05 : false;
      if (!showing) return setState("gone");
      setState("leaving");
      timer = setTimeout(() => setState("gone"), 320);
    };
    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });
    return () => {
      window.removeEventListener("load", finish);
      clearTimeout(timer);
    };
  }, []);

  if (state === "gone") return null;
  return (
    <div id="jc-preloader" className="jc-preloader" data-leaving={state === "leaving" ? "" : undefined} role="status" aria-live="polite">
      <div className="grid justify-items-center gap-5">
        <span className="jc-preloader-mark">
          <LogoMark className="size-16" />
        </span>
        <span className="text-[1.05rem] font-semibold tracking-[-0.02em] text-fg">
          Jerry<span className="font-normal text-fg-muted"> Computers</span>
        </span>
        <span className="jc-preloader-bar" aria-hidden />
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
}
