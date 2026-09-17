"use client";

import { Badge, SectionCard, type Tone } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import {
  type ProposalRow,
  submitProposalAction,
} from "@/app/actions/proposals";
import { BotaoPrimario, Erro } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";
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
  enviando,
  onEnviar,
}: {
  p: ProposalRow;
  podeEscrever: boolean;
  primeira: boolean;
  /** Esta linha está no ar — o Confirmar da barreira trava e diz. */
  enviando: boolean;
  onEnviar: (id: string) => void;
}) {
  const acimaDoLimite = p.descontoPercent > LIMITE_DESCONTO_SEM_APROVACAO;
  // Só rascunho tem ação: enviada de novo mudaria o que o cliente já recebeu.
  const podeEnviar = podeEscrever && p.status === "RASCUNHO";

  return (
    // `<li>` neutro. O que abre a proposta é o `<Link>` — um controle próprio,
    // com o conteúdo da linha como nome acessível e "Abrir" em `sr-only` na
    // frente, para o leitor de tela dizer a intenção antes do conteúdo. O
    // "Enviar" fica fora do link, como irmão: controle dentro de controle não
    // é HTML válido, e era o que o `<li role="button">` anterior fazia.
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "11px 2px",
        borderTop: primeira ? "none" : "1px solid var(--hairline)",
      }}
    >
      <Link
        href={`/propostas/${p.id}`}
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "inherit",
          textDecoration: "none",
        }}
      >
        <span className="sr-only">Abrir </span>
        <span
          className="mono"
          style={{ fontSize: "var(--fs-nota)", fontWeight: 700, width: 84 }}
        >
          {p.numero}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              display: "block",
              fontSize: "var(--fs-base)",
              fontWeight: 600,
            }}
          >
            {p.titulo}
          </span>
          <span
            style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
          >
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
            fontSize: "var(--fs-base)",
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
      </Link>
      {podeEnviar ? (
        // Enviar é sem volta — a barreira é a mesma do gerador.
        <ConfirmarAcao
          alvo={`${p.titulo} · ${p.cliente}`}
          consequencia={
            acimaDoLimite
              ? "A proposta vai para a fila de aprovação; não há como editar depois de enviada."
              : "O cliente recebe esta versão; não há como editar depois de enviada."
          }
          executando={enviando}
          onConfirmar={() => onEnviar(p.id)}
          rotulo={acimaDoLimite ? "Pedir aprovação" : "Enviar"}
          tom="accent"
        />
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
  // A proposta cuja chamada está no ar: segundo clique no Confirmar da
  // barreira não chama de novo (o botão trava e diz "Executando…").
  const [enviandoId, setEnviandoId] = useState<string | null>(null);

  // O gerador chega aqui com `?enviada=<id>` depois de enviar. Confirmar pelo
  // título, e não com um "enviado com sucesso" genérico: é a frase que diz
  // qual proposta saiu — e para um id que não está na lista, nada.
  const enviadaId = useSearchParams().get("enviada");
  const enviada = enviadaId
    ? iniciais.find((p) => p.id === enviadaId)
    : undefined;

  const enviar = useCallback(async (id: string) => {
    setErro(null);
    setEnviandoId(id);
    try {
      const res = await submitProposalAction({ id });
      if (res.ok) {
        setLista((atual) =>
          atual.map((p) =>
            p.id === id ? { ...p, status: res.data.status } : p
          )
        );
      } else {
        setErro(res.error);
      }
    } finally {
      setEnviandoId(null);
    }
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {enviada ? (
        <output
          style={{
            display: "block",
            padding: "9px 11px",
            borderRadius: "var(--r-md)",
            background: "var(--green-soft)",
            border: "1px solid rgba(var(--green-rgb),.3)",
            color: "var(--green-text)",
            fontSize: "var(--fs-base)",
            fontWeight: 600,
          }}
        >
          Proposta «{enviada.titulo}» enviada
          {enviada.status === "AGUARDANDO_APROVACAO"
            ? " para a fila de aprovação"
            : ""}
          .
        </output>
      ) : null}
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
        subtitle={`${lista.length} ${lista.length === 1 ? "proposta" : "propostas"}`}
        title="Pipeline"
      >
        {lista.length === 0 ? (
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
            Nenhuma proposta ainda. Uma proposta nasce em rascunho e só sai
            daqui quando alguém a envia — acima de{" "}
            {LIMITE_DESCONTO_SEM_APROVACAO}% de desconto, passando pela fila de
            aprovação.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {lista.map((p, i) => (
              <LinhaProposta
                enviando={enviandoId === p.id}
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
