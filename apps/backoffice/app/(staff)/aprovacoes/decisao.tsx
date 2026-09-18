"use client";

import { useState, useTransition } from "react";
import { decidePlatformApprovalAction } from "@/app/actions/approvals";
import { Erro, INPUT } from "@/components/campo";
import { Confirmacao } from "@/components/confirmacao";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { WriteButton } from "@/components/write-button";

/**
 * FR-8.3/8.4/8.5 — decidir grava a trilha; pedido já decidido mostra a decisão
 * **em vez** dos botões.
 *
 * A nota fica sempre visível, não escondida atrás de "adicionar observação":
 * rejeição sem motivo é o que faz o solicitante reabrir o mesmo pedido na
 * semana seguinte.
 *
 * As duas decisões passam pela barreira: o servidor não deixa decidir de
 * novo. Rejeitar devolve o pedido ao solicitante sem apelação; aprovar
 * executa a ação original (FR-8.4 — a proposta com desconto acima do limite
 * vira Enviada) e grava a decisão com o nome de quem aprovou. Aprovar era um
 * clique só, e é a operação com mais efeito da tela.
 *
 * O fim é anunciado num `<Confirmacao>` (status polite) no lugar dos botões;
 * o cartão em volta troca para "Aprovado por X em…" quando a lista relê.
 */

const CONSEQUENCIA: Record<"APPROVED" | "REJECTED", string> = {
  APPROVED:
    "A ação pedida é executada — uma proposta com desconto acima do limite passa a Enviada — e a decisão fica registrada com o seu nome; não pode ser refeita.",
  REJECTED:
    "O solicitante recebe a recusa e o pedido não pode ser decidido de novo.",
};

const FIM: Record<"APPROVED" | "REJECTED", string> = {
  APPROVED: "Aprovado — registrado com o seu nome.",
  REJECTED: "Rejeitado — registrado com o seu nome.",
};
export function Decisao({
  id,
  canWrite,
  alvo,
}: {
  id: string;
  canWrite: boolean;
  /** O que está sendo decidido, por extenso — título e cliente do pedido.
   *  Sem ele a barreira mostra o id, que é único mas não é reconhecível. */
  alvo?: string;
}) {
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [decidido, setDecidido] = useState<"APPROVED" | "REJECTED" | null>(
    null
  );
  const [pendente, iniciar] = useTransition();

  const decidir = (outcome: "APPROVED" | "REJECTED") => {
    setErro(null);
    iniciar(async () => {
      const res = await decidePlatformApprovalAction({
        id,
        outcome,
        ...(nota.trim() ? { nota: nota.trim() } : {}),
      });
      if (!res.ok) {
        // O servidor recusa de novo (papel, ou pedido já decidido por outro
        // aprovador na mesma janela). A mensagem dele é mais precisa que
        // qualquer texto genérico daqui.
        setErro(res.error);
        return;
      }
      setDecidido(outcome);
    });
  };

  if (decidido) {
    return (
      <div style={{ marginTop: 12 }}>
        <Confirmacao>{FIM[decidido]}</Confirmacao>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        marginTop: 12,
      }}
    >
      <label className="sr-only" htmlFor={`nota-${id}`}>
        Nota da decisão
      </label>
      <textarea
        id={`nota-${id}`}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota da decisão (a rejeição costuma precisar mais que a aprovação)"
        rows={2}
        style={{ ...INPUT, fontWeight: 500, resize: "vertical" }}
        value={nota}
      />
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        {canWrite ? (
          <>
            <ConfirmarAcao
              alvo={alvo ?? `pedido ${id}`}
              consequencia={CONSEQUENCIA.APPROVED}
              executando={pendente}
              onConfirmar={() => decidir("APPROVED")}
              rotulo={pendente ? "Decidindo…" : "Aprovar"}
              tom="accent"
            />
            <ConfirmarAcao
              alvo={alvo ?? `pedido ${id}`}
              consequencia={CONSEQUENCIA.REJECTED}
              executando={pendente}
              onConfirmar={() => decidir("REJECTED")}
              rotulo={pendente ? "Decidindo…" : "Rejeitar"}
              tom="red"
            />
          </>
        ) : (
          <>
            <WriteButton canWrite={false}>Aprovar</WriteButton>
            <WriteButton canWrite={false}>Rejeitar</WriteButton>
          </>
        )}
      </div>
      {erro ? <Erro>{erro}</Erro> : null}
    </div>
  );
}
