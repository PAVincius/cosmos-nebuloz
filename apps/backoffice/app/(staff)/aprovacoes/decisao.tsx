"use client";

import { useState, useTransition } from "react";
import { decidePlatformApprovalAction } from "@/app/actions/approvals";
import { WriteButton } from "@/components/write-button";

/**
 * FR-8.3/8.4/8.5 — decidir grava a trilha; pedido já decidido mostra a decisão
 * **em vez** dos botões.
 *
 * A nota fica sempre visível, não escondida atrás de "adicionar observação":
 * rejeição sem motivo é o que faz o solicitante reabrir o mesmo pedido na
 * semana seguinte.
 */
export function Decisao({ id, canWrite }: { id: string; canWrite: boolean }) {
  const [nota, setNota] = useState("");
  const [erro, setErro] = useState<string | null>(null);
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
      }
    });
  };

  return (
    <div className="mt-3 flex flex-col gap-2">
      <label className="sr-only" htmlFor={`nota-${id}`}>
        Nota da decisão
      </label>
      <textarea
        className="w-full rounded-md border bg-background p-2 text-sm"
        id={`nota-${id}`}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Nota da decisão (a rejeição costuma precisar mais que a aprovação)"
        rows={2}
        value={nota}
      />
      <div className="flex items-center gap-2">
        <WriteButton
          canWrite={canWrite}
          disabled={pendente}
          onClick={() => decidir("APPROVED")}
        >
          {pendente ? "Decidindo…" : "Aprovar"}
        </WriteButton>
        <WriteButton
          canWrite={canWrite}
          disabled={pendente}
          onClick={() => decidir("REJECTED")}
        >
          Rejeitar
        </WriteButton>
      </div>
      {erro ? (
        <p className="text-red-600 text-xs dark:text-red-400">{erro}</p>
      ) : null}
    </div>
  );
}
