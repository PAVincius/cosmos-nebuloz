import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import type { ServiceDetail } from "@/app/actions/services";
import { MetaCell } from "@/components/meta-cell";
import { Secao } from "@/components/secao";
import { formatarBRL } from "@/lib/comercial/formato";
import {
  ROTULO_STATUS as ROTULO_STATUS_ENGAJAMENTO,
  type StatusEngajamento,
} from "@/lib/delivery";

/**
 * Detalhe de um serviço do catálogo, no layout do `backoffice-services.jsx`.
 *
 * Duas colunas, 1.5fr / 1fr: à esquerda o que o cliente recebe e o que precisa
 * vir antes; à direita as três leituras curtas — comercial, time e vínculo com
 * a plataforma. A divisão não é estética: a coluna larga é o que entra na
 * proposta como anexo, a estreita é o que decide se dá para vender.
 */

/** Como a unidade entra no total da proposta. Só RETAINER é recorrente —
 *  a mesma regra de `lib/comercial/precificar`, e é por isso que o handoff
 *  marca essa unidade com ponto no badge. */
const RECORRENTE = new Set(["RETAINER"]);

/** Rótulos compartilhados com `page.tsx` (selos do cabeçalho) e `editar.tsx`
 *  (opções dos selects). Moram aqui, e não em `page.tsx`, porque página do
 *  App Router não pode exportar nada além do contrato do Next. */
export const ROTULO_UNIDADE: Record<string, string> = {
  PROJETO: "Projeto fechado",
  SPRINT: "Por sprint",
  HORA: "Hora técnica",
  RETAINER: "Retainer mensal",
};

export const TRILHA: Record<
  string,
  { label: string; tone: "accent" | "green" | "purple" | "blue" }
> = {
  readiness: { label: "AI Readiness", tone: "accent" },
  adoption: { label: "AI Adoption", tone: "green" },
  enablement: { label: "Enablement", tone: "purple" },
  custom: { label: "Modelo próprio", tone: "blue" },
};

const TOM_STATUS: Record<string, "green" | "amber" | "neutral"> = {
  ACEITA: "green",
  ENVIADA: "amber",
  RASCUNHO: "neutral",
  RECUSADA: "neutral",
  EM_ANDAMENTO: "green",
  PROPOSTO: "amber",
  CONCLUIDO: "neutral",
};

/** Status de proposta em rótulo. O enum cru ("ENVIADA") era o que aparecia
 *  no badge — o mesmo mapa de `propostas/propostas.tsx`, que mora lá como
 *  const local. */
const ROTULO_STATUS_PROPOSTA: Record<string, string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  ENVIADA: "Enviada",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
};

/** O código do pré-requisito. Vira link só quando o serviço existe — apontar
 *  para uma rota que devolve erro é pior que não apontar. */
function CodigoDoAntecedente({
  codigo,
  existe,
}: {
  codigo: string;
  existe: boolean;
}) {
  const estilo = {
    marginLeft: "auto",
    fontSize: "var(--fs-nota)",
    color: "var(--ink-faint)",
    textDecoration: "none",
  } as const;

  if (!existe) {
    return (
      <span className="mono" style={estilo}>
        {codigo}
      </span>
    );
  }
  return (
    <Link
      className="mono"
      href={`/servicos/${encodeURIComponent(codigo)}`}
      style={estilo}
    >
      {codigo}
    </Link>
  );
}

/** Linha de lista do handoff: ícone à esquerda, texto, fundo de superfície. */
function LinhaDeItem({
  icone,
  cor,
  tom,
  children,
}: {
  icone: "check" | "alert" | "userCheck";
  cor: string;
  /** Fundo e borda tonais — usado só onde o handoff pinta (pré-requisito). */
  tom?: "amber";
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 12px",
        borderRadius: 9,
        background: tom ? `var(--${tom}-soft)` : "var(--surface-2)",
        border: `1px solid ${tom ? `rgba(var(--${tom}-rgb),.3)` : "var(--hairline)"}`,
      }}
    >
      <Icon name={icone} size={14} style={{ color: cor, flexShrink: 0 }} />
      {children}
    </div>
  );
}

export function DetalheDoServico({ servico }: { servico: ServiceDetail }) {
  const { uso } = servico;
  const recorrente = RECORRENTE.has(servico.unidadeDeCobranca);
  const trilha = TRILHA[servico.trilha];
  // Fora do JSX: o lint lê ternário inline como valor vazando para o render.
  const tomDoTotal: "amber" | undefined = recorrente ? "amber" : undefined;
  const comoEntraNoTotal = recorrente
    ? "recorrente mensal"
    : "one-time do projeto";

  return (
    <div className="bo-detalhe">
      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
      >
        <Secao
          icon="layers"
          subtitle="O que o cliente recebe — vira anexo da proposta"
          title="Entregáveis"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {servico.entregaveis.length === 0 ? (
              <span
                style={{
                  fontSize: "var(--fs-base)",
                  color: "var(--ink-subtle)",
                  fontWeight: 500,
                  lineHeight: 1.55,
                }}
              >
                Sem entregáveis cadastrados — uma proposta com este item não diz
                ao cliente o que ele recebe.{" "}
                {/* O aviso ganha saída: abre a edição já com o foco no campo.
                    Sem isto, a frase apontava o problema e parava. */}
                <Link
                  href={`/servicos/${encodeURIComponent(servico.codigo)}?editar=entregaveis`}
                  style={{ fontWeight: 700, color: "var(--accent-text)" }}
                >
                  Cadastrar entregáveis
                </Link>
              </span>
            ) : (
              servico.entregaveis.map((d) => (
                <LinhaDeItem cor="var(--green-text)" icone="check" key={d}>
                  <span style={{ fontSize: "var(--fs-base)", fontWeight: 600 }}>
                    {d}
                  </span>
                </LinhaDeItem>
              ))
            )}
          </div>
        </Secao>

        <Secao
          icon="layers"
          subtitle="Serviços que precisam vir antes"
          title="Pré-requisitos"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {servico.preRequisitos.length === 0 ? (
              <span
                style={{
                  fontSize: "var(--fs-base)",
                  color: "var(--ink-subtle)",
                  fontWeight: 500,
                }}
              >
                Nenhum — pode ser o primeiro engajamento com o cliente.
              </span>
            ) : (
              servico.preRequisitos.map((r) => (
                <LinhaDeItem
                  cor="var(--amber-text)"
                  icone="alert"
                  key={r.codigo}
                  tom="amber"
                >
                  {/* O nome, não o código: `SV-02` sozinho não diz a ninguém o
                      que precisa vir antes. Quando o código não resolve, a tela
                      diz isso em vez de mostrar um vazio. */}
                  <span
                    style={{
                      fontSize: "var(--fs-base)",
                      fontWeight: 600,
                      color: "var(--amber-text)",
                    }}
                  >
                    {r.nome ?? "Código sem serviço correspondente"}
                  </span>
                  <CodigoDoAntecedente codigo={r.codigo} existe={r.existe} />
                </LinhaDeItem>
              ))
            )}
            <p
              style={{
                margin: "2px 0 0",
                fontSize: "var(--fs-nota)",
                color: "var(--ink-faint)",
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              O gerador de proposta avisa quando um pré-requisito não está no
              escopo — mas não bloqueia: às vezes o cliente já tem o equivalente
              feito.
            </p>
          </div>
        </Secao>

        {/* Só aparece quando há proposta. O handoff omite o cartão vazio, e com
            razão: um cartão "nenhuma" ocupa a mesma altura de um cheio sem
            dizer nada que a contagem do cabeçalho já não diga. */}
        {uso.propostas.length > 0 ? (
          <Secao icon="tag" title="Em propostas">
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {uso.propostas.map((p) => (
                <Link
                  href={`/propostas/${p.id}`}
                  key={`${p.id}-${p.numero}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 9,
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                    color: "var(--ink)",
                    textDecoration: "none",
                  }}
                >
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--fs-nota)",
                      color: "var(--ink-faint)",
                    }}
                  >
                    {p.numero}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--fs-base)",
                      fontWeight: 700,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {p.cliente}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--fs-nota)",
                      color: "var(--ink-faint)",
                    }}
                  >
                    {p.quantidade}× {formatarBRL(p.precoUnitCentavos)}
                  </span>
                  <Badge dot tone={TOM_STATUS[p.status] ?? "neutral"}>
                    {ROTULO_STATUS_PROPOSTA[p.status] ?? p.status}
                  </Badge>
                </Link>
              ))}
            </div>
          </Secao>
        ) : null}

        {uso.engajamentos.length > 0 ? (
          <Secao icon="briefcase" title="Em engajamentos">
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {uso.engajamentos.map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 12px",
                    borderRadius: 9,
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--fs-base)",
                      fontWeight: 700,
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    {e.nome}
                  </span>
                  <Badge dot tone={TOM_STATUS[e.status] ?? "neutral"}>
                    {ROTULO_STATUS_ENGAJAMENTO[e.status as StatusEngajamento] ??
                      e.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Secao>
        ) : null}
      </div>

      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
      >
        <Secao icon="tag" title="Comercial" tone="amber">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <MetaCell label="Preço" mono tone="amber">
              {formatarBRL(servico.precoBaseCentavos)}
              <span
                style={{
                  color: "var(--ink-faint)",
                  fontWeight: 500,
                }}
              >
                /{servico.unidade}
              </span>
            </MetaCell>
            <MetaCell label="Modelo de cobrança">
              {ROTULO_UNIDADE[servico.unidadeDeCobranca] ??
                servico.unidadeDeCobranca}
            </MetaCell>
            <MetaCell label="Duração">
              {servico.duracao ?? "não definida"}
            </MetaCell>
            {/* A leitura que decide a fórmula da proposta: recorrente entra na
                mensalidade, o resto entra uma vez. Ver lib/comercial/precificar. */}
            <MetaCell label="Entra no total como" tone={tomDoTotal}>
              {comoEntraNoTotal}
            </MetaCell>
            <MetaCell label="Trilha" tone={trilha?.tone}>
              {trilha?.label ?? servico.trilha}
            </MetaCell>
          </div>
        </Secao>

        <Secao icon="users" title="Time necessário">
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {servico.papeis.length === 0 ? (
              <span
                style={{
                  fontSize: "var(--fs-nota)",
                  color: "var(--ink-subtle)",
                  fontWeight: 500,
                  lineHeight: 1.55,
                }}
              >
                Sem papéis cadastrados — a alocação fica por conta de quem
                montar o engajamento.
              </span>
            ) : (
              servico.papeis.map((r) => (
                <LinhaDeItem cor="var(--ink-faint)" icone="userCheck" key={r}>
                  <span style={{ fontSize: "var(--fs-base)", fontWeight: 600 }}>
                    {r}
                  </span>
                </LinhaDeItem>
              ))
            )}
          </div>
        </Secao>

        <Secao icon="layers" title="Vínculo com plataforma">
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {servico.moduloVinculado ? (
              <MetaCell label="Módulo que este serviço deixa configurado">
                {servico.moduloVinculado}
              </MetaCell>
            ) : (
              <span
                style={{
                  fontSize: "var(--fs-nota)",
                  color: "var(--ink-subtle)",
                  fontWeight: 500,
                  lineHeight: 1.55,
                }}
              >
                Serviço independente de módulo — pode ser vendido sem licença.
              </span>
            )}
            {servico.exigeLab ? (
              <div
                style={{
                  display: "flex",
                  gap: 9,
                  alignItems: "center",
                  padding: "9px 12px",
                  borderRadius: 9,
                  border: "1px solid rgba(var(--blue-rgb),.35)",
                  background: "var(--blue-soft)",
                }}
              >
                <Icon
                  name="flask"
                  size={14}
                  style={{ color: "var(--blue-text)", flexShrink: 0 }}
                />
                <span
                  style={{
                    fontSize: "var(--fs-nota)",
                    color: "var(--blue-text)",
                    fontWeight: 600,
                  }}
                >
                  Execução depende de capacidade no LAB — checar fila de treino
                  antes de prometer prazo.
                </span>
              </div>
            ) : null}
          </div>
        </Secao>
      </div>
    </div>
  );
}
