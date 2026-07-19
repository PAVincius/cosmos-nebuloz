import type { ReactNode } from "react";
import { CosmosShell } from "@/components/cosmos/shell";
import "@/components/cosmos/cosmos.css";

// Fonts (Manrope / Space Grotesk / JetBrains Mono) are already loaded on <html>
// by @repo/design-system/lib/fonts — cosmos.css references those vars directly,
// so no duplicate next/font load here.
const CosmosLayout = ({ children }: { children: ReactNode }) => (
  <CosmosShell>{children}</CosmosShell>
);

export default CosmosLayout;
