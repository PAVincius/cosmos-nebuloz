"use client";

// Perfis de controle — CH-DEV-04. Cinco perfis, um por forma de trabalho. Cada
// um diz quais riscos dominam aquele tipo de trabalho, quem decide o caso, e a
// lista de controles com a evidência que conta, o papel que revisa, a cadência e
// a classe de dado a partir da qual o controle entra. É o método da Nebuloz:
// global e versionado. O conteúdo é rascunho até Jurídico/DPO e Segurança
// assinarem (CH-PO-01), e a tela diz isso em vez de esconder.

import { Badge, PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import { useCallback, useState } from "react";
import {
  listControlProfiles,
  type ProfileCard,
} from "@/app/(charter)/actions/controls-read";
import {
  Eyebrow,
  ScreenError,
  SkeletonCard,
  SmartEmptyState,
  TableHead,
  TableRow,
  Tabs,
} from "../base";
import { Callout } from "../form-kit";
import { FS } from "../type-scale";
import { useCharterData } from "../use-charter-data";

const COLS = "72px minmax(0,2.4fr) 110px 100px 130px 110px";

function ProfileView({ p }: { p: ProfileCard }) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      {p.signed ? null : (
        <Callout icon="alert" tone="amber">
          Rascunho: este perfil ainda não tem a assinatura de Jurídico/DPO e de
          Segurança. Enquanto não tiver, nenhum caso usa este perfil.
        </Callout>
      )}

      <div
        style={{
          display: "grid",
          gap: "var(--gap)",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <SectionCard title="Riscos dominantes">
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {p.dominantRisks.map((r) => (
              <Badge key={r.id} tone="purple">
                {r.label}
              </Badge>
            ))}
          </div>
        </SectionCard>
        <SectionCard title="Caminho de decisão">
          <p style={{ margin: 0, fontSize: FS.base, lineHeight: 1.6 }}>
            Quem submete o caso envia; <strong>{p.decisionRoleLabel}</strong>{" "}
            decide. Aceitar, dispensar e reabrir controle é de quem decide o
            caso.
          </p>
          {p.note ? (
            <p
              style={{
                margin: "8px 0 0",
                fontSize: FS.nota,
                color: "var(--ink-muted)",
              }}
            >
              {p.note}
            </p>
          ) : null}
        </SectionCard>
      </div>

      <SectionCard
        subtitle={`${p.versionLabel} · o controle entra no caso quando a classe de dado do caso é igual ou maior que a mínima`}
        title={`${p.controls.length} controles`}
      >
        <TableHead
          cols={COLS}
          labels={[
            "Código",
            "Controle e evidência que conta",
            "Papel",
            "Cadência",
            "Classe mínima",
            "Dispensa",
          ]}
        />
        {p.controls.map((c, i) => (
          <TableRow cols={COLS} key={c.code} last={i === p.controls.length - 1}>
            <span
              className="mono"
              style={{ fontSize: FS.nota, fontWeight: 700 }}
            >
              {c.code}
            </span>
            <span style={{ minWidth: 0 }}>
              <span style={{ fontSize: FS.base, fontWeight: 600 }}>
                {c.name}
              </span>
              <span
                style={{
                  display: "block",
                  fontSize: FS.nota,
                  color: "var(--ink-muted)",
                }}
              >
                {c.evidence}
              </span>
            </span>
            <span style={{ fontSize: FS.nota }}>{c.roleLabel}</span>
            <span style={{ fontSize: FS.nota }}>{c.cadenceLabel}</span>
            <span style={{ fontSize: FS.nota }}>{c.minClassLabel}</span>
            <span style={{ fontSize: FS.nota, color: "var(--ink-muted)" }}>
              {c.dispensable ? "Pode dispensar" : "Não dispensável"}
            </span>
          </TableRow>
        ))}
      </SectionCard>

      <SectionCard title={`Casos em uso (${p.casesInUse.length})`}>
        {p.casesInUse.length === 0 ? (
          <p
            style={{ margin: 0, fontSize: FS.base, color: "var(--ink-faint)" }}
          >
            Nenhum caso desta organização usa este perfil ainda.
          </p>
        ) : (
          p.casesInUse.map((c) => (
            <div key={c.code} style={{ fontSize: FS.base, padding: "4px 0" }}>
              <Eyebrow>{c.code}</Eyebrow> {c.title}
            </div>
          ))
        )}
      </SectionCard>
    </div>
  );
}

export default function ControlProfilesScreen() {
  const { data, loading, error, reload } = useCharterData(
    useCallback(() => listControlProfiles(), [])
  );
  const [selected, setSelected] = useState<string | null>(null);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }
  if (loading || !data) {
    return <SkeletonCard />;
  }
  const current = data.find((p) => p.workForm === selected) ?? data[0] ?? null;

  return (
    <div
      className="fade-in"
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <PageHeader
        eyebrow="Governança · método"
        subtitle="A forma do trabalho define os riscos dominantes; a classe de dado define quais controles entram; cada caso tem um plano de controles com evidência revisada."
        title="Perfis de controle"
        tone="accent"
      />
      {current ? (
        <>
          <Tabs
            onChange={setSelected}
            tabs={data.map((p) => ({
              id: p.workForm,
              label: p.name,
              count: p.casesInUse.length,
            }))}
            value={current.workForm}
          />
          <ProfileView p={current} />
        </>
      ) : (
        <SmartEmptyState
          icon="shield"
          subtitle="Os perfis são publicados pela Nebuloz. Quando houver um para a forma de trabalho do caso, ele aparece aqui."
          title="Nenhum perfil de controle publicado"
          tone="accent"
        />
      )}
    </div>
  );
}
