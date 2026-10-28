import { accentParts } from "@/lib/settings";
import { Accent } from "./SectionHeading";

/** Renders editable copy where *words in asterisks* get the accent style. */
export function Accented({ text }: { text: string }) {
  return (
    <>
      {accentParts(text).map((p, i) => (p.accent ? <Accent key={i}>{p.text}</Accent> : <span key={i}>{p.text}</span>))}
    </>
  );
}
