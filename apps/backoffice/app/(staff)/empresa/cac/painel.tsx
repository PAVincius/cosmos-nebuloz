"use client";

import { SectionCard } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import {
  type CacView,
  salvarAlocacao,
  salvarConversao,
  salvarParcelas,
} from "@/app/actions/empresa/cac";
import { BotaoPrimario, Erro, INPUT, rotuloSalvar } from "@/components/campo";
import { SeletorDePeriodo } from "@/components/seletor-de-periodo";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import {
  centavosParaCampo,
  formatarBRL,
  paraCentavos,
} from "@/lib/comercial/formato";
import { PRESETS_COMPETENCIA } from "@/lib/empresa/periodo";
import type { ContaDoCac } from "@/lib/empresa/plano-de-contas";

const rotuloValor = (v: number | null) => (v === null ? "—" : formatarBRL(v));

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

/** As duas parcelas que ainda se digitam aqui — as outras seis (4.1–4.6) são
 *  leitura do livro-razão. */
const CAMPOS_FORM = PARCELAS.filter(
  (
    p
  ): p is (typeof PARCELAS)[number] & {
    chave: "entregaDiagnosticoCentavos" | "clientesGanhos";
  } => p.chave === "entregaDiagnosticoCentavos" || p.chave === "clientesGanhos"
);

function ehContabil(
  chave: (typeof PARCELAS)[number]["chave"]
): chave is ContaDoCac {
  return chave !== "entregaDiagnosticoCentavos" && chave !== "clientesGanhos";
}

function valorInicial(v: number | null, dinheiro: boolean): string {
  if (v === null) {
    return "";
  }
  return dinheiro ? centavosParaCampo(v) : String(v);
}

/** O que o formulário gravaria agora. Uma função só, usada tanto no envio
 *  quanto no `sujo`: comparar o payload com o que está carregado é o que faz
 *  "Sem alterações" ser verdade — comparar o texto digitado não seria
 *  ("1.000,00" e "1000,00" são o mesmo valor). */
function parcelasDoForm(form: Record<string, string>) {
  return {
    entregaDiagnosticoCentavos:
      form.entregaDiagnosticoCentavos.trim() === ""
        ? null
        : paraCentavos(form.entregaDiagnosticoCentavos),
    clientesGanhos:
      form.clientesGanhos.trim() === ""
        ? null
        : Number.parseInt(form.clientesGanhos, 10),
  };
}

/** Sujo de verdade: o que o formulário gravaria difere do que está carregado.
 *  Antes era `true` fixo, e "Salvar revisão" prometia revisão sem nada para
 *  versionar. */
function haAlteracao(
  form: Record<string, string>,
  parcelas: CacView["parcelas"]
): boolean {
  const digitado = parcelasDoForm(form);
  return (
    digitado.entregaDiagnosticoCentavos !==
      parcelas.entregaDiagnosticoCentavos ||
    digitado.clientesGanhos !== parcelas.clientesGanhos
  );
}

/** Campo em modo leitura: fundo de superfície e sem moldura — lê-se como
 *  valor, não como algo a preencher. O `aria-readonly` é o que o leitor de
 *  tela anuncia; o estilo é o que o olho vê. */
const LEITURA = {
  ...INPUT,
  border: "1px solid transparent",
  cursor: "default",
} as const;

/** O que a tela deixa fazer agora. Fora da árvore JSX (nursery/noLeakedRender)
 *  e fora do componente (teto de complexidade): com mais de um mês no
 *  intervalo as escritas ficam indisponíveis mesmo para quem pode escrever, e
 *  "Salvar revisão" só vale com algo a versionar e nada em curso. */
function modoDeEdicao({
  editavel,
  podeEscrever,
  salvando,
  sujo,
}: {
  editavel: boolean;
  podeEscrever: boolean;
  salvando: boolean;
  sujo: boolean;
}) {
  const podeEditar = podeEscrever && editavel;
  return {
    podeEditar,
    podeSalvar: editavel && sujo && !salvando,
    estiloDoCampo: podeEditar ? INPUT : LEITURA,
  };
}

/** O resultado — o número que a tela existe para dar. Quando incompleto, o
 *  mesmo lugar diz quantas parcelas faltam. Tamanhos na escala do painel
 *  (`--fs-display`, `--fs-titulo`), não px literal. */
function ResultadoDoCac({
  r,
  mensalidadeReferenciaCentavos,
}: {
  r: CacView["resultado"];
  mensalidadeReferenciaCentavos: number | null;
}) {
  const faltam = r.total - r.preenchidas;
  return (
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
          <div
            className="mono"
            style={{ fontSize: "var(--fs-display)", fontWeight: 700 }}
          >
            {r.cacCentavos === null ? "R$ —" : formatarBRL(r.cacCentavos)}
          </div>
          <div
            style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
          >
            {r.cacCentavos === null ? (
              <>
                <strong style={{ color: "var(--amber-text)" }}>
                  faltam {faltam} de {r.total} parcelas
                </strong>{" "}
                — sem número não há resultado
              </>
            ) : (
              "por cliente ganho no período"
            )}
          </div>
        </div>
        <div>
          <div
            className="mono"
            style={{ fontSize: "var(--fs-titulo)", fontWeight: 700 }}
          >
            {r.paybackMeses === null
              ? "— meses"
              : `${String(r.paybackMeses).replace(".", ",")} meses`}
          </div>
          <div
            style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
          >
            Payback contra a mensalidade de referência
            {mensalidadeReferenciaCentavos === null
              ? " (plano scale/anual ausente no catálogo)"
              : `: ${formatarBRL(mensalidadeReferenciaCentavos)}/mês`}
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
  );
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
      CAMPOS_FORM.map((p) => [
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
  const [erro, setErro] = useState<string | null>(null);
  // Três transições, uma por escrita: o pendente de cada uma trava o próprio
  // botão no mesmo render em que o envio começa (segundo clique não grava
  // duas vezes) sem travar as outras duas.
  const [salvando, iniciarSalvar] = useTransition();
  const [salvandoConv, iniciarSalvarConv] = useTransition();
  const [salvandoPesos, iniciarSalvarPesos] = useTransition();

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

  const salvar = useCallback(() => {
    setErro(null);
    iniciarSalvar(async () => {
      aplicar(
        await salvarParcelas({
          competencia: view.competenciaEditavel,
          ...parcelasDoForm(form),
          de: view.intervalo.de,
          ate: view.intervalo.ate,
        })
      );
    });
  }, [form, view.competenciaEditavel, view.intervalo, aplicar]);

  const salvarConv = useCallback(() => {
    setErro(null);
    iniciarSalvarConv(async () => {
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
    });
  }, [conv, view.competenciaEditavel, view.intervalo, aplicar]);

  const salvarPesos = useCallback(() => {
    setErro(null);
    iniciarSalvarPesos(async () => {
      aplicar(
        await salvarAlocacao({
          competencia: view.competenciaEditavel,
          alocacoes: PRODUTOS.filter((p) => pesos[p].trim() !== "").map(
            (p) => ({
              produto: p,
              pesoPercent: Number.parseInt(pesos[p], 10),
            })
          ),
          de: view.intervalo.de,
          ate: view.intervalo.ate,
        })
      );
    });
  }, [pesos, view.competenciaEditavel, view.intervalo, aplicar]);

  const r = view.resultado;
  const sujo = haAlteracao(form, view.parcelas);
  const { podeEditar, podeSalvar, estiloDoCampo } = modoDeEdicao({
    editavel: view.editavel,
    podeEscrever,
    salvando,
    sujo,
  });

  return (
    <>
      {/* O resultado — o número que a tela existe para dar — vem primeiro.
          Quando incompleto, o mesmo lugar diz quantas parcelas faltam, para a
          pessoa não rolar até o fim para descobrir que ainda não há número. */}
      <ResultadoDoCac
        mensalidadeReferenciaCentavos={view.mensalidadeReferenciaCentavos}
        r={r}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <SeletorDePeriodo
          onAplicar={(i) =>
            router.push(
              `/empresa/cac?de=${encodeURIComponent(i.de)}&ate=${encodeURIComponent(i.ate)}`
            )
          }
          presets={PRESETS_COMPETENCIA}
          valor={view.intervalo}
        />
        {podeEscrever ? (
          <BotaoPrimario
            disabled={!podeSalvar}
            full={false}
            onClick={salvar}
            type="button"
          >
            {rotuloSalvar(salvando, sujo)}
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
        subtitle={`${r.preenchidas} de ${r.total} preenchidas · as seis primeiras vêm do livro-razão (aba Lançamentos)`}
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
                <Celula style={{ textAlign: "right" }}>
                  {ehContabil(p.chave) ? (
                    <Link
                      aria-label={p.rotulo}
                      href={`/empresa/financeiro?aba=lancamentos&de=${encodeURIComponent(view.intervalo.de)}&ate=${encodeURIComponent(view.intervalo.ate)}&conta=${encodeURIComponent(p.chave)}`}
                      style={{
                        display: "block",
                        color: "var(--ink)",
                        textDecoration: "none",
                      }}
                    >
                      <span className="mono">
                        {rotuloValor(view.parcelas[p.chave])}
                      </span>
                    </Link>
                  ) : (
                    <input
                      aria-label={p.rotulo}
                      aria-readonly={!podeEditar}
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
                      style={{ ...estiloDoCampo, textAlign: "right" }}
                      value={form[p.chave]}
                    />
                  )}
                </Celula>
              </TableRow>
            ))}
          </tbody>
        </Tabela>
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SectionCard
          subtitle={
            view.editavel
              ? "o Meridian é a porta de entrada; o custo dele segue para quem ele puxa"
              : `Valores do mês ${view.competenciaEditavel} — o rateio não se soma entre meses`
          }
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
                        aria-readonly={!podeEditar}
                        inputMode="numeric"
                        onChange={(e) =>
                          setPesos({ ...pesos, [p]: e.target.value })
                        }
                        placeholder="— %"
                        readOnly={!podeEditar}
                        style={{
                          ...estiloDoCampo,
                          width: 90,
                          textAlign: "right",
                        }}
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
                disabled={salvandoPesos || !view.editavel}
                full={false}
                onClick={salvarPesos}
                type="button"
              >
                {salvandoPesos ? "Salvando pesos…" : "Salvar pesos"}
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
                aria-readonly={!podeEditar}
                inputMode="numeric"
                onChange={(e) =>
                  setConv({ ...conv, [c.chave]: e.target.value })
                }
                placeholder="— %"
                readOnly={!podeEditar}
                style={{ ...estiloDoCampo, width: 90, textAlign: "right" }}
                value={conv[c.chave]}
              />
            </div>
          ))}
          {podeEscrever ? (
            <div style={{ marginTop: 10 }}>
              <BotaoPrimario
                disabled={salvandoConv || !view.editavel}
                full={false}
                onClick={salvarConv}
                type="button"
              >
                {salvandoConv ? "Salvando conversão…" : "Salvar conversão"}
              </BotaoPrimario>
            </div>
          ) : null}
        </SectionCard>
      </div>
    </>
  );
}
