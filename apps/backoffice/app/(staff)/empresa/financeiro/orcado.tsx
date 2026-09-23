"use client";

import Link from "next/link";
import { Fragment, useCallback, useId, useMemo, useState } from "react";
import {
  lerOrcado,
  type OrcadoContaView,
  type OrcadoView,
  salvarOrcamento,
} from "@/app/actions/empresa/orcamento";
import { Erro, INPUT } from "@/components/campo";
import { Secao } from "@/components/secao";
import { Vazio } from "@/components/vazio";
import {
  centavosParaCampo,
  formatarBRL,
  paraCentavos,
} from "@/lib/comercial/formato";
import type { Intervalo } from "@/lib/empresa/periodo";
import {
  type CentroDeCusto,
  type Grupo,
  ROTULO_CENTRO,
} from "@/lib/empresa/plano-de-contas";
import { useSalvoHaPouco } from "@/lib/salvo-ha-pouco";

/**
 * Aba "Orçado × realizado" (Task 4, spec 2026-09-06 §4): orçado editável por
 * conta e competência ao lado do realizado (soma do livro-razão, T3) e do
 * desvio entre os dois, agrupado por centro de custo com subtotal por grupo e
 * total geral.
 *
 * `useState(inicial)` + `recarregar()`: mesmo padrão de `caixa.tsx` e
 * `lancamentos.tsx` — `salvarOrcamento` devolve só `{competencia, conta}`, e
 * quem tem a visão inteira de novo é `lerOrcado`.
 */

const NOME_MES = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];
function rotuloMes(c: string): string {
  const [a, m] = c.split("-");
  return `${NOME_MES[Number(m) - 1]} ${a}`;
}

const dinheiro = (v: number | null) => (v === null ? "—" : formatarBRL(v));

/** O "ruim" do desvio muda de lado com o grupo da conta: numa conta de custo,
 *  despesa ou dedução (grupos 2 a 6 — dedução se comporta como custo, não
 *  como receita) passar do orçado é ruim; numa conta de receita (grupo 1) é
 *  ficar abaixo do orçado que é ruim. Helper nomeado e comentado porque a
 *  regra inverte por grupo — não é estética, é o que a célula quer dizer. */
function desvioRuim(grupo: Grupo, desvio: number): boolean {
  if (grupo === 1) {
    return desvio < 0;
  }
  return desvio > 0;
}

const CHAVE_RECEITA = "receita";
const CHAVE_DEDUCOES = "deducoes";
type ChaveGrupo = CentroDeCusto | typeof CHAVE_DEDUCOES | typeof CHAVE_RECEITA;

// Grupos 1 (receita) e 2 (deduções) não têm centro de custo
// (plano-de-contas-nebuloz.ts) — a chave cai num balde próprio para cada um,
// ao lado dos quatro centros reais.
const ROTULO_GRUPO: Record<ChaveGrupo, string> = {
  ...ROTULO_CENTRO,
  [CHAVE_RECEITA]: "Receita",
  [CHAVE_DEDUCOES]: "Deduções",
};
// Um grupo representativo por balde, só para `desvioRuim` colorir o
// subtotal — cada centro real corresponde a um único grupo de custo/despesa.
const GRUPO_REPRESENTATIVO: Record<ChaveGrupo, Grupo> = {
  [CHAVE_RECEITA]: 1,
  [CHAVE_DEDUCOES]: 2,
  entrega: 3,
  comercial: 4,
  "produto-engenharia": 5,
  ga: 6,
};
const ORDEM_GRUPO: ChaveGrupo[] = [
  CHAVE_RECEITA,
  CHAVE_DEDUCOES,
  "entrega",
  "comercial",
  "produto-engenharia",
  "ga",
];

function chaveDoGrupo(c: OrcadoContaView): ChaveGrupo {
  if (c.centroDeCusto) {
    return c.centroDeCusto;
  }
  return c.grupo === 1 ? CHAVE_RECEITA : CHAVE_DEDUCOES;
}

function somarCentavos(valores: (number | null)[]): number {
  return valores.reduce<number>((soma, v) => soma + (v ?? 0), 0);
}

const CEL = {
  padding: "6px 8px",
  borderBottom: "1px solid var(--hairline)",
  fontSize: "var(--fs-nota)",
  whiteSpace: "nowrap",
} as const;

type Gravacao = { ok: true } | { ok: false; error: string };
type Gravar = (
  conta: string,
  competencia: string,
  texto: string
) => Promise<Gravacao>;

/**
 * A célula do orçado, com o estado dela. Gravava no blur sem dizer nada e,
 * na falha, continuava mostrando o valor digitado com o erro longe, no topo
 * da tabela — a tela afirmava um orçado que o banco não tinha. Agora diz
 * "Salvando…" e "Salvo" ali mesmo e, na falha, volta ao valor anterior com o
 * motivo ao lado, amarrado ao campo por `aria-describedby`.
 *
 * O `<output>` nasce no primeiro blur e fica: região viva que já existe é a
 * que o leitor de tela anuncia quando o texto muda.
 */
function CampoOrcado({
  conta,
  nomeConta,
  competencia,
  valor,
  podeEscrever,
  gravar,
}: {
  conta: string;
  nomeConta: string;
  competencia: string;
  valor: number | null;
  podeEscrever: boolean;
  gravar: Gravar;
}) {
  const anterior = valor === null ? "" : centavosParaCampo(valor);
  const [texto, setTexto] = useState(anterior);
  const [visto, setVisto] = useState(anterior);
  const [tocada, setTocada] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [gravacoes, setGravacoes] = useState(0);
  const salvo = useSalvoHaPouco(gravacoes);
  const idErro = useId();

  // A releitura trouxe outro valor: a célula passa a mostrá-lo.
  if (anterior !== visto) {
    setVisto(anterior);
    setTexto(anterior);
  }

  async function sair() {
    // Sair cedo quando nada mudou: sem isso, passar o Tab pela grade
    // inteira grava (e audita) cada célula, mesmo vazia.
    if (!podeEscrever || texto === anterior) {
      return;
    }
    setTocada(true);
    setErro(null);
    setSalvando(true);
    const res = await gravar(conta, competencia, texto);
    setSalvando(false);
    if (!res.ok) {
      setTexto(anterior);
      setErro(res.error);
      return;
    }
    setGravacoes((n) => n + 1);
  }

  // Fora do JSX: atributo ausente (não "false") quando não há erro.
  const descritoPor = erro === null ? undefined : idErro;
  const invalido = erro === null ? undefined : true;
  let estado = "";
  if (salvando) {
    estado = "Salvando…";
  } else if (salvo) {
    estado = "Salvo";
  }

  return (
    <div
      style={{
        alignItems: "flex-end",
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <input
        aria-describedby={descritoPor}
        aria-invalid={invalido}
        aria-label={`Orçado de ${nomeConta} em ${rotuloMes(competencia)}`}
        inputMode="decimal"
        onBlur={sair}
        onChange={(e) => setTexto(e.target.value)}
        readOnly={!podeEscrever}
        style={{
          ...INPUT,
          padding: "4px 6px",
          width: 96,
          textAlign: "right",
          fontSize: "var(--fs-nota)",
          ...(erro ? { border: "1px solid rgba(var(--red-rgb),.6)" } : {}),
        }}
        value={texto}
      />
      {tocada ? (
        <output aria-live="polite" style={{ color: "var(--ink-muted)" }}>
          {estado}
        </output>
      ) : null}
      {erro ? (
        <span
          id={idErro}
          role="alert"
          style={{
            color: "var(--red-text)",
            fontWeight: 600,
            maxWidth: 180,
            textAlign: "right",
            whiteSpace: "normal",
          }}
        >
          Não salvou: {erro}
        </span>
      ) : null}
    </div>
  );
}

/** A palavra do desvio ruim — cor nunca sozinha (apps/backoffice/DESIGN.md). */
function vereditoDoDesvio(grupo: Grupo): string {
  return grupo === 1 ? "abaixo do previsto" : "acima do orçado";
}

function CelulaDesvio({
  grupo,
  desvio,
  desvioPercent,
  forte,
}: {
  grupo: Grupo;
  desvio: number | null;
  desvioPercent: number | null;
  forte?: boolean;
}) {
  const ruim = desvio !== null && desvioRuim(grupo, desvio);
  return (
    <td
      style={{
        ...CEL,
        textAlign: "right",
        fontWeight: forte ? 700 : 500,
        color: ruim ? "var(--red-text)" : "var(--ink)",
      }}
    >
      <span className="mono">{dinheiro(desvio)}</span>
      {desvioPercent === null ? null : (
        <span className="mono" style={{ marginLeft: 6 }}>
          ({desvioPercent}%)
        </span>
      )}
      {ruim ? (
        <span style={{ display: "block", fontWeight: 600 }}>
          {vereditoDoDesvio(grupo)}
        </span>
      ) : null}
    </td>
  );
}

function LinhaConta({
  c,
  competencias,
  podeEscrever,
  gravar,
}: {
  c: OrcadoContaView;
  competencias: string[];
  podeEscrever: boolean;
  gravar: Gravar;
}) {
  return (
    <tr>
      <td style={CEL}>
        <span className="mono" style={{ marginRight: 8 }}>
          {c.conta}
        </span>
        {c.nome}
      </td>
      {competencias.map((competencia) => {
        const linha = c.porCompetencia[competencia];
        return (
          <Fragment key={competencia}>
            <td style={{ ...CEL, textAlign: "right" }}>
              <CampoOrcado
                competencia={competencia}
                conta={c.conta}
                gravar={gravar}
                nomeConta={c.nome}
                podeEscrever={podeEscrever}
                valor={linha?.orcado ?? null}
              />
            </td>
            <td style={{ ...CEL, textAlign: "right" }}>
              <span className="mono">{dinheiro(linha?.realizado ?? null)}</span>
            </td>
            <CelulaDesvio
              desvio={linha?.desvio ?? null}
              desvioPercent={linha?.desvioPercent ?? null}
              grupo={c.grupo}
            />
          </Fragment>
        );
      })}
    </tr>
  );
}

/** `LinhaSubtotal` (`chave` presente) e o antigo `LinhaTotalGeral`
 *  (`chave: null`) eram a mesma soma repetida duas vezes, só a cor mudando.
 *  Unificadas com a flag: total geral não colore (mistura receita e custo, e
 *  as duas direções de "ruim" não cabem num número só) nem mostra percentual;
 *  por grupo, as duas coisas aparecem. */
function LinhaTotal({
  chave,
  contas,
  competencias,
}: {
  chave: ChaveGrupo | null;
  contas: OrcadoContaView[];
  competencias: string[];
}) {
  const grupo = chave === null ? null : GRUPO_REPRESENTATIVO[chave];
  const rotulo =
    chave === null ? "Total geral" : `Total ${ROTULO_GRUPO[chave]}`;
  return (
    <tr>
      <td style={{ ...CEL, fontWeight: 700 }}>{rotulo}</td>
      {competencias.map((competencia) => {
        const totalOrcado = somarCentavos(
          contas.map((c) => c.porCompetencia[competencia]?.orcado ?? null)
        );
        const totalRealizado = somarCentavos(
          contas.map((c) => c.porCompetencia[competencia]?.realizado ?? null)
        );
        const desvio = totalRealizado - totalOrcado;
        return (
          <Fragment key={competencia}>
            <td style={{ ...CEL, textAlign: "right", fontWeight: 700 }}>
              <span className="mono">{formatarBRL(totalOrcado)}</span>
            </td>
            <td style={{ ...CEL, textAlign: "right", fontWeight: 700 }}>
              <span className="mono">{formatarBRL(totalRealizado)}</span>
            </td>
            {grupo === null ? (
              <td style={{ ...CEL, textAlign: "right", fontWeight: 700 }}>
                <span className="mono">{formatarBRL(desvio)}</span>
              </td>
            ) : (
              <CelulaDesvio
                desvio={desvio}
                desvioPercent={
                  totalOrcado === 0
                    ? null
                    : Math.round((desvio / totalOrcado) * 100)
                }
                forte
                grupo={grupo}
              />
            )}
          </Fragment>
        );
      })}
    </tr>
  );
}

function CabecalhoOrcado({ competencias }: { competencias: string[] }) {
  return (
    <thead>
      <tr>
        <th
          rowSpan={2}
          scope="col"
          style={{ ...CEL, textAlign: "left", verticalAlign: "bottom" }}
        >
          Conta
        </th>
        {competencias.map((competencia) => (
          <th
            colSpan={3}
            key={competencia}
            scope="colgroup"
            style={{ ...CEL, textAlign: "center" }}
          >
            {rotuloMes(competencia)}
          </th>
        ))}
      </tr>
      <tr>
        {competencias.map((competencia) => (
          <Fragment key={competencia}>
            <th scope="col" style={{ ...CEL, textAlign: "right" }}>
              Orçado
            </th>
            <th scope="col" style={{ ...CEL, textAlign: "right" }}>
              Realizado
            </th>
            <th scope="col" style={{ ...CEL, textAlign: "right" }}>
              Desvio
            </th>
          </Fragment>
        ))}
      </tr>
    </thead>
  );
}

export type OrcadoPayload = OrcadoView;

export function Orcado({
  inicial,
  intervalo,
  podeEscrever,
}: {
  inicial: OrcadoPayload;
  intervalo: Intervalo;
  podeEscrever: boolean;
}) {
  const [dados, setDados] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);

  const recarregar = useCallback(async () => {
    const res = await lerOrcado({ ate: intervalo.ate, de: intervalo.de });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setDados(res.data);
  }, [intervalo.de, intervalo.ate]);

  // A falha da gravação volta para a célula (ver `CampoOrcado`); o erro do
  // topo fica só para a releitura, que é da tabela inteira.
  const gravar = useCallback<Gravar>(
    async (conta, competencia, texto) => {
      setErro(null);
      const valorCentavos = texto.trim() === "" ? null : paraCentavos(texto);
      const res = await salvarOrcamento({
        competencia,
        conta,
        valorCentavos,
      });
      if (!res.ok) {
        return res;
      }
      await recarregar();
      return { ok: true };
    },
    [recarregar]
  );

  const grupos = useMemo(() => {
    const baldes = new Map<ChaveGrupo, OrcadoContaView[]>();
    for (const c of dados.contas) {
      const chave = chaveDoGrupo(c);
      const atual = baldes.get(chave) ?? [];
      atual.push(c);
      baldes.set(chave, atual);
    }
    return ORDEM_GRUPO.map((chave) => ({
      chave,
      contas: baldes.get(chave) ?? [],
    })).filter((g) => g.contas.length > 0);
  }, [dados.contas]);

  const colunas = 1 + 3 * dados.competencias.length;

  // Sem conta no plano não há linha para orçar: a tabela nasce do plano de
  // contas, não dos lançamentos. O vazio aponta a aba que resolve.
  if (dados.contas.length === 0) {
    return (
      <Secao
        subtitle="orçado editável por conta e competência, realizado somado do livro-razão"
        title="Orçado × realizado"
      >
        <Vazio>
          Plano de contas vazio. Cada linha desta tabela é uma conta do plano;
          sem conta cadastrada não há o que orçar nem onde somar o realizado.
          Cadastre as contas em{" "}
          <Link
            href="/empresa/financeiro?aba=plano"
            style={{ color: "var(--accent-text)" }}
          >
            Plano de contas
          </Link>
          .
        </Vazio>
      </Secao>
    );
  }

  return (
    <Secao
      subtitle="orçado editável por conta e competência, realizado somado do livro-razão, e o desvio entre os dois — em vermelho e dito por extenso quando é ruim para a conta"
      title="Orçado × realizado"
    >
      {erro ? <Erro>{erro}</Erro> : null}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 720 }}>
          <CabecalhoOrcado competencias={dados.competencias} />
          <tbody>
            {grupos.map((g) => (
              <Fragment key={g.chave}>
                <tr>
                  <td
                    colSpan={colunas}
                    style={{
                      ...CEL,
                      background: "var(--surface-2)",
                      color: "var(--ink-faint)",
                      fontSize: "var(--fs-micro)",
                      fontWeight: 700,
                      letterSpacing: ".1em",
                      textTransform: "uppercase",
                    }}
                  >
                    {ROTULO_GRUPO[g.chave]}
                  </td>
                </tr>
                {g.contas.map((c) => (
                  <LinhaConta
                    c={c}
                    competencias={dados.competencias}
                    gravar={gravar}
                    key={c.conta}
                    podeEscrever={podeEscrever}
                  />
                ))}
                <LinhaTotal
                  chave={g.chave}
                  competencias={dados.competencias}
                  contas={g.contas}
                />
              </Fragment>
            ))}
            <LinhaTotal
              chave={null}
              competencias={dados.competencias}
              contas={dados.contas}
            />
          </tbody>
        </table>
      </div>
    </Secao>
  );
}
