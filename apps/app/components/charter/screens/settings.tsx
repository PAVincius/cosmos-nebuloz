"use client";

// Configurações — FR-12. Workspace, matriz de permissões (leitura) e
// notificações.

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  PageHeader,
  SectionCard,
  Switch,
} from "@repo/design-system/cosmos/kit";
import { useCallback, useState, useTransition } from "react";
import {
  getSettings,
  setMemberCharterRole,
  setNotificationTrigger,
  updateWorkspace,
} from "@/app/(charter)/actions/settings";
import { useActionToast as runWithToast } from "../../cosmos/use-action-toast";
import {
  Eyebrow,
  Field,
  Input,
  ScreenError,
  Segmented,
  Select,
  Tabs,
} from "../base";
import { useCharterData } from "../use-charter-data";

const ROLE_ORDER = [
  "COMPLIANCE",
  "LEGAL",
  "SECURITY",
  "HR",
  "REQUESTER",
  "EXEC",
  "AUDITOR",
] as const;

export default function SettingsScreen() {
  const [tab, setTab] = useState("workspace");
  const [pending, startTransition] = useTransition();
  const { data, loading, error, reload } = useCharterData(
    useCallback(() => getSettings(), [])
  );

  const [industry, setIndustry] = useState<string | null>(null);
  const [geo, setGeo] = useState<string | null>(null);
  const [posture, setPosture] = useState<string | null>(null);
  const [employees, setEmployees] = useState<string | null>(null);
  const [retention, setRetention] = useState<number | null>(null);

  if (error) {
    return <ScreenError message={error} onRetry={reload} />;
  }
  if (loading || !data) {
    return (
      <div className="skeleton" style={{ height: 260, borderRadius: 14 }} />
    );
  }

  const ws = data.workspace;
  const v = {
    industry: industry ?? ws.industry ?? "",
    geo: geo ?? ws.geo ?? "",
    posture: posture ?? ws.posture,
    employees: employees ?? (ws.employees !== null ? String(ws.employees) : ""),
    retention: retention ?? ws.logRetentionDays,
  };

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow={`workspace ${ws.slug}${ws.employees !== null ? ` · ${ws.employees} pessoas` : ""}`}
        meta={
          <>
            <Badge tone="accent">Retenção {ws.logRetentionDays} dias</Badge>
            <Badge tone="accent">Região {ws.geo ?? "não declarada"}</Badge>
            <Badge dot tone="green">
              {data.members.length} membros do Charter
            </Badge>
          </>
        }
        subtitle="Contexto organizacional, permissões por papel e o que o Charter notifica."
        title="Configurações do Workspace"
        tone="accent"
      />

      <Tabs
        onChange={setTab}
        tabs={[
          { id: "workspace", label: "Workspace" },
          { id: "permissoes", label: "Papéis e permissões" },
          {
            id: "notificacoes",
            label: "Notificações",
            count: data.notifications.length,
          },
        ]}
        value={tab}
      />

      {tab === "workspace" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "var(--gap)",
              alignItems: "start",
            }}
          >
            <SectionCard
              icon="building"
              subtitle="Alimenta a geração de política e o cálculo de caminho de aprovação"
              title="Perfil organizacional"
              tone="accent"
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 13 }}
              >
                {/* Nome do tenant é da plataforma, não do Charter — mostrado
                    para contexto, editado fora daqui. */}
                <Field
                  hint="Alterado na administração da plataforma"
                  label="Organização"
                >
                  <Input readOnly value={ws.name} />
                </Field>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <Field label="Setor">
                    <Input
                      onChange={(e) => setIndustry(e.target.value)}
                      placeholder="Healthtech · Pagamentos"
                      value={v.industry}
                    />
                  </Field>
                  <Field label="Colaboradores">
                    <Input
                      min={0}
                      onChange={(e) => setEmployees(e.target.value)}
                      type="number"
                      value={v.employees}
                    />
                  </Field>
                </div>
                <Field
                  hint="Define o padrão de restrição em rascunhos e recomendações"
                  label="Postura de risco"
                >
                  <Segmented
                    ariaLabel="Postura de risco"
                    onChange={setPosture}
                    options={[
                      {
                        value: "CONSERVATIVE",
                        label: "Conservador",
                        tone: "green",
                      },
                      { value: "MODERATE", label: "Moderado" },
                      {
                        value: "AGGRESSIVE",
                        label: "Agressivo",
                        tone: "amber",
                      },
                    ]}
                    value={v.posture}
                  />
                </Field>
              </div>
            </SectionCard>

            <SectionCard
              icon="lock"
              subtitle="Requisitos de LGPD e GDPR aplicados ao próprio Charter"
              title="Dados e retenção"
              tone="blue"
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 13 }}
              >
                <Field
                  hint="LGPD/GDPR — quanto tempo a trilha permanece consultável."
                  label="Retenção de trilha"
                >
                  <Select
                    ariaLabel="Retenção de trilha"
                    onChange={(x) => setRetention(Number(x))}
                    options={[
                      { value: "30", label: "30 dias" },
                      { value: "90", label: "90 dias" },
                      { value: "365", label: "365 dias" },
                    ]}
                    value={String(v.retention)}
                  />
                </Field>
                <Field
                  hint="Onde o dado do Charter é processado — entra no pacote de evidência."
                  label="Residência de dados"
                >
                  <Input
                    onChange={(e) => setGeo(e.target.value)}
                    placeholder="BR · UE"
                    value={v.geo}
                  />
                </Field>
              </div>
            </SectionCard>
          </div>

          <div style={{ marginTop: "var(--gap)" }}>
            <Button
              icon="check"
              onClick={() =>
                startTransition(async () => {
                  const res = await runWithToast(
                    () =>
                      updateWorkspace({
                        industry: v.industry || undefined,
                        geo: v.geo || undefined,
                        posture: v.posture as never,
                        employees: v.employees
                          ? Number(v.employees)
                          : undefined,
                        logRetentionDays: v.retention as 30 | 90 | 365,
                      }),
                    { loading: "Salvando…", success: "Perfil atualizado" }
                  );
                  if (res.ok) {
                    reload();
                  }
                })
              }
            >
              {pending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </>
      )}

      {tab === "permissoes" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--gap)",
          }}
        >
          <SectionCard
            icon="users"
            subtitle="Padrão é negar — cada permissão lista explicitamente quem tem"
            title="Matriz de permissões"
            tone="purple"
          >
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  minWidth: 720,
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: ".06em",
                        textTransform: "uppercase",
                        color: "var(--ink-faint)",
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                      }}
                    >
                      Permissão
                    </th>
                    {ROLE_ORDER.map((r) => {
                      const role = data.roles.find((x) => x.id === r);
                      const active = data.activeRole === r;
                      return (
                        <th
                          key={r}
                          style={{
                            padding: "8px 6px",
                            fontSize: 10.5,
                            fontWeight: 700,
                            color: active
                              ? "var(--accent-text)"
                              : "var(--ink-faint)",
                            background: active
                              ? "var(--accent-soft)"
                              : undefined,
                            borderRadius: "var(--r-xs)",
                          }}
                        >
                          {role?.label ?? r}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {data.permissions.map((p) => (
                    <tr key={p.id}>
                      <td
                        style={{
                          padding: "9px 10px",
                          fontSize: 12.5,
                          color: "var(--ink)",
                          borderTop: "1px solid var(--hairline)",
                        }}
                      >
                        {p.label}
                        <span
                          className="mono"
                          style={{
                            display: "block",
                            fontSize: 10,
                            color: "var(--ink-faint)",
                          }}
                        >
                          {p.id}
                        </span>
                      </td>
                      {ROLE_ORDER.map((r) => {
                        const granted = p.grants.includes(r);
                        const active = data.activeRole === r;
                        return (
                          <td
                            key={r}
                            style={{
                              textAlign: "center",
                              padding: "9px 6px",
                              borderTop: "1px solid var(--hairline)",
                              background: active
                                ? "var(--accent-soft)"
                                : undefined,
                            }}
                          >
                            {/* Negado é desenhado, não deixado em branco:
                                célula vazia lê como dado faltando. */}
                            <span
                              style={{
                                display: "grid",
                                placeItems: "center",
                                width: 22,
                                height: 22,
                                margin: "0 auto",
                                borderRadius: 6,
                                background: granted
                                  ? "var(--green-soft)"
                                  : "var(--chip-bg)",
                                border: `1px solid ${granted ? "rgba(var(--green-rgb),.28)" : "var(--hairline)"}`,
                                color: granted
                                  ? "var(--green-text)"
                                  : "var(--ink-faint)",
                              }}
                              title={granted ? "Permitido" : "Negado"}
                            >
                              <Icon
                                name={granted ? "check" : "slash"}
                                size={granted ? 12 : 11}
                                strokeWidth={2.4}
                              />
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p
              style={{
                fontSize: 11.5,
                color: "var(--ink-muted)",
                lineHeight: 1.6,
                marginTop: 12,
                marginBottom: 0,
              }}
            >
              O ADMIN do tenant não herda permissão de Charter: governança que o
              admin de plataforma contorna não é evidência de auditoria.
            </p>
          </SectionCard>

          <SectionCard
            bodyStyle={{ padding: 0 }}
            subtitle="Papel de governança é ortogonal ao papel SAFe"
            title="Membros do Charter"
          >
            {data.members.map((m, i) => (
              <div
                key={m.userId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0,1fr) 220px 200px",
                  gap: 12,
                  padding: "11px 16px",
                  alignItems: "center",
                  borderBottom:
                    i === data.members.length - 1
                      ? "none"
                      : "1px solid var(--hairline)",
                }}
              >
                <span>
                  <span
                    style={{
                      display: "block",
                      fontSize: 12.5,
                      fontWeight: 600,
                      color: "var(--ink)",
                    }}
                  >
                    {m.name}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--ink-faint)" }}>
                    {m.email}
                  </span>
                </span>
                <Badge tone="accent">
                  {data.roles.find((r) => r.id === m.role)?.label ?? m.role}
                </Badge>
                <Select
                  ariaLabel={`Papel de ${m.name}`}
                  onChange={(role) =>
                    startTransition(async () => {
                      const res = await runWithToast(
                        () =>
                          setMemberCharterRole({
                            userId: m.userId,
                            role: role as never,
                          }),
                        {
                          loading: "Atribuindo papel…",
                          success: "Papel atribuído",
                        }
                      );
                      if (res.ok) {
                        reload();
                      }
                    })
                  }
                  options={data.roles.map((r) => ({
                    value: r.id,
                    label: r.label,
                  }))}
                  value={m.role}
                />
              </div>
            ))}
          </SectionCard>
        </div>
      )}

      {tab === "notificacoes" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 1fr",
            gap: "var(--gap)",
            alignItems: "start",
          }}
        >
          <SectionCard
            icon="bell"
            subtitle="Notificação existe para trazer decisão de volta ao fluxo — não para informar o óbvio"
            title="Eventos notificados"
            tone="amber"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {data.notifications.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "11px 12px",
                    borderRadius: "var(--r-sm)",
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, color: "var(--ink)" }}>
                      {n.label}
                    </div>
                    <Eyebrow>{n.audience}</Eyebrow>
                  </div>
                  <Switch
                    on={n.on}
                    onClick={() =>
                      startTransition(async () => {
                        const on = !n.on;
                        const res = await runWithToast(
                          () => setNotificationTrigger({ id: n.id, on }),
                          {
                            loading: "Salvando…",
                            success: on
                              ? "Notificação ativada"
                              : "Notificação desativada",
                          }
                        );
                        if (res.ok) {
                          reload();
                        }
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          {/* O protótipo mostra aqui um painel de integrações (Slack, Okta,
              webhooks). Nada disso existe no V1 — em lugar de simular canal,
              a tela diz o que o toggle faz hoje (ADR-0011). */}
          <SectionCard
            icon="clock"
            subtitle="O que o toggle faz hoje"
            title="Entrega ainda não ligada"
            tone="accent"
          >
            <p
              style={{
                fontSize: 12.5,
                color: "var(--ink-muted)",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              A preferência é persistida por tenant e entra na trilha de
              auditoria, mas nenhum canal dispara: e-mail, Slack e o job de SLA
              ficaram fora do V1. Quando o job existir, estes gatilhos já
              definem quem recebe o quê — nada precisa ser reconfigurado.
            </p>
            <p
              style={{
                fontSize: 11.5,
                color: "var(--ink-faint)",
                lineHeight: 1.6,
                marginBottom: 0,
                marginTop: 10,
              }}
            >
              ADR-0011 · notificações e job de SLA fora do V1
            </p>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
