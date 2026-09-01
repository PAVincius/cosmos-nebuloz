"use client";

import { useState, useTransition } from "react";
import {
  type TenantMemberRow,
  updateTenantMemberRoleAction,
} from "@/app/actions/tenant-members";
import { Erro, INPUT } from "@/components/campo";
import { Vazio } from "@/components/vazio";

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
      <Vazio>
        Este tenant não tem membro algum. Quem foi convidado no provisionamento
        aparece aqui depois de criar a conta.
      </Vazio>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {membros.map((m) => (
          <li
            key={m.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: 12,
              borderRadius: "var(--r-md)",
              border: "1px solid var(--hairline)",
              background: "var(--surface-2)",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "var(--fs-base)", fontWeight: 700 }}>
                {m.nome ?? "—"}
              </div>
              <div
                className="mono"
                style={{
                  fontSize: "var(--fs-nota)",
                  color: "var(--ink-faint)",
                  overflowWrap: "anywhere",
                }}
              >
                {m.email}
              </div>
            </div>
            <label className="sr-only" htmlFor={`papel-${m.id}`}>
              Papel de {m.email}
            </label>
            <select
              disabled={!canWrite || pendente}
              id={`papel-${m.id}`}
              onChange={(e) => mudar(m.id, e.target.value)}
              style={{
                ...INPUT,
                width: "auto",
                flexShrink: 0,
                padding: "7px 10px",
                opacity: canWrite ? 1 : 0.5,
                cursor: canWrite ? "pointer" : "not-allowed",
              }}
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
      {erro ? <Erro>{erro}</Erro> : null}
    </div>
  );
}
