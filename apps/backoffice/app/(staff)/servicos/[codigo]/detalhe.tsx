import { Badge, SectionCard } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import type { ServiceDetail } from "@/app/actions/services";
import { Vazio } from "@/components/vazio";
import { formatarBRL } from "@/lib/comercial/formato";

/**
 * Detalhe de um serviço do catálogo.
 *
 * A lista mostra código, nome, modalidade e preço — cabe numa linha. O que não
 * cabia eram os três arrays (entregáveis, papéis, pré-requisitos), que já
 * vinham no `ServiceRow` sem ter onde aparecer, e o **uso**: quem vende e quem
 * entrega este serviço.
 *
 * O uso é o motivo desta tela existir. A ação que o catálogo oferece é "tirar
 * do catálogo", e sem ele essa decisão é tomada às cegas.
 */

const ROTULO_TRILHA: Record<string, string> = {
  readiness: "Readiness",
  adoption: "Adoção",
  enablement: "Capacitação",
  custom: "Sob medida",
};

/** Verde é o que está no ar; neutro é o que já não se vende. Cor mais palavra,
 *  como no resto do painel. */
const TOM_STATUS: Record<string, "green" | "amber" | "neutral"> = {
  ACEITA: "green",
  ENVIADA: "amber",
  RASCUNHO: "neutral",
  RECUSADA: "neutral",
  EM_ANDAMENTO: "green",
  PROPOSTO: "amber",
  CONCLUIDO: "neutral",
};

/** Rótulo em mono maiúsculo — o mesmo eyebrow que o resto do painel usa para
 *  nomear um bloco. Sozinho quando o conteúdo abaixo é uma lista. */
function Rotulo({ children }: { children: string }) {
  return (
    <span
      className="mono"
      style={{
        display: "block",
        fontSize: "var(--fs-micro)",
        fontWeight: 700,
        letterSpacing: ".12em",
        textTransform: "uppercase",
        color: "var(--ink-faint)",
      }}
    >
      {children}
    </span>
  );
}

function Dado({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <Rotulo>{rotulo}</Rotulo>
      <span style={{ fontSize: "var(--fs-base)", fontWeight: 600 }}>
        {children}
      </span>
    </div>
  );
}

function Lista({ itens, vazio }: { itens: string[]; vazio: string }) {
  if (itens.length === 0) {
    return <Vazio>{vazio}</Vazio>;
  }
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {itens.map((item) => (
        <li
          key={item}
          style={{
            display: "flex",
            gap: 9,
            alignItems: "baseline",
            fontSize: "var(--fs-base)",
            lineHeight: 1.55,
          }}
        >
          <span aria-hidden="true" style={{ color: "var(--accent-text)" }}>
            ·
          </span>
          {item}
        </li>
      ))}
    </ul>
  );
}

export function DetalheDoServico({ servico }: { servico: ServiceDetail }) {
  const { uso } = servico;
  const vendido = uso.propostas.length;
  const entregue = uso.engajamentos.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <SectionCard
        icon="briefcase"
        subtitle="como este serviço é cobrado e o que a proposta copia dele"
        title="O serviço"
      >
        <div
          style={{
            display: "grid",
            gap: 16,
            gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
          }}
        >
          <Dado rotulo="Preço de referência">
            <span className="mono" style={{ color: "var(--accent-text)" }}>
              {formatarBRL(servico.precoBaseCentavos)}
            </span>
            <span style={{ color: "var(--ink-faint)" }}>
              /{servico.unidade}
            </span>
          </Dado>
          <Dado rotulo="Cobrança">{servico.unidadeDeCobranca}</Dado>
          <Dado rotulo="Modalidade">{servico.modalidade}</Dado>
          <Dado rotulo="Trilha">
            {ROTULO_TRILHA[servico.trilha] ?? servico.trilha}
          </Dado>
          <Dado rotulo="Duração">{servico.duracao ?? "não definida"}</Dado>
          <Dado rotulo="Módulo vinculado">
            {servico.moduloVinculado ?? "nenhum"}
          </Dado>
        </div>

        {servico.descricao ? (
          <p
            style={{
              margin: "18px 0 0",
              paddingTop: 16,
              borderTop: "1px solid var(--hairline)",
              fontSize: "var(--fs-base)",
              lineHeight: 1.65,
              color: "var(--ink-muted)",
            }}
          >
            {servico.descricao}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard
        icon="check"
        subtitle="o que o cliente recebe e quem precisa estar na sala"
        title="Escopo"
      >
        <div
          style={{
            display: "grid",
            gap: 18,
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
          }}
        >
          <div>
            <Rotulo>Entregáveis</Rotulo>
            <div style={{ marginTop: 8 }}>
              <Lista
                itens={servico.entregaveis}
                vazio="Sem entregáveis cadastrados. Uma proposta com este item não diz ao cliente o que ele recebe."
              />
            </div>
          </div>
          <div>
            <Rotulo>Papéis</Rotulo>
            <div style={{ marginTop: 8 }}>
              <Lista
                itens={servico.papeis}
                vazio="Sem papéis cadastrados — a alocação de gente fica por conta de quem montar o engajamento."
              />
            </div>
          </div>
          <div>
            <Rotulo>Pré-requisitos</Rotulo>
            <div style={{ marginTop: 8 }}>
              <Lista
                itens={servico.preRequisitos}
                vazio="Nenhum. Este serviço pode ser vendido sozinho."
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* O motivo desta tela. Tirar do catálogo sem ver isto é decidir às
          cegas: a proposta antiga sobrevive porque `ProposalItem` copia preço e
          descrição, mas a que alguém está montando perde a opção no meio. */}
      <SectionCard
        icon="tag"
        subtitle={`${vendido} ${vendido === 1 ? "proposta" : "propostas"} · ${entregue} ${entregue === 1 ? "engajamento" : "engajamentos"}`}
        title="Onde está sendo usado"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div>
            <Rotulo>Propostas</Rotulo>
            <div style={{ marginTop: 8 }}>
              {uso.propostas.length === 0 ? (
                <Vazio>
                  Nenhuma proposta inclui este serviço. Tirar do catálogo agora
                  não afeta nada em aberto.
                </Vazio>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {uso.propostas.map((p) => (
                    <li key={`${p.id}-${p.numero}`}>
                      <Link
                        className="navitem"
                        href={`/propostas/${p.id}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "10px 12px",
                          borderRadius: "var(--r-md)",
                          border: "1px solid var(--hairline)",
                          background: "var(--surface-2)",
                          color: "var(--ink)",
                          textDecoration: "none",
                          fontSize: "var(--fs-base)",
                        }}
                      >
                        <span
                          className="mono"
                          style={{
                            fontSize: "var(--fs-nota)",
                            fontWeight: 700,
                            color: "var(--accent-text)",
                          }}
                        >
                          {p.numero}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
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
                        <Badge tone={TOM_STATUS[p.status] ?? "neutral"}>
                          {p.status}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <Rotulo>Engajamentos</Rotulo>
            <div style={{ marginTop: 8 }}>
              {uso.engajamentos.length === 0 ? (
                <Vazio>Nenhum engajamento executa este serviço hoje.</Vazio>
              ) : (
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  {uso.engajamentos.map((e) => (
                    <li
                      key={e.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: "var(--r-md)",
                        border: "1px solid var(--hairline)",
                        background: "var(--surface-2)",
                        fontSize: "var(--fs-base)",
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0 }}>{e.nome}</span>
                      <Badge tone={TOM_STATUS[e.status] ?? "neutral"}>
                        {e.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
