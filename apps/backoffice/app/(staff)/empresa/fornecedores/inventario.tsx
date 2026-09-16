"use client";

import { Badge, KpiCard, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useState } from "react";
import {
  aplicarAcaoDpa,
  exportarAoCharter,
  type FornecedorDpaRow,
} from "@/app/actions/empresa/fornecedores";
import { Erro, INPUT } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { FiltroChips } from "@/components/filtro-chips";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import { WriteButton } from "@/components/write-button";
import { formatarData, ROTULO_ESTADO, TOM_ESTADO } from "@/lib/empresa/formato";
import { contadores } from "@/lib/empresa/fornecedores";

/**
 * Inventário de fornecedores com o estado do DPA.
 *
 * As ações da linha são as de lib/empresa/fornecedores — a tela oferece só o
 * que `acoes` lista, e o servidor recusa o resto de novo. "Marcar aceito"
 * pede o link da evidência inline: sem ele, o estado seria afirmação.
 */

const FILTROS = [
  { id: "A_ASSINAR", label: "A assinar" },
  { id: "SEM_DOCUMENTO", label: "Sem documento" },
  { id: "bloqueia", label: "Bloqueiam venda" },
];

const LARGURAS = [
  { id: "cod", largura: "64px" },
  { id: "nome", largura: "16%" },
  { id: "dpa", largura: "110px" },
  { id: "regiao", largura: "12%" },
  { id: "ret", largura: "12%" },
  { id: "transf", largura: "11%" },
  { id: "acao", largura: "20%" },
  { id: "dono", largura: "12%" },
  { id: "venda", largura: "150px" },
];

const BOTAO = {
  padding: "4px 10px",
  borderRadius: "var(--r-sm)",
  border: "1px solid var(--hairline)",
  background: "none",
  color: "var(--ink-muted)",
  fontSize: "var(--fs-nota)",
  fontWeight: 600,
  cursor: "pointer",
} as const;

/** Sem ternário aninhado: cada filtro é um `if`, não um segundo `?:` dentro
 *  do primeiro. */
function linhaVisivel(l: FornecedorDpaRow, filtro: string): boolean {
  if (filtro === "all") {
    return true;
  }
  if (filtro === "bloqueia") {
    return l.bloqueiaVenda && l.estado !== "ASSINADO";
  }
  return l.estado === filtro;
}

type AcaoDpaHandler = (
  codigo: string,
  acao: "MARCAR_ACEITO" | "REGISTRAR_PEDIDO",
  evidenciaUrl?: string
) => Promise<void>;

/** Extraída da linha: junta o estado de "pedindo evidência" que só essa ação
 *  usa, e tira da linha o segundo nível de ternário que a complexidade
 *  cognitiva do Biome recusa. */
function AcaoMarcarAceito({
  f,
  onAgir,
}: {
  f: FornecedorDpaRow;
  onAgir: AcaoDpaHandler;
}) {
  const [evidencia, setEvidencia] = useState("");
  const [pedindo, setPedindo] = useState(false);

  if (!pedindo) {
    return (
      <button
        className="btn"
        onClick={() => setPedindo(true)}
        style={BOTAO}
        type="button"
      >
        Marcar aceito
      </button>
    );
  }

  return (
    <>
      <input
        aria-label={`Evidência do DPA de ${f.nome}`}
        onChange={(e) => setEvidencia(e.target.value)}
        placeholder="https://… via assinada ou aceite"
        style={{ ...INPUT, padding: "6px 8px" }}
        value={evidencia}
      />
      <button
        className="btn"
        onClick={() => onAgir(f.codigo, "MARCAR_ACEITO", evidencia)}
        style={BOTAO}
        type="button"
      >
        Confirmar
      </button>
    </>
  );
}

function LinhaFornecedor({
  f,
  podeEscrever,
  onAgir,
}: {
  f: FornecedorDpaRow;
  podeEscrever: boolean;
  onAgir: AcaoDpaHandler;
}) {
  const bloqueiaVenda = f.bloqueiaVenda && f.estado !== "ASSINADO";
  const podeRegistrarPedido =
    podeEscrever && f.acoes.includes("REGISTRAR_PEDIDO");
  const podeMarcarAceito = podeEscrever && f.acoes.includes("MARCAR_ACEITO");

  return (
    <TableRow>
      <Celula>
        <span className="mono" style={{ fontWeight: 700 }}>
          {f.codigo}
        </span>
      </Celula>
      <Celula>
        {f.nome}
        {f.dpaUrl ? (
          <a
            href={f.dpaUrl}
            rel="noreferrer"
            style={{
              marginLeft: 8,
              fontSize: "var(--fs-nota)",
              color: "var(--accent-text)",
            }}
            target="_blank"
          >
            Fonte
          </a>
        ) : null}
      </Celula>
      <Celula>
        <Badge tone={TOM_ESTADO[f.estado]}>
          {ROTULO_ESTADO[f.estado]}
          {f.classificacaoProvisoria ? " *" : ""}
        </Badge>
      </Celula>
      <Celula>{f.regiao ?? "—"}</Celula>
      <Celula>{f.retencao ?? "—"}</Celula>
      <Celula>{f.transferencia ?? "—"}</Celula>
      <Celula>
        {f.acaoPendente ?? "—"}
        {f.pedidoEm ? (
          <div
            style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
          >
            pedido em {formatarData(f.pedidoEm)}
          </div>
        ) : null}
        {f.assinadoEm ? (
          <div
            style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
          >
            assinado em {formatarData(f.assinadoEm)}
          </div>
        ) : null}
      </Celula>
      <Celula>{f.donoPapel ?? "—"}</Celula>
      <Celula>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {bloqueiaVenda ? <Badge tone="amber">Bloqueia venda</Badge> : null}
          {podeRegistrarPedido ? (
            <button
              className="btn"
              onClick={() => onAgir(f.codigo, "REGISTRAR_PEDIDO")}
              style={BOTAO}
              type="button"
            >
              Registrar pedido
            </button>
          ) : null}
          {podeMarcarAceito ? <AcaoMarcarAceito f={f} onAgir={onAgir} /> : null}
        </div>
      </Celula>
    </TableRow>
  );
}

export function Inventario({
  iniciais,
  podeEscrever,
}: {
  iniciais: FornecedorDpaRow[];
  podeEscrever: boolean;
}) {
  const [linhas, setLinhas] = useState(iniciais);
  const [filtro, setFiltro] = useState("all");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const kpis = useMemo(() => contadores(linhas), [linhas]);

  const visiveis = linhas.filter((l) => linhaVisivel(l, filtro));

  const agir = useCallback(
    async (
      codigo: string,
      acao: "MARCAR_ACEITO" | "REGISTRAR_PEDIDO",
      evidenciaUrl?: string
    ) => {
      setErro(null);
      const res = await aplicarAcaoDpa({
        codigo,
        acao,
        evidenciaUrl: evidenciaUrl || undefined,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setLinhas((atual) =>
        atual.map((l) => (l.codigo === codigo ? res.data : l))
      );
    },
    []
  );

  const exportar = useCallback(async () => {
    setErro(null);
    setAviso(null);
    const res = await exportarAoCharter({
      codigos: linhas.map((l) => l.codigo),
    });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setAviso(
      `${res.data.exportados.length} exportados ao Charter${
        res.data.semCorrespondente.length
          ? `; sem correspondente: ${res.data.semCorrespondente.join(", ")}`
          : ""
      }.`
    );
  }, [linhas]);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
        }}
      >
        <KpiCard
          icon="check"
          label="DPA embutido nos termos"
          tone="blue"
          value={kpis.embutidos}
        />
        <KpiCard
          icon="edit"
          label="A aceitar ou assinar"
          tone="blue"
          value={kpis.aAssinar}
        />
        <KpiCard
          icon="eyeOff"
          label="Sem documento público"
          tone="neutral"
          value={kpis.semDocumento}
        />
        <KpiCard
          icon="alert"
          label="Bloqueiam venda hoje"
          tone="amber"
          value={kpis.bloqueiamVenda}
        />
      </div>

      <SectionCard
        action={
          // A única escrita fora do tenant system — e duplicata no Charter
          // do cliente não se desfaz daqui. Passa pela barreira, com a
          // contagem escrita.
          podeEscrever ? (
            <ConfirmarAcao
              alvo={`${linhas.length} fornecedores do inventário`}
              consequencia={`Cria ${linhas.length} fornecedores no Charter do cliente; duplicatas não são desfeitas.`}
              desabilitado={linhas.length === 0}
              onConfirmar={exportar}
              rotulo="Exportar para o Charter"
              tom="accent"
            />
          ) : (
            <WriteButton canWrite={false}>Exportar para o Charter</WriteButton>
          )
        }
        subtitle={`${linhas.length} fornecedores · verificado em ${formatarData(
          linhas[0]?.verificadoEm ?? null
        )}`}
        title="Inventário"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <FiltroChips
            onMudar={setFiltro}
            opcoes={FILTROS}
            rotuloTodas="Todos"
            valor={filtro}
          />
          {erro ? <Erro>{erro}</Erro> : null}
          {aviso ? (
            <p
              style={{
                margin: 0,
                fontSize: "var(--fs-nota)",
                color: "var(--ink-muted)",
              }}
            >
              {aviso}
            </p>
          ) : null}
          <Tabela larguras={LARGURAS}>
            <TableHead
              labels={[
                "Cód.",
                "Fornecedor",
                "DPA",
                "Região",
                "Retenção",
                "Transferência",
                "Ação pendente",
                "Dono",
                "Venda",
              ]}
            />
            <tbody>
              {visiveis.map((f) => (
                <LinhaFornecedor
                  f={f}
                  key={f.codigo}
                  onAgir={agir}
                  podeEscrever={podeEscrever}
                />
              ))}
            </tbody>
          </Tabela>
        </div>
      </SectionCard>
    </>
  );
}
