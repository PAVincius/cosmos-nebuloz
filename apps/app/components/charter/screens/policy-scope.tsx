"use client";

import { Button, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useTransition } from "react";
import {
  getPolicyScope,
  linkPolicy,
  unlinkPolicy,
} from "@/app/(charter)/actions/policy";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import { useCharterData } from "../use-charter-data";

// policy-scope.tsx — quem está e quem não está sob a política publicada.
//
// Em lote e aqui, e não um controle em case-detail, por três razões: fechar
// catorze lacunas visitando catorze telas é tedioso o bastante para não ser
// feito; `linkPolicy` exige `policy.edit`, que SECURITY não tem apesar de
// decidir caso de uso; e o `href` da capacidade POLICY_LINK já aponta para
// /charter/policy, então quem clica na evidência do mapa cai exatamente onde
// fecha a lacuna.

type Alvo = {
  id: string;
  rotulo: string;
  vinculado: boolean;
  tipo: "USE_CASE" | "VENDOR";
};

const SUBTITLE = "Todo caso de uso e fornecedor precisa estar sob a política";

export default function PolicyScope() {
  const { data, loading, error, reload } = useCharterData(
    useCallback(() => getPolicyScope(), [])
  );
  const [pending, startTransition] = useTransition();

  if (loading) {
    return (
      <SectionCard subtitle={SUBTITLE} title="Alcance da política">
        <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>
          Carregando…
        </div>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard subtitle={SUBTITLE} title="Alcance da política">
        <div style={{ fontSize: 13, color: "var(--red-text)" }}>{error}</div>
      </SectionCard>
    );
  }

  // Distinto de "carregando": a leitura terminou e o tenant não tem
  // política. Os dois estados não podem cair no mesmo galho — senão um
  // tenant sem política mostra "Carregando…" para sempre.
  if (data === null) {
    return (
      <SectionCard subtitle={SUBTITLE} title="Alcance da política">
        <div style={{ fontSize: 13, color: "var(--ink-faint)" }}>
          Nenhuma política nesta organização. O seed inicial cria a estrutura.
        </div>
      </SectionCard>
    );
  }

  const alvos: Alvo[] = [
    ...data.casos.map((c) => ({ ...c, tipo: "USE_CASE" as const })),
    ...data.vendors.map((v) => ({ ...v, tipo: "VENDOR" as const })),
  ];
  // Fora primeiro: a lista existe para fechar lacuna, e o que falta é o que
  // precisa estar à vista.
  const ordenados = [
    ...alvos.filter((a) => !a.vinculado),
    ...alvos.filter((a) => a.vinculado),
  ];
  const fora = alvos.filter((a) => !a.vinculado).length;

  const alternar = (alvo: Alvo) =>
    startTransition(async () => {
      const args = {
        policyId: data.policyId,
        alvoTipo: alvo.tipo,
        alvoId: alvo.id,
      };
      // Sem isto, `res.ok === false` (por exemplo SECURITY, sem
      // `policy.edit`) não recarregava, não avisava — a linha continuava
      // "fora da política" sem nenhum sinal de que o clique foi recusado.
      // `runWithToast` já cai para `res.error` quando `error` não é
      // passado, então a mensagem que o servidor deu não se perde.
      const res = await runWithToast(
        () => (alvo.vinculado ? unlinkPolicy(args) : linkPolicy(args)),
        {
          loading: alvo.vinculado ? "Removendo vínculo…" : "Vinculando…",
          success: alvo.vinculado ? "Vínculo removido" : "Vinculado à política",
        }
      );
      if (res.ok) {
        reload();
      }
    });

  return (
    <SectionCard subtitle={SUBTITLE} title="Alcance da política">
      <div
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: fora > 0 ? "var(--amber-text)" : "var(--green-text)",
          marginBottom: 10,
        }}
      >
        {fora > 0
          ? `${fora} fora da política, de ${alvos.length}`
          : `${alvos.length} de ${alvos.length} sob a política`}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {ordenados.map((alvo) => (
          <div
            key={`${alvo.tipo}-${alvo.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "6px 0",
              borderBottom: "1px solid var(--hairline)",
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 13,
                color: alvo.vinculado ? "var(--ink)" : "var(--amber-text)",
              }}
            >
              {alvo.rotulo}
            </span>
            <Button
              onClick={() => {
                if (pending) {
                  return;
                }
                alternar(alvo);
              }}
              size="sm"
              variant={alvo.vinculado ? "secondary" : "primary"}
            >
              {alvo.vinculado ? "Remover" : "Vincular"}
            </Button>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
