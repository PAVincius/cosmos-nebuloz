"use client";

import { Badge, SectionCard, type Tone } from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import type { TenantOpcao } from "@/app/actions/audit";
import {
  createEngagementAction,
  type EngagementRow,
  setEngagementStatusAction,
} from "@/app/actions/engagements";
import type { ServiceRow } from "@/app/actions/services";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { ROTULO_STATUS, type StatusEngajamento } from "@/lib/delivery";
import { formatarBRL } from "../servicos/catalogo";

const TOM: Record<string, Tone> = {
  PROPOSTO: "accent",
  ATIVO: "green",
  PAUSADO: "amber",
  CONCLUIDO: "blue",
  CANCELADO: "red",
};

const NAO_DIGITO = /[^\d]/g;

function paraCentavos(texto: string): number {
  const so = texto.replace(NAO_DIGITO, "");
  return so ? Number.parseInt(so, 10) : 0;
}

function periodo(inicio: string | null, fim: string | null): string {
  if (!(inicio || fim)) {
    return "sem período definido";
  }
  const d = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("pt-BR") : "…";
  return `${d(inicio)} → ${d(fim)}`;
}

function LinhaEngajamento({
  e,
  primeira,
  podeEscrever,
  onStatus,
}: {
  e: EngagementRow;
  primeira: boolean;
  podeEscrever: boolean;
  onStatus: (id: string, status: StatusEngajamento) => void;
}) {
  const terminal = e.proximos.length === 0;

  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        flexWrap: "wrap",
        padding: "11px 2px",
        borderTop: primeira ? "none" : "1px solid var(--hairline)",
        opacity: terminal ? 0.7 : 1,
      }}
    >
      <span
        className="mono"
        style={{ fontSize: 11, fontWeight: 700, width: 72 }}
      >
        {e.codigo}
      </span>
      <span style={{ flex: 1, minWidth: 160 }}>
        <span style={{ display: "block", fontSize: 13, fontWeight: 600 }}>
          {e.nome}
        </span>
        <span
          className="mono"
          style={{ fontSize: 10.5, color: "var(--ink-faint)" }}
        >
          {e.clienteSlug} · {periodo(e.inicioEm, e.fimEm)}
        </span>
      </span>
      <span
        className="mono"
        style={{ fontSize: 12, color: "var(--accent-text)" }}
      >
        {formatarBRL(e.valorCentavos)}
      </span>
      <Badge dot tone={TOM[e.status] ?? "neutral"}>
        {ROTULO_STATUS[e.status as StatusEngajamento] ?? e.status}
      </Badge>

      {/* Só as transições que a action aceita. Oferecer uma que ela recusa é
          pior que não oferecer nada. */}
      {podeEscrever
        ? e.proximos.map((p) => (
            <button
              className="btn"
              key={p}
              onClick={() => onStatus(e.id, p as StatusEngajamento)}
              style={{
                padding: "4px 9px",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--hairline)",
                background: "none",
                color: "var(--ink-muted)",
                fontSize: 10.5,
                fontWeight: 600,
                cursor: "pointer",
              }}
              type="button"
            >
              → {ROTULO_STATUS[p as StatusEngajamento] ?? p}
            </button>
          ))
        : null}
    </li>
  );
}

export function Engajamentos({
  iniciais,
  clientes,
  servicos,
  podeEscrever,
}: {
  iniciais: EngagementRow[];
  clientes: TenantOpcao[];
  servicos: ServiceRow[];
  podeEscrever: boolean;
}) {
  const [lista, setLista] = useState(iniciais);
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState({
    nome: "",
    codigo: "",
    clienteTenantId: "",
    serviceId: "",
    valor: "",
    inicioEm: "",
    fimEm: "",
    escopo: "",
  });

  const criar = useCallback(async () => {
    setErro(null);
    const res = await createEngagementAction({
      nome: form.nome,
      codigo: form.codigo,
      clienteTenantId: form.clienteTenantId,
      serviceId: form.serviceId || undefined,
      escopo: form.escopo || undefined,
      valorCentavos: paraCentavos(form.valor),
      inicioEm: form.inicioEm || undefined,
      fimEm: form.fimEm || undefined,
    });
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    const cliente = clientes.find((c) => c.id === form.clienteTenantId);
    setLista((atual) => [
      {
        id: res.data.id,
        codigo: res.data.codigo,
        nome: form.nome,
        clienteNome: cliente?.name ?? "—",
        clienteSlug: cliente?.slug ?? "—",
        status: "PROPOSTO",
        valorCentavos: paraCentavos(form.valor),
        inicioEm: form.inicioEm || null,
        fimEm: form.fimEm || null,
        proximos: ["ATIVO", "CANCELADO"],
      },
      ...atual,
    ]);
    setCriando(false);
    setForm({
      nome: "",
      codigo: "",
      clienteTenantId: "",
      serviceId: "",
      valor: "",
      inicioEm: "",
      fimEm: "",
      escopo: "",
    });
  }, [form, clientes]);

  const mudarStatus = useCallback(
    async (id: string, status: StatusEngajamento) => {
      setErro(null);
      const res = await setEngagementStatusAction({ id, status });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      // Recarrega a página para a lista refletir as novas transições
      // possíveis — recalculá-las aqui duplicaria o mapa que já existe no
      // servidor, e duas cópias divergem.
      window.location.reload();
    },
    []
  );

  const podeCriar =
    form.nome.trim().length >= 2 &&
    form.codigo.trim().length >= 2 &&
    form.clienteTenantId !== "";

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
              {criando ? "Cancelar" : "Novo engajamento"}
            </BotaoPrimario>
          ) : null
        }
        icon="handshake"
        subtitle={`${lista.length} engajamento(s) · escopo fechado`}
        title="Engajamentos"
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
                gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
              }}
            >
              <Campo htmlFor="e-codigo" label="Código">
                <input
                  id="e-codigo"
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, codigo: ev.target.value }))
                  }
                  placeholder="ENG-01"
                  style={INPUT}
                  value={form.codigo}
                />
              </Campo>
              <Campo htmlFor="e-nome" label="Nome">
                <input
                  id="e-nome"
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, nome: ev.target.value }))
                  }
                  style={INPUT}
                  value={form.nome}
                />
              </Campo>
              <Campo htmlFor="e-cliente" label="Cliente">
                <select
                  id="e-cliente"
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, clienteTenantId: ev.target.value }))
                  }
                  style={{ ...INPUT, cursor: "pointer" }}
                  value={form.clienteTenantId}
                >
                  <option value="">Escolha…</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Campo>
              <Campo htmlFor="e-servico" label="Serviço (opcional)">
                <select
                  id="e-servico"
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
                hint={`grava ${formatarBRL(paraCentavos(form.valor))}`}
                htmlFor="e-valor"
                label="Valor fechado"
              >
                <input
                  id="e-valor"
                  inputMode="numeric"
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, valor: ev.target.value }))
                  }
                  placeholder="5.000,00"
                  style={INPUT}
                  value={form.valor}
                />
              </Campo>
              <Campo htmlFor="e-inicio" label="Início">
                <input
                  id="e-inicio"
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, inicioEm: ev.target.value }))
                  }
                  style={INPUT}
                  type="date"
                  value={form.inicioEm}
                />
              </Campo>
              <Campo htmlFor="e-fim" label="Fim previsto">
                <input
                  id="e-fim"
                  onChange={(ev) =>
                    setForm((f) => ({ ...f, fimEm: ev.target.value }))
                  }
                  style={INPUT}
                  type="date"
                  value={form.fimEm}
                />
              </Campo>
            </div>

            <Campo
              hint="o que foi acordado entregar — é o que fecha o escopo"
              htmlFor="e-escopo"
              label="Escopo"
            >
              <textarea
                id="e-escopo"
                onChange={(ev) =>
                  setForm((f) => ({ ...f, escopo: ev.target.value }))
                }
                style={{ ...INPUT, minHeight: 70, resize: "vertical" }}
                value={form.escopo}
              />
            </Campo>

            <BotaoPrimario
              disabled={!podeCriar}
              full={false}
              onClick={criar}
              type="button"
            >
              Criar como proposto
            </BotaoPrimario>
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
            Nenhum engajamento. Um engajamento nasce proposto e só vira ativo
            quando alguém confirma — nascer ativo faria a receita entrar antes
            do aceite.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {lista.map((e, i) => (
              <LinhaEngajamento
                e={e}
                key={e.id}
                onStatus={mudarStatus}
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
