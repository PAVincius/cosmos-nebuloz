"use client";

/**
 * Raiz cliente do mapa de processos (spec §4). `useState(inicial)` +
 * `recarregar()` — toda escrita relê `listarProcessos()` e substitui o
 * estado inteiro, no mesmo padrão do funil v2 (`app/(staff)/funil/funil.tsx`):
 * processo, ligações e status derivado interagem demais entre si para
 * remendar o item localmente sem arriscar divergir do que a action decidiu.
 *
 * Processo selecionado e filtro de domínio moram em `?processo=` e
 * `?dominio=` (chip "Todos" = sem param): F5 devolve o mesmo painel, e "olha
 * o PZ-07" vira um link. Id ou domínio que não existe cai no estado padrão.
 */
import { Icon } from "@repo/design-system/cosmos/icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  atualizarProcesso,
  criarLigacao,
  criarProcesso,
  type DiagramaRow,
  excluirLigacao,
  excluirProcesso,
  type LigacaoRow,
  listarProcessos,
  type ProcessoRow,
} from "@/app/actions/processos";
import { BotaoPrimario, Erro, INPUT } from "@/components/campo";
import { FiltroChips } from "@/components/filtro-chips";
import {
  buscar,
  DOMINIOS,
  type Dominio,
  layoutPolar,
  NIVEIS,
  type Nivel,
  STATUS,
  type Status,
  statusDe,
} from "@/lib/ferramentas/processos";
import { paraJsonCanvas } from "@/lib/ferramentas/processos-canvas";
import { useParamState } from "@/lib/url-state";
import { Grafo } from "./grafo";
import { Painel } from "./painel";
import { ProcessoDialog, type ProcessoFormInput } from "./processo-dialog";

export type DadosMapa = {
  processos: ProcessoRow[];
  ligacoes: LigacaoRow[];
  diagramas: DiagramaRow[];
};

const OPCOES_DOMINIO = (Object.keys(DOMINIOS) as Dominio[]).map((id) => ({
  id,
  label: DOMINIOS[id].rotulo,
}));
const OPCOES_NIVEL = ([1, 2, 3] as Nivel[]).map((id) => ({
  id: String(id),
  label: NIVEIS[id].curto,
}));
const OPCOES_STATUS = (Object.keys(STATUS) as Status[]).map((id) => ({
  id,
  label: STATUS[id].rotulo,
}));

const TRACO_VERTICAL = (
  <span
    aria-hidden="true"
    style={{ alignSelf: "stretch", background: "var(--hairline)", width: 1 }}
  />
);

function visivelPorFiltros(
  p: ProcessoRow,
  dominio: string,
  nivel: string,
  status: string
): boolean {
  if (dominio !== "all" && p.dominio !== dominio) {
    return false;
  }
  if (nivel !== "all" && String(p.nivel) !== nivel) {
    return false;
  }
  if (status !== "all" && statusDe(p) !== status) {
    return false;
  }
  return true;
}

function baixarCanvas(doc: unknown): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.download = "nebuloz-processos.canvas";
  a.href = url;
  a.click();
  URL.revokeObjectURL(url);
}

/** Mesmo padrão de `components/seletor-de-periodo.tsx`: nada de `@media` em
 *  componente que só usa `style` inline — o breakpoint mora num listener. */
function useEmpilhado(largura: number): boolean {
  const [empilhado, setEmpilhado] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mq = window.matchMedia(`(max-width: ${largura}px)`);
    const aplicar = () => setEmpilhado(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, [largura]);
  return empilhado;
}

function tituloDaBusca(n: number, q: string): string {
  return `${n} ${n === 1 ? "processo" : "processos"} para “${q}”`;
}

/** Só duas colunas quando há painel para mostrar e a tela não empilhou —
 *  função em vez de ternário para o `&&` não acabar exposto a um render da
 *  Biome (`noLeakedRender`). */
function colunasDoGrid(mostrarPainel: boolean, empilhado: boolean): string {
  if (mostrarPainel && !empilhado) {
    return "minmax(0,1fr) 300px";
  }
  return "1fr";
}

export function Mapa({
  inicial,
  podeEscrever,
}: {
  inicial: DadosMapa;
  podeEscrever: boolean;
}) {
  const [dados, setDados] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [dominioParam, setDominio] = useParamState("dominio", "all");
  // Domínio que não existe no param vale como Todos — link velho não pode
  // deixar o mapa vazio sem explicação.
  const dominio = dominioParam in DOMINIOS ? dominioParam : "all";
  const [nivel, setNivel] = useState("all");
  const [status, setStatus] = useState("all");
  const [processoParam, setProcessoParam] = useParamState("processo");
  const selecionado = processoParam || null;
  const setSelecionado = useCallback(
    (id: string | null) => setProcessoParam(id ?? ""),
    [setProcessoParam]
  );
  const [excluindo, setExcluindo] = useState(false);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [processoEmEdicao, setProcessoEmEdicao] = useState<ProcessoRow | null>(
    null
  );
  const empilhado = useEmpilhado(1100);

  const recarregar = useCallback(async () => {
    const res = await listarProcessos();
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setDados(res.data);
  }, []);

  const resultado = useMemo(
    () => buscar(q, dados.processos),
    [q, dados.processos]
  );

  const visiveis = useMemo(
    () =>
      dados.processos.filter(
        (p) =>
          (resultado.ids === null || resultado.ids.has(p.id)) &&
          visivelPorFiltros(p, dominio, nivel, status)
      ),
    [dados.processos, resultado, dominio, nivel, status]
  );

  const limpar = useCallback(() => {
    setQ("");
    setDominio("all");
    setNivel("all");
    setStatus("all");
  }, [setDominio]);

  const abrirCriacao = useCallback(() => {
    setProcessoEmEdicao(null);
    setDialogoAberto(true);
  }, []);

  const abrirEdicao = useCallback((p: ProcessoRow) => {
    setProcessoEmEdicao(p);
    setDialogoAberto(true);
  }, []);

  const fecharDialogo = useCallback(() => {
    setDialogoAberto(false);
  }, []);

  const salvarProcesso = useCallback(
    async (input: ProcessoFormInput) => {
      const res = processoEmEdicao
        ? await atualizarProcesso({ ...input, id: processoEmEdicao.id })
        : await criarProcesso(input);
      if (res.ok) {
        setDialogoAberto(false);
        setProcessoEmEdicao(null);
        await recarregar();
      }
      return res;
    },
    [processoEmEdicao, recarregar]
  );

  const criarLigacaoDoProcesso = useCallback(
    async (paraId: string, rotulo: string) => {
      if (!selecionado) {
        return { error: "Nenhum processo selecionado.", ok: false as const };
      }
      const res = await criarLigacao({ deId: selecionado, paraId, rotulo });
      if (res.ok) {
        await recarregar();
      }
      return res;
    },
    [selecionado, recarregar]
  );

  const excluirProcessoSelecionado = useCallback(
    async (id: string) => {
      setErro(null);
      setExcluindo(true);
      try {
        const res = await excluirProcesso({ id });
        if (!res.ok) {
          setErro(res.error);
          return;
        }
        setSelecionado(null);
        await recarregar();
      } finally {
        setExcluindo(false);
      }
    },
    [recarregar, setSelecionado]
  );

  const removerLigacao = useCallback(
    async (id: string) => {
      setErro(null);
      const res = await excluirLigacao({ id });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      await recarregar();
    },
    [recarregar]
  );

  const exportar = useCallback(() => {
    const layout = layoutPolar(visiveis);
    baixarCanvas(paraJsonCanvas(visiveis, dados.ligacoes, layout.pos));
  }, [visiveis, dados.ligacoes]);

  const processoSelecionado =
    dados.processos.find((p) => p.id === selecionado) ?? null;
  const semResultado = visiveis.length === 0;
  const mostrarPainel = selecionado !== null && processoSelecionado !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {erro ? <Erro>{erro}</Erro> : null}

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        {podeEscrever ? (
          <BotaoPrimario full={false} onClick={abrirCriacao} type="button">
            Novo processo
          </BotaoPrimario>
        ) : null}
      </div>

      <div style={{ position: "relative" }}>
        <Icon
          name="search"
          size={15}
          style={{
            color: "var(--ink-faint)",
            left: 12,
            pointerEvents: "none",
            position: "absolute",
            top: "50%",
            transform: "translateY(-50%)",
          }}
        />
        <input
          aria-label="Buscar processos"
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, descrição ou tag"
          style={{ ...INPUT, paddingLeft: 34, paddingRight: q ? 34 : 12 }}
          type="text"
          value={q}
        />
        {q ? (
          <button
            aria-label="Limpar busca"
            className="btn"
            onClick={() => setQ("")}
            style={{
              background: "none",
              border: "none",
              color: "var(--ink-faint)",
              cursor: "pointer",
              padding: 4,
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
            }}
            type="button"
          >
            <Icon name="x" size={14} />
          </button>
        ) : null}
      </div>

      {q ? (
        <p
          className="mono"
          style={{
            color: "var(--ink-faint)",
            fontSize: "var(--fs-nota)",
            margin: 0,
          }}
        >
          {tituloDaBusca(visiveis.length, q)}
        </p>
      ) : null}

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <FiltroChips
          onMudar={setDominio}
          opcoes={OPCOES_DOMINIO}
          rotuloTodas="Todos domínios"
          valor={dominio}
        />
        {TRACO_VERTICAL}
        <FiltroChips
          onMudar={setNivel}
          opcoes={OPCOES_NIVEL}
          rotuloTodas="Todos níveis"
          valor={nivel}
        />
        {TRACO_VERTICAL}
        <FiltroChips
          onMudar={setStatus}
          opcoes={OPCOES_STATUS}
          rotuloTodas="Todos status"
          valor={status}
        />
      </div>

      {semResultado ? (
        <div
          style={{
            alignItems: "center",
            border: "1px dashed var(--hairline-strong)",
            borderRadius: "var(--r-lg)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            padding: "36px 20px",
          }}
        >
          <p style={{ color: "var(--ink-muted)", margin: 0 }}>
            Nenhum processo bate com a busca e os filtros atuais.
          </p>
          <button
            className="btn"
            onClick={limpar}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--hairline)",
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              fontSize: "var(--fs-nota)",
              fontWeight: 700,
              padding: "6px 14px",
            }}
            type="button"
          >
            Limpar
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: colunasDoGrid(mostrarPainel, empilhado),
          }}
        >
          <Grafo
            ligacoes={dados.ligacoes}
            onExportar={exportar}
            onSelecionar={setSelecionado}
            processos={visiveis}
            quente={resultado.primeiro}
            selecionado={selecionado}
          />
          {mostrarPainel ? (
            <Painel
              executando={excluindo}
              key={processoSelecionado.id}
              ligacoes={dados.ligacoes}
              onCriarLigacao={criarLigacaoDoProcesso}
              onEditar={() => abrirEdicao(processoSelecionado)}
              onExcluirLigacao={removerLigacao}
              onExcluirProcesso={excluirProcessoSelecionado}
              onSelecionar={setSelecionado}
              podeEscrever={podeEscrever}
              processo={processoSelecionado}
              processos={dados.processos}
            />
          ) : null}
        </div>
      )}

      <ProcessoDialog
        aberto={dialogoAberto}
        diagramas={dados.diagramas}
        onFechar={fecharDialogo}
        onSalvar={salvarProcesso}
        processo={processoEmEdicao}
      />
    </div>
  );
}
