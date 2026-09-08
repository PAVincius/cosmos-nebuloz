import Link from "next/link";
import type { ReactNode } from "react";
import { Shell } from "@/components/shell";
import {
  ACAO_DE_BLOQUEIO,
  TelaDeBloqueio,
} from "@/components/tela-de-bloqueio";
import { resolveStaffAccess } from "@/lib/staff-access";

/** O grupo `(staff)` existe para deixar `/sign-in` fora deste guard. Guard no
 *  layout raiz redirecionaria a própria tela de login, em laço. */
export default async function StaffLayout({
  children,
}: {
  children: ReactNode;
}) {
  const access = await resolveStaffAccess();

  // Antes esta recusa caía no ramo genérico: a pessoa lia o endereço da tela de
  // cadastro como texto e tinha de digitá-lo, enquanto o único botão oferecido
  // era "entrar com outra conta" — que não é o problema dela.
  if (access.status === "sem_2fa") {
    return (
      <TelaDeBloqueio
        acao={
          <Link
            href="/seguranca"
            style={{
              ...ACAO_DE_BLOQUEIO,
              border: "1px solid var(--accent)",
              background: "var(--accent)",
              color: "var(--accent-fg)",
              boxShadow:
                "0 1px 2px rgba(var(--accent-rgb),.4), 0 6px 16px -8px rgba(var(--accent-rgb),.6)",
            }}
          >
            Cadastrar aplicativo autenticador
          </Link>
        }
        icone="shield"
        mensagem={access.message}
        titulo="Falta o segundo fator"
        tom="accent"
      />
    );
  }

  if (access.status === "forbidden") {
    return (
      <TelaDeBloqueio
        acao={
          <Link
            href="/sign-in"
            style={{
              ...ACAO_DE_BLOQUEIO,
              border: "1px solid var(--hairline-strong)",
              background: "var(--surface-2)",
              color: "var(--ink-muted)",
            }}
          >
            Entrar com outra conta
          </Link>
        }
        icone="ban"
        mensagem={access.message}
        nota="O guard roda em toda page e toda action — não é só a navegação que está fechada."
        titulo="Acesso restrito"
        tom="red"
      />
    );
  }

  // Título próprio: quem estourou o teto não perdeu acesso, e oferecer "entrar
  // com outra conta" aqui mandaria a pessoa fazer logout à toa.
  if (access.status === "rate_limited") {
    return (
      <TelaDeBloqueio
        icone="clock"
        mensagem={access.message}
        nota="Seu acesso continua válido — é o teto de requisições da janela, não o papel."
        titulo="Requisições demais"
        tom="amber"
      />
    );
  }

  return <Shell staff={access.staff}>{children}</Shell>;
}
