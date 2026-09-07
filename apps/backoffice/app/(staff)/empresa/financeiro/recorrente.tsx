"use client";

import {
  Badge,
  KpiCard,
  SectionCard,
  type Tone,
} from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import {
  alterarValor,
  criarAssinatura,
  encerrarAssinatura,
  listarRecorrente,
  type RecorrenteView,
  salvarCreditoDoMes,
} from "@/app/actions/empresa/recorrente";
import { Erro, INPUT } from "@/components/campo";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import { WriteButton } from "@/components/write-button";
import { formatarBRL } from "@/lib/comercial/formato";
import {
  type AssinaturaRow,
  arr,
  type CreditoRow,
  churnDeClientes,
  churnDeReceita,
  excedenteDoMes,
  type Movimento,
  type MudancaRow,
  movimento,
  mrr,
  ROTULO_TIPO_MUDANCA,
  receitaDeServico,
  type TipoDeMudanca,
  TOM_TIPO_MUDANCA,
  type UsoDaFranquia,
  usoDaFranquia,
  valorNaCompetencia,
} from "@/lib/empresa/recorrente";
import { NovaAssinaturaDialog } from "./recorrente-dialog-nova";
import {
  AlterarValorDialog,
  CreditoDialog,
  EncerrarDialog,
} from "./recorrente-dialogs";

/**
 * Aba "Receita recorrente" (Task 5, spec 2026-09-06 §4): quatro cartões (MRR,
 * ARR, movimento líquido do mês, churn de receita), a cascata do mês, a
 * tabela de assinaturas com valor da competência/degrau/franquia/uso/
 * excedente, e a receita de serviço numa faixa própria — rotulada como não
 * recorrente e fora do ARR, porque misturar as duas num número só mentiria
 * sobre o que é contrato e o que é projeto avulso.
 *
 * Todo número da tela sai do módulo puro (T2, lib/empresa/recorrente.ts) —
 * nada é recalculado inline aqui, nem o excedente do mês: ele já roda uma vez
 * dentro de `salvarCreditoDoMes` (T3) e roda de novo aqui, com os mesmos
 * `franquia`/`consumidos`/`precoCreditoExtraCentavos` congelados na linha do
 * mês e o `tetoExcedenteCentavos` atual da assinatura — a mesma função, os
 * mesmos parâmetros com nomes iguais aos do banco, então a tela nunca diverge
 * da conta que a action gravou. O teto não fica congelado por mês (só o
 * resultado gravado fica); recalcular com o teto atual é o que a mantém viva
 * se o degrau mudar sem que ninguém regrave o consumo daquele mês.
 */

function competenciaAnterior(competencia: string): string {
  const [ano, mes] = competencia.split("-").map(Number);
  const d = new Date(Date.UTC(ano, mes - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Ponte cliente entre o `<input type="month">` e a URL — mesma ideia de
 *  `SeletorDaAba` (seletor.tsx), mas para um mês só: esta aba olha uma
 *  competência, não um intervalo, então `SeletorDePeriodo` não serve aqui. */
export function SeletorCompetenciaRecorrente({
  competencia,
}: {
  competencia: string;
}) {
  const router = useRouter();
  return (
    <input
      aria-label="Competência"
      onChange={(e) => {
        if (e.target.value) {
          router.push(
            `/empresa/financeiro?aba=recorrente&competencia=${encodeURIComponent(e.target.value)}`
          );
        }
      }}
      style={{ ...INPUT, width: 160 }}
      type="month"
      value={competencia}
    />
  );
}

function tomLiquido(liquido: number): Tone {
  return liquido >= 0 ? "green" : "red";
}

function tomChurn(percent: number | null): Tone {
  return percent !== null && percent > 0 ? "red" : "neutral";
}

function textoChurn(percent: number | null): string {
  return percent === null ? "—" : `${percent}%`;
}

/** Só funciona para os cinco tons que `TOM_TIPO_MUDANCA` usa (green, blue,
 *  amber, red, purple) — todos seguem `--{tom}-soft`/`--{tom}-text`, igual ao
 *  mapa interno de `Badge`. "neutral"/"accent" têm nomes de token diferentes
 *  e não passam por aqui. */
function corDoTom(tone: Tone): { bg: string; fg: string } {
  return { bg: `var(--${tone}-soft)`, fg: `var(--${tone}-text)` };
}

const ORDEM_MOVIMENTO: TipoDeMudanca[] = [
  "NOVO",
  "EXPANSAO",
  "REATIVACAO",
  "CONTRACAO",
  "CHURN",
];

function valorDoTipo(mov: Movimento, tipo: TipoDeMudanca): number {
  if (tipo === "NOVO") {
    return mov.novo;
  }
  if (tipo === "EXPANSAO") {
    return mov.expansao;
  }
  if (tipo === "CONTRACAO") {
    return mov.contracao;
  }
  if (tipo === "CHURN") {
    return mov.churn;
  }
  return mov.reativacao;
}

function BarraMovimento({
  tipo,
  valor,
  maximo,
}: {
  tipo: TipoDeMudanca;
  valor: number;
  maximo: number;
}) {
  const cor = corDoTom(TOM_TIPO_MUDANCA[tipo]);
  const largura = Math.round((valor / maximo) * 100);
  return (
    <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
      <span
        style={{
          color: "var(--ink-muted)",
          fontSize: "var(--fs-nota)",
          fontWeight: 700,
          width: 96,
        }}
      >
        {ROTULO_TIPO_MUDANCA[tipo]}
      </span>
      <div
        style={{
          background: "var(--surface-2)",
          borderRadius: "var(--r-sm)",
          flex: 1,
          height: 18,
          overflow: "hidden",
        }}
      >
        <div
          style={{ background: cor.bg, height: "100%", width: `${largura}%` }}
        />
      </div>
      <span
        className="mono"
        style={{
          color: cor.fg,
          fontSize: "var(--fs-nota)",
          fontWeight: 700,
          textAlign: "right",
          width: 110,
        }}
      >
        {formatarBRL(valor)}
      </span>
    </div>
  );
}

function CascataDoMes({ mov }: { mov: Movimento }) {
  const maximo = Math.max(
    1,
    mov.novo,
    mov.expansao,
    mov.contracao,
    mov.churn,
    mov.reativacao
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {ORDEM_MOVIMENTO.map((tipo) => (
        <BarraMovimento
          key={tipo}
          maximo={maximo}
          tipo={tipo}
          valor={valorDoTipo(mov, tipo)}
        />
      ))}
      <div
        style={{
          borderTop: "1px solid var(--hairline)",
          display: "flex",
          justifyContent: "space-between",
          paddingTop: 8,
        }}
      >
        <span style={{ fontWeight: 700 }}>Líquido do mês</span>
        <span className="mono" style={{ fontWeight: 700 }}>
          {formatarBRL(mov.liquido)}
        </span>
      </div>
    </div>
  );
}

const ROTULO_USO: Record<UsoDaFranquia["leitura"], string> = {
  SEM_FRANQUIA: "Sem franquia",
  OCIOSO: "Ocioso",
  SAUDAVEL: "Saudável",
  UPGRADE: "Upgrade",
};
const TOM_USO: Record<UsoDaFranquia["leitura"], Tone> = {
  SEM_FRANQUIA: "neutral",
  OCIOSO: "amber",
  SAUDAVEL: "green",
  UPGRADE: "red",
};

const LARGURAS_ASSINATURAS = [
  { id: "cliente", largura: "22%" },
  { id: "degrau", largura: "12%" },
  { id: "valor", largura: "13%" },
  { id: "franquia", largura: "10%" },
  { id: "uso", largura: "13%" },
  { id: "excedente", largura: "13%" },
  { id: "acoes", largura: "17%" },
];

function CelulaUso({ credito }: { credito: CreditoRow | undefined }) {
  if (!credito) {
    return <Celula style={{ textAlign: "right" }}>—</Celula>;
  }
  const uso = usoDaFranquia(credito);
  return (
    <Celula style={{ textAlign: "right" }}>
      <div
        style={{
          alignItems: "flex-end",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <Badge tone={TOM_USO[uso.leitura]}>{ROTULO_USO[uso.leitura]}</Badge>
        {uso.percent === null ? null : (
          <span
            className="mono"
            style={{ color: "var(--ink-faint)", fontSize: "var(--fs-micro)" }}
          >
            {uso.percent}%
          </span>
        )}
      </div>
    </Celula>
  );
}

function CelulaExcedente({
  credito,
  teto,
}: {
  credito: CreditoRow | undefined;
  teto: number | null;
}) {
  if (!credito) {
    return <Celula style={{ textAlign: "right" }}>—</Celula>;
  }
  const excedente = excedenteDoMes(
    credito.franquia,
    credito.consumidos,
    credito.precoCreditoExtraCentavos,
    teto
  );
  return (
    <Celula style={{ textAlign: "right" }}>
      <div
        style={{
          alignItems: "flex-end",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        <span className="mono">{formatarBRL(excedente.cobrado)}</span>
        {excedente.reprimido === 0 ? null : (
          <span
            className="mono"
            style={{ color: "var(--ink-faint)", fontSize: "var(--fs-micro)" }}
          >
            {formatarBRL(excedente.reprimido)} reprimido
          </span>
        )}
      </div>
    </Celula>
  );
}

function LinhaAssinatura({
  a,
  mudancas,
  credito,
  competencia,
  podeEscrever,
  onAlterar,
  onEncerrar,
  onCredito,
}: {
  a: AssinaturaRow;
  mudancas: MudancaRow[];
  credito: CreditoRow | undefined;
  competencia: string;
  podeEscrever: boolean;
  onAlterar: (a: AssinaturaRow) => void;
  onEncerrar: (a: AssinaturaRow) => void;
  onCredito: (a: AssinaturaRow) => void;
}) {
  const encerrada = a.encerradaEm !== null;
  const valor = valorNaCompetencia(a.id, mudancas, competencia);
  const podeAgir = podeEscrever && !encerrada;

  return (
    <TableRow>
      <Celula>
        {a.clienteNome}
        {encerrada ? (
          <span style={{ marginLeft: 8 }}>
            <Badge tone="red">Encerrada</Badge>
          </span>
        ) : null}
      </Celula>
      <Celula>
        <span className="mono">{a.planoSlug}</span>
      </Celula>
      <Celula style={{ textAlign: "right" }}>
        <span className="mono">{formatarBRL(valor)}</span>
      </Celula>
      <Celula style={{ textAlign: "right" }}>
        {credito ? credito.franquia : "—"}
      </Celula>
      <CelulaUso credito={credito} />
      <CelulaExcedente credito={credito} teto={a.tetoExcedenteCentavos} />
      <Celula style={{ textAlign: "right" }}>
        {podeAgir ? (
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <button
              aria-label={`Alterar valor — ${a.clienteNome}`}
              className="btn"
              onClick={() => onAlterar(a)}
              style={BOTAO_LINHA}
              type="button"
            >
              Alterar valor
            </button>
            <button
              aria-label={`Lançar consumo — ${a.clienteNome}`}
              className="btn"
              onClick={() => onCredito(a)}
              style={BOTAO_LINHA}
              type="button"
            >
              Lançar consumo
            </button>
            <button
              aria-label={`Encerrar — ${a.clienteNome}`}
              className="btn"
              onClick={() => onEncerrar(a)}
              style={BOTAO_LINHA}
              type="button"
            >
              Encerrar
            </button>
          </div>
        ) : null}
      </Celula>
    </TableRow>
  );
}

const BOTAO_LINHA = {
  alignItems: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-sm)",
  color: "var(--ink-muted)",
  display: "inline-flex",
  fontSize: "var(--fs-nota)",
  fontWeight: 700,
  gap: 6,
  padding: "6px 10px",
} as const;

function FaixaServico({ valor }: { valor: number }) {
  return (
    <div
      style={{
        alignItems: "center",
        background: "var(--surface-2)",
        border: "1px dashed var(--hairline-strong)",
        borderRadius: "var(--r-lg)",
        display: "flex",
        gap: 12,
        justifyContent: "space-between",
        padding: "14px 18px",
      }}
    >
      <div>
        <span
          style={{
            color: "var(--ink-faint)",
            fontSize: "var(--fs-micro)",
            fontWeight: 700,
            letterSpacing: ".1em",
            textTransform: "uppercase",
          }}
        >
          Receita de serviço
        </span>
        <p
          style={{
            color: "var(--ink-muted)",
            fontSize: "var(--fs-nota)",
            margin: "4px 0 0",
          }}
        >
          Projeto e consultoria avulsos — não é recorrente, fica fora do MRR e
          do ARR.
        </p>
      </div>
      <span
        className="mono"
        style={{ fontSize: "var(--fs-forte)", fontWeight: 700 }}
      >
        {formatarBRL(valor)}
      </span>
    </div>
  );
}

export type RecorrentePayload = RecorrenteView;

export function Recorrente({
  inicial,
  competencia,
  podeEscrever,
}: {
  inicial: RecorrentePayload;
  competencia: string;
  podeEscrever: boolean;
}) {
  const [dados, setDados] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [novaAberta, setNovaAberta] = useState(false);
  const [alterando, setAlterando] = useState<AssinaturaRow | null>(null);
  const [encerrando, setEncerrando] = useState<AssinaturaRow | null>(null);
  const [lancandoCredito, setLancandoCredito] = useState<AssinaturaRow | null>(
    null
  );

  const recarregar = useCallback(async () => {
    const res = await listarRecorrente({ competencia });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setDados(res.data);
  }, [competencia]);

  const criar = useCallback(
    async (input: Parameters<typeof criarAssinatura>[0]) => {
      const res = await criarAssinatura(input);
      if (res.ok) {
        await recarregar();
      }
      return res;
    },
    [recarregar]
  );

  const alterar = useCallback(
    async (input: Parameters<typeof alterarValor>[0]) => {
      const res = await alterarValor(input);
      if (res.ok) {
        await recarregar();
      }
      return res;
    },
    [recarregar]
  );

  const encerrar = useCallback(
    async (input: Parameters<typeof encerrarAssinatura>[0]) => {
      const res = await encerrarAssinatura(input);
      if (res.ok) {
        await recarregar();
      }
      return res;
    },
    [recarregar]
  );

  const salvarCredito = useCallback(
    async (input: Parameters<typeof salvarCreditoDoMes>[0]) => {
      const res = await salvarCreditoDoMes(input);
      if (res.ok) {
        await recarregar();
      }
      return res;
    },
    [recarregar]
  );

  const creditoPorCliente = useMemo(() => {
    const mapa = new Map<string, CreditoRow>();
    for (const c of dados.creditos) {
      mapa.set(c.clienteSlug, c);
    }
    return mapa;
  }, [dados.creditos]);

  const mrrCentavos = useMemo(
    () => mrr(dados.assinaturas, dados.mudancas, competencia),
    [dados.assinaturas, dados.mudancas, competencia]
  );
  const arrCentavos = arr(mrrCentavos);
  const mov = useMemo(
    () => movimento(dados.assinaturas, dados.mudancas, competencia),
    [dados.assinaturas, dados.mudancas, competencia]
  );
  const mrrInicial = useMemo(
    () =>
      mrr(dados.assinaturas, dados.mudancas, competenciaAnterior(competencia)),
    [dados.assinaturas, dados.mudancas, competencia]
  );
  const churnPercent = churnDeReceita(
    dados.assinaturas,
    dados.mudancas,
    competencia,
    mrrInicial
  );
  const churnClientes = useMemo(
    () => churnDeClientes(dados.assinaturas, competencia),
    [dados.assinaturas, competencia]
  );
  const servicoCentavos = useMemo(
    () => receitaDeServico(dados.lancamentosDaCompetencia),
    [dados.lancamentosDaCompetencia]
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {erro ? <Erro>{erro}</Erro> : null}

      <div
        style={{
          display: "grid",
          gap: 12,
          gridTemplateColumns: "repeat(4, 1fr)",
        }}
      >
        <KpiCard
          icon="dollar"
          label="MRR"
          tone="green"
          value={formatarBRL(mrrCentavos)}
        />
        <KpiCard
          icon="calendar"
          label="ARR"
          tone="blue"
          value={formatarBRL(arrCentavos)}
        />
        <KpiCard
          icon={mov.liquido >= 0 ? "trendingUp" : "trendingDown"}
          label="Líquido do mês"
          tone={tomLiquido(mov.liquido)}
          value={formatarBRL(mov.liquido)}
        />
        <KpiCard
          hint={`${churnClientes.sairam} de ${churnClientes.base} clientes`}
          icon="alert"
          label="Churn de receita"
          tone={tomChurn(churnPercent)}
          value={textoChurn(churnPercent)}
        />
      </div>

      <SectionCard
        subtitle="novo, expansão, reativação, contração e churn — o que entrou e o que saiu do MRR neste mês"
        title="Movimento do mês"
      >
        <CascataDoMes mov={mov} />
      </SectionCard>

      <SectionCard
        action={
          <WriteButton
            canWrite={podeEscrever}
            onClick={() => setNovaAberta(true)}
          >
            Nova assinatura
          </WriteButton>
        }
        subtitle="valor vigente na competência, degrau, franquia de créditos de IA, uso e excedente do mês"
        title="Assinaturas"
      >
        <div style={{ overflowX: "auto" }}>
          <Tabela larguras={LARGURAS_ASSINATURAS}>
            <TableHead
              labels={[
                "Cliente",
                "Degrau",
                "Valor",
                "Franquia",
                "Uso",
                "Excedente",
                "",
              ]}
            />
            <tbody>
              {dados.assinaturas.map((a) => (
                <LinhaAssinatura
                  a={a}
                  competencia={competencia}
                  credito={creditoPorCliente.get(a.clienteSlug)}
                  key={a.id}
                  mudancas={dados.mudancas}
                  onAlterar={setAlterando}
                  onCredito={setLancandoCredito}
                  onEncerrar={setEncerrando}
                  podeEscrever={podeEscrever}
                />
              ))}
            </tbody>
          </Tabela>
        </div>
      </SectionCard>

      <FaixaServico valor={servicoCentavos} />

      <NovaAssinaturaDialog
        aberto={novaAberta}
        onClose={() => setNovaAberta(false)}
        onCriar={criar}
      />
      <AlterarValorDialog
        assinatura={alterando}
        competencia={competencia}
        onAlterar={alterar}
        onClose={() => setAlterando(null)}
      />
      <EncerrarDialog
        assinatura={encerrando}
        onClose={() => setEncerrando(null)}
        onEncerrar={encerrar}
      />
      <CreditoDialog
        assinatura={lancandoCredito}
        competencia={competencia}
        onClose={() => setLancandoCredito(null)}
        onSalvar={salvarCredito}
      />
    </div>
  );
}
