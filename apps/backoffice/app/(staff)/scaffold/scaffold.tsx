"use client";

import { Badge, SectionCard, type Tone } from "@repo/design-system/cosmos/kit";
import { useCallback, useMemo, useState } from "react";
import {
  materializarEngajamento,
  type PromocoesPorCliente,
} from "@/app/actions/scaffold";
import type { ServiceRow } from "@/app/actions/services";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { formatarBRL } from "@/lib/comercial/formato";

const SEVERIDADE_ROTULO: Record<string, string> = {
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
};

const SEVERIDADE_TOM: Record<string, Tone> = {
  HIGH: "red",
  MEDIUM: "amber",
  LOW: "neutral",
};

const ESFORCO_ROTULO: Record<string, string> = {
  S: "Pequeno",
  M: "Médio",
  L: "Grande",
};

const NAO_DIGITO = /[^\d]/g;

function paraCentavos(texto: string): number {
  const so = texto.replace(NAO_DIGITO, "");
  return so ? Number.parseInt(so, 10) : 0;
}

function dataLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

const linhaCheckbox = {
  display: "flex",
  alignItems: "flex-start",
  gap: 10,
  padding: "10px 2px",
} as const;

function LinhaPromocao({
  gapCode,
  gapStatement,
  severity,
  effort,
  costOfDelay,
  promotedAt,
  marcada,
  desabilitada,
  onAlternar,
}: {
  gapCode: string;
  gapStatement: string;
  severity: string;
  effort: string;
  costOfDelay: number;
  promotedAt: string;
  marcada: boolean;
  desabilitada: boolean;
  onAlternar: () => void;
}) {
  return (
    <li style={{ ...linhaCheckbox, borderTop: "1px solid var(--hairline)" }}>
      <input
        aria-label={`Selecionar ${gapCode}`}
        checked={marcada}
        disabled={desabilitada}
        onChange={onAlternar}
        style={{
          marginTop: 3,
          cursor: desabilitada ? "not-allowed" : "pointer",
        }}
        type="checkbox"
      />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span
            className="mono"
            style={{ fontSize: "var(--fs-nota)", fontWeight: 700 }}
          >
            {gapCode}
          </span>
          <Badge dot tone={SEVERIDADE_TOM[severity] ?? "neutral"}>
            {SEVERIDADE_ROTULO[severity] ?? severity}
          </Badge>
          <Badge tone="neutral">
            Esforço {ESFORCO_ROTULO[effort] ?? effort}
          </Badge>
          <span
            style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
          >
            atraso {costOfDelay} · promovida em {dataLocal(promotedAt)}
          </span>
        </span>
        <span style={{ display: "block", fontSize: "var(--fs-base)" }}>
          {gapStatement}
        </span>
      </span>
    </li>
  );
}

export function Scaffold({
  iniciais,
  servicos,
  podeEscrever,
}: {
  iniciais: PromocoesPorCliente[];
  servicos: ServiceRow[];
  podeEscrever: boolean;
}) {
  const [grupos, setGrupos] = useState(iniciais);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    serviceId: "",
    valor: "",
    escopo: "",
  });

  // O cliente da seleção atual — deriva do primeiro grupo que tem alguma
  // promoção marcada. Com nenhuma seleção, todo mundo pode marcar; com uma,
  // só o mesmo cliente pode continuar marcando, porque um engajamento tem um
  // cliente só (a action recusa o contrário, mas a tela nem oferece o clique).
  const clienteSelecionado = useMemo(() => {
    for (const g of grupos) {
      if (g.promocoes.some((p) => selecionadas.has(p.id))) {
        return g.clienteTenantId;
      }
    }
    return null;
  }, [grupos, selecionadas]);

  const alternar = useCallback((id: string) => {
    setSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
  }, []);

  const materializar = useCallback(async () => {
    if (selecionadas.size === 0) {
      return;
    }
    setErro(null);
    setEnviando(true);
    const res = await materializarEngajamento({
      promotionIds: [...selecionadas],
      nome: form.nome,
      serviceId: form.serviceId || undefined,
      escopo: form.escopo || undefined,
      valorCentavos: paraCentavos(form.valor),
    });
    setEnviando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setGrupos((atual) =>
      atual
        .map((g) => ({
          ...g,
          promocoes: g.promocoes.filter((p) => !selecionadas.has(p.id)),
        }))
        .filter((g) => g.promocoes.length > 0)
    );
    setSelecionadas(new Set());
    setForm({ nome: "", serviceId: "", valor: "", escopo: "" });
  }, [selecionadas, form]);

  const podeMaterializar =
    selecionadas.size > 0 && form.nome.trim().length >= 2;
  const totalPendente = grupos.reduce((s, g) => s + g.promocoes.length, 0);
  const mostrarFormulario = podeEscrever && selecionadas.size > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {erro ? <Erro>{erro}</Erro> : null}

      <SectionCard
        icon="puzzle"
        subtitle={`${totalPendente} promoção(ões) pendente(s) · ${grupos.length} cliente(s)`}
        title="Fila de Scaffold"
      >
        {grupos.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 28,
              textAlign: "center",
              fontSize: "var(--fs-base)",
              lineHeight: 1.6,
              color: "var(--ink-muted)",
            }}
          >
            Nenhuma promoção pendente. Uma lacuna promovida para Scaffold no
            Meridian aparece aqui até virar engajamento.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {grupos.map((g) => (
              <div key={g.clienteTenantId}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{ fontSize: "var(--fs-forte)", fontWeight: 700 }}
                  >
                    {g.clienteNome}
                  </span>
                  <span
                    className="mono"
                    style={{
                      fontSize: "var(--fs-nota)",
                      color: "var(--ink-faint)",
                    }}
                  >
                    {g.clienteSlug} · {g.promocoes.length} lacuna(s)
                  </span>
                </div>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {g.promocoes.map((p) => (
                    <LinhaPromocao
                      costOfDelay={p.costOfDelay}
                      desabilitada={
                        !podeEscrever ||
                        (clienteSelecionado !== null &&
                          clienteSelecionado !== g.clienteTenantId)
                      }
                      effort={p.effort}
                      gapCode={p.gapCode}
                      gapStatement={p.gapStatement}
                      key={p.id}
                      marcada={selecionadas.has(p.id)}
                      onAlternar={() => alternar(p.id)}
                      promotedAt={p.promotedAt}
                      severity={p.severity}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {mostrarFormulario ? (
        <SectionCard
          icon="handshake"
          subtitle={`${selecionadas.size} lacuna(s) selecionada(s) — vira um Engagement só`}
          title="Materializar engajamento"
        >
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
            }}
          >
            <Campo htmlFor="s-nome" label="Nome do engajamento">
              <input
                id="s-nome"
                onChange={(ev) =>
                  setForm((f) => ({ ...f, nome: ev.target.value }))
                }
                style={INPUT}
                value={form.nome}
              />
            </Campo>
            <Campo htmlFor="s-servico" label="Serviço do catálogo (opcional)">
              <select
                id="s-servico"
                onChange={(ev) =>
                  setForm((f) => ({ ...f, serviceId: ev.target.value }))
                }
                style={{ ...INPUT, cursor: "pointer" }}
                value={form.serviceId}
              >
                <option value="">Nenhum</option>
                {servicos
                  .filter((s) => s.ativo)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.codigo} · {s.nome}
                    </option>
                  ))}
              </select>
            </Campo>
            <Campo
              hint={`grava ${formatarBRL(paraCentavos(form.valor))} — sem CAC carregado, o preço é decisão manual (PRD §6)`}
              htmlFor="s-valor"
              label="Valor fechado"
            >
              <input
                id="s-valor"
                inputMode="numeric"
                onChange={(ev) =>
                  setForm((f) => ({ ...f, valor: ev.target.value }))
                }
                placeholder="0,00"
                style={INPUT}
                value={form.valor}
              />
            </Campo>
          </div>

          <Campo
            hint="o que foi acordado entregar"
            htmlFor="s-escopo"
            label="Escopo (opcional)"
          >
            <textarea
              id="s-escopo"
              onChange={(ev) =>
                setForm((f) => ({ ...f, escopo: ev.target.value }))
              }
              style={{ ...INPUT, minHeight: 70, resize: "vertical" }}
              value={form.escopo}
            />
          </Campo>

          <div style={{ marginTop: 10 }}>
            <BotaoPrimario
              disabled={!podeMaterializar || enviando}
              full={false}
              onClick={materializar}
              type="button"
            >
              {enviando ? "Criando…" : "Criar engajamento"}
            </BotaoPrimario>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
