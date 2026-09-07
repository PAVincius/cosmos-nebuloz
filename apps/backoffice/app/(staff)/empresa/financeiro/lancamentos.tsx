"use client";

import { SectionCard } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import type { ContaView } from "@/app/actions/empresa/financeiro";
import {
  atualizarLancamento,
  criarLancamento,
  excluirLancamento,
  listarLancamentos,
} from "@/app/actions/empresa/livro";
import { BotaoSecundario, Erro, INPUT } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { FiltroChips } from "@/components/filtro-chips";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import { WriteButton } from "@/components/write-button";
import { formatarBRL } from "@/lib/comercial/formato";
import { type LinhaDoLivro, totalPorConta } from "@/lib/empresa/livro";
import { formatarDataBr, type Intervalo } from "@/lib/empresa/periodo";
import {
  type CentroDeCusto,
  ROTULO_CENTRO,
} from "@/lib/empresa/plano-de-contas";
import { LancamentoDialog } from "./lancamento-dialog";

/**
 * Aba "Lançamentos" (Task 5, spec 2026-09-06 §4): o livro-razão por
 * intervalo, filtrável por centro de custo e por conta (a conta chega pela
 * URL — é o que a célula do DRE liga, Task 4), com busca por descrição e
 * contraparte, total do período e o diálogo de criar/editar.
 *
 * `useState(inicial)` + `recarregar()`: toda escrita relê `listarLancamentos`
 * e substitui o estado inteiro, no mesmo padrão de `funil.tsx` — remendar a
 * linha local arriscaria divergir do que a action realmente gravou.
 */

export type LancamentosPayload = {
  linhas: LinhaDoLivro[];
  contas: ContaView[];
};

const CENTROS_FILTRO: CentroDeCusto[] = [
  "comercial",
  "produto-engenharia",
  "ga",
];
const OPCOES_CENTRO = CENTROS_FILTRO.map((c) => ({
  id: c,
  label: ROTULO_CENTRO[c],
}));

const LARGURAS = [
  { id: "data", largura: "11%" },
  { id: "conta", largura: "10%" },
  { id: "descricao", largura: "29%" },
  { id: "contraparte", largura: "18%" },
  { id: "valor", largura: "14%" },
  { id: "acoes", largura: "18%" },
];

// Busca sem acento e sem caixa: NFD separa a letra da marca diacrítica, e
// ̀–ͯ (marcas diacríticas combinantes) cobre as marcas — regex no
// topo do módulo por causa de useTopLevelRegex.
const MARCA_DIACRITICA = /[̀-ͯ]/g;
function normalizarBusca(s: string): string {
  return s.normalize("NFD").replace(MARCA_DIACRITICA, "").toLowerCase();
}

function linhaVisivel(
  l: LinhaDoLivro,
  centro: string,
  centroPorConta: Map<string, CentroDeCusto | null>,
  buscaNormalizada: string
): boolean {
  if (centro !== "all" && centroPorConta.get(l.conta) !== centro) {
    return false;
  }
  if (!buscaNormalizada) {
    return true;
  }
  const alvo = normalizarBusca(`${l.descricao} ${l.contraparte ?? ""}`);
  return alvo.includes(buscaNormalizada);
}

function LinhaTabela({
  l,
  podeEscrever,
  excluindo,
  onEditar,
  onExcluir,
}: {
  l: LinhaDoLivro;
  podeEscrever: boolean;
  excluindo: boolean;
  onEditar: (l: LinhaDoLivro) => void;
  onExcluir: (id: string) => void;
}) {
  const viaTitulo = l.tituloId !== null;
  const podeExcluir = podeEscrever && !viaTitulo;
  return (
    <TableRow>
      <Celula>{formatarDataBr(l.data)}</Celula>
      <Celula>
        <span className="mono">{l.conta}</span>
      </Celula>
      <Celula>{l.descricao}</Celula>
      <Celula>{l.contraparte ?? "—"}</Celula>
      <Celula style={{ textAlign: "right" }}>
        <span className="mono">{formatarBRL(l.valorCentavos)}</span>
      </Celula>
      <Celula style={{ textAlign: "right" }}>
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 6,
            justifyContent: "flex-end",
          }}
        >
          {viaTitulo ? (
            <span
              style={{ color: "var(--ink-faint)", fontSize: "var(--fs-nota)" }}
            >
              via título
            </span>
          ) : null}
          {podeEscrever ? (
            <BotaoSecundario
              onClick={() => onEditar(l)}
              rotulo={`Editar lançamento — ${l.descricao}`}
            >
              Editar
            </BotaoSecundario>
          ) : null}
          {podeExcluir ? (
            <ConfirmarAcao
              alvo={l.descricao}
              consequencia="O lançamento sai do livro-razão e do total do DRE no mês."
              executando={excluindo}
              onConfirmar={() => onExcluir(l.id)}
              rotulo={`Excluir lançamento — ${l.descricao}`}
            />
          ) : null}
        </div>
      </Celula>
    </TableRow>
  );
}

export function Lancamentos({
  inicial,
  intervalo,
  contaFiltro,
  podeEscrever,
}: {
  inicial: LancamentosPayload;
  intervalo: Intervalo;
  /** Conta vinda da URL (`?conta=`, Task 4): o servidor já leu só as linhas
   *  dessa conta — aqui só falta mostrar de qual conta se trata e o total
   *  dela, sem filtrar de novo no cliente. */
  contaFiltro: string | null;
  podeEscrever: boolean;
}) {
  const [dados, setDados] = useState(inicial);
  const [centro, setCentro] = useState("all");
  const [busca, setBusca] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [dialogoAberto, setDialogoAberto] = useState(false);
  const [linhaEditando, setLinhaEditando] = useState<LinhaDoLivro | null>(null);
  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  const centroPorConta = useMemo(() => {
    const mapa = new Map<string, CentroDeCusto | null>();
    for (const c of dados.contas) {
      mapa.set(c.conta, c.centroDeCusto);
    }
    return mapa;
  }, [dados.contas]);

  const linhasFiltradas = useMemo(() => {
    const buscaNormalizada = normalizarBusca(busca);
    return dados.linhas.filter((l) =>
      linhaVisivel(l, centro, centroPorConta, buscaNormalizada)
    );
  }, [dados.linhas, centro, busca, centroPorConta]);

  const totalVisivel = linhasFiltradas.reduce(
    (soma, l) => soma + l.valorCentavos,
    0
  );
  const totalDaConta = contaFiltro
    ? (totalPorConta(dados.linhas)[contaFiltro] ?? 0)
    : null;
  const contaInfo = contaFiltro
    ? (dados.contas.find((c) => c.conta === contaFiltro) ?? null)
    : null;

  const recarregar = useCallback(async () => {
    const res = await listarLancamentos({
      ate: intervalo.ate,
      de: intervalo.de,
      ...(contaFiltro ? { conta: contaFiltro } : {}),
    });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setDados(res.data);
  }, [intervalo.de, intervalo.ate, contaFiltro]);

  const criar = useCallback(
    async (input: Parameters<typeof criarLancamento>[0]) => {
      const res = await criarLancamento(input);
      if (res.ok) {
        await recarregar();
      }
      return res;
    },
    [recarregar]
  );

  const atualizar = useCallback(
    async (input: Parameters<typeof atualizarLancamento>[0]) => {
      const res = await atualizarLancamento(input);
      if (res.ok) {
        await recarregar();
      }
      return res;
    },
    [recarregar]
  );

  const excluir = useCallback(
    async (id: string) => {
      setErro(null);
      setExcluindoId(id);
      const res = await excluirLancamento({ id });
      setExcluindoId(null);
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      await recarregar();
    },
    [recarregar]
  );

  const abrirNovo = useCallback(() => {
    setLinhaEditando(null);
    setDialogoAberto(true);
  }, []);
  const abrirEdicao = useCallback((l: LinhaDoLivro) => {
    setLinhaEditando(l);
    setDialogoAberto(true);
  }, []);
  const fecharDialogo = useCallback(() => {
    setDialogoAberto(false);
  }, []);

  const hrefSemConta = `/empresa/financeiro?aba=lancamentos&de=${intervalo.de}&ate=${intervalo.ate}`;

  return (
    <SectionCard
      subtitle={`${formatarDataBr(intervalo.de)} – ${formatarDataBr(intervalo.ate)} · ${linhasFiltradas.length} de ${dados.linhas.length} lançamento(s)`}
      title="Lançamentos"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {erro ? <Erro>{erro}</Erro> : null}

        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <FiltroChips
              onMudar={setCentro}
              opcoes={OPCOES_CENTRO}
              valor={centro}
            />
            {contaFiltro ? (
              <span
                style={{
                  alignItems: "center",
                  background: "var(--accent-soft)",
                  border: "1px solid rgba(var(--accent-rgb),.45)",
                  borderRadius: 99,
                  display: "inline-flex",
                  fontSize: "var(--fs-nota)",
                  fontWeight: 700,
                  gap: 6,
                  padding: "5px 11px",
                }}
              >
                Conta <span className="mono">{contaFiltro}</span>
                {contaInfo ? ` · ${contaInfo.nome}` : ""}
                <Link href={hrefSemConta} style={{ color: "var(--ink)" }}>
                  ×
                </Link>
              </span>
            ) : null}
            <input
              aria-label="Buscar por descrição ou contraparte"
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar…"
              style={{ ...INPUT, width: 220 }}
              value={busca}
            />
          </div>
          <WriteButton canWrite={podeEscrever} onClick={abrirNovo}>
            Novo lançamento
          </WriteButton>
        </div>

        <Tabela larguras={LARGURAS}>
          <TableHead
            labels={["Data", "Conta", "Descrição", "Contraparte", "Valor", ""]}
          />
          <tbody>
            {linhasFiltradas.map((l) => (
              <LinhaTabela
                excluindo={excluindoId === l.id}
                key={l.id}
                l={l}
                onEditar={abrirEdicao}
                onExcluir={excluir}
                podeEscrever={podeEscrever}
              />
            ))}
          </tbody>
        </Tabela>

        <div
          style={{
            display: "flex",
            gap: 24,
            justifyContent: "flex-end",
            padding: "4px 4px 0",
          }}
        >
          <span style={{ fontSize: "var(--fs-base)", fontWeight: 600 }}>
            Total do período:{" "}
            <span className="mono">{formatarBRL(totalVisivel)}</span>
          </span>
          {contaFiltro ? (
            <span style={{ fontSize: "var(--fs-base)", fontWeight: 600 }}>
              Total da conta {contaFiltro}:{" "}
              <span className="mono">{formatarBRL(totalDaConta ?? 0)}</span>
            </span>
          ) : null}
        </div>
      </div>

      <LancamentoDialog
        aberto={dialogoAberto}
        contas={dados.contas}
        linha={linhaEditando}
        onAtualizar={atualizar}
        onClose={fecharDialogo}
        onCriar={criar}
      />
    </SectionCard>
  );
}
