import { DesignSystemProvider } from "@repo/design-system";
import { fonts } from "@repo/design-system/lib/fonts";
// Entrada única, como em `apps/app`. A cascata (cosmos → tema do back-office →
// bibliotecas → bpmn-estudio) mora dentro do arquivo, onde a ordem é literal e
// o bundler não reordena. É também o que traz o `@import "tailwindcss"` a
// partir da raiz deste app — sem ele as classes utilitárias daqui não são
// geradas. Ver os comentários em styles.css.
import "./styles.css";
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
 * `cosmos-root` no body — é o escopo em que `cosmos.css` publica os tokens e as
 * primitivas (.kpi, .lift, .navitem, .btn, .skeleton). Sem a classe, nada
 * daquele arquivo se aplica. A ordem de carga mora em `styles.css`.
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
