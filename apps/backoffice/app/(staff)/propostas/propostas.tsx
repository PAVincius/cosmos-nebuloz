"use client";

import { Badge, SectionCard, type Tone } from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import {
  createProposalAction,
  type ProposalRow,
  submitProposalAction,
} from "@/app/actions/proposals";
import type { ServiceRow } from "@/app/actions/services";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { LIMITE_DESCONTO_SEM_APROVACAO } from "@/lib/comercial";
import { formatarBRL } from "../servicos/catalogo";

const TOM: Record<string, Tone> = {
  RASCUNHO: "neutral",
  AGUARDANDO_APROVACAO: "amber",
  ENVIADA: "blue",
  ACEITA: "green",
  RECUSADA: "red",
};

const ROTULO: Record<string, string> = {
  RASCUNHO: "Rascunho",
  AGUARDANDO_APROVACAO: "Aguardando aprovação",
  ENVIADA: "Enviada",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
};

type ItemForm = { serviceId: string; quantidade: number };

function LinhaProposta({
  p,
  podeEscrever,
  primeira,
  onEnviar,
}: {
  p: ProposalRow;
  podeEscrever: boolean;
  primeira: boolean;
  onEnviar: (id: string) => void;
}) {
  const acimaDoLimite = p.descontoPercent > LIMITE_DESCONTO_SEM_APROVACAO;
  // Só rascunho tem ação: enviada de novo mudaria o que o cliente já recebeu.
  const podeEnviar = podeEscrever && p.status === "RASCUNHO";

  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 2px",
        borderTop: primeira ? "none" : "1px solid var(--hairline)",
      }}
    >
      <span
        className="mono"
        style={{ fontSize: 11, fontWeight: 700, width: 84 }}
      >
        {p.numero}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
          {p.titulo}
        </span>
        <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
          {p.cliente}
        </span>
      </span>
      {p.descontoPercent > 0 ? (
        // Acima do limite fica em âmbar mesmo depois de decidido: é o que
        // explica por que a proposta passou pela fila.
        <Badge tone={acimaDoLimite ? "amber" : "neutral"}>
          −{p.descontoPercent}%
        </Badge>
      ) : null}
      <span
        className="mono"
        style={{
          fontSize: 12,
          color: "var(--accent-text)",
          width: 110,
          textAlign: "right",
        }}
      >
        {formatarBRL(p.totalCentavos)}
      </span>
      <Badge dot tone={TOM[p.status] ?? "neutral"}>
        {ROTULO[p.status] ?? p.status}
      </Badge>
      {podeEnviar ? (
        <button
          className="btn"
          onClick={() => onEnviar(p.id)}
          style={{
            padding: "4px 10px",
            borderRadius: "var(--r-sm)",
            border: "1px solid var(--hairline)",
            background: "none",
            color: "var(--ink-muted)",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
          type="button"
        >
          {acimaDoLimite ? "Pedir aprovação" : "Enviar"}
        </button>
      ) : null}
    </li>
  );
}

export function Propostas({
  iniciais,
  servicos,
  podeEscrever,
}: {
  iniciais: ProposalRow[];
  servicos: ServiceRow[];
  podeEscrever: boolean;
}) {
  const [lista, setLista] = useState(iniciais);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [cliente, setCliente] = useState("");
  const [desconto, setDesconto] = useState(0);
  const [itens, setItens] = useState<ItemForm[]>([]);

  const disponiveis = servicos.filter((s) => s.ativo);
  const bruto = itens.reduce((soma, i) => {
    const s = servicos.find((x) => x.id === i.serviceId);
    return soma + (s ? s.precoBaseCentavos * i.quantidade : 0);
  }, 0);
  const total = Math.round(bruto * (1 - desconto / 100));
  const precisaAprovacao = desconto > LIMITE_DESCONTO_SEM_APROVACAO;

  const criar = useCallback(async () => {
    setErro(null);
    const res = await createProposalAction({
      titulo,
      clienteNome: cliente || undefined,
      descontoPercent: desconto,
      itens,
    });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    setLista((atual) => [
      {
        id: res.data.id,
        numero: res.data.numero,
        titulo,
        cliente: cliente || "—",
        status: "RASCUNHO",
        descontoPercent: desconto,
        totalCentavos: total,
        criadoEm: new Date().toISOString(),
      },
      ...atual,
    ]);
    setCriando(false);
    setTitulo("");
    setCliente("");
    setDesconto(0);
    setItens([]);
  }, [titulo, cliente, desconto, itens, total]);

  const enviar = useCallback(async (id: string) => {
    setErro(null);
    const res = await submitProposalAction({ id });
    if (res.ok) {
      setLista((atual) =>
        atual.map((p) => (p.id === id ? { ...p, status: res.data.status } : p))
      );
    } else {
      setErro(res.error);
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {erro ? <Erro>{erro}</Erro> : null}

      <SectionCard
        action={
          podeEscrever ? (
            <BotaoPrimario
              full={false}
              onClick={() => setCriando((v) => !v)}
              type="button"
            >
              {criando ? "Cancelar" : "Nova proposta"}
            </BotaoPrimario>
          ) : null
        }
        icon="tag"
        subtitle={`${lista.length} proposta(s)`}
        title="Pipeline"
      >
        {criando ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              paddingBottom: 14,
              marginBottom: 14,
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <div
              style={{
                display: "grid",
                gap: 10,
                gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
              }}
            >
              <Campo htmlFor="p-titulo" label="Título">
                <input
                  id="p-titulo"
                  onChange={(e) => setTitulo(e.target.value)}
                  style={INPUT}
                  value={titulo}
                />
              </Campo>
              <Campo htmlFor="p-cliente" label="Cliente ou prospect">
                <input
                  id="p-cliente"
                  onChange={(e) => setCliente(e.target.value)}
                  style={INPUT}
                  value={cliente}
                />
              </Campo>
              <Campo
                hint={
                  precisaAprovacao
                    ? `acima de ${LIMITE_DESCONTO_SEM_APROVACAO}% — vai para a fila de aprovação`
                    : `até ${LIMITE_DESCONTO_SEM_APROVACAO}% envia direto`
                }
                htmlFor="p-desconto"
                label="Desconto %"
              >
                <input
                  id="p-desconto"
                  max={100}
                  min={0}
                  onChange={(e) => setDesconto(Number(e.target.value) || 0)}
                  style={{
                    ...INPUT,
                    borderColor: precisaAprovacao
                      ? "rgba(var(--amber-rgb),.5)"
                      : "var(--hairline)",
                  }}
                  type="number"
                  value={desconto}
                />
              </Campo>
            </div>

            <div>
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: ".12em",
                  textTransform: "uppercase",
                  color: "var(--ink-faint)",
                }}
              >
                Itens do catálogo
              </span>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  marginTop: 7,
                }}
              >
                {disponiveis.length === 0 ? (
                  <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                    Catálogo vazio — cadastre um serviço antes.
                  </span>
                ) : (
                  disponiveis.map((s) => {
                    const escolhido = itens.some((i) => i.serviceId === s.id);
                    return (
                      <button
                        className="btn"
                        key={s.id}
                        onClick={() =>
                          setItens((atual) =>
                            escolhido
                              ? atual.filter((i) => i.serviceId !== s.id)
                              : [...atual, { serviceId: s.id, quantidade: 1 }]
                          )
                        }
                        style={{
                          padding: "5px 11px",
                          borderRadius: "var(--r-pill)",
                          border: `1px solid ${escolhido ? "rgba(var(--accent-rgb),.5)" : "var(--hairline)"}`,
                          background: escolhido
                            ? "var(--accent-soft)"
                            : "var(--surface-2)",
                          color: escolhido
                            ? "var(--accent-text)"
                            : "var(--ink-muted)",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        type="button"
                      >
                        {s.codigo} · {formatarBRL(s.precoBaseCentavos)}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span
                className="mono"
                style={{ flex: 1, fontSize: 12, color: "var(--ink-muted)" }}
              >
                {itens.length} item(ns) · total {formatarBRL(total)}
                {desconto > 0 ? ` (bruto ${formatarBRL(bruto)})` : ""}
              </span>
              <BotaoPrimario
                disabled={titulo.trim().length < 2 || itens.length === 0}
                full={false}
                onClick={criar}
                type="button"
              >
                Criar rascunho
              </BotaoPrimario>
            </div>
          </div>
        ) : null}

        {lista.length === 0 ? (
          <p
            style={{
              margin: 0,
              padding: 28,
              textAlign: "center",
              fontSize: 13,
              lineHeight: 1.6,
              color: "var(--ink-muted)",
            }}
          >
            Nenhuma proposta ainda. Uma proposta nasce em rascunho e só sai
            daqui quando alguém a envia — acima de{" "}
            {LIMITE_DESCONTO_SEM_APROVACAO}% de desconto, passando pela fila de
            aprovação.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {lista.map((p, i) => (
              <LinhaProposta
                key={p.id}
                onEnviar={enviar}
                p={p}
                podeEscrever={podeEscrever}
                primeira={i === 0}
              />
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
