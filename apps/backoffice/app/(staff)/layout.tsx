import Link from "next/link";
import type { ReactNode } from "react";
import { SairEEntrar } from "@/components/sair-e-entrar";
import { Shell } from "@/components/shell";
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
      <div className="mx-auto max-w-md rounded-lg border p-8 text-center">
        <h1 className="font-semibold text-xl">Falta o segundo fator</h1>
        <p className="mt-2 text-muted-foreground text-sm">{access.message}</p>
        <Link
          className="mt-4 inline-block rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground text-sm"
          href="/seguranca"
        >
          Cadastrar aplicativo autenticador
        </Link>
      </div>
    );
  }

  // Cadastrou o autenticador e continua barrado: a sessão é anterior ao
  // cadastro. Um link para /sign-in não resolve — a sessão velha continua de
  // pé e o guard a recusa de novo. Só encerrar resolve.
  if (access.status === "sessao_sem_2fa") {
    return (
      <div className="mx-auto max-w-md rounded-lg border p-8 text-center">
        <h1 className="font-semibold text-xl">Falta um login novo</h1>
        <p className="mt-2 text-muted-foreground text-sm">{access.message}</p>
        <SairEEntrar rotulo="Sair e entrar de novo" />
      </div>
    );
  }

  if (access.status === "forbidden") {
    return (
      <div className="mx-auto max-w-md rounded-lg border p-8 text-center">
        <h1 className="font-semibold text-xl">Acesso restrito</h1>
        <p className="mt-2 text-muted-foreground text-sm">{access.message}</p>
        <Link className="mt-4 inline-block text-sm underline" href="/sign-in">
          Entrar com outra conta
        </Link>
      </div>
    );
  }

  // Título próprio: quem estourou o teto não perdeu acesso, e oferecer "entrar
  // com outra conta" aqui mandaria a pessoa fazer logout à toa.
  if (access.status === "rate_limited") {
    return (
      <div className="mx-auto max-w-md rounded-lg border p-8 text-center">
        <h1 className="font-semibold text-xl">Requisições demais</h1>
        <p className="mt-2 text-muted-foreground text-sm">{access.message}</p>
      </div>
    );
  }

  return <Shell staff={access.staff}>{children}</Shell>;
}
