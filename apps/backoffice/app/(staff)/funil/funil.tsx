"use client";

import type { ProductModule } from "@repo/database";
import { KpiCard, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useState } from "react";
import {
  type CanalRow,
  converterEmProposta,
  type LeadRow,
  listarFunil,
  moverEstagio,
} from "@/app/actions/leads";
import { Erro } from "@/components/campo";
import { FiltroChips } from "@/components/filtro-chips";
import { WriteButton } from "@/components/write-button";
import { formatarBRL } from "@/lib/comercial/formato";
import {
  type ConfigEstagio,
  cacSobreAcvGanho,
  diasNoEstagio,
  type Estagio,
  estagnado,
  type LeadFunil,
  MOTIVOS_PERDA,
  type MotivoPerda,
  PORTAS,
  pipelinePonderado,
  type Transicao,
  taxaLeadParaProposta,
} from "@/lib/comercial/funil";
import { Barras, type LinhaBarra } from "./barras";
import { Board } from "./board";
import { TabelaLeads } from "./tabela-leads";

/**
 * Raiz cliente do funil (spec §4). `useState(inicial)` + `recarregar()` —
 * toda escrita relê `listarFunil()` e substitui o estado inteiro, em vez de
 * remendar o item localmente: `estagio`, `situacao` e histórico interagem
 * demais entre si para reconstruir no cliente sem arriscar divergir do que a
 * action decidiu (mesmo raciocínio que já valia no funil anterior).
 */

export type DadosFunil = {
  leads: LeadRow[];
  estagios: ConfigEstagio[];
  canais: CanalRow[];
  historico: Transicao[];
  hoje: string;
};

/** `LeadRow` → `LeadFunil` para as regras puras — local a cada arquivo que
 *  precisa (também em board.tsx e tabela-leads.tsx) porque cada um é uma
 *  unidade de apresentação independente; a única regra que importa,
 *  `canalSlug: l.canal?.slug ?? null`, é a mesma nas três cópias. */
function paraLeadFunil(l: LeadRow): LeadFunil {
  return {
    id: l.id,
    estagio: l.estagio,
    estagioDesde: l.estagioDesde,
    situacao: l.situacao,
    acvEstimadoCentavos: l.acvEstimadoCentavos,
    proposta: l.proposta,
    entrada: l.entrada,
    canalSlug: l.canal?.slug ?? null,
    perdidoNoEstagio: l.perdidoNoEstagio,
  };
}

function leadVisivel(
  l: LeadRow,
  filtro: string,
  estagios: ConfigEstagio[],
  hoje: Date
): boolean {
  if (filtro === "all") {
    return true;
  }
  if (filtro === "ESTAGNADOS") {
    return estagnado(paraLeadFunil(l), estagios, hoje);
  }
  if (filtro === "GANHOS") {
    return l.situacao === "GANHO";
  }
  if (filtro === "PERDIDOS") {
    return l.situacao === "PERDIDO";
  }
  return l.estagio === filtro;
}

function linhasEntrada(leads: LeadRow[]): LinhaBarra[] {
  return (Object.keys(PORTAS) as ProductModule[]).map((chave) => {
    const porta = PORTAS[chave];
    return {
      chave,
      rotulo: `${porta.degrau} ${porta.rotulo}`,
      quantidade: leads.filter((l) => l.entrada === chave).length,
    };
  });
}

function linhasOrigem(leads: LeadRow[], canais: CanalRow[]): LinhaBarra[] {
  return canais.map((c) => ({
    chave: c.slug,
    rotulo: c.nome,
    quantidade: leads.filter((l) => l.canal?.slug === c.slug).length,
    direita:
      c.cacMedioCentavos === null
        ? "CAC —"
        : `CAC ${formatarBRL(c.cacMedioCentavos)}`,
  }));
}

function linhasMotivos(perdidos: LeadRow[]): LinhaBarra[] {
  return (Object.keys(MOTIVOS_PERDA) as MotivoPerda[]).map((codigo) => ({
    chave: codigo,
    rotulo: MOTIVOS_PERDA[codigo],
    quantidade: perdidos.filter((l) => l.motivoPerda === codigo).length,
  }));
}

const FILTROS = [
  { id: "ESTAGNADOS", label: "Estagnados" },
  { id: "LEAD", label: "Lead" },
  { id: "DISCOVERY", label: "Descoberta" },
  { id: "EVALUATION", label: "Avaliação" },
  { id: "PROPOSAL", label: "Proposta" },
  { id: "GANHOS", label: "Ganhos" },
  { id: "PERDIDOS", label: "Perdidos" },
];

/** Botão "Novo lead" do cabeçalho. Vive aqui (client) porque `WriteButton`
 *  precisa de `onClick`, que `page.tsx` (server) não pode fornecer. O diálogo
 *  em si é da T5 — por ora o clique só mostra o aviso. */
export function NovoLeadAcao({ podeEscrever }: { podeEscrever: boolean }) {
  const [mostrar, setMostrar] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 6,
      }}
    >
      <WriteButton
        canWrite={podeEscrever}
        onClick={() => setMostrar((v) => !v)}
        type="button"
      >
        Novo lead
      </WriteButton>
      {mostrar ? (
        <Erro>Diálogo de novo lead chega na próxima tarefa.</Erro>
      ) : null}
    </div>
  );
}

export function Funil({
  inicial,
  podeEscrever,
}: {
  inicial: DadosFunil;
  podeEscrever: boolean;
}) {
  const [dados, setDados] = useState(inicial);
  const [filtro, setFiltro] = useState("all");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const hoje = useMemo(() => new Date(dados.hoje), [dados.hoje]);
  const leadsFunil = useMemo(
    () => dados.leads.map(paraLeadFunil),
    [dados.leads]
  );

  const recarregar = useCallback(async () => {
    const res = await listarFunil();
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setDados(res.data);
  }, []);

  const mover = useCallback(
    async (id: string, estagio: Estagio) => {
      setErro(null);
      setAviso(null);
      const res = await moverEstagio({ id, estagio });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      await recarregar();
    },
    [recarregar]
  );

  const converter = useCallback(
    async (id: string) => {
      setErro(null);
      setAviso(null);
      const res = await converterEmProposta({ id });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      await recarregar();
    },
    [recarregar]
  );

  const perder = useCallback((_id: string) => {
    setAviso(
      "Marcar perdido pelo board pede motivo e nota — o formulário completo chega na próxima tarefa."
    );
  }, []);

  const abrirLead = useCallback((_id: string) => {
    setAviso("O detalhe do lead chega na próxima tarefa.");
  }, []);

  const abrirEstagio = useCallback((_codigo: Estagio) => {
    setAviso("O painel do estágio chega na próxima tarefa.");
  }, []);

  const pipelineCentavos = pipelinePonderado(leadsFunil, dados.estagios);
  const pipelineTexto = (pipelineCentavos / 100_000)
    .toFixed(1)
    .replace(".", ",");
  const taxa = taxaLeadParaProposta(leadsFunil);
  const cac = cacSobreAcvGanho(leadsFunil, dados.canais);

  let estagnadosQtd = 0;
  let piorDias = 0;
  for (let i = 0; i < dados.leads.length; i++) {
    const l = dados.leads[i];
    if (estagnado(leadsFunil[i], dados.estagios, hoje)) {
      estagnadosQtd += 1;
      const dias = diasNoEstagio(l.estagioDesde, hoje);
      if (dias > piorDias) {
        piorDias = dias;
      }
    }
  }

  const visiveis = dados.leads.filter((l) =>
    leadVisivel(l, filtro, dados.estagios, hoje)
  );
  const perdidos = dados.leads.filter((l) => l.situacao === "PERDIDO");
  const hintEstagnados = estagnadosQtd > 0 ? `pior: ${piorDias} d` : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {erro ? <Erro>{erro}</Erro> : null}
      {aviso ? (
        <output
          style={{
            display: "block",
            margin: 0,
            padding: "9px 11px",
            borderRadius: "var(--r-md)",
            background: "var(--surface-2)",
            border: "1px solid var(--hairline)",
            color: "var(--ink-muted)",
            fontSize: "var(--fs-base)",
            fontWeight: 600,
          }}
        >
          {aviso}
        </output>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        <KpiCard
          icon="wallet"
          label="Pipeline ponderado"
          tone="accent"
          unit="k"
          value={pipelineTexto}
        />
        <KpiCard
          icon="trendingUp"
          label="Lead → proposta"
          tone="green"
          unit="%"
          value={taxa.percent}
        />
        <KpiCard
          hint={hintEstagnados}
          icon="clock"
          label="Estagnados"
          tone={estagnadosQtd > 0 ? "red" : "neutral"}
          value={estagnadosQtd}
        />
        <KpiCard
          icon="dollar"
          label="CAC sobre ACV ganho"
          tone="blue"
          unit={cac.percent === null ? undefined : "%"}
          value={cac.percent === null ? "—" : cac.percent}
        />
      </div>

      <SectionCard icon="kanban" title="Pipeline">
        <Board
          estagios={dados.estagios}
          hoje={hoje}
          leads={dados.leads}
          onAbrirEstagio={abrirEstagio}
          onAbrirLead={abrirLead}
          onConverter={converter}
          onMover={mover}
          onPerder={perder}
          podeEscrever={podeEscrever}
        />
      </SectionCard>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <SectionCard title="Porta de entrada">
          <Barras linhas={linhasEntrada(dados.leads)} />
        </SectionCard>
        <SectionCard title="Origem e custo">
          <Barras linhas={linhasOrigem(dados.leads, dados.canais)} />
        </SectionCard>
      </div>

      <SectionCard
        subtitle={`${visiveis.length} de ${dados.leads.length} lead(s)`}
        title="Leads"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FiltroChips
            onMudar={setFiltro}
            opcoes={FILTROS}
            rotuloTodas="Todos"
            valor={filtro}
          />
          <TabelaLeads
            estagios={dados.estagios}
            hoje={hoje}
            leads={visiveis}
            onAbrirLead={abrirLead}
          />
        </div>
      </SectionCard>

      {perdidos.length > 0 ? (
        <SectionCard title="Motivos de perda">
          <Barras linhas={linhasMotivos(perdidos)} tom="red" />
        </SectionCard>
      ) : null}
    </div>
  );
}
