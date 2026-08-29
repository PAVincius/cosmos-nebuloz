"use client";

// Visão do respondente (consultora) — US2.
//
// A consultora não tem token: ela conduz o assessment, não responde a bateria.
// Esta tela existe para responder "o que a pessoa do outro lado vê?" sem
// inventar um modo de espiar a resposta alheia — o que seria exatamente o
// contrário da regra de que cada respondente só enxerga o seu eixo.

import { Icon } from "@repo/design-system/cosmos/icons";
import { PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { Eyebrow } from "../base";
import { AwaitingUpstream } from "../seams";

const RULES = [
  {
    icon: "lock" as const,
    title: "Um link, uma pessoa, um eixo",
    body: "O convite carrega um token de uso individual, guardado hasheado. Ele abre a bateria de um eixo só, daquele assessment — nunca a de outro respondente, nunca a de outro eixo.",
  },
  {
    icon: "clock" as const,
    title: "Validade até o prazo",
    body: "O token expira no prazo do assessment. Revogar um respondente invalida o link na hora: o hash é regravado, e o token antigo deixa de casar.",
  },
  {
    icon: "paperclip" as const,
    title: "Evidência vai para fora do banco",
    body: "O anexo sobe para armazenamento privado segregado por organização. O banco guarda só o metadado, e toda leitura posterior entra na trilha de auditoria.",
  },
  {
    icon: "mail" as const,
    title: "Lembretes param na conclusão",
    body: "Enquanto houver pergunta em branco, o lembrete continua. Concluída a bateria, cessa — lembrete a quem já respondeu treina a pessoa a ignorar os próximos.",
  },
];

export default function RespondentPreviewScreen() {
  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Diagnose · campo"
        subtitle="O que a pessoa da organização avaliada vê ao abrir o link do convite."
        title="Visão do respondente"
        tone="accent"
      />

      <AwaitingUpstream
        entity="link de respondente"
        product="convite"
        why="A bateria abre por um token de uso individual, emitido quando você atribui alguém a um eixo na aba Coleta de um assessment. Não há como abri-la a partir daqui: um atalho que dispensasse o token seria uma porta lateral para o mesmo conteúdo que o token protege."
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
          gap: "var(--gap)",
        }}
      >
        {RULES.map((r) => (
          <SectionCard
            bodyStyle={{ display: "flex", gap: 12 }}
            icon={r.icon}
            key={r.title}
            title={r.title}
            tone="accent"
          >
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--ink-muted)",
                lineHeight: 1.6,
              }}
            >
              {r.body}
            </p>
          </SectionCard>
        ))}
      </div>

      <SectionCard
        bodyStyle={{ display: "flex", flexDirection: "column", gap: 10 }}
        icon="compass"
        title="Formato da bateria"
      >
        <Eyebrow>Tipos de pergunta</Eyebrow>
        {[
          ["Likert de 5 pontos", "Discordo forte → Concordo forte."],
          ["Sim / não", "Binária, para o que ou existe ou não existe."],
          [
            "Escala de faixas",
            "Faixas nomeadas pelo template; quando a faixa alta é a pior resposta, a normalização inverte.",
          ],
        ].map(([label, desc]) => (
          <div
            key={label}
            style={{
              display: "flex",
              gap: 10,
              alignItems: "flex-start",
              padding: "9px 12px",
              borderRadius: 9,
              background: "var(--surface-2)",
              border: "1px solid var(--hairline)",
            }}
          >
            <Icon
              name="check"
              size={13}
              style={{
                color: "var(--accent-text)",
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <span>
              <span
                style={{ display: "block", fontSize: 12.5, fontWeight: 700 }}
              >
                {label}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: 11.5,
                  color: "var(--ink-muted)",
                  lineHeight: 1.5,
                }}
              >
                {desc}
              </span>
            </span>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}
