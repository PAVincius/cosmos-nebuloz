import type { ThemeProviderProps } from "next-themes";
import { ThemeProvider as NextThemeProvider } from "next-themes";

export const ThemeProvider = ({
  children,
  ...properties
}: ThemeProviderProps) => (
  <NextThemeProvider
    defaultTheme="dark"
    enableSystem={false}
    {...properties}
    attribute="data-theme"
    disableTransitionOnChange
  >
    {children}
  </NextThemeProvider>
);
