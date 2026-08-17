"use client";

import dynamic from "next/dynamic";
import type { Tier } from "./scene-gate";

/* The scene reads window.devicePixelRatio and builds WebGL buffers at mount, so
   it cannot be server-rendered. This is the ONLY ssr:false boundary on the page —
   every section is a plain "use client" component and still ships its copy in
   the HTML.

   The capability gate runs in ReadinessHero, which only renders this component
   once it has decided the device can carry the scene — so an incapable device
   never reaches the dynamic import and never downloads three + fiber +
   postprocessing (measured at 1,117,121 bytes uncompressed). */
const ReadinessNebula = dynamic(
  () => import("./nebula").then((m) => ({ default: m.ReadinessNebula })),
  { ssr: false }
);

type ReadinessSceneProps = {
  label: string;
  tier: Tier;
};

export function ReadinessScene({ label, tier }: ReadinessSceneProps) {
  return <ReadinessNebula label={label} tier={tier} />;
}
