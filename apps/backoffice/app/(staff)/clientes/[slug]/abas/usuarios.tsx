"use client";

import { Avatar } from "@repo/design-system/cosmos/kit";
import { useState, useTransition } from "react";
import {
  type TenantMemberRow,
  updateTenantMemberRoleAction,
} from "@/app/actions/tenant-members";
import { Erro, INPUT } from "@/components/campo";
import { Confirmacao } from "@/components/confirmacao";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { FiltroChips } from "@/components/filtro-chips";
import { Secao } from "@/components/secao";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import { Vazio } from "@/components/vazio";

const PAPEIS = ["ADMIN", "STE", "RTE", "SM", "PO", "DEV", "MEMBER"] as const;
type Papel = (typeof PAPEIS)[number];

/** Uma linha por sigla. Legenda visível, não tooltip: quem opera o painel
 *  conhece o vocabulário, mas STE/RTE/SM/PO/DEV sem expansão em lugar nenhum
 *  é o que a crítica apontou — e tooltip de mouse não chega ao teclado. */
const SIGNIFICADO: Record<Papel, string> = {
  ADMIN: "administra o cliente: convida, remove e promove",
  STE: "Solution Train Engineer — coordena vários ARTs",
  RTE: "Release Train Engineer — conduz o ART e o PI Planning",
  SM: "Scrum Master — facilita um time",
  PO: "Product Owner — prioriza o backlog do time",
  DEV: "desenvolvedor — entrega no time",
  MEMBER: "só lê",
};

/** O que o `<select>` mostra. O valor segue o enum do schema — é o que a
 *  action valida —, mas "MEMBER" e "ADMIN" crus na lista eram vocabulário de
 *  quem escreveu o schema, não de quem troca o papel de alguém. */
const ROTULO: Record<Papel, string> = {
  ADMIN: "Administrador",
  STE: "STE — Solution Train Engineer",
  RTE: "RTE — Release Train Engineer",
  SM: "SM — Scrum Master",
  PO: "PO — Product Owner",
  DEV: "DEV — desenvolvedor",
  MEMBER: "Membro",
};

const ID_MOTIVO_LEITURA = "usuarios-somente-leitura";

/** `<select>` devolve string; o contrato da action é fechado. Estreitar aqui
 *  evita empurrar o `as` para dentro da action, onde ele apagaria a validação. */
const ehPapel = (v: string): v is Papel =>
  (PAPEIS as readonly string[]).includes(v);

// Sem coluna "Acesso": dizia "Ativo" para todo mundo, hardcoded — nem
// `TenantMember` nem `TenantMemberRow` carregam esse dado.
const LARGURAS = [
  { id: "usuario", largura: "auto" },
  { id: "papel", largura: "110px" },
  { id: "alterar", largura: "160px" },
];

/** O que muda para quem, em prosa. Entrar ou sair de ADMIN é a mudança que
 *  importa: é quem convida, remove e promove os outros. */
function consequenciaDaTroca(nome: string, de: string, para: Papel): string {
  if (para === "ADMIN") {
    return `${nome} passa a administrar o cliente: convida e remove pessoas, troca papéis, e mexe em integrações, SSO e política de segurança.`;
  }
  if (de === "ADMIN") {
    return `${nome} deixa de administrar o cliente. Se for o último ADMIN, o servidor recusa.`;
  }
  return `${nome} passa a ${para} no cliente; a mudança fica na auditoria.`;
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
  confirmada,
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
  /** A última troca gravada, em prosa — só na linha que agiu. */
  confirmada: string | null;
  onEscolher: (memberId: string, role: string) => void;
  onMudar: (memberId: string, role: Papel) => void;
  onVoltar: () => void;
}) {
  const nome = m.nome ?? m.email;
  const descricaoDoBloqueio = canWrite ? undefined : ID_MOTIVO_LEITURA;
  return (
    <Celula last={ultima}>
      <label className="sr-only" htmlFor={`papel-${m.id}`}>
        Papel de {m.email}
      </label>
      <select
        aria-describedby={descricaoDoBloqueio}
        disabled={!canWrite || pendente}
        id={`papel-${m.id}`}
        onChange={(e) => onEscolher(m.id, e.target.value)}
        style={{
          ...INPUT,
          padding: "6px 9px",
          opacity: canWrite ? 1 : 0.5,
          cursor: canWrite ? "pointer" : "not-allowed",
        }}
        value={pendenteDe ?? m.role}
      >
        {PAPEIS.map((p) => (
          <option key={p} value={p}>
            {ROTULO[p]}
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
      {/* O sucesso nasce onde a ação foi feita: sem isto o select voltava ao
          papel novo em silêncio, e quem confirmou não sabia se gravou. */}
      {confirmada ? (
        <div style={{ marginTop: 8 }}>
          <Confirmacao>{confirmada}</Confirmacao>
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
  // A última troca gravada, presa ao membro: a frase aparece na linha dele,
  // não no rodapé da tabela.
  const [confirmacao, setConfirmacao] = useState<{
    memberId: string;
    texto: string;
  } | null>(null);

  const escolher = (memberId: string, role: string) => {
    if (!ehPapel(role)) {
      return;
    }
    setErro(null);
    setConfirmacao(null);
    setEscolha({ memberId, role });
  };

  const mudar = (memberId: string, role: Papel) => {
    setErro(null);
    setConfirmacao(null);
    iniciar(async () => {
      const res = await updateTenantMemberRoleAction({ slug, memberId, role });
      if (res.ok) {
        const m = membros.find((x) => x.id === memberId);
        const nome = m?.nome ?? m?.email ?? memberId;
        setEscolha(null);
        setConfirmacao({ memberId, texto: `Papel de ${nome} agora é ${role}` });
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
      <Secao icon="userCheck" title="Usuários">
        <Vazio>
          Este cliente não tem membro algum. Quem foi convidado no
          provisionamento aparece aqui depois de criar a conta.
        </Vazio>
      </Secao>
    );
  }

  return (
    <Secao
      action={
        <FiltroChips
          onMudar={setPapel}
          opcoes={papeisPresentes}
          valor={papel}
        />
      }
      bodyStyle={{ padding: 0 }}
      icon="userCheck"
      subtitle="Papel dentro do cliente — mudanças auditadas"
      title="Usuários"
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          padding: "12px 16px",
          borderBottom: "1px solid var(--hairline)",
        }}
      >
        {/* Motivo do bloqueio em texto, uma vez — o `title` no select
            desabilitado não chegava a ninguém: select desabilitado nem
            recebe foco. Cada select aponta para cá por `aria-describedby`. */}
        {canWrite ? null : (
          <p
            id={ID_MOTIVO_LEITURA}
            style={{
              margin: 0,
              fontSize: "var(--fs-nota)",
              color: "var(--ink-muted)",
            }}
          >
            Somente leitura — seu papel no tenant system é MEMBER.
          </p>
        )}
        <dl
          style={{
            margin: 0,
            display: "flex",
            flexWrap: "wrap",
            gap: "4px 14px",
            fontSize: "var(--fs-nota)",
            color: "var(--ink-faint)",
          }}
        >
          {PAPEIS.map((p) => (
            <div key={p} style={{ display: "inline-flex", gap: 5 }}>
              <dt className="mono" style={{ fontWeight: 700 }}>
                {p}
              </dt>
              <dd style={{ margin: 0 }}>{SIGNIFICADO[p]}</dd>
            </div>
          ))}
        </dl>
      </div>
      <Tabela larguras={LARGURAS}>
        <TableHead labels={["Usuário", "Papel", "Alterar papel"]} />
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

                <CelulaDePapel
                  canWrite={canWrite}
                  confirmada={
                    confirmacao?.memberId === m.id ? confirmacao.texto : null
                  }
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
    </Secao>
  );
}
