"use client";

import { Badge, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useState } from "react";
import type { ContaView } from "@/app/actions/empresa/financeiro";
import {
  baixarTitulo,
  cancelarTitulo,
  criarTitulo,
  listarTitulos,
} from "@/app/actions/empresa/titulos";
import { BotaoSecundario, Erro } from "@/components/campo";
import { FiltroChips } from "@/components/filtro-chips";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import { WriteButton } from "@/components/write-button";
import { formatarBRL } from "@/lib/comercial/formato";
import {
  envelhecimento,
  type FaixaDeVencimento,
  ROTULO_SITUACAO,
  ROTULO_TIPO,
  type Situacao,
  situacaoDoTitulo,
  type TituloRow,
  TOM_SITUACAO,
} from "@/lib/empresa/livro";
import { formatarDataBr } from "@/lib/empresa/periodo";
import { NovoTituloDialog } from "./titulo-dialog-novo";
import { BaixarDialog, CancelarDialog } from "./titulo-dialogs";

/**
 * Aba "Títulos" (Task 6, spec 2026-09-06 §4): duas listas — a pagar e a
 * receber —, o envelhecimento no topo e os três diálogos de escrita (novo,
 * baixar, cancelar). Sem intervalo: título é lista viva, não recorte de
 * período (é por isso que `page.tsx` não monta `SeletorDaAba` nesta aba).
 *
 * `useState(inicial)` + `recarregar()`: mesmo padrão de `lancamentos.tsx` —
 * toda escrita relê `listarTitulos` e substitui o estado inteiro.
 */

export type TitulosPayload = {
  titulos: TituloRow[];
  contas: ContaView[];
};

const CHIPS_SITUACAO: { id: Situacao; label: string }[] = [
  { id: "ABERTO", label: "Abertos" },
  { id: "VENCIDO", label: "Vencidos" },
  { id: "BAIXADO", label: "Baixados" },
  { id: "CANCELADO", label: "Cancelados" },
];

const LARGURAS = [
  { id: "vencimento", largura: "11%" },
  { id: "contraparte", largura: "18%" },
  { id: "descricao", largura: "25%" },
  { id: "conta", largura: "9%" },
  { id: "valor", largura: "13%" },
  { id: "situacao", largura: "11%" },
  { id: "acoes", largura: "13%" },
];

function CartaoFaixa({ faixa }: { faixa: FaixaDeVencimento }) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        border: "1px solid var(--hairline)",
        borderRadius: "var(--r-md)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        padding: "10px 12px",
      }}
    >
      <span
        style={{
          color: "var(--ink-faint)",
          fontSize: "var(--fs-micro)",
          fontWeight: 700,
          letterSpacing: ".08em",
          textTransform: "uppercase",
        }}
      >
        {faixa.rotulo}
      </span>
      <span
        className="mono"
        style={{ fontSize: "var(--fs-forte)", fontWeight: 700 }}
      >
        {formatarBRL(faixa.valorCentavos)}
      </span>
      <span style={{ color: "var(--ink-muted)", fontSize: "var(--fs-nota)" }}>
        {faixa.quantidade} título{faixa.quantidade === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function LinhaTitulo({
  t,
  situacao,
  podeEscrever,
  onBaixar,
  onCancelar,
}: {
  t: TituloRow;
  situacao: Situacao;
  podeEscrever: boolean;
  onBaixar: (t: TituloRow) => void;
  onCancelar: (t: TituloRow) => void;
}) {
  const podeAgir = podeEscrever && t.status === "ABERTO";
  return (
    <TableRow>
      <Celula>{formatarDataBr(t.vencimento)}</Celula>
      <Celula>{t.contraparte}</Celula>
      <Celula>{t.descricao}</Celula>
      <Celula>
        <span className="mono">{t.conta}</span>
      </Celula>
      <Celula style={{ textAlign: "right" }}>
        <span className="mono">{formatarBRL(t.valorCentavos)}</span>
      </Celula>
      <Celula>
        <Badge tone={TOM_SITUACAO[situacao]}>{ROTULO_SITUACAO[situacao]}</Badge>
      </Celula>
      <Celula style={{ textAlign: "right" }}>
        {podeAgir ? (
          <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
            <BotaoSecundario
              onClick={() => onBaixar(t)}
              rotulo={`Baixar — ${t.descricao}`}
            >
              Baixar
            </BotaoSecundario>
            <BotaoSecundario
              onClick={() => onCancelar(t)}
              rotulo={`Cancelar — ${t.descricao}`}
            >
              Cancelar
            </BotaoSecundario>
          </div>
        ) : null}
      </Celula>
    </TableRow>
  );
}

function ListaDeTitulos({
  titulo,
  titulos,
  hoje,
  podeEscrever,
  onBaixar,
  onCancelar,
}: {
  titulo: string;
  titulos: TituloRow[];
  hoje: Date;
  podeEscrever: boolean;
  onBaixar: (t: TituloRow) => void;
  onCancelar: (t: TituloRow) => void;
}) {
  return (
    <SectionCard subtitle={`${titulos.length} título(s)`} title={titulo}>
      <Tabela larguras={LARGURAS}>
        <TableHead
          labels={[
            "Vencimento",
            "Contraparte",
            "Descrição",
            "Conta",
            "Valor",
            "Situação",
            "",
          ]}
        />
        <tbody>
          {titulos.map((t) => (
            <LinhaTitulo
              key={t.id}
              onBaixar={onBaixar}
              onCancelar={onCancelar}
              podeEscrever={podeEscrever}
              situacao={situacaoDoTitulo(t, hoje)}
              t={t}
            />
          ))}
        </tbody>
      </Tabela>
    </SectionCard>
  );
}

export function Titulos({
  inicial,
  podeEscrever,
}: {
  inicial: TitulosPayload;
  podeEscrever: boolean;
}) {
  // `useMemo(() => new Date(), [])` roda duas vezes num componente cliente:
  // a primeira, no SSR, pega o relógio do servidor; a hidratação no navegador
  // roda de novo e é esse segundo valor que fica, porque React não reaproveita
  // o cálculo do SSR como cache de `useMemo` na primeira montagem do cliente.
  // Então "hoje" nunca é o payload do servidor — é o relógio de quem está
  // olhando a tela, com uma janela de milissegundos de defasagem entre as duas
  // rodadas. Tolerável aqui: `situacaoDoTitulo`/`envelhecimento` só mudam de
  // resposta na virada do dia, e a pior consequência de errar por um instante
  // é uma faixa de vencimento reclassificada no recarregamento seguinte, não
  // dado perdido.
  const hoje = useMemo(() => new Date(), []);
  const [dados, setDados] = useState(inicial);
  const [situacaoFiltro, setSituacaoFiltro] = useState("all");
  const [erro, setErro] = useState<string | null>(null);
  const [novoAberto, setNovoAberto] = useState(false);
  const [tituloBaixando, setTituloBaixando] = useState<TituloRow | null>(null);
  const [tituloCancelando, setTituloCancelando] = useState<TituloRow | null>(
    null
  );

  const faixas = useMemo(
    () => envelhecimento(dados.titulos, hoje),
    [dados.titulos, hoje]
  );

  const recarregar = useCallback(async () => {
    const res = await listarTitulos({});
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setDados(res.data);
  }, []);

  const criar = useCallback(
    async (input: Parameters<typeof criarTitulo>[0]) => {
      const res = await criarTitulo(input);
      if (res.ok) {
        await recarregar();
      }
      return res;
    },
    [recarregar]
  );

  const baixar = useCallback(
    async (input: Parameters<typeof baixarTitulo>[0]) => {
      const res = await baixarTitulo(input);
      if (res.ok) {
        await recarregar();
      }
      return res;
    },
    [recarregar]
  );

  const cancelar = useCallback(
    async (input: Parameters<typeof cancelarTitulo>[0]) => {
      const res = await cancelarTitulo(input);
      if (res.ok) {
        await recarregar();
      }
      return res;
    },
    [recarregar]
  );

  const titulosVisiveis = useMemo(() => {
    if (situacaoFiltro === "all") {
      return dados.titulos;
    }
    return dados.titulos.filter(
      (t) => situacaoDoTitulo(t, hoje) === situacaoFiltro
    );
  }, [dados.titulos, situacaoFiltro, hoje]);

  const aPagar = titulosVisiveis.filter((t) => t.tipo === "PAGAR");
  const aReceber = titulosVisiveis.filter((t) => t.tipo === "RECEBER");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {erro ? <Erro>{erro}</Erro> : null}

      <div
        style={{
          display: "grid",
          gap: 10,
          gridTemplateColumns: "repeat(5, 1fr)",
        }}
      >
        {faixas.map((f) => (
          <CartaoFaixa faixa={f} key={f.id} />
        ))}
      </div>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: 10,
          justifyContent: "space-between",
        }}
      >
        <FiltroChips
          onMudar={setSituacaoFiltro}
          opcoes={CHIPS_SITUACAO}
          rotuloTodas="Todos"
          valor={situacaoFiltro}
        />
        <WriteButton
          canWrite={podeEscrever}
          onClick={() => setNovoAberto(true)}
        >
          Novo título
        </WriteButton>
      </div>

      <ListaDeTitulos
        hoje={hoje}
        onBaixar={setTituloBaixando}
        onCancelar={setTituloCancelando}
        podeEscrever={podeEscrever}
        titulo={ROTULO_TIPO.PAGAR}
        titulos={aPagar}
      />
      <ListaDeTitulos
        hoje={hoje}
        onBaixar={setTituloBaixando}
        onCancelar={setTituloCancelando}
        podeEscrever={podeEscrever}
        titulo={ROTULO_TIPO.RECEBER}
        titulos={aReceber}
      />

      <NovoTituloDialog
        aberto={novoAberto}
        contas={dados.contas}
        onClose={() => setNovoAberto(false)}
        onCriar={criar}
      />
      <BaixarDialog
        onBaixar={baixar}
        onClose={() => setTituloBaixando(null)}
        titulo={tituloBaixando}
      />
      <CancelarDialog
        onCancelar={cancelar}
        onClose={() => setTituloCancelando(null)}
        titulo={tituloCancelando}
      />
    </div>
  );
}
