import type { ReactNode } from "react";
import { SCREENS } from "@/components/cosmos/screens/registry";
import { CosmosShell } from "@/components/cosmos/shell";
import "@/components/cosmos/cosmos.css";

// Fonts (Manrope / Space Grotesk / JetBrains Mono) are already loaded on <html>
// by @repo/design-system/lib/fonts — cosmos.css references those vars directly,
// so no duplicate next/font load here.
//
// SCREENS is only imported here (a Server Component) — CosmosShell is
// "use client" and must not import the registry itself, since several
// ported screens are Server Components. Only the plain string keys cross
// the client boundary.
const CosmosLayout = ({ children }: { children: ReactNode }) => (
  <CosmosShell screenIds={Object.keys(SCREENS)}>{children}</CosmosShell>
);

export default CosmosLayout;
