"use client";

import type { ProductModule } from "@repo/database";
import { KpiCard, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useState } from "react";
import {
  type CanalRow,
  converterEmProposta,
  criarLead,
  type LeadRow,
  listarFunil,
  marcarPerdido,
  moverEstagio,
  registrarProximaAcao,
} from "@/app/actions/leads";
import { Busca, contemTexto } from "@/components/busca";
import { Erro } from "@/components/campo";
import { Confirmacao } from "@/components/confirmacao";
import { FiltroChips } from "@/components/filtro-chips";
import { BotaoMostrarMais, usePaginas } from "@/components/mostrar-mais";
import { WriteButton } from "@/components/write-button";
import { formatarBRL } from "@/lib/comercial/formato";
import {
  type ConfigEstagio,
  cacSobreAcvGanho,
  diasNoEstagio,
  type Estagio,
  estagnado,
  INFO_ESTAGIO,
  MOTIVOS_PERDA,
  type MotivoPerda,
  PORTAS,
  paraLeadFunil,
  pipelinePonderado,
  type Transicao,
  taxaLeadParaProposta,
} from "@/lib/comercial/funil";
import { useParamState } from "@/lib/url-state";
import { Barras, type LinhaBarra } from "./barras";
import { Board } from "./board";
import { EstagioDialog } from "./estagio-dialog";
import { LeadDialog } from "./lead-dialog";
import { NovoLeadDialog } from "./novo-lead-dialog";
import { TabelaLeads } from "./tabela-leads";

/**
 * Raiz cliente do funil (spec §4). `useState(inicial)` + `recarregar()` —
 * toda escrita relê `listarFunil()` e substitui o estado inteiro, em vez de
 * remendar o item localmente: `estagio`, `situacao` e histórico interagem
 * demais entre si para reconstruir no cliente sem arriscar divergir do que a
 * action decidiu (mesmo raciocínio que já valia no funil anterior).
 *
 * Lead aberto, filtro de estágio e busca moram em `?lead=`, `?estagio=`
 * (chip "Todos" = sem param) e `?q=`: F5 devolve o mesmo diálogo, e "olha
 * esse lead" vira um link. Id ou estágio que não existe cai no estado
 * padrão, sem erro. A busca (nome, contato, dono) vale para o board e para a
 * tabela; o chip de estágio, só para a tabela — o board já é por estágio.
 */

export type DadosFunil = {
  leads: LeadRow[];
  /** Há leads além dos desta página — ver `lib/paginacao.ts`. Opcional
   *  porque só `listarFunil` o produz; quem monta o pacote à mão (testes)
   *  não precisa saber de página. */
  temMaisLeads?: boolean;
  estagios: ConfigEstagio[];
  canais: CanalRow[];
  historico: Transicao[];
  hoje: string;
};

/** Páginas do funil num pacote só: leads e histórico somam, o resto
 *  (estágios, canais, hoje) é o da primeira, e "há mais" é o da última. */
function juntar(paginas: DadosFunil[]): DadosFunil {
  const primeira = paginas[0];
  return {
    ...primeira,
    leads: paginas.flatMap((p) => p.leads),
    historico: paginas.flatMap((p) => p.historico),
    temMaisLeads: paginas.at(-1)?.temMaisLeads ?? false,
  };
}

/**
 * Os dados do funil e as duas formas de mudá-los: `recarregar` relê as
 * páginas já carregadas depois de uma escrita; `mostrarMais` acrescenta a
 * próxima. Cada página é um pacote inteiro (`listarFunil({ pagina })`), e
 * `juntar` faz deles um só.
 */
function useDadosDoFunil(inicial: DadosFunil) {
  const [dados, setDados] = useState(inicial);
  // Releitura que falhou: aviso próprio, junto da lista, não o `erro` das
  // escritas — a escrita deu certo, o que ficou velho foi a tela.
  const [listaVelha, setListaVelha] = useState<string | null>(null);

  const ler = useCallback(async (pagina: number) => {
    const res = await listarFunil({ pagina });
    if (!res.ok) {
      return res;
    }
    return {
      ok: true as const,
      data: { itens: [res.data], temMais: res.data.temMaisLeads },
    };
  }, []);
  const paginacao = usePaginas(ler, inicial.temMaisLeads ?? false);

  const recarregar = useCallback(async () => {
    const res = await paginacao.reler();
    if (!res.ok) {
      setListaVelha(res.error);
      return;
    }
    setListaVelha(null);
    setDados(juntar(res.data));
  }, [paginacao.reler]);

  const mostrarMais = useCallback(async () => {
    const mais = await paginacao.proxima();
    if (mais) {
      setDados((atual) => juntar([atual, ...mais]));
    }
  }, [paginacao.proxima]);

  return { dados, listaVelha, mostrarMais, paginacao, recarregar };
}

/** "1 lead" / "12 leads" — fora do componente, que já está no teto de
 *  complexidade do lint. */
function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function leadBuscado(l: LeadRow, q: string): boolean {
  return contemTexto([l.nome, l.contatoNome, l.contatoEmail, l.donoNome], q);
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

/** "—" no lugar do valor quando não há `EstagioDoFunil` — sem peso/teto por
 *  estágio, pipeline ponderado e estagnados não têm o que calcular. */
function valorKpiOuTraco(
  semEstagios: boolean,
  valor: string | number
): string | number {
  return semEstagios ? "—" : valor;
}

/** Unidade do KPI de pipeline ponderado — some junto com o valor quando sem
 *  estágios configurados. */
function unidadeKpiPipeline(semEstagios: boolean): "k" | undefined {
  return semEstagios ? undefined : "k";
}

/** `recarregar` que falha deixava a lista velha sem dizer: a escrita foi, a
 *  releitura não, e a tela seguia mostrando o estado anterior como se fosse
 *  o atual. Aqui o aviso fica junto da lista, com a saída — reler de novo. */
function AvisoListaVelha({
  motivo,
  onTentar,
}: {
  motivo: string | null;
  onTentar: () => void;
}) {
  if (motivo === null) {
    return null;
  }
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 10,
        padding: "9px 11px",
        borderRadius: "var(--r-md)",
        background: "var(--amber-soft)",
        border: "1px solid rgba(var(--amber-rgb),.35)",
        color: "var(--amber-text)",
        fontSize: "var(--fs-base)",
        fontWeight: 600,
      }}
    >
      <span>Lista pode estar desatualizada — {motivo}</span>
      <button
        className="btn"
        onClick={onTentar}
        style={{
          padding: "4px 10px",
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--hairline-strong)",
          background: "var(--surface-2)",
          color: "var(--ink)",
          fontFamily: "inherit",
          fontSize: "var(--fs-nota)",
          fontWeight: 600,
          cursor: "pointer",
        }}
        type="button"
      >
        Tentar de novo
      </button>
    </div>
  );
}

/** Um lead por vez: enquanto `movendo` existe o board recusa outro drop —
 *  um segundo arraste antes da releitura dispararia outra action sobre a
 *  lista velha. E o fim é dito: mover terminava em `recarregar()` mudo. */
function useMoverLead({
  leads,
  onErro,
  recarregar,
}: {
  leads: { id: string; nome: string }[];
  onErro: (mensagem: string | null) => void;
  recarregar: () => Promise<void>;
}) {
  const [movendo, setMovendo] = useState<string | null>(null);
  const [movido, setMovido] = useState<string | null>(null);
  const mover = useCallback(
    async (id: string, estagio: Estagio) => {
      if (movendo) {
        return { ok: false as const, error: "Aguarde a mudança anterior." };
      }
      onErro(null);
      setMovido(null);
      setMovendo(id);
      try {
        const res = await moverEstagio({ id, estagio });
        if (!res.ok) {
          onErro(res.error);
          return res;
        }
        await recarregar();
        const nome = leads.find((l) => l.id === id)?.nome ?? "Lead";
        setMovido(`${nome} movido para ${INFO_ESTAGIO[estagio].rotulo}.`);
        return res;
      } finally {
        setMovendo(null);
      }
    },
    [leads, movendo, onErro, recarregar]
  );
  const confirmacao = movido ? <Confirmacao>{movido}</Confirmacao> : null;
  return { confirmacao, mover, movendo };
}

export function Funil({
  inicial,
  podeEscrever,
}: {
  inicial: DadosFunil;
  podeEscrever: boolean;
}) {
  const { dados, listaVelha, mostrarMais, paginacao, recarregar } =
    useDadosDoFunil(inicial);
  const [filtroParam, setFiltro] = useParamState("estagio", "all");
  const [q, setQ] = useParamState("q");
  // Estágio que não existe no param vale como Todos — link velho não pode
  // deixar a tabela vazia sem explicação.
  const filtro = FILTROS.some((f) => f.id === filtroParam)
    ? filtroParam
    : "all";
  const [erro, setErro] = useState<string | null>(null);
  const [leadAbertoId, setLeadAbertoId] = useParamState("lead");
  const [leadAbertoModo, setLeadAbertoModo] = useState<
    "perda" | "conversao" | null
  >(null);
  const [estagioAbertoId, setEstagioAbertoId] = useState<Estagio | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);

  const hoje = useMemo(() => new Date(dados.hoje), [dados.hoje]);
  const leadsFunil = useMemo(
    () => dados.leads.map(paraLeadFunil),
    [dados.leads]
  );

  const { confirmacao, mover, movendo } = useMoverLead({
    leads: dados.leads,
    onErro: setErro,
    recarregar,
  });

  const converter = useCallback(
    async (id: string) => {
      setErro(null);
      const res = await converterEmProposta({ id });
      if (!res.ok) {
        setErro(res.error);
        return res;
      }
      await recarregar();
      return res;
    },
    [recarregar]
  );

  const perderComMotivo = useCallback(
    async (id: string, motivo: MotivoPerda, nota: string) => {
      const res = await marcarPerdido({ id, motivo, nota });
      if (res.ok) {
        await recarregar();
      }
      return res;
    },
    [recarregar]
  );

  const salvarProximaAcao = useCallback(
    async (id: string, texto: string, data: string) => {
      const res = await registrarProximaAcao({
        id,
        proximaAcao: texto,
        proximaAcaoEm: data,
      });
      if (res.ok) {
        await recarregar();
      }
      return res;
    },
    [recarregar]
  );

  const criarNovoLead = useCallback(
    async (input: Parameters<typeof criarLead>[0]) => {
      const res = await criarLead(input);
      if (res.ok) {
        await recarregar();
      }
      return res;
    },
    [recarregar]
  );

  const abrirLead = useCallback(
    (id: string) => {
      setLeadAbertoId(id);
      setLeadAbertoModo(null);
    },
    [setLeadAbertoId]
  );

  // Soltar no alvo Perdido do board (Ruling 8) abre o mesmo diálogo do lead,
  // mas já em modo perda — quem arrastou até ali já decidiu que o lead
  // morreu; só falta motivo e nota, não mais um clique para "achar" o botão.
  const abrirLeadEmModoPerda = useCallback(
    (id: string) => {
      setLeadAbertoId(id);
      setLeadAbertoModo("perda");
    },
    [setLeadAbertoId]
  );

  // Soltar em Proposta não converte: abre o mesmo diálogo já na pergunta
  // de conversão. Converter é sem volta (o servidor nunca mais deixa mover o
  // lead), e o diálogo já perguntava — o board era o atalho que pulava isso.
  const abrirLeadEmModoConversao = useCallback(
    (id: string) => {
      setLeadAbertoId(id);
      setLeadAbertoModo("conversao");
    },
    [setLeadAbertoId]
  );

  const fecharLead = useCallback(() => {
    setLeadAbertoId("");
    setLeadAbertoModo(null);
  }, [setLeadAbertoId]);

  const abrirEstagio = useCallback((codigo: Estagio) => {
    setEstagioAbertoId(codigo);
  }, []);

  const semEstagios = dados.estagios.length === 0;
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

  const buscados = dados.leads.filter((l) => leadBuscado(l, q));
  const visiveis = buscados.filter((l) =>
    leadVisivel(l, filtro, dados.estagios, hoje)
  );
  const perdidos = dados.leads.filter((l) => l.situacao === "PERDIDO");
  const hintEstagnados = estagnadosQtd > 0 ? `pior: ${piorDias} d` : undefined;
  const leadAberto = dados.leads.find((l) => l.id === leadAbertoId) ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {erro ? <Erro>{erro}</Erro> : null}
      <AvisoListaVelha motivo={listaVelha} onTentar={recarregar} />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <Busca
          id="busca-lead"
          onMudar={setQ}
          rotulo="Buscar lead"
          total={dados.leads.length}
          valor={q}
          visiveis={buscados.length}
        />
        <WriteButton
          canWrite={podeEscrever}
          onClick={() => setNovoAberto(true)}
        >
          Novo lead
        </WriteButton>
      </div>

      <div className="bo-kpis">
        <KpiCard
          icon="wallet"
          label="Pipeline ponderado"
          tone="accent"
          unit={unidadeKpiPipeline(semEstagios)}
          value={valorKpiOuTraco(semEstagios, pipelineTexto)}
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
          value={valorKpiOuTraco(semEstagios, estagnadosQtd)}
        />
        <KpiCard
          icon="dollar"
          label="CAC sobre ACV ganho"
          tone="blue"
          unit={cac.percent === null ? undefined : "%"}
          value={cac.percent === null ? "—" : cac.percent}
        />
      </div>

      <SectionCard as="h2" icon="kanban" title="Pipeline">
        {confirmacao}
        <Board
          estagios={dados.estagios}
          hoje={hoje}
          leads={buscados}
          movendo={movendo}
          onAbrirEstagio={abrirEstagio}
          onAbrirLead={abrirLead}
          onConverter={abrirLeadEmModoConversao}
          onMover={mover}
          onPerder={abrirLeadEmModoPerda}
          podeEscrever={podeEscrever}
        />
      </SectionCard>

      <div className="bo-duas-colunas">
        <SectionCard as="h2" title="Porta de entrada">
          <Barras linhas={linhasEntrada(dados.leads)} />
        </SectionCard>
        <SectionCard as="h2" title="Origem e custo">
          <Barras linhas={linhasOrigem(dados.leads, dados.canais)} />
        </SectionCard>
      </div>

      <SectionCard
        as="h2"
        subtitle={`${visiveis.length} de ${plural(dados.leads.length, "lead", "leads")}`}
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
          <BotaoMostrarMais
            carregando={paginacao.carregando}
            erro={paginacao.erro}
            onClick={mostrarMais}
            temMais={paginacao.temMais}
          />
        </div>
      </SectionCard>

      {perdidos.length > 0 ? (
        <SectionCard as="h2" title="Motivos de perda">
          <Barras linhas={linhasMotivos(perdidos)} tom="red" />
        </SectionCard>
      ) : null}

      <LeadDialog
        estagios={dados.estagios}
        hoje={hoje}
        lead={leadAberto}
        modoInicial={leadAbertoModo ?? undefined}
        onClose={fecharLead}
        onConverter={converter}
        onMover={mover}
        onPerder={perderComMotivo}
        onProximaAcao={salvarProximaAcao}
        podeEscrever={podeEscrever}
      />
      <NovoLeadDialog
        aberto={novoAberto}
        canais={dados.canais}
        onClose={() => setNovoAberto(false)}
        onCriar={criarNovoLead}
      />
      <EstagioDialog
        codigo={estagioAbertoId}
        dados={dados}
        onAbrirLead={abrirLead}
        onClose={() => setEstagioAbertoId(null)}
        onFiltrar={setFiltro}
        onRecarregar={recarregar}
        podeEscrever={podeEscrever}
      />
    </div>
  );
}
