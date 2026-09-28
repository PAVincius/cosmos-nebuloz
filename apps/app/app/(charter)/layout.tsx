import { AuthError } from "@repo/auth/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SCREENS } from "@/components/charter/screens/registry";
import { CharterShell } from "@/components/charter/shell";
import { getShellData } from "./actions/shell";
import "@/components/charter/charter.css";

// Layout do Charter.
//
// O guard vive aqui e é o primeiro portão: sessão de tenant → módulo contratado
// → papel de governança. Não é o único: toda server action repete os três, porque
// layout protege navegação e não protege RPC.
//
// Fontes (Manrope / Space Grotesk / JetBrains Mono) já vêm no <html> por
// @repo/design-system/lib/fonts; charter.css referencia essas vars direto.
//
// SCREENS só é importado aqui (Server Component) — CharterShell é "use client"
// e não pode importar o registry, já que telas portadas são Server Components.
// Só as chaves string cruzam a fronteira.

const CharterLayout = async ({ children }: { children: ReactNode }) => {
  let data: Awaited<ReturnType<typeof getShellData>>;
  try {
    data = await getShellData();
  } catch (e) {
    if (e instanceof AuthError) {
      // UNAUTHORIZED → login. FORBIDDEN aqui cobre dois casos distintos que o
      // usuário resolve em lugares diferentes: módulo não contratado (comercial)
      // e papel de governança ausente (peça a um Compliance Lead).
      if (e.code === "UNAUTHORIZED") {
        redirect("/sign-in");
      }
      redirect(`/charter-indisponivel?motivo=${encodeURIComponent(e.message)}`);
    }
    throw e;
  }

  return (
    <CharterShell
      activeTenantId={data.activeTenantId}
      badges={data.badges}
      modules={data.modules}
      policy={data.policy}
      screenIds={Object.keys(SCREENS)}
      tenants={data.tenants}
      user={data.user}
    >
      {children}
    </CharterShell>
  );
};

export default CharterLayout;
