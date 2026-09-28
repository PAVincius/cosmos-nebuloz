import { AuthError } from "@repo/auth/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { SCREENS } from "@/components/signal/screens/registry";
import { SignalShell } from "@/components/signal/shell";
import { getShellData } from "./actions/shell";
import "@/components/signal/signal.css";

// Layout do Signal.
//
// O guard vive aqui e é o primeiro portão: sessão de tenant → módulo contratado
// → papel de medição. Não é o único: toda server action repete os três, porque
// layout protege navegação e não protege RPC.
//
// SCREENS só é importado aqui (Server Component) — SignalShell é "use client" e
// não pode importar o registry, já que telas portadas são Server Components. Só
// as chaves string cruzam a fronteira.

const SignalLayout = async ({ children }: { children: ReactNode }) => {
  let data: Awaited<ReturnType<typeof getShellData>>;
  try {
    data = await getShellData();
  } catch (e) {
    if (e instanceof AuthError) {
      // UNAUTHORIZED → login. FORBIDDEN aqui cobre dois casos distintos que o
      // usuário resolve em lugares diferentes: módulo não contratado
      // (comercial) e papel de medição ausente (peça a um administrador). A
      // página de destino distingue os dois pela mensagem.
      if (e.code === "UNAUTHORIZED") {
        redirect("/sign-in");
      }
      redirect("/signal-indisponivel");
    }
    throw e;
  }

  return (
    <SignalShell
      activeTenantId={data.activeTenantId}
      alertsTone={data.alertsTone}
      badges={data.badges}
      brokenConnections={data.brokenConnections}
      modules={data.modules}
      portfolio={data.portfolio}
      screenIds={Object.keys(SCREENS)}
      tenants={data.tenants}
      user={data.user}
      valueBar={data.bars.valueBar}
    >
      {children}
    </SignalShell>
  );
};

export default SignalLayout;
