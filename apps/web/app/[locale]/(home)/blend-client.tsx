"use client";

import dynamic from "next/dynamic";

const BlendApp = dynamic(
  () => import("./blend").then((m) => ({ default: m.BlendApp })),
  { ssr: false }
);

export default function BlendClient() {
  return <BlendApp />;
}
