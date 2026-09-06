"use client";

import { SectionCard } from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  type CacView,
  salvarAlocacao,
  salvarConversao,
  salvarParcelas,
} from "@/app/actions/empresa/cac";
import { BotaoPrimario, Erro, INPUT, rotuloSalvar } from "@/components/campo";
import { SeletorDePeriodo } from "@/components/seletor-de-periodo";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import { formatarBRL, paraCentavos } from "@/lib/comercial/formato";
import { PRESETS_COMPETENCIA } from "@/lib/empresa/periodo";
import type { ContaDoCac } from "@/lib/empresa/plano-de-contas";

/** As oito parcelas da tela, com "como medir" e fonte de cac-modelo.md §2.
 *  As seis primeiras são contas do DRE; as duas últimas, do CacPeriodo. */
const PARCELAS: {
  chave: ContaDoCac | "entregaDiagnosticoCentavos" | "clientesGanhos";
  rotulo: string;
  comoMedir: string;
  fonte: string;
  dinheiro: boolean;
}[] = [
  {
    chave: "4.1",
    rotulo: "Salários e encargos — vendas",
    comoMedir: "Folha de quem vende × % do tempo em vendas",
    fonte: "folha / RH",
    dinheiro: true,
  },
  {
    chave: "4.2",
    rotulo: "Salários e encargos — marketing",
    comoMedir: "Folha de quem faz marketing × % do tempo",
    fonte: "folha / RH",
    dinheiro: true,
  },
  {
    chave: "4.3",
    rotulo: "Comissões pagas",
    comoMedir: "Soma de comissão sobre propostas aceitas",
    fonte: "contrato",
    dinheiro: true,
  },
  {
    chave: "4.4",
    rotulo: "Ferramentas de vendas e marketing",
    comoMedir: "Assinaturas ativas: CRM, automação, gravação",
    fonte: "notas fiscais",
    dinheiro: true,
  },
  {
    chave: "4.5",
    rotulo: "Mídia paga",
    comoMedir: "Anúncio, evento, patrocínio no período",
    fonte: "extrato",
    dinheiro: true,
  },
  {
    chave: "4.6",
    rotulo: "Horas de discovery, convertidas e não",
    comoMedir: "Leads em DISCOVERY × horas por lead × custo-hora carregado",
    fonte: "funil",
    dinheiro: true,
  },
  {
    chave: "entregaDiagnosticoCentavos",
    rotulo: "Custo de entrega do diagnóstico",
    comoMedir: "Horas de entrega × custo-hora + ferramentas da entrega",
    fonte: "delivery",
    dinheiro: true,
  },
  {
    chave: "clientesGanhos",
    rotulo: "Clientes ganhos no período",
    comoMedir: "Propostas com status ACEITA no período",
    fonte: "propostas",
    dinheiro: false,
  },
];

const CONVERSOES: { chave: keyof CacView["conversao"]; rotulo: string }[] = [
  { chave: "convLeadDiscoveryPercent", rotulo: "LEAD → DISCOVERY" },
  {
    chave: "convDiscoveryEvaluationPercent",
    rotulo: "DISCOVERY → EVALUATION",
  },
  {
    chave: "convEvaluationPropostaPercent",
    rotulo: "EVALUATION → proposta enviada",
  },
  { chave: "convPropostaAceitaPercent", rotulo: "proposta enviada → ACEITA" },
];

const PRODUTOS = ["MERIDIAN", "CHARTER", "SCAFFOLD", "COSMOS"] as const;

function valorInicial(v: number | null, dinheiro: boolean): string {
  if (v === null) {
    return "";
  }
  return dinheiro ? (v / 100).toFixed(2).replace(".", ",") : String(v);
}

export function Painel({
  inicial,
  podeEscrever,
}: {
  inicial: CacView;
  podeEscrever: boolean;
}) {
  const router = useRouter();
  const [view, setView] = useState(inicial);
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(
      PARCELAS.map((p) => [
        p.chave,
        valorInicial(inicial.parcelas[p.chave], p.dinheiro),
      ])
    )
  );
  const [conv, setConv] = useState<Record<string, string>>(
    Object.fromEntries(
      CONVERSOES.map((c) => [
        c.chave,
        inicial.conversao[c.chave] === null
          ? ""
          : String(inicial.conversao[c.chave]),
      ])
    )
  );
  const [pesos, setPesos] = useState<Record<string, string>>(
    Object.fromEntries(
      PRODUTOS.map((p) => [
        p,
        String(
          inicial.alocacoes.find((a) => a.produto === p)?.pesoPercent ?? ""
        ),
      ])
    )
  );
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const aplicar = useCallback(
    (res: Awaited<ReturnType<typeof salvarParcelas>>) => {
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setView(res.data);
    },
    []
  );

  const salvar = useCallback(async () => {
    setSalvando(true);
    setErro(null);
    const contas: Partial<Record<ContaDoCac, number | null>> = {};
    for (const p of PARCELAS) {
      if (
        p.chave === "entregaDiagnosticoCentavos" ||
        p.chave === "clientesGanhos"
      ) {
        continue;
      }
      contas[p.chave] =
        form[p.chave].trim() === "" ? null : paraCentavos(form[p.chave]);
    }
    aplicar(
      await salvarParcelas({
        competencia: view.competenciaEditavel,
        contas,
        entregaDiagnosticoCentavos:
          form.entregaDiagnosticoCentavos.trim() === ""
            ? null
            : paraCentavos(form.entregaDiagnosticoCentavos),
        clientesGanhos:
          form.clientesGanhos.trim() === ""
            ? null
            : Number.parseInt(form.clientesGanhos, 10),
        de: view.intervalo.de,
        ate: view.intervalo.ate,
      })
    );
    setSalvando(false);
  }, [form, view.competenciaEditavel, view.intervalo, aplicar]);

  const salvarConv = useCallback(async () => {
    setErro(null);
    aplicar(
      await salvarConversao({
        competencia: view.competenciaEditavel,
        ...Object.fromEntries(
          CONVERSOES.map((c) => [
            c.chave,
            conv[c.chave].trim() === ""
              ? null
              : Number.parseInt(conv[c.chave], 10),
          ])
        ),
        de: view.intervalo.de,
        ate: view.intervalo.ate,
      })
    );
  }, [conv, view.competenciaEditavel, view.intervalo, aplicar]);

  const salvarPesos = useCallback(async () => {
    setErro(null);
    aplicar(
      await salvarAlocacao({
        competencia: view.competenciaEditavel,
        alocacoes: PRODUTOS.filter((p) => pesos[p].trim() !== "").map((p) => ({
          produto: p,
          pesoPercent: Number.parseInt(pesos[p], 10),
        })),
        de: view.intervalo.de,
        ate: view.intervalo.ate,
      })
    );
  }, [pesos, view.competenciaEditavel, view.intervalo, aplicar]);

  const r = view.resultado;
  const faltam = r.total - r.preenchidas;
  // Fora da árvore JSX (nursery/noLeakedRender): com mais de um mês no
  // intervalo as escritas ficam indisponíveis mesmo para quem pode escrever.
  const podeEditar = podeEscrever && view.editavel;

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <SeletorDePeriodo
          onAplicar={(i) => router.push(`/empresa/cac?de=${i.de}&ate=${i.ate}`)}
          presets={PRESETS_COMPETENCIA}
          valor={view.intervalo}
        />
        {podeEscrever ? (
          <BotaoPrimario
            disabled={salvando || !view.editavel}
            full={false}
            onClick={salvar}
            type="button"
          >
            {rotuloSalvar(salvando, true)}
          </BotaoPrimario>
        ) : null}
      </div>
      {view.editavel ? null : (
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-nota)",
            color: "var(--ink-muted)",
          }}
        >
          Selecione um mês para editar — o período atual agrega{" "}
          {view.competencias.length} meses.
        </p>
      )}
      {erro ? <Erro>{erro}</Erro> : null}

      <SectionCard
        subtitle={`${r.preenchidas} de ${r.total} preenchidas`}
        title="Parcelas do período"
      >
        <Tabela
          larguras={[
            { id: "p", largura: "28%" },
            { id: "c", largura: "40%" },
            { id: "f", largura: "12%" },
            { id: "v", largura: "20%" },
          ]}
        >
          <TableHead
            labels={["Parcela", "Como medir", "Fonte", "Valor mensal"]}
          />
          <tbody>
            {PARCELAS.map((p) => (
              <TableRow key={p.chave}>
                <Celula>{p.rotulo}</Celula>
                <Celula style={{ color: "var(--ink-muted)" }}>
                  {p.comoMedir}
                </Celula>
                <Celula>
                  <span className="mono">{p.fonte}</span>
                </Celula>
                <Celula>
                  <input
                    aria-label={p.rotulo}
                    inputMode={p.dinheiro ? "decimal" : "numeric"}
                    onChange={(e) =>
                      setForm({ ...form, [p.chave]: e.target.value })
                    }
                    placeholder={
                      p.chave === "clientesGanhos"
                        ? `sugestão: ${view.sugestaoClientesGanhos}`
                        : "R$ —"
                    }
                    readOnly={!podeEditar}
                    style={{ ...INPUT, textAlign: "right" }}
                    value={form[p.chave]}
                  />
                </Celula>
              </TableRow>
            ))}
          </tbody>
        </Tabela>
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SectionCard
          subtitle="o Meridian é a porta de entrada; o custo dele segue para quem ele puxa"
          title="Alocação por produto"
        >
          <Tabela
            larguras={[
              { id: "p", largura: "34%" },
              { id: "w", largura: "33%" },
              { id: "c", largura: "33%" },
            ]}
          >
            <TableHead labels={["Produto", "Peso", "CAC alocado"]} />
            <tbody>
              {PRODUTOS.map((p) => {
                const alocado =
                  r.porProduto.find((a) => a.produto === p)?.cacCentavos ??
                  null;
                return (
                  <TableRow key={p}>
                    <Celula>{p}</Celula>
                    <Celula>
                      <input
                        aria-label={`Peso ${p}`}
                        inputMode="numeric"
                        onChange={(e) =>
                          setPesos({ ...pesos, [p]: e.target.value })
                        }
                        placeholder="— %"
                        readOnly={!podeEditar}
                        style={{ ...INPUT, width: 90, textAlign: "right" }}
                        value={pesos[p]}
                      />
                    </Celula>
                    <Celula>
                      <span className="mono">
                        {alocado === null ? "R$ —" : formatarBRL(alocado)}
                      </span>
                    </Celula>
                  </TableRow>
                );
              })}
            </tbody>
          </Tabela>
          {podeEscrever ? (
            <div style={{ marginTop: 10 }}>
              <BotaoPrimario
                disabled={!view.editavel}
                full={false}
                onClick={salvarPesos}
                type="button"
              >
                Salvar pesos
              </BotaoPrimario>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard
          subtitle={
            view.editavel
              ? "Pondera as horas de discovery que não viraram cliente. Lê-se do funil quando houver volume; até lá, entra à mão."
              : `Pondera as horas de discovery que não viraram cliente. Valores do mês ${view.competenciaEditavel}.`
          }
          title="Conversão do funil"
        >
          {CONVERSOES.map((c) => (
            <div
              key={c.chave}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 0",
                borderBottom: "1px solid var(--hairline)",
                fontSize: "var(--fs-base)",
              }}
            >
              <span className="mono">{c.rotulo}</span>
              <input
                aria-label={c.rotulo}
                inputMode="numeric"
                onChange={(e) =>
                  setConv({ ...conv, [c.chave]: e.target.value })
                }
                placeholder="— %"
                readOnly={!podeEditar}
                style={{ ...INPUT, width: 90, textAlign: "right" }}
                value={conv[c.chave]}
              />
            </div>
          ))}
          {podeEscrever ? (
            <div style={{ marginTop: 10 }}>
              <BotaoPrimario
                disabled={!view.editavel}
                full={false}
                onClick={salvarConv}
                type="button"
              >
                Salvar conversão
              </BotaoPrimario>
            </div>
          ) : null}
        </SectionCard>
      </div>

      <SectionCard
        title="CAC totalmente carregado"
        tone={r.cacCentavos === null ? "amber" : "green"}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div className="mono" style={{ fontSize: 32, fontWeight: 700 }}>
              {r.cacCentavos === null ? "R$ —" : formatarBRL(r.cacCentavos)}
            </div>
            <div
              style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
            >
              {r.cacCentavos === null
                ? `Faltam ${faltam} parcelas · sem número não há resultado`
                : "por cliente ganho no período"}
            </div>
          </div>
          <div>
            <div className="mono" style={{ fontSize: 24, fontWeight: 700 }}>
              {r.paybackMeses === null
                ? "— meses"
                : `${String(r.paybackMeses).replace(".", ",")} meses`}
            </div>
            <div
              style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
            >
              Payback contra a mensalidade de referência
              {view.mensalidadeReferenciaCentavos === null
                ? " (plano scale/anual ausente no catálogo)"
                : `: ${formatarBRL(view.mensalidadeReferenciaCentavos)}/mês`}
            </div>
          </div>
        </div>
        <p
          style={{
            margin: "12px 0 0",
            fontSize: "var(--fs-nota)",
            color: "var(--ink-muted)",
          }}
        >
          O ticket do diagnóstico e o preço do pacote S do Scaffold esperam este
          resultado. Preencher as parcelas é a decisão; o cálculo é automático.
        </p>
      </SectionCard>
    </>
  );
}
