"use client";

import { SectionCard } from "@repo/design-system/cosmos/kit";
import { Fragment, useCallback, useMemo, useState } from "react";
import {
  lerOrcado,
  type OrcadoContaView,
  type OrcadoView,
  salvarOrcamento,
} from "@/app/actions/empresa/orcamento";
import { Erro, INPUT } from "@/components/campo";
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

function CampoOrcado({
  conta,
  competencia,
  valor,
  podeEscrever,
  gravar,
}: {
  conta: string;
  competencia: string;
  valor: number | null;
  podeEscrever: boolean;
  gravar: (conta: string, competencia: string, texto: string) => void;
}) {
  return (
    <input
      aria-label={`Orçado ${conta} ${rotuloMes(competencia)}`}
      defaultValue={valor === null ? "" : centavosParaCampo(valor)}
      inputMode="decimal"
      key={`${conta}-${competencia}-${valor ?? ""}`}
      onBlur={(e) => {
        if (podeEscrever) {
          gravar(conta, competencia, e.target.value);
        }
      }}
      readOnly={!podeEscrever}
      style={{
        ...INPUT,
        padding: "4px 6px",
        width: 96,
        textAlign: "right",
        fontSize: "var(--fs-nota)",
      }}
    />
  );
}

function CelulaDesvio({
  grupo,
  desvio,
  forte,
}: {
  grupo: Grupo;
  desvio: number | null;
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
  gravar: (conta: string, competencia: string, texto: string) => void;
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
                podeEscrever={podeEscrever}
                valor={linha?.orcado ?? null}
              />
            </td>
            <td style={{ ...CEL, textAlign: "right" }}>
              <span className="mono">{dinheiro(linha?.realizado ?? null)}</span>
            </td>
            <CelulaDesvio desvio={linha?.desvio ?? null} grupo={c.grupo} />
          </Fragment>
        );
      })}
    </tr>
  );
}

function LinhaSubtotal({
  chave,
  contas,
  competencias,
}: {
  chave: ChaveGrupo;
  contas: OrcadoContaView[];
  competencias: string[];
}) {
  const grupo = GRUPO_REPRESENTATIVO[chave];
  return (
    <tr>
      <td style={{ ...CEL, fontWeight: 700 }}>Total {ROTULO_GRUPO[chave]}</td>
      {competencias.map((competencia) => {
        const totalOrcado = somarCentavos(
          contas.map((c) => c.porCompetencia[competencia]?.orcado ?? null)
        );
        const totalRealizado = somarCentavos(
          contas.map((c) => c.porCompetencia[competencia]?.realizado ?? null)
        );
        return (
          <Fragment key={competencia}>
            <td style={{ ...CEL, textAlign: "right", fontWeight: 700 }}>
              <span className="mono">{formatarBRL(totalOrcado)}</span>
            </td>
            <td style={{ ...CEL, textAlign: "right", fontWeight: 700 }}>
              <span className="mono">{formatarBRL(totalRealizado)}</span>
            </td>
            <CelulaDesvio
              desvio={totalRealizado - totalOrcado}
              forte
              grupo={grupo}
            />
          </Fragment>
        );
      })}
    </tr>
  );
}

function LinhaTotalGeral({
  contas,
  competencias,
}: {
  contas: OrcadoContaView[];
  competencias: string[];
}) {
  return (
    <tr>
      <td style={{ ...CEL, fontWeight: 700 }}>Total geral</td>
      {competencias.map((competencia) => {
        const totalOrcado = somarCentavos(
          contas.map((c) => c.porCompetencia[competencia]?.orcado ?? null)
        );
        const totalRealizado = somarCentavos(
          contas.map((c) => c.porCompetencia[competencia]?.realizado ?? null)
        );
        return (
          <Fragment key={competencia}>
            <td style={{ ...CEL, textAlign: "right", fontWeight: 700 }}>
              <span className="mono">{formatarBRL(totalOrcado)}</span>
            </td>
            <td style={{ ...CEL, textAlign: "right", fontWeight: 700 }}>
              <span className="mono">{formatarBRL(totalRealizado)}</span>
            </td>
            {/* Sem cor: o total geral mistura receita e custo, e as duas
                direções de "ruim" não cabem num número só. */}
            <td style={{ ...CEL, textAlign: "right", fontWeight: 700 }}>
              <span className="mono">
                {formatarBRL(totalRealizado - totalOrcado)}
              </span>
            </td>
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
          style={{ ...CEL, textAlign: "left", verticalAlign: "bottom" }}
        >
          Conta
        </th>
        {competencias.map((competencia) => (
          <th
            colSpan={3}
            key={competencia}
            style={{ ...CEL, textAlign: "center" }}
          >
            {rotuloMes(competencia)}
          </th>
        ))}
      </tr>
      <tr>
        {competencias.map((competencia) => (
          <Fragment key={competencia}>
            <th style={{ ...CEL, textAlign: "right" }}>Orçado</th>
            <th style={{ ...CEL, textAlign: "right" }}>Realizado</th>
            <th style={{ ...CEL, textAlign: "right" }}>Desvio</th>
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

  const gravar = useCallback(
    async (conta: string, competencia: string, texto: string) => {
      setErro(null);
      const valorCentavos = texto.trim() === "" ? null : paraCentavos(texto);
      const res = await salvarOrcamento({
        competencia,
        conta,
        valorCentavos,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      await recarregar();
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

  return (
    <SectionCard
      subtitle="orçado editável por conta e competência, realizado somado do livro-razão, e o desvio entre os dois — vermelho quando é ruim para a conta"
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
                <LinhaSubtotal
                  chave={g.chave}
                  competencias={dados.competencias}
                  contas={g.contas}
                />
              </Fragment>
            ))}
            <LinhaTotalGeral
              competencias={dados.competencias}
              contas={dados.contas}
            />
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
