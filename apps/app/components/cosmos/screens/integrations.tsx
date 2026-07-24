"use client";

// integrations.tsx — Integrações, wired to listIntegrations(). Per-connector
// cards use real, tenant-scoped fields (source, name, status, lastSyncAt)
// straight from the Integration model — config/mapping stay excluded (both
// hold secrets: apiKey/org/token and statusMap/typeMap/teamId/artId/piId —
// see the SECURITY comment on listIntegrations, unchanged here).
//
// Integration has no category/description columns, so the "richer card"
// requested for parity (logo/category/description) is sourced from
// CONNECTOR_CATALOG below — a small static lookup keyed by the real
// `source` value, describing what each connector *type* does. That's
// product metadata, not per-tenant instance data, so it isn't a
// fabrication: no fake status, no invented sync timestamps. Catalog entries
// with zero configured rows for this tenant render as "available" cards.
//
// Connect/manage flow: IntegrationDraft (the model the handoff's connect
// wizard was meant to persist to) has zero callers anywhere in this
// codebase — no action, no route. Wiring a draft-create mutation here would
// be new mutation surface, not a thin parity change, so it's deferred.
// "Conectar" and "Gerenciar" both open read-only modals that say exactly
// that out loud; neither pretends to connect anything or synthesizes a
// "Conectado" state or sync data.
import type { CSSProperties } from "react";
import {
  type IntegrationView,
  listIntegrations,
} from "@/app/(cosmos)/actions/integrations";
import type { IconName } from "../icons";
import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  PageHeader,
  SectionCard,
  type Tone,
  useAction,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "green",
  INACTIVE: "amber",
  ERROR: "red",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  ERROR: "Erro",
};

type CatalogEntry = {
  source: string;
  label: string;
  category: string;
  description: string;
  icon: IconName;
  tone: Tone;
};

// Source values per the Integration.source comment in system.prisma.
const CONNECTOR_CATALOG: CatalogEntry[] = [
  {
    source: "linear",
    label: "Linear",
    category: "Gestão de trabalho",
    description: "Sincroniza issues e status de squads com o board do COSMOS.",
    icon: "kanban",
    tone: "purple",
  },
  {
    source: "jira",
    label: "Jira",
    category: "Gestão de trabalho",
    description: "Issues e sprints sincronizados com o backlog do ART.",
    icon: "kanban",
    tone: "blue",
  },
  {
    source: "asana",
    label: "Asana",
    category: "Gestão de trabalho",
    description: "Tarefas e projetos sincronizados com épicos e features.",
    icon: "kanban",
    tone: "red",
  },
  {
    source: "github",
    label: "GitHub",
    category: "Engenharia",
    description: "Deploys, PRs e eventos de CI/CD para métricas DORA.",
    icon: "gitBranch",
    tone: "neutral",
  },
  {
    source: "gitlab",
    label: "GitLab",
    category: "Engenharia",
    description: "Pipelines e merge requests para rastreabilidade de entrega.",
    icon: "gitBranch",
    tone: "amber",
  },
  {
    source: "azure-devops",
    label: "Azure DevOps",
    category: "Engenharia",
    description: "Work items e pipelines do ecossistema Microsoft.",
    icon: "gitBranch",
    tone: "blue",
  },
  {
    source: "billing_aws",
    label: "AWS Billing",
    category: "FinOps",
    description: "Custos de nuvem AWS para alocação por tema e time.",
    icon: "dollar",
    tone: "amber",
  },
  {
    source: "billing_gcp",
    label: "GCP Billing",
    category: "FinOps",
    description: "Custos de nuvem GCP para alocação por tema e time.",
    icon: "dollar",
    tone: "blue",
  },
  {
    source: "billing_azure",
    label: "Azure Billing",
    category: "FinOps",
    description: "Custos de nuvem Azure para alocação por tema e time.",
    icon: "dollar",
    tone: "blue",
  },
];

const CATALOG_BY_SOURCE = new Map(
  CONNECTOR_CATALOG.map((entry) => [entry.source, entry])
);

function catalogFor(source: string): CatalogEntry {
  return (
    CATALOG_BY_SOURCE.get(source) ?? {
      source,
      label: source,
      category: "Conector",
      description: "Conector externo configurado para este tenant.",
      icon: "plug",
      tone: "neutral",
    }
  );
}

function fmtSync(iso: string | null): string {
  if (!iso) {
    return "Nunca sincronizado";
  }
  return `Sincronizado em ${new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })}`;
}

function fieldRowStyle(): CSSProperties {
  return {
    alignItems: "center",
    display: "flex",
    fontSize: 13,
    justifyContent: "space-between",
  };
}

function ManageIntegrationModal({
  integration,
  catalog,
}: {
  integration: IntegrationView;
  catalog: CatalogEntry;
}) {
  const { close } = useModal();
  return (
    <ModalCard
      icon={<Avatar name={catalog.label} size={24} tone={catalog.tone} />}
      subtitle={catalog.category}
      title={integration.name}
      width={440}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={fieldRowStyle()}>
          <span style={{ color: "var(--ink-faint)" }}>Fonte</span>
          <span
            className="mono"
            style={{ color: "var(--ink)", fontWeight: 600 }}
          >
            {integration.source}
          </span>
        </div>
        <div style={fieldRowStyle()}>
          <span style={{ color: "var(--ink-faint)" }}>Status</span>
          <Badge dot tone={STATUS_TONE[integration.status] ?? "neutral"}>
            {STATUS_LABEL[integration.status] ?? integration.status}
          </Badge>
        </div>
        <div style={fieldRowStyle()}>
          <span style={{ color: "var(--ink-faint)" }}>Sincronização</span>
          <span style={{ color: "var(--ink)" }}>
            {fmtSync(integration.lastSyncAt)}
          </span>
        </div>
        <p
          style={{
            color: "var(--ink-faint)",
            fontSize: 12,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          Credenciais e mapeamento de campos não são exibidos aqui por
          segurança. Editar essa configuração é um fluxo de administração ainda
          não implementado nesta tela.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Fechar
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function ConnectIntegrationModal({ catalog }: { catalog: CatalogEntry }) {
  const { close } = useModal();
  return (
    <ModalCard
      icon={<Avatar name={catalog.label} size={24} tone={catalog.tone} />}
      subtitle={catalog.category}
      title={`Conectar ${catalog.label}`}
      width={440}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p
          style={{
            color: "var(--ink-muted)",
            fontSize: 13,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {catalog.description}
        </p>
        <p
          style={{
            color: "var(--ink-faint)",
            fontSize: 12.5,
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          O fluxo de conexão (autenticação e mapeamento de campos) ainda não
          está implementado nesta versão — nenhuma credencial é coletada aqui.
          Item pendente de infraestrutura.
        </p>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Entendi
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function ConnectorCard({
  integration,
  catalog,
}: {
  integration?: IntegrationView;
  catalog: CatalogEntry;
}) {
  const modal = useModal();
  return (
    <SectionCard
      action={
        integration ? (
          <Badge dot tone={STATUS_TONE[integration.status] ?? "neutral"}>
            {STATUS_LABEL[integration.status] ?? integration.status}
          </Badge>
        ) : (
          <Badge tone="neutral">Disponível</Badge>
        )
      }
      icon={catalog.icon}
      subtitle={catalog.category}
      title={integration ? integration.name : catalog.label}
      tone={
        integration ? (STATUS_TONE[integration.status] ?? "neutral") : "neutral"
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p
          style={{
            color: "var(--ink-muted)",
            fontSize: 12.5,
            lineHeight: 1.45,
            margin: 0,
          }}
        >
          {catalog.description}
        </p>
        <div
          style={{
            alignItems: "center",
            borderTop: "1px solid var(--hairline)",
            display: "flex",
            gap: 8,
            paddingTop: 12,
          }}
        >
          {integration ? (
            <>
              <span style={{ color: "var(--ink-faint)", fontSize: 11.5 }}>
                {fmtSync(integration.lastSyncAt)}
              </span>
              <Button
                onClick={() =>
                  modal.open(
                    <ManageIntegrationModal
                      catalog={catalog}
                      integration={integration}
                    />
                  )
                }
                size="sm"
                style={{ marginLeft: "auto" }}
                variant="secondary"
              >
                Gerenciar
              </Button>
            </>
          ) : (
            <Button
              full
              icon="plug"
              onClick={() =>
                modal.open(<ConnectIntegrationModal catalog={catalog} />)
              }
              size="sm"
              variant="soft"
            >
              Conectar
            </Button>
          )}
        </div>
      </div>
    </SectionCard>
  );
}

function IntegrationsBody() {
  const { data: items, loading, error } = useAction(listIntegrations);

  const connectedSources = new Set((items ?? []).map((i) => i.source));
  const availableCatalog = CONNECTOR_CATALOG.filter(
    (entry) => !connectedSources.has(entry.source)
  );
  const errorCount = (items ?? []).filter((i) => i.status === "ERROR").length;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Plataforma"
        meta={
          <>
            <Badge dot tone="green">
              {items?.length ?? 0} conectadas
            </Badge>
            <Badge tone="neutral">{availableCatalog.length} disponíveis</Badge>
            {errorCount > 0 && <Badge tone="red">{errorCount} com erro</Badge>}
          </>
        }
        subtitle="Conectores externos e estado de sincronização."
        title="Integrações"
      />
      {error && <ErrorState />}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
        }}
      >
        {items?.map((i) => (
          <ConnectorCard
            catalog={catalogFor(i.source)}
            integration={i}
            key={i.id}
          />
        ))}
        {!loading &&
          availableCatalog.map((entry) => (
            <ConnectorCard catalog={entry} key={entry.source} />
          ))}
      </div>
    </div>
  );
}

export default function IntegrationsScreen() {
  return (
    <ModalProvider>
      <IntegrationsBody />
    </ModalProvider>
  );
}
