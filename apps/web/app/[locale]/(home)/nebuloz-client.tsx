"use client";

import dynamic from "next/dynamic";

const NebulozApp = dynamic(
  () => import("./nebuloz/app").then((m) => ({ default: m.NebulozApp })),
  { ssr: false }
);

export default function NebulozClient() {
  return <NebulozApp />;
}
