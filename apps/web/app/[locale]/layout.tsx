import "./styles.css";
import { AnalyticsProvider } from "@repo/analytics/provider";
import { DesignSystemProvider } from "@repo/design-system";
import { fonts } from "@repo/design-system/lib/fonts";
import { cn } from "@repo/design-system/lib/utils";
import type { ReactNode } from "react";
import { LenisProvider } from "@/components/cosmos/lenis-provider";
import { ScrollProgress } from "@/components/cosmos/scroll-progress";

type RootLayoutProperties = {
  readonly children: ReactNode;
  readonly params: Promise<{
    locale: string;
  }>;
};

const RootLayout = async ({ children, params }: RootLayoutProperties) => {
  const { locale } = await params;

  // No `scroll-smooth` on <html>: Lenis drives smooth scrolling, and lenis.css
  // (which ships the `scroll-behavior: auto !important` reset) is not imported —
  // so native smooth-scroll would fight Lenis on every anchor jump.
  return (
    <html
      className={cn(fonts, "relative")}
      lang={locale}
      suppressHydrationWarning
    >
      {/* No Google Fonts <link>: the nosecone CSP is `style-src 'self'
          'unsafe-inline'`, so it was blocked in every environment and Inter
          Tight / JetBrains Mono never loaded. They are self-hosted through
          next/font now — see @repo/design-system/lib/fonts. */}
      <body className="grain">
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        {/* No CursorGlow: the sphere already owns the cursor — it drives the
            camera parallax, the hover wake and the click shockwave. A second
            glow following the pointer competed with it and read as smear. The
            component stays in components/cosmos for the older pages. */}
        <LenisProvider />
        <ScrollProgress />
        <AnalyticsProvider>
          <DesignSystemProvider>{children}</DesignSystemProvider>
        </AnalyticsProvider>
      </body>
    </html>
  );
};

export default RootLayout;
