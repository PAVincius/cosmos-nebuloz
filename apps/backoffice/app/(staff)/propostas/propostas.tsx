"use client";

import { Badge, SectionCard, type Tone } from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import {
  type ProposalRow,
  submitProposalAction,
} from "@/app/actions/proposals";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { LIMITE_DESCONTO_SEM_APROVACAO } from "@/lib/comercial";
import { formatarBRL } from "@/lib/comercial/formato";

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

function LinhaProposta({
  p,
  podeEscrever,
  primeira,
  onEnviar,
  onAbrir,
}: {
  p: ProposalRow;
  podeEscrever: boolean;
  primeira: boolean;
  onEnviar: (id: string) => void;
  onAbrir: (id: string) => void;
}) {
  const acimaDoLimite = p.descontoPercent > LIMITE_DESCONTO_SEM_APROVACAO;
  // Só rascunho tem ação: enviada de novo mudaria o que o cliente já recebeu.
  const podeEnviar = podeEscrever && p.status === "RASCUNHO";

  return (
    // A linha inteira abre a proposta. Não é `<button>` porque carrega outros
    // controles dentro (enviar), e botão dentro de botão não é HTML válido —
    // daí role, tabIndex e o handler de Enter na mão (NFR-2.3).
    <li
      aria-label={`Abrir proposta ${p.numero} — ${p.titulo}`}
      onClick={() => onAbrir(p.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir(p.id);
        }
      }}
      role="button"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 2px",
        borderTop: primeira ? "none" : "1px solid var(--hairline)",
        cursor: "pointer",
      }}
      tabIndex={0}
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
          // `stopPropagation` porque a linha inteira abre a proposta: sem
          // isto, enviar também navegaria, e a pessoa sairia da lista sem
          // saber se o envio aconteceu.
          onClick={(e) => {
            e.stopPropagation();
            onEnviar(p.id);
          }}
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
  podeEscrever,
}: {
  iniciais: ProposalRow[];
  podeEscrever: boolean;
}) {
  const router = useRouter();
  const [lista, setLista] = useState(iniciais);
  const [erro, setErro] = useState<string | null>(null);

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
              onClick={() => router.push("/propostas/nova")}
              type="button"
            >
              Nova proposta
            </BotaoPrimario>
          ) : null
        }
        icon="tag"
        subtitle={`${lista.length} proposta(s)`}
        title="Pipeline"
      >
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
                onAbrir={(id) => router.push(`/propostas/${id}`)}
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
