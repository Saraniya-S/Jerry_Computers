import Link from "next/link";

/**
 * Jerry Computers "JR" badge, vectorised from the supplied logo
 * (docs/reference/brand/jr-logo-original.webp) in its original colours. The site
 * palette in globals.css is derived from these.
 */
export const brandColors = {
  ring: "#143d0c",
  band: "#b8dcb5",
  centre: "#fdfdfd",
  ink: "#372f63",
};

/** Letterform outlines on a 1000×1000 canvas: J, then R. */
export const JR_PATHS = [
  "M412,246 L454,246 L445,679 L435,708 L425,728 L416,741 L397,760 L379,771 L360,778 L339,782 L302,782 L301,781 L292,781 L291,780 L268,777 L255,773 L235,760 L216,744 L202,729 L186,707 L174,685 L168,669 L175,669 L237,667 L238,666 L261,666 L262,665 L286,665 L287,664 L300,663 L316,658 L331,650 L339,644 L350,633 L357,624 L358,622 L358,605 L357,604 L357,558 L356,557 L356,516 L355,515 L356,512 L355,511 L355,468 L354,467 L354,420 L426,359 L420,357 L407,357 L406,356 L393,356 L392,355 L379,355 L378,354 L364,354 L363,353 L350,353 L349,352 L300,349 L291,313 L291,309 L284,284 L284,280 L275,247 L411,247 Z",
  "M495,240 L712,244 L723,248 L743,259 L752,266 L767,281 L780,299 L794,328 L801,351 L804,367 L804,373 L805,374 L806,413 L805,414 L805,424 L804,425 L804,431 L801,446 L797,461 L789,482 L782,496 L772,512 L762,525 L743,544 L718,562 L696,573 L681,578 L678,581 L736,661 L823,662 L824,663 L833,663 L833,665 L817,688 L816,691 L801,711 L799,712 L797,716 L781,733 L765,746 L742,759 L725,765 L705,769 L688,770 L674,770 L673,769 L558,577 L556,575 L495,577 L495,571 L496,570 L496,554 L497,553 L497,537 L498,536 L498,519 L499,518 L499,502 L500,501 L500,485 L501,484 L501,467 L502,463 L506,464 L641,465 L642,466 L654,465 L665,460 L675,453 L684,444 L689,437 L693,429 L697,413 L697,402 L694,388 L689,377 L683,368 L665,351 L488,349 L489,348 L489,332 L490,331 L490,316 L491,315 L491,299 L492,298 Z",
] as const;

export function LogoMark({ className = "size-8", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 1000 1000" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <circle cx="500" cy="500" r="483" fill="none" stroke={brandColors.ring} strokeWidth="34" />
      <circle cx="500" cy="500" r="418.5" fill="none" stroke={brandColors.band} strokeWidth="95" />
      <circle cx="500" cy="500" r="371" fill={brandColors.centre} />
      {JR_PATHS.map((d) => (
        <path key={d.slice(0, 12)} d={d} fill={brandColors.ink} />
      ))}
    </svg>
  );
}

export function Logo({ className = "", onClick }: { className?: string; onClick?: () => void }) {
  return (
    <Link href="/#home" onClick={onClick} className={`group inline-flex items-center gap-2.5 text-fg ${className}`} aria-label="Jerry Computers — home">
      <LogoMark className="size-8 transition-transform duration-300 group-hover:rotate-[-8deg]" />
      <span className="whitespace-nowrap text-[1.05rem] font-semibold tracking-[-0.02em]">
        Jerry<span className="font-normal text-fg-muted"> Computers</span>
      </span>
    </Link>
  );
}
