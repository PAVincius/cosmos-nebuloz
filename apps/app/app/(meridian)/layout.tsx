import { AuthError } from "@repo/auth/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SCREENS } from "@/components/meridian/screens/registry";
import { MeridianShell } from "@/components/meridian/shell";
import { getShellData } from "./actions/shell";
import "@/components/meridian/meridian.css";

// Layout do Meridian.
//
// O guard vive aqui e é o primeiro portão: sessão de tenant → módulo contratado
// → papel de diagnóstico. Não é o único: toda server action repete os três,
// porque layout protege navegação e não protege RPC.
//
// SCREENS só é importado aqui (Server Component) — MeridianShell é "use client"
// e não pode importar o registry, já que telas portadas são Server Components.
// Só as chaves string cruzam a fronteira.
//
// A visão do respondente NÃO passa por este layout: ela vive em
// `app/(meridian)/responder/[token]`, fora do guard, porque o respondente não
// tem conta na plataforma.

const MeridianLayout = async ({ children }: { children: ReactNode }) => {
  let data: Awaited<ReturnType<typeof getShellData>>;
  try {
    data = await getShellData();
  } catch (e) {
    if (e instanceof AuthError) {
      // UNAUTHORIZED → login. FORBIDDEN aqui cobre dois casos distintos que o
      // usuário resolve em lugares diferentes: módulo não contratado
      // (comercial) e papel de diagnóstico ausente (peça a um consultor).
      if (e.code === "UNAUTHORIZED") {
        redirect("/sign-in");
      }
      redirect("/meridian-indisponivel");
    }
    throw e;
  }

  return (
    <MeridianShell
      activeTenantId={data.activeTenantId}
      badges={data.badges}
      modules={data.modules}
      screenIds={Object.keys(SCREENS)}
      tenants={data.tenants}
      user={data.user}
    >
      {children}
    </MeridianShell>
  );
};

export default MeridianLayout;
