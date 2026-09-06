"use client";

import { SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useState } from "react";
import {
  atualizarConta,
  type ContaView,
  criarConta,
} from "@/app/actions/empresa/financeiro";
import {
  BotaoPrimario,
  BotaoSecundario,
  Erro,
  INPUT,
} from "@/components/campo";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";
import {
  type CentroDeCusto,
  ROTULO_CENTRO,
} from "@/lib/empresa/plano-de-contas";

/**
 * Aba "Plano de contas" (spec 2026-09-06 §4.4). Renomear é inline (`onBlur`);
 * desativar/reativar substitui excluir — ponytail: cobre o caso sem quebrar
 * lançamento já feito. Escrita gated por `podeEscrever`, recusada de novo no
 * servidor por `assertCanWrite`.
 */

const ROTULO_GRUPO: Record<number, string> = {
  1: "1 · Receita",
  2: "2 · Deduções",
  3: "3 · Custo de entrega",
  4: "4 · Comercial",
  5: "5 · Produto e engenharia",
  6: "6 · G&A",
};
const GRUPOS = [1, 2, 3, 4, 5, 6];
const CENTROS: CentroDeCusto[] = [
  "comercial",
  "produto-engenharia",
  "entrega",
  "ga",
];
const LARGURAS = [
  { id: "c", largura: "12%" },
  { id: "n", largura: "48%" },
  { id: "ce", largura: "25%" },
  { id: "a", largura: "15%" },
];
const RUBRICA = {
  fontSize: "var(--fs-micro)",
  fontWeight: 700,
  letterSpacing: ".12em",
  textTransform: "uppercase",
} as const;

function temCentro(grupo: number): boolean {
  return grupo >= 3;
}

type Resultado = Awaited<ReturnType<typeof atualizarConta>>;

function LinhaConta({
  c,
  podeEscrever,
  onRenomear,
  onCentro,
  onAtivar,
}: {
  c: ContaView;
  podeEscrever: boolean;
  onRenomear: (conta: string, nome: string) => void;
  onCentro: (conta: string, centro: CentroDeCusto) => void;
  onAtivar: (conta: string, ativa: boolean) => void;
}) {
  const opacidade = c.ativa ? 1 : 0.6;
  return (
    <TableRow>
      <Celula style={{ opacity: opacidade }}>
        <span className="mono">{c.conta}</span>
      </Celula>
      <Celula style={{ opacity: opacidade }}>
        <input
          aria-label={`Nome da conta ${c.conta}`}
          defaultValue={c.nome}
          key={c.nome}
          onBlur={(e) => onRenomear(c.conta, e.target.value)}
          readOnly={!podeEscrever}
          style={{ ...INPUT, padding: "6px 8px" }}
        />
      </Celula>
      <Celula style={{ opacity: opacidade }}>
        {temCentro(c.grupo) ? (
          <select
            disabled={!podeEscrever}
            onChange={(e) => onCentro(c.conta, e.target.value as CentroDeCusto)}
            style={{ ...INPUT, padding: "6px 8px" }}
            value={c.centroDeCusto ?? ""}
          >
            {CENTROS.map((centro) => (
              <option key={centro} value={centro}>
                {ROTULO_CENTRO[centro]}
              </option>
            ))}
          </select>
        ) : (
          <span style={{ color: "var(--ink-faint)" }}>—</span>
        )}
      </Celula>
      <Celula style={{ textAlign: "right" }}>
        {podeEscrever ? (
          <BotaoSecundario onClick={() => onAtivar(c.conta, !c.ativa)}>
            {c.ativa ? "Desativar" : "Reativar"}
          </BotaoSecundario>
        ) : (
          <span style={{ color: "var(--ink-faint)" }}>
            {c.ativa ? "Ativa" : "Inativa"}
          </span>
        )}
      </Celula>
    </TableRow>
  );
}

function FormularioNovaConta({
  podeEscrever,
  onCriar,
}: {
  podeEscrever: boolean;
  onCriar: (input: {
    conta: string;
    nome: string;
    centroDeCusto: CentroDeCusto | null;
  }) => Promise<boolean>;
}) {
  const [conta, setConta] = useState("");
  const [nome, setNome] = useState("");
  const [centro, setCentro] = useState<CentroDeCusto | "">("");
  const [criando, setCriando] = useState(false);

  if (!podeEscrever) {
    return null;
  }

  const enviar = async () => {
    setCriando(true);
    const ok = await onCriar({
      conta: conta.trim(),
      nome: nome.trim(),
      centroDeCusto: centro === "" ? null : centro,
    });
    setCriando(false);
    if (ok) {
      setConta("");
      setNome("");
      setCentro("");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-end",
        marginTop: 16,
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label className="mono" htmlFor="nova-conta-codigo" style={RUBRICA}>
          Código
        </label>
        <input
          id="nova-conta-codigo"
          onChange={(e) => setConta(e.target.value)}
          placeholder="4.7"
          style={{ ...INPUT, width: 90 }}
          value={conta}
        />
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", flex: 1, gap: 4 }}
      >
        <label className="mono" htmlFor="nova-conta-nome" style={RUBRICA}>
          Nome
        </label>
        <input
          id="nova-conta-nome"
          onChange={(e) => setNome(e.target.value)}
          style={INPUT}
          value={nome}
        />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label className="mono" htmlFor="nova-conta-centro" style={RUBRICA}>
          Centro
        </label>
        <select
          id="nova-conta-centro"
          onChange={(e) => setCentro(e.target.value as CentroDeCusto | "")}
          style={{ ...INPUT, width: 180 }}
          value={centro}
        >
          <option value="">(derivado do grupo)</option>
          {CENTROS.map((c) => (
            <option key={c} value={c}>
              {ROTULO_CENTRO[c]}
            </option>
          ))}
        </select>
      </div>
      <BotaoPrimario
        disabled={criando || conta.trim() === "" || nome.trim() === ""}
        full={false}
        onClick={enviar}
        type="button"
      >
        {criando ? "Criando…" : "Nova conta"}
      </BotaoPrimario>
    </div>
  );
}

export function Plano({
  inicial,
  podeEscrever,
}: {
  inicial: ContaView[];
  podeEscrever: boolean;
}) {
  const [contas, setContas] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);

  const aplicar = useCallback((res: Resultado): boolean => {
    if (!res.ok) {
      setErro(res.error);
      return false;
    }
    setErro(null);
    setContas(res.data);
    return true;
  }, []);

  const renomear = useCallback(
    async (conta: string, nomeNovo: string) => {
      if (!podeEscrever) {
        return;
      }
      const nome = nomeNovo.trim();
      const atual = contas.find((c) => c.conta === conta);
      if (!atual || nome === "" || nome === atual.nome) {
        return;
      }
      aplicar(await atualizarConta({ conta, nome }));
    },
    [contas, podeEscrever, aplicar]
  );

  const mudarCentro = useCallback(
    async (conta: string, centroDeCusto: CentroDeCusto) => {
      aplicar(await atualizarConta({ conta, centroDeCusto }));
    },
    [aplicar]
  );

  const ativar = useCallback(
    async (conta: string, ativa: boolean) => {
      aplicar(await atualizarConta({ conta, ativa }));
    },
    [aplicar]
  );

  const criar = useCallback(
    async (input: {
      conta: string;
      nome: string;
      centroDeCusto: CentroDeCusto | null;
    }) => aplicar(await criarConta(input)),
    [aplicar]
  );

  const grupos = useMemo(
    () =>
      GRUPOS.map((grupo) => ({
        grupo,
        contas: contas.filter((c) => c.grupo === grupo),
      })).filter((g) => g.contas.length > 0),
    [contas]
  );

  return (
    <SectionCard
      subtitle="código, nome, centro de custo e situação; sem excluir — desativar cobre o caso"
      title="Plano de contas"
    >
      {erro ? <Erro>{erro}</Erro> : null}
      {grupos.map((g) => (
        <div key={g.grupo} style={{ marginBottom: 20 }}>
          <h3
            className="mono"
            style={{
              margin: "0 0 8px",
              fontSize: "var(--fs-micro)",
              letterSpacing: ".1em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
            }}
          >
            {ROTULO_GRUPO[g.grupo]}
          </h3>
          <Tabela larguras={LARGURAS}>
            <TableHead labels={["Código", "Nome", "Centro", "Situação"]} />
            <tbody>
              {g.contas.map((c) => (
                <LinhaConta
                  c={c}
                  key={c.conta}
                  onAtivar={ativar}
                  onCentro={mudarCentro}
                  onRenomear={renomear}
                  podeEscrever={podeEscrever}
                />
              ))}
            </tbody>
          </Tabela>
        </div>
      ))}
      <FormularioNovaConta onCriar={criar} podeEscrever={podeEscrever} />
    </SectionCard>
  );
}
