"use client";

import { useState, useTransition } from "react";
import {
  type TenantMemberRow,
  updateTenantMemberRoleAction,
} from "@/app/actions/tenant-members";

const PAPEIS = ["ADMIN", "STE", "RTE", "SM", "PO", "DEV", "MEMBER"] as const;
type Papel = (typeof PAPEIS)[number];

/** `<select>` devolve string; o contrato da action é fechado. Estreitar aqui
 *  evita empurrar o `as` para dentro da action, onde ele apagaria a validação. */
const ehPapel = (v: string): v is Papel =>
  (PAPEIS as readonly string[]).includes(v);

/**
 * Aba Usuários (FR-4.2). O `<select>` de papel é o controle de escrita — se o
 * staff é MEMBER ele vem desabilitado, com o mesmo motivo do WriteButton.
 *
 * O guard de último ADMIN mora no servidor e volta como mensagem: a UI não
 * tenta prever se a mudança é permitida, porque a contagem de ADMINs pode mudar
 * entre o render e o clique. Mostrar o erro do servidor é honesto; adivinhar
 * antes dá falso negativo.
 */
export function Membros({
  slug,
  membros,
  canWrite,
}: {
  slug: string;
  membros: TenantMemberRow[];
  canWrite: boolean;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const mudar = (memberId: string, role: string) => {
    if (!ehPapel(role)) {
      return;
    }
    setErro(null);
    iniciar(async () => {
      const res = await updateTenantMemberRoleAction({ slug, memberId, role });
      if (!res.ok) {
        setErro(res.error);
      }
    });
  };

  if (membros.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
        Este tenant não tem membro algum. Quem foi convidado no provisionamento
        aparece aqui depois de criar a conta.
      </p>
    );
  }

  return (
    <div>
      <ul className="flex flex-col gap-2">
        {membros.map((m) => (
          <li
            className="flex items-center justify-between gap-3 rounded-md border p-3"
            key={m.id}
          >
            <div className="min-w-0">
              <div className="font-medium text-sm">{m.nome ?? "—"}</div>
              <div className="font-mono text-muted-foreground text-xs">
                {m.email}
              </div>
            </div>
            <label className="sr-only" htmlFor={`papel-${m.id}`}>
              Papel de {m.email}
            </label>
            <select
              className="rounded-md border bg-background px-2 py-1.5 text-sm disabled:opacity-50"
              disabled={!canWrite || pendente}
              id={`papel-${m.id}`}
              onChange={(e) => mudar(m.id, e.target.value)}
              title={
                canWrite
                  ? undefined
                  : "Somente leitura — seu papel no tenant system é MEMBER."
              }
              value={m.role}
            >
              {PAPEIS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      {erro ? (
        <p className="mt-3 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-red-600 text-sm dark:text-red-400">
          {erro}
        </p>
      ) : null}
    </div>
  );
}
