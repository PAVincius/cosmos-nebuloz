import "@repo/design-system/styles/globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Nebuloz — Back-office",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-background text-foreground">
        <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
