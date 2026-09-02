"use client";

import { Avatar, SectionCard } from "@repo/design-system/cosmos/kit";
import { useState, useTransition } from "react";
import {
  type TenantMemberRow,
  updateTenantMemberRoleAction,
} from "@/app/actions/tenant-members";
import { Erro, INPUT } from "@/components/campo";
import { FiltroChips } from "@/components/filtro-chips";
import { StatusDot } from "@/components/status-dot";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import { Vazio } from "@/components/vazio";

const PAPEIS = ["ADMIN", "STE", "RTE", "SM", "PO", "DEV", "MEMBER"] as const;
type Papel = (typeof PAPEIS)[number];

/** `<select>` devolve string; o contrato da action é fechado. Estreitar aqui
 *  evita empurrar o `as` para dentro da action, onde ele apagaria a validação. */
const ehPapel = (v: string): v is Papel =>
  (PAPEIS as readonly string[]).includes(v);

const LARGURAS = [
  { id: "usuario", largura: "auto" },
  { id: "papel", largura: "110px" },
  { id: "acesso", largura: "120px" },
  { id: "alterar", largura: "160px" },
];

/**
 * Aba Usuários — a tabela do `TenantUsersTab`, com filtro por papel.
 *
 * O guard de último ADMIN mora no servidor e volta como mensagem: a UI não
 * tenta prever se a mudança é permitida, porque a contagem de ADMINs pode mudar
 * entre o render e o clique. Mostrar o erro do servidor é honesto; adivinhar
 * antes dá falso negativo.
 */
export function AbaUsuarios({
  slug,
  membros,
  canWrite,
}: {
  slug: string;
  membros: TenantMemberRow[];
  canWrite: boolean;
}) {
  const [erro, setErro] = useState<string | null>(null);
  const [papel, setPapel] = useState("all");
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

  const lista =
    papel === "all" ? membros : membros.filter((m) => m.role === papel);

  // Só os papéis que este tenant realmente tem: oferecer filtro para papel sem
  // ninguém dá sempre lista vazia, e lista vazia por filtro parece bug.
  const papeisPresentes = PAPEIS.filter((p) =>
    membros.some((m) => m.role === p)
  ).map((p) => ({ id: p, label: p }));

  if (membros.length === 0) {
    return (
      <SectionCard icon="userCheck" title="Usuários">
        <Vazio>
          Este tenant não tem membro algum. Quem foi convidado no
          provisionamento aparece aqui depois de criar a conta.
        </Vazio>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      action={
        <FiltroChips
          onMudar={setPapel}
          opcoes={papeisPresentes}
          valor={papel}
        />
      }
      bodyStyle={{ padding: 0 }}
      icon="userCheck"
      subtitle="Papel dentro do tenant do cliente — mudanças auditadas"
      title="Usuários"
    >
      <Tabela larguras={LARGURAS}>
        <TableHead labels={["Usuário", "Papel", "Acesso", "Alterar papel"]} />
        <tbody>
          {lista.map((m, i) => {
            const ultima = i === lista.length - 1;
            return (
              <TableRow key={m.id}>
                <Celula last={ultima}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      minWidth: 0,
                    }}
                  >
                    <Avatar name={m.nome ?? m.email} size={28} />
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: "block",
                          fontSize: "var(--fs-base)",
                          fontWeight: 700,
                        }}
                      >
                        {m.nome ?? "—"}
                      </span>
                      <span
                        className="mono"
                        style={{
                          display: "block",
                          fontSize: "var(--fs-nota)",
                          color: "var(--ink-faint)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.email}
                      </span>
                    </span>
                  </span>
                </Celula>

                <Celula last={ultima}>
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--fs-nota)",
                      fontWeight: 700,
                      color:
                        m.role === "ADMIN"
                          ? "var(--purple-text)"
                          : "var(--ink-muted)",
                    }}
                  >
                    {m.role}
                  </span>
                </Celula>

                <Celula last={ultima}>
                  <StatusDot tom="green">Ativo</StatusDot>
                </Celula>

                <Celula last={ultima}>
                  <label className="sr-only" htmlFor={`papel-${m.id}`}>
                    Papel de {m.email}
                  </label>
                  <select
                    disabled={!canWrite || pendente}
                    id={`papel-${m.id}`}
                    onChange={(e) => mudar(m.id, e.target.value)}
                    style={{
                      ...INPUT,
                      padding: "6px 9px",
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
                </Celula>
              </TableRow>
            );
          })}
        </tbody>
      </Tabela>

      {erro ? (
        <div style={{ padding: 16 }}>
          <Erro>{erro}</Erro>
        </div>
      ) : null}
    </SectionCard>
  );
}
