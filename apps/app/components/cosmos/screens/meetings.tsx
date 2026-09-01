// meetings.tsx — Consentimento de Gravação (docs/compliance/
// consentimento-de-gravacao.md §7, passo 5). Tela fina no servidor: busca a
// fila via listConsentQueue() e entrega para o client component, mesmo
// padrão de epic-detail.tsx/epic-detail-client.tsx.
//
// Sem esta tela, PENDING é beco sem saída: o pipeline de IA nunca roda e a
// revogação recém-implementada (revokeConsent) é inalcançável.
import { listConsentQueue } from "@/app/actions/meeting/consent";
import MeetingsClient from "./meetings-client";

export default async function MeetingsScreen() {
  const res = await listConsentQueue();
  return (
    <MeetingsClient
      error={res.ok ? null : res.error}
      initial={res.ok ? res.data : null}
    />
  );
}
