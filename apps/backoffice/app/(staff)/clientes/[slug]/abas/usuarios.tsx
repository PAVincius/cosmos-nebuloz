"use client";

import { Avatar, SectionCard } from "@repo/design-system/cosmos/kit";
import { useState, useTransition } from "react";
import {
  type TenantMemberRow,
  updateTenantMemberRoleAction,
} from "@/app/actions/tenant-members";
import { Erro, INPUT } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
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

/** O que muda para quem, em prosa. Entrar ou sair de ADMIN é a mudança que
 *  importa: é quem convida, remove e promove os outros. */
function consequenciaDaTroca(nome: string, de: string, para: Papel): string {
  if (para === "ADMIN") {
    return `${nome} passa a administrar o tenant do cliente: convida, remove e promove qualquer membro.`;
  }
  if (de === "ADMIN") {
    return `${nome} deixa de administrar o tenant. Se for o último ADMIN, o servidor recusa.`;
  }
  return `${nome} passa a ${para} no tenant do cliente; a mudança fica na auditoria.`;
}

/** A célula "Alterar papel": o `<select>` escolhe, a barreira grava.
 *  Componente próprio porque, inline no `map`, a linha passava do teto de
 *  complexidade do lint. */
function CelulaDePapel({
  m,
  ultima,
  canWrite,
  pendente,
  pendenteDe,
  onEscolher,
  onMudar,
  onVoltar,
}: {
  m: TenantMemberRow;
  ultima: boolean;
  canWrite: boolean;
  pendente: boolean;
  /** Papel escolhido no select e ainda não gravado. */
  pendenteDe: Papel | null;
  onEscolher: (memberId: string, role: string) => void;
  onMudar: (memberId: string, role: Papel) => void;
  onVoltar: () => void;
}) {
  const nome = m.nome ?? m.email;
  return (
    <Celula last={ultima}>
      <label className="sr-only" htmlFor={`papel-${m.id}`}>
        Papel de {m.email}
      </label>
      <select
        disabled={!canWrite || pendente}
        id={`papel-${m.id}`}
        onChange={(e) => onEscolher(m.id, e.target.value)}
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
        value={pendenteDe ?? m.role}
      >
        {PAPEIS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      {pendenteDe ? (
        <div style={{ marginTop: 8 }}>
          {/* `aberto`: o select já foi o gatilho. Vermelho quando
              entra ou sai de ADMIN; "Voltar" devolve o select ao
              papel atual. */}
          <ConfirmarAcao
            aberto
            alvo={m.email}
            consequencia={consequenciaDaTroca(nome, m.role, pendenteDe)}
            executando={pendente}
            onConfirmar={() => onMudar(m.id, pendenteDe)}
            onVoltar={onVoltar}
            rotulo={`Trocar papel de ${nome} para ${pendenteDe}`}
            tom={
              pendenteDe === "ADMIN" || m.role === "ADMIN" ? "red" : "accent"
            }
          />
        </div>
      ) : null}
    </Celula>
  );
}

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
  // O `<select>` só muda isto; gravar é o "Confirmar" da barreira. Antes, o
  // `onChange` gravava direto — inclusive para e de ADMIN.
  const [escolha, setEscolha] = useState<{
    memberId: string;
    role: Papel;
  } | null>(null);

  const escolher = (memberId: string, role: string) => {
    if (!ehPapel(role)) {
      return;
    }
    setErro(null);
    setEscolha({ memberId, role });
  };

  const mudar = (memberId: string, role: Papel) => {
    setErro(null);
    iniciar(async () => {
      const res = await updateTenantMemberRoleAction({ slug, memberId, role });
      if (res.ok) {
        setEscolha(null);
      } else {
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
            const pendenteDe =
              escolha?.memberId === m.id && escolha.role !== m.role
                ? escolha.role
                : null;
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

                <CelulaDePapel
                  canWrite={canWrite}
                  m={m}
                  onEscolher={escolher}
                  onMudar={mudar}
                  onVoltar={() => setEscolha(null)}
                  pendente={pendente}
                  pendenteDe={pendenteDe}
                  ultima={ultima}
                />
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
