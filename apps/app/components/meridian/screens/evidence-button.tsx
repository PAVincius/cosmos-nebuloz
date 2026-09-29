"use client";

import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import { requestEvidenceUrl } from "@/app/(meridian)/actions/report";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";

/** Abre a evidência que o respondente anexou. URL assinada de curta duração
 *  — `requestEvidenceUrl` grava a trilha ANTES de emitir, então cada clique
 *  é uma leitura auditada, não uma URL reaproveitável. */
/** Nome do arquivo como texto (React escapa), com truncamento só visual: o
 *  DOM guarda o nome inteiro e o `title` mostra o completo no hover. */
export function TruncatedName({ children }: { children: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        maxWidth: 240,
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export function EvidenceButton({
  evidenceId,
  label,
}: {
  evidenceId: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);

  const open = async () => {
    // A aba abre NO clique, em branco — depois do await, o browser não conta
    // mais como gesto do usuário e Chrome/Safari bloqueiam o popup. A URL
    // assinada só existe depois da volta do servidor; a aba só navega então.
    //
    // Sem "noopener" nos features: pela spec, window.open com "noopener"
    // devolve null em todo browser — não dá pra ter a referência da aba
    // (pra navegar depois) e já cortar o opener ao mesmo tempo. Corta o
    // opener na mão, que é o que "noopener" faz por baixo.
    const tab = window.open("", "_blank");
    if (tab) {
      tab.opener = null;
    }
    setBusy(true);
    const res = await runWithToast(() => requestEvidenceUrl({ evidenceId }), {
      loading: "Abrindo evidência…",
      success: "Evidência aberta — acesso registrado na trilha.",
    });
    setBusy(false);
    if (res.ok && tab) {
      tab.location.href = res.data.url;
    } else {
      tab?.close();
    }
  };

  return (
    <Button
      disabled={busy}
      icon="paperclip"
      onClick={open}
      size="sm"
      title={label}
      variant="ghost"
    >
      <TruncatedName>{label}</TruncatedName>
    </Button>
  );
}
