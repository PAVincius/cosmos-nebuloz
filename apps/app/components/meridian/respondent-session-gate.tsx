"use client";

import { type ReactNode, useEffect, useState } from "react";
import { startRespondentSession } from "@/app/(meridian)/actions/respondent";
import { reloadPage } from "@/lib/meridian/reload-page";
import { respondentErrorCopy } from "@/lib/meridian/respondent-error-copy";
import { tokenFromHash } from "@/lib/meridian/respondent-link";
import { TOKEN_INVALID_MESSAGE } from "@/lib/meridian/respondent-messages";
import { RespondentNotice } from "./respondent-notice";

// Porta da bateria do respondente (achado 28a do Lacre).
//
// O link novo leva o token no fragmento, `/meridian-responder#t=<token>`, que o
// navegador não envia ao servidor. Este componente o lê de `location.hash`, tira
// o fragmento do endereço ANTES de qualquer chamada (para o token não ficar no
// histórico, em captura de tela nem em referrer) e o troca por sessão numa server
// action: POST, token no corpo, e o servidor grava o cookie httpOnly. Com a
// sessão gravada, recarrega a página, que o servidor então renderiza pelo cookie.
//
// Sem token no fragmento, vale a decisão do servidor: formulário se há sessão
// (cookie), texto de link inválido se não há.

type Phase =
  | { kind: "ready" }
  | { kind: "opening" }
  | { kind: "notice"; error: string };

export function RespondentSessionGate({
  hasSession,
  initialError,
  children,
}: {
  hasSession: boolean;
  /** O erro que o servidor viu ao tentar ler a sessão; nulo com sessão. */
  initialError: string | null;
  children: ReactNode;
}) {
  // Sem sessão o servidor não sabe se há token no fragmento (ele não o recebe):
  // começa em "abrindo", em vez de piscar "link inválido" para quem chegou pelo
  // link novo.
  const [phase, setPhase] = useState<Phase>(
    hasSession ? { kind: "ready" } : { kind: "opening" }
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: só na montagem; o fragmento é lido uma vez
  useEffect(() => {
    const token = tokenFromHash(window.location.hash);
    if (token === null) {
      setPhase(
        hasSession
          ? { kind: "ready" }
          : { kind: "notice", error: initialError ?? TOKEN_INVALID_MESSAGE }
      );
      return;
    }
    setPhase({ kind: "opening" });
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    );
    startRespondentSession(token)
      .then((res) => {
        if (res.ok) {
          reloadPage();
        } else {
          setPhase({ kind: "notice", error: res.error });
        }
      })
      .catch(() => setPhase({ kind: "notice", error: TOKEN_INVALID_MESSAGE }));
  }, []);

  if (phase.kind === "ready") {
    return <>{children}</>;
  }
  if (phase.kind === "notice") {
    return <RespondentNotice {...respondentErrorCopy(phase.error)} />;
  }
  return (
    <output
      className="meridian-root"
      style={{
        display: "block",
        minHeight: "100dvh",
        padding: "16vh 24px 0",
        textAlign: "center",
        color: "var(--ink-muted)",
        fontSize: 14,
      }}
    >
      Abrindo seu link…
    </output>
  );
}
