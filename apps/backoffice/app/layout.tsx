import { DesignSystemProvider } from "@repo/design-system";
import { fonts } from "@repo/design-system/lib/fonts";
import "@repo/design-system/styles/globals.css";
import "@repo/design-system/cosmos/cosmos.css";
// Depois do cosmos.css de propósito: mesma especificidade, e é a ordem que faz
// a paleta do back-office vencer a do produto. Ver backoffice-theme.css.
import "./backoffice-theme.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Nebuloz — Back-office",
};

/**
 * Raiz do back-office. Três coisas que o handoff exige e que a versão anterior
 * não tinha:
 *
 * `fonts` — Manrope, Space Grotesk e JetBrains Mono. O `cosmos.css` referencia
 * `--font-manrope` e companhia direto; sem a classe no <html> tudo cai para a
 * fonte de sistema e o desenho não se parece com o protótipo em nada.
 *
 * `cosmos.css` — os tokens e as primitivas (.kpi, .lift, .navitem, .btn,
 * .skeleton) escopados em `.cosmos-root`. O `globals.css` também define
 * `--canvas` e `--surface`, mas com valores que já divergiram do protótipo
 * (#f4f5f8 contra #f5f6f8). O escopo do cosmos vence porque é mais específico,
 * e é ele que carrega os valores fiéis.
 *
 * `defaultTheme="dark"` com `storageKey` próprio — o back-office nasce escuro,
 * como o protótipo, e não divide preferência de tema com o produto: são duas
 * aplicações, em dois domínios, para duas pessoas diferentes.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html className={fonts} lang="pt-BR" suppressHydrationWarning>
      {/* `cosmos-root` no body, não no shell: o sign-in fica fora do shell e
          precisa dos mesmos tokens — no protótipo ele usa a mesma paleta. */}
      <body className="cosmos-root">
        <DesignSystemProvider defaultTheme="dark" storageKey="nebuloz-bo-theme">
          {children}
        </DesignSystemProvider>
      </body>
    </html>
  );
}
