"use client";

import { SectionCard } from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  type DreView,
  salvarLancamento,
} from "@/app/actions/empresa/financeiro";
import { Erro, INPUT } from "@/components/campo";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import { formatarBRL, paraCentavos } from "@/lib/comercial/formato";

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
const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v}%`;

export function Dre({
  inicial,
  podeEscrever,
}: {
  inicial: DreView;
  podeEscrever: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const ultima = view.competencias.at(-1) ?? "";

  const lancar = useCallback(
    async (competencia: string, conta: string, texto: string) => {
      setErro(null);
      const res = await salvarLancamento({
        competencia,
        conta,
        valorCentavos: texto.trim() === "" ? null : paraCentavos(texto),
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setView(res.data);
    },
    []
  );

  const larguras = [
    { id: "l", largura: "34%" },
    ...view.competencias.map((c) => ({ id: c, largura: "16.5%" })),
    { id: "t", largura: "16.5%" },
  ];
  const cabecalho = ["Linha", ...view.competencias.map(rotuloMes), "Trim."];

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <label
          className="mono"
          htmlFor="ate"
          style={{
            fontSize: "var(--fs-micro)",
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: "var(--ink-faint)",
          }}
        >
          Até
        </label>
        <input
          id="ate"
          onChange={(e) =>
            router.push(`/empresa/financeiro?aba=dre&ate=${e.target.value}`)
          }
          style={{ ...INPUT, width: 160 }}
          type="month"
          value={ultima}
        />
      </div>
      {erro ? <Erro>{erro}</Erro> : null}

      <SectionCard
        subtitle="receita por frente · custo de entrega · margem bruta · EBITDA"
        title="DRE por competência"
      >
        <Tabela larguras={larguras}>
          <TableHead labels={cabecalho} />
          <tbody>
            {view.linhas.map((l) => (
              <TableRow key={l.id}>
                <Celula style={{ fontWeight: l.calculada ? 700 : 500 }}>
                  {l.rotulo}
                </Celula>
                {(l.percents ?? l.valores).map((v, i) => (
                  <Celula
                    key={view.competencias[i]}
                    style={{ textAlign: "right" }}
                  >
                    <span className="mono">
                      {l.percents ? pct(v) : dinheiro(v)}
                    </span>
                  </Celula>
                ))}
                <Celula style={{ textAlign: "right", fontWeight: 700 }}>
                  <span className="mono">
                    {l.percents
                      ? pct(l.trimestrePercent)
                      : dinheiro(l.trimestre)}
                  </span>
                </Celula>
              </TableRow>
            ))}
          </tbody>
        </Tabela>
      </SectionCard>

      <SectionCard
        subtitle="uma célula por conta e mês; vazio apaga o lançamento"
        title="Plano de contas — entrada"
      >
        <Tabela larguras={larguras}>
          <TableHead
            labels={["Conta", ...view.competencias.map(rotuloMes), ""]}
          />
          <tbody>
            {view.contas.map((c) => (
              <TableRow key={c.conta}>
                <Celula>
                  <span className="mono" style={{ marginRight: 8 }}>
                    {c.conta}
                  </span>
                  {c.nome}
                </Celula>
                {c.valores.map((v, i) => (
                  <Celula key={view.competencias[i]}>
                    <input
                      aria-label={`${c.nome} ${rotuloMes(view.competencias[i])}`}
                      defaultValue={
                        v === null ? "" : (v / 100).toFixed(2).replace(".", ",")
                      }
                      inputMode="decimal"
                      key={`${c.conta}-${view.competencias[i]}-${v ?? ""}`}
                      onBlur={(e) => {
                        if (podeEscrever) {
                          lancar(view.competencias[i], c.conta, e.target.value);
                        }
                      }}
                      readOnly={!podeEscrever}
                      style={{
                        ...INPUT,
                        padding: "6px 8px",
                        textAlign: "right",
                      }}
                    />
                  </Celula>
                ))}
                <Celula>{""}</Celula>
              </TableRow>
            ))}
          </tbody>
        </Tabela>
      </SectionCard>
    </>
  );
}
