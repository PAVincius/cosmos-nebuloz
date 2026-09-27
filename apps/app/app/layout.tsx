import { env } from "@/env";
import "./styles.css";
import { AnalyticsProvider } from "@repo/analytics/provider";
import { AuthProvider } from "@repo/auth/provider";
import { DesignSystemProvider } from "@repo/design-system";
import { fonts } from "@repo/design-system/lib/fonts";
import { Toolbar } from "@repo/feature-flags/components/toolbar";
import type { ReactNode } from "react";
import { EnvironmentBanner } from "./environment-banner";

type RootLayoutProperties = {
  readonly children: ReactNode;
};

const RootLayout = ({ children }: RootLayoutProperties) => (
  <html className={fonts} lang="pt-BR" suppressHydrationWarning>
    <head>
      <link href="/manifest.json" rel="manifest" />
      <meta content="#5e6ad2" name="theme-color" />
    </head>
    <body>
      <EnvironmentBanner vercelEnv={process.env.VERCEL_ENV} />
      <AnalyticsProvider>
        <AuthProvider
          helpUrl={env.NEXT_PUBLIC_DOCS_URL}
          privacyUrl={new URL(
            "/legal/privacy",
            env.NEXT_PUBLIC_WEB_URL
          ).toString()}
          termsUrl={new URL("/legal/terms", env.NEXT_PUBLIC_WEB_URL).toString()}
        >
          <DesignSystemProvider defaultTheme="dark" storageKey="cosmos-theme">
            {children}
          </DesignSystemProvider>
        </AuthProvider>
      </AnalyticsProvider>
      <Toolbar />
    </body>
  </html>
);

export default RootLayout;
