"use client";

// setup-panel.tsx — painel de montagem no topo do dashboard. FR do
// onboarding: uma compliance lead abrindo o Charter pela primeira vez não
// sabe por onde começar, e a ordem dos cinco passos já existe em
// `getSetupProgress` (Task 1). Este painel só desenha o que a action
// calculou — recebe `progresso` por prop, nunca busca dado próprio, porque o
// dashboard já faz essa request numa tela que carrega uma vez, e duplicá-la
// desperdiçaria a query.
//
// Um passo que o papel de quem olha não pode executar aparece desabilitado,
// nomeando quem pode — nunca escondido (a pessoa concluiria que o produto
// quebrou) nem clicável de verdade (reabriria o defeito que `GatedButton` já
// resolveu: um controle que aceita clique e recusa depois de um round trip).

import type { IconName } from "@repo/design-system/cosmos/icons";
import { Badge, SectionCard, type Tone } from "@repo/design-system/cosmos/kit";
import { useRouter } from "next/navigation";
import type { SetupProgress, SetupStep } from "@/app/(charter)/actions/setup";
import { GatedButton } from "./base";

const ESTADO_LABEL: Record<SetupStep["estado"], string> = {
  feito: "Feito",
  disponivel: "Disponível",
  bloqueado: "Bloqueado",
};

const ESTADO_TONE: Record<SetupStep["estado"], Tone> = {
  feito: "green",
  disponivel: "accent",
  bloqueado: "neutral",
};

const ESTADO_ICON: Record<SetupStep["estado"], IconName> = {
  feito: "check",
  disponivel: "arrowRight",
  bloqueado: "lock",
};

function StepRow({ onOpen, step }: { onOpen: () => void; step: SetupStep }) {
  const allowed = step.podeAgir && step.estado === "disponivel";
  const reason = step.podeAgir
    ? (step.bloqueadoPor ?? "Ainda não disponível.")
    : `Só ${step.quemPode} pode fazer isso.`;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 2px",
        borderBottom: "1px solid var(--hairline)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <Badge
            icon={ESTADO_ICON[step.estado]}
            tone={ESTADO_TONE[step.estado]}
          >
            {ESTADO_LABEL[step.estado]}
          </Badge>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
            {step.titulo}
          </span>
        </div>

        <div
          style={{ fontSize: 12, color: "var(--ink-muted)", lineHeight: 1.5 }}
        >
          {step.porque}
        </div>

        {step.progresso && (
          <div
            className="mono"
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: "var(--ink-faint)",
              marginTop: 6,
            }}
          >
            {step.progresso.feito} de {step.progresso.total}
          </div>
        )}

        {step.estado === "bloqueado" && step.bloqueadoPor && (
          <div
            style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 6 }}
          >
            {step.bloqueadoPor}
          </div>
        )}

        {!step.podeAgir && step.quemPode && (
          <div
            style={{ fontSize: 11.5, color: "var(--ink-faint)", marginTop: 6 }}
          >
            Só {step.quemPode} pode fazer isso.
          </div>
        )}
      </div>

      {step.estado !== "feito" && (
        <GatedButton
          allowed={allowed}
          onClick={onOpen}
          reason={reason}
          variant="secondary"
        >
          Abrir
        </GatedButton>
      )}
    </div>
  );
}

export function SetupPanel({ progresso }: { progresso: SetupProgress }) {
  const router = useRouter();

  if (progresso.completo) {
    return (
      <SectionCard icon="check" title="Montagem concluída" tone="green">
        <span style={{ fontSize: 12.5, color: "var(--ink-muted)" }}>
          Os {progresso.total} passos de montagem inicial foram feitos.
        </span>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      icon="flag"
      subtitle={`${progresso.concluidos} de ${progresso.total} concluídos`}
      title="Comece por aqui"
      tone="accent"
    >
      <div style={{ display: "flex", flexDirection: "column" }}>
        {progresso.passos.map((step) => (
          <StepRow
            key={step.id}
            onOpen={() => router.push(step.href)}
            step={step}
          />
        ))}
      </div>
    </SectionCard>
  );
}
