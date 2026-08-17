import type { Dictionary } from "@repo/internationalization";

/**
 * Copy slices for the readiness home.
 *
 * `@repo/internationalization` is `server-only`, but these are `import type`
 * and therefore fully erased — the same pattern the existing client components
 * in this app already use to take a `Dictionary` prop.
 */
export type ReadinessCopy = Dictionary["web"]["readiness"];

export type NavCopy = ReadinessCopy["nav"];
export type HeroCopy = ReadinessCopy["hero"];
export type GapCopy = ReadinessCopy["gap"];
export type LadderCopy = ReadinessCopy["ladder"];
export type ShapeCopy = ReadinessCopy["shape"];
export type MethodCopy = ReadinessCopy["method"];
export type ProductsCopy = ReadinessCopy["products"];
export type ProofCopy = ReadinessCopy["proof"];
export type PositionCopy = ReadinessCopy["position"];
export type CtaCopy = ReadinessCopy["cta"];
export type FooterCopy = ReadinessCopy["footer"];
