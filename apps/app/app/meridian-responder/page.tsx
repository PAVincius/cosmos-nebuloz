import type { Metadata } from "next";
import { getBattery } from "@/app/(meridian)/actions/respondent";
import { RespondentForm } from "@/components/meridian/respondent-form";
import { respondentErrorCopy } from "@/lib/meridian/respondent-error-copy";
import "@/components/meridian/meridian.css";

// Visão do respondente — a única rota do Meridian fora do guard de sessão.
//
// O respondente não tem conta na plataforma: o acesso é por token de uso
// individual, e o tenant sai do token, nunca do request. Por isso esta página
// vive FORA do route group `(meridian)`: um layout de route group envolve tudo
// que está sob ele, então bastaria estar lá dentro para o guard de sessão
// disparar — e afrouxar o guard para deixá-la passar abriria o módulo inteiro.
//
// Pelo mesmo motivo a URL é /meridian-responder (o link emitido,
// /meridian-responder/<token>, é trocado por cookie na primeira carga) e não
// /meridian/responder/<token>: `/meridian` é prefixo protegido no proxy.
//
// Token inválido, expirado e revogado caem no mesmo texto. Diferenciar
// confirmaria a um estranho que aquele assessment existe. O limite de
// tentativas (rate limit) tem texto próprio — `respondentErrorCopy` só
// reconhece essas duas mensagens; qualquer outra cai no texto genérico de
// link inválido, pra nunca mostrar detalhe interno nesta tela sem sessão.

export const metadata: Metadata = {
  title: "Bateria de prontidão · Meridian",
  // Link individual não deve acabar em índice de busca.
  robots: { index: false, follow: false },
};

export default async function RespondentPage() {
  // O token vem do cookie de sessão que `[token]/route.ts` grava na primeira
  // carga; esta página nunca o recebe pela URL.
  const res = await getBattery();

  if (!res.ok) {
    const copy = respondentErrorCopy(res.error);
    return (
      <div className="meridian-root" style={{ minHeight: "100dvh" }}>
        <main
          style={{
            maxWidth: 520,
            margin: "16vh auto",
            padding: 28,
            borderRadius: 18,
            border: "1px solid var(--hairline)",
            background: "var(--surface)",
            color: "var(--ink)",
          }}
        >
          <div
            className="mono"
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: ".12em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              marginBottom: 10,
            }}
          >
            Meridian · Bateria de prontidão
          </div>
          <h1
            className="display"
            style={{ fontSize: 22, fontWeight: 700, margin: "0 0 12px" }}
          >
            {copy.title}
          </h1>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.65,
              color: "var(--ink-muted)",
              margin: 0,
            }}
          >
            {copy.body}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div
      className="meridian-root grain"
      style={{ minHeight: "100dvh", padding: "32px 24px 64px" }}
    >
      <RespondentForm battery={res.data} />
    </div>
  );
}
