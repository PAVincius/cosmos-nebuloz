"use client";

import { SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import { type CaixaView, salvarSemana } from "@/app/actions/empresa/financeiro";
import { Erro, INPUT } from "@/components/campo";
import {
  centavosParaCampo,
  formatarBRL,
  paraCentavos,
} from "@/lib/comercial/formato";
import type { SemanaEntrada } from "@/lib/empresa/financeiro";
import { formatarDataBr } from "@/lib/empresa/periodo";

type CampoSemana = Exclude<keyof SemanaEntrada, "semanaInicio">;
type Semana = CaixaView["semanas"][number];

const ENTRADAS: { chave: CampoSemana; rotulo: string }[] = [
  { chave: "recebiveisCentavos", rotulo: "Entradas — recebíveis previstos" },
  {
    chave: "contratosAssinadosCentavos",
    rotulo: "Entradas — contratos assinados",
  },
  {
    chave: "pipelinePonderadoCentavos",
    rotulo: "Entradas — pipeline ponderado",
  },
];
const SAIDAS: { chave: CampoSemana; rotulo: string }[] = [
  { chave: "saidasPessoalCentavos", rotulo: "Saídas — pessoal" },
  {
    chave: "saidasFornecedoresCentavos",
    rotulo: "Saídas — fornecedores e ferramentas",
  },
  { chave: "saidasComercialCentavos", rotulo: "Saídas — comercial" },
  { chave: "saidasImpostosCentavos", rotulo: "Saídas — impostos e obrigações" },
  { chave: "saidasOutrasCentavos", rotulo: "Saídas — outras" },
];

const CEL = {
  padding: "6px 8px",
  borderBottom: "1px solid var(--hairline)",
  fontSize: "var(--fs-nota)",
  whiteSpace: "nowrap",
} as const;
const dinheiro = (v: number | null) => (v === null ? "—" : formatarBRL(v));

/** "S3 · 16/09": o número da semana e o dia que ela começa, visíveis. Antes a
 *  data vivia só no `title`, e tooltip não chega ao teclado nem ao leitor de
 *  tela. Sem o ano porque o subtítulo já situa o intervalo. */
function rotuloDaSemana(indice: number, semanaInicio: string): string {
  return `S${indice + 1} · ${formatarDataBr(semanaInicio).slice(0, 5)}`;
}

function Input({
  s,
  chave,
  rotulo,
  podeEscrever,
  gravar,
}: {
  s: Semana;
  chave: CampoSemana;
  rotulo: string;
  podeEscrever: boolean;
  gravar: (semanaInicio: string, chave: CampoSemana, texto: string) => void;
}) {
  return (
    <input
      aria-label={`${rotulo} ${s.semanaInicio}`}
      defaultValue={
        s[chave] === null ? "" : centavosParaCampo(s[chave] as number)
      }
      inputMode="decimal"
      onBlur={(e) => {
        if (podeEscrever) {
          gravar(s.semanaInicio, chave, e.target.value);
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

export function Caixa({
  inicial,
  podeEscrever,
}: {
  inicial: CaixaView;
  podeEscrever: boolean;
}) {
  const [view, setView] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);

  const gravar = useCallback(
    async (semanaInicio: string, chave: CampoSemana, texto: string) => {
      setErro(null);
      const res = await salvarSemana({
        semanaInicio,
        de: view.intervalo.de,
        ate: view.intervalo.ate,
        ...{ [chave]: texto.trim() === "" ? null : paraCentavos(texto) },
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setView(res.data);
    },
    [view.intervalo]
  );

  const linhaCalc = (
    rotulo: string,
    valor: (s: Semana) => number | null,
    forte = false
  ) => (
    <tr key={rotulo}>
      <td style={{ ...CEL, fontWeight: forte ? 700 : 500 }}>{rotulo}</td>
      {view.semanas.map((s) => (
        <td
          key={s.semanaInicio}
          style={{ ...CEL, textAlign: "right", fontWeight: forte ? 700 : 500 }}
        >
          <span className="mono">{dinheiro(valor(s))}</span>
        </td>
      ))}
    </tr>
  );
  const linhaInput = (
    rotulo: string,
    chave: CampoSemana,
    soPrimeira = false
  ) => (
    <tr key={chave}>
      <td style={CEL}>{rotulo}</td>
      {view.semanas.map((s, i) => {
        const efetiva = !!soPrimeira && i > 0;
        return (
          <td key={s.semanaInicio} style={{ ...CEL, textAlign: "right" }}>
            {efetiva ? (
              <span className="mono">
                {dinheiro(s.saldoInicialEfetivoCentavos)}
              </span>
            ) : (
              <Input
                chave={chave}
                gravar={gravar}
                key={`${chave}-${s.semanaInicio}-${s[chave] ?? ""}`}
                podeEscrever={podeEscrever}
                rotulo={rotulo}
                s={s}
              />
            )}
          </td>
        );
      })}
    </tr>
  );

  return (
    <SectionCard
      subtitle={`S1 = ${formatarDataBr(view.semanas[0]?.semanaInicio ?? view.intervalo.de)} · atualizado toda segunda · pipeline ponderado de referência: ${
        view.referenciaPipelineCentavos === null
          ? "sem taxa de conversão registrada na tela de CAC"
          : `${formatarBRL(view.referenciaPipelineCentavos)} (${formatarBRL(view.totalPropostasAbertasCentavos)} × ${view.convPropostaAceitaPercent}%)`
      }`}
      title="Caixa rolante"
    >
      {erro ? <Erro>{erro}</Erro> : null}
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: 1500 }}>
          <thead>
            <tr>
              <th scope="col" style={{ ...CEL, textAlign: "left" }}>
                Linha
              </th>
              {view.semanas.map((s, i) => (
                <th
                  key={s.semanaInicio}
                  scope="col"
                  style={{ ...CEL, textAlign: "right" }}
                  title={formatarDataBr(s.semanaInicio)}
                >
                  {rotuloDaSemana(i, s.semanaInicio)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhaInput(
              "Saldo inicial (extrato na S1)",
              "saldoInicialCentavos",
              true
            )}
            {ENTRADAS.map((e) => linhaInput(e.rotulo, e.chave))}
            {linhaCalc(
              "Total de entradas",
              (s) => s.totalEntradasCentavos,
              true
            )}
            {SAIDAS.map((e) => linhaInput(e.rotulo, e.chave))}
            {linhaCalc("Total de saídas", (s) => s.totalSaidasCentavos, true)}
            {linhaCalc("Saldo final", (s) => s.saldoFinalCentavos, true)}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}
