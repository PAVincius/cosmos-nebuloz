import { AuthError } from "@repo/auth/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SCREENS } from "@/components/scaffold/screens/registry";
import { ScaffoldShell } from "@/components/scaffold/shell";
import { getShellData } from "./actions/shell";
import "@/components/scaffold/scaffold.css";

// Layout do Scaffold.
//
// O guard vive aqui e é o primeiro portão: sessão de tenant → módulo contratado
// → papel de adoção. Não é o único: toda server action repete os três, porque
// layout protege navegação e não protege RPC.
//
// SCREENS só é importado aqui (Server Component) — ScaffoldShell é "use client"
// e não pode importar o registry, já que as telas são Server Components. Só as
// chaves string cruzam a fronteira.
//
// A fila de supervisão da consultora NÃO passa por este layout: ela é
// cross-tenant e vive em `apps/backoffice/app/scaffold-supervision`, porque a
// ADR-0013 proíbe `apps/app` de importar `platformDb`.

const ScaffoldLayout = async ({ children }: { children: ReactNode }) => {
  let data: Awaited<ReturnType<typeof getShellData>>;
  try {
    data = await getShellData();
  } catch (e) {
    if (e instanceof AuthError) {
      // UNAUTHORIZED → login. FORBIDDEN aqui cobre dois casos distintos que o
      // usuário resolve em lugares diferentes: módulo não contratado
      // (comercial) e papel de adoção ausente (peça a um consultor).
      if (e.code === "UNAUTHORIZED") {
        redirect("/sign-in");
      }
      redirect("/scaffold-indisponivel");
    }
    throw e;
  }

  return (
    <ScaffoldShell
      activeTenantId={data.activeTenantId}
      badges={data.badges}
      screenIds={Object.keys(SCREENS)}
      stalledCount={data.stalledCount}
      stallThresholdDays={data.stallThresholdDays}
      tenants={data.tenants}
      totalTracks={data.totalTracks}
      user={data.user}
    >
      {children}
    </ScaffoldShell>
  );
};

export default ScaffoldLayout;
