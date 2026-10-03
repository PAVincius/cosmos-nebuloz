import type { Metadata } from "next";
import { getBattery } from "@/app/(meridian)/actions/respondent";
import { RespondentForm } from "@/components/meridian/respondent-form";
import { RespondentSessionGate } from "@/components/meridian/respondent-session-gate";
import "@/components/meridian/meridian.css";

// Visão do respondente — a única rota do Meridian fora do guard de sessão.
//
// O respondente não tem conta na plataforma: o acesso é por token de uso
// individual, e o tenant sai do token, nunca do request. Por isso esta página
// vive FORA do route group `(meridian)`: um layout de route group envolve tudo
// que está sob ele, então bastaria estar lá dentro para o guard de sessão
// disparar — e afrouxar o guard para deixá-la passar abriria o módulo inteiro.
//
// Pelo mesmo motivo a URL é /meridian-responder e não /meridian/responder:
// `/meridian` é prefixo protegido no proxy.
//
// O token NUNCA chega por esta URL (achado 28a do Lacre). O link emitido é
// `/meridian-responder#t=<token>`: o fragmento não vai ao servidor, e o
// `RespondentSessionGate` o lê no cliente e o troca por um cookie httpOnly numa
// server action. Aqui o servidor só vê o cookie. (O formato antigo,
// `/meridian-responder/<token>`, é tratado por `[token]/route.ts` até 16/10/2026.)
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
  const res = await getBattery();

  return (
    <RespondentSessionGate
      hasSession={res.ok}
      initialError={res.ok ? null : res.error}
    >
      <div
        className="meridian-root grain"
        style={{ minHeight: "100dvh", padding: "32px 24px 64px" }}
      >
        {res.ok ? <RespondentForm battery={res.data} /> : null}
      </div>
    </RespondentSessionGate>
  );
}
