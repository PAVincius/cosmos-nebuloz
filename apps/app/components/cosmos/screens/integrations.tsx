"use client";

import type { IconName } from "@repo/design-system/cosmos/icons";
import {
  Avatar,
  Badge,
  Button,
  ErrorState,
  IconButton,
  PageHeader,
  SectionCard,
  type Tone,
  useAction,
} from "@repo/design-system/cosmos/kit";
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
// Ciclo de vida (story-060, FR-018): pausar/retomar e testar a conexão são
// escritas reais sobre Integration. `PAUSED` é o estado que as rotas de
// ingestão (api/webhooks/linear|github) já liam para mandar o evento à
// dead-letter queue sem tocar em dado do Cosmos — esta tela é o produtor que
// faltava. Testar usa a credencial JÁ guardada, decifrada dentro da action:
// nenhum campo de segredo existe nesta tela.
//
// Conectar (Linear): o modal coleta a API key, valida com o Linear ANTES de
// gravar, lista os times reais da conta e delega a escrita a
// connectLinearIntegration — que cifra via createIntegration. A chave existe
// só no submit: não é lida de volta em lugar nenhum desta tela, porque
// `listIntegrations` não seleciona `config`. As demais fontes do catálogo
// seguem sem caminho de conexão e o modal continua dizendo isso em voz alta,
// em vez de fingir um formulário que não grava nada.
import { type CSSProperties, useState } from "react";
import {
  connectLinearIntegration,
  discoverLinearTeams,
  type ImportCounts,
  type IntegrationView,
  type LinearTeamOption,
  listIntegrations,
  resyncIntegration,
  setIntegrationPaused,
  testIntegrationConnection,
} from "@/app/(cosmos)/actions/integrations";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

const STATUS_TONE: Record<string, Tone> = {
  ACTIVE: "green",
  INACTIVE: "amber",
  PAUSED: "amber",
  ERROR: "red",
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  PAUSED: "Pausado",
  ERROR: "Erro",
};

// FR-020: `partial` não faz rollback, então é um resultado distinto de
// sucesso — arredondar os dois para "ok" esconderia itens que ficaram para
// trás. O rótulo sai do valor gravado em SyncLog.status, sem tradução criativa.
const SYNC_STATUS_LABEL: Record<string, string> = {
  success: "sucesso",
  partial: "parcial",
  error: "erro",
};

const SYNC_STATUS_TONE: Record<string, Tone> = {
  success: "green",
  partial: "amber",
  error: "red",
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

const inputStyle: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-md)",
  color: "var(--ink)",
  fontFamily: "inherit",
  fontSize: 14,
  outline: "none",
  padding: "10px 12px",
  width: "100%",
};

const labelStyle: CSSProperties = {
  color: "var(--ink-faint)",
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  marginBottom: 6,
  textTransform: "uppercase",
};

function fieldRowStyle(): CSSProperties {
  return {
    alignItems: "center",
    display: "flex",
    fontSize: 13,
    justifyContent: "space-between",
  };
}

/** Saúde da última sincronização, lida de SyncLog. Só renderiza quando existe
 *  execução registrada — conector que nunca sincronizou não ganha contador
 *  zerado, que seria indistinguível de "rodou e não trouxe nada" (AC-004). */
function SyncHealth({ integration }: { integration: IntegrationView }) {
  const last = integration.lastSync;
  if (!last) {
    return null;
  }
  const label = SYNC_STATUS_LABEL[last.status] ?? last.status;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <Badge dot tone={SYNC_STATUS_TONE[last.status] ?? "neutral"}>
        {`Última sincronização: ${label}`}
      </Badge>
      <span
        style={{ color: "var(--ink-faint)", fontSize: 11.5 }}
      >{`${last.itemsCreated} criados · ${last.itemsUpdated} atualizados · ${last.itemsSkipped} pulado${last.itemsSkipped === 1 ? "" : "s"}`}</span>
    </div>
  );
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
        {integration.lastSync && (
          <div style={fieldRowStyle()}>
            <span style={{ color: "var(--ink-faint)" }}>Última execução</span>
            <SyncHealth integration={integration} />
          </div>
        )}
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

// Conectar o Linear em dois passos, na ordem em que a segurança exige:
// validar a chave e listar os times **antes** de gravar qualquer coisa. O
// caminho inverso — gravar e testar depois — deixaria uma Integration ACTIVE
// apontando para credencial que não autentica, e alguém confiaria no card
// verde.
function ConnectLinearModal({
  catalog,
  onConnected,
}: {
  catalog: CatalogEntry;
  onConnected: () => void;
}) {
  const { close } = useModal();
  const [name, setName] = useState(catalog.label);
  const [apiKey, setApiKey] = useState("");
  const [account, setAccount] = useState<string | null>(null);
  const [teams, setTeams] = useState<LinearTeamOption[] | null>(null);
  const [teamId, setTeamId] = useState("");
  const [importNow, setImportNow] = useState(true);
  const [busy, setBusy] = useState(false);

  const discover = async () => {
    if (apiKey.trim().length < 8 || busy) {
      return;
    }
    setBusy(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => discoverLinearTeams({ apiKey }), {
      loading: "Validando credencial no Linear...",
      success: (data: { account: string | null }) =>
        data.account
          ? `Autenticado como ${data.account}.`
          : "Credencial aceita.",
      error: (e: string) => `Linear recusou a credencial: ${e}`,
    });
    setBusy(false);
    if (res.ok) {
      setAccount(res.data.account);
      setTeams(res.data.teams);
      setTeamId(res.data.teams[0]?.id ?? "");
    }
  };

  const connect = async () => {
    if (!(teamId && name.trim()) || busy) {
      return;
    }
    setBusy(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        connectLinearIntegration({
          name: name.trim(),
          apiKey,
          linearTeamId: teamId,
          importNow,
        }),
      {
        loading: importNow
          ? "Conectando e importando issues..."
          : "Conectando...",
        success: (data: { imported: ImportCounts | null }) =>
          data.imported
            ? `Conectado — ${data.imported.created} criadas, ${data.imported.updated} atualizadas, ${data.imported.skipped} puladas.`
            : "Conectado. Sincronize quando quiser trazer as issues.",
        error: (e: string) => `Não foi possível conectar: ${e}`,
      }
    );
    setBusy(false);
    // Só fecha no sucesso: fechar no erro custaria a chave já digitada, e ela
    // não é lida de volta em lugar nenhum para repopular o campo.
    if (res.ok) {
      setApiKey("");
      close();
      onConnected();
    }
  };

  return (
    <ModalCard
      icon={<Avatar name={catalog.label} size={24} tone={catalog.tone} />}
      subtitle={catalog.category}
      title={`Conectar ${catalog.label}`}
      width={460}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="linear-name" style={labelStyle}>
            Nome da integração
          </label>
          <input
            id="linear-name"
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Linear Nebuloz"
            style={inputStyle}
            value={name}
          />
        </div>

        <div>
          <label htmlFor="linear-key" style={labelStyle}>
            Personal API key
          </label>
          <input
            autoComplete="off"
            disabled={teams !== null}
            id="linear-key"
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && teams === null) {
                discover();
              }
            }}
            placeholder="lin_api_..."
            spellCheck={false}
            style={inputStyle}
            type="password"
            value={apiKey}
          />
          <p
            style={{
              color: "var(--ink-faint)",
              fontSize: 12,
              lineHeight: 1.5,
              margin: "6px 0 0",
            }}
          >
            Linear → Settings → Security &amp; access → Personal API keys. A
            chave é cifrada no servidor (AES-256-GCM) e nunca volta para esta
            tela — para trocá-la, reconecte.
          </p>
        </div>

        {teams !== null && (
          <div>
            <label htmlFor="linear-team" style={labelStyle}>
              Time do Linear{account ? ` · conta ${account}` : ""}
            </label>
            {teams.length === 0 ? (
              <p style={{ color: "var(--ink-muted)", fontSize: 13, margin: 0 }}>
                Esta conta não tem nenhum time visível. Nada a mapear.
              </p>
            ) : (
              <select
                id="linear-team"
                onChange={(e) => setTeamId(e.target.value)}
                style={inputStyle}
                value={teamId}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {`${t.key} · ${t.name}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {teams !== null && teams.length > 0 && (
          <label
            htmlFor="linear-import"
            style={{
              alignItems: "center",
              color: "var(--ink-subtle)",
              display: "flex",
              fontSize: 13,
              gap: 8,
            }}
          >
            <input
              checked={importNow}
              id="linear-import"
              onChange={(e) => setImportNow(e.target.checked)}
              type="checkbox"
            />
            Importar as issues deste time agora (vira Feature no COSMOS)
          </label>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          {teams === null ? (
            <Button onClick={discover} size="sm" variant="primary">
              Validar e listar times
            </Button>
          ) : (
            <Button onClick={connect} size="sm" variant="primary">
              Conectar
            </Button>
          )}
        </div>
      </div>
    </ModalCard>
  );
}

// As demais fontes do catálogo não têm conector no repositório — nem cliente
// de API, nem rota de webhook. Um formulário aqui coletaria credencial para
// guardar e nunca usar, que é pior que dizer que não existe.
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
          Não há conector para {catalog.label} neste ambiente — nem cliente de
          API, nem rota de ingestão. Nenhuma credencial é coletada aqui.
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
  onChanged,
}: {
  integration?: IntegrationView;
  catalog: CatalogEntry;
  onChanged: () => void;
}) {
  const modal = useModal();
  const [busy, setBusy] = useState(false);
  const paused = integration?.status === "PAUSED";

  const togglePaused = async () => {
    if (!integration || busy) {
      return;
    }
    setBusy(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => setIntegrationPaused({ id: integration.id, paused: !paused }),
      {
        loading: paused ? "Retomando conector..." : "Pausando conector...",
        success: paused
          ? "Conector retomado."
          : "Conector pausado — eventos que chegarem vão para a fila de mortos.",
        error: (err: string) => `Não foi possível atualizar o conector: ${err}`,
      }
    );
    setBusy(false);
    if (res.ok) {
      onChanged();
    }
  };

  const syncNow = async () => {
    if (!integration || busy) {
      return;
    }
    setBusy(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => resyncIntegration({ id: integration.id }),
      {
        loading: `Sincronizando ${integration.name}...`,
        success: (data: ImportCounts) =>
          `${data.created} criadas, ${data.updated} atualizadas, ${data.skipped} puladas.`,
        error: (e: string) => `Sincronização falhou: ${e}`,
      }
    );
    setBusy(false);
    if (res.ok) {
      onChanged();
    }
  };

  const testConnection = async () => {
    if (!integration || busy) {
      return;
    }
    setBusy(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => testIntegrationConnection({ id: integration.id }),
      {
        loading: "Testando conexão...",
        success: (data: { account: string | null }) =>
          data.account
            ? `Conexão ok — autenticado como ${data.account}.`
            : "Conexão ok.",
        error: (err: string) => `Conexão recusada: ${err}`,
      }
    );
    setBusy(false);
    if (res.ok) {
      onChanged();
    }
  };

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
        {integration && <SyncHealth integration={integration} />}
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
              <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
                <IconButton
                  name="refresh"
                  onClick={testConnection}
                  size={30}
                  title={`Testar conexão de ${integration.name}`}
                />
                {integration.source === "linear" && (
                  <IconButton
                    name="download"
                    onClick={syncNow}
                    size={30}
                    title={`Sincronizar ${integration.name} agora`}
                  />
                )}
                <IconButton
                  name={paused ? "play" : "pause"}
                  onClick={togglePaused}
                  size={30}
                  title={`${paused ? "Retomar" : "Pausar"} ${integration.name}`}
                />
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
                  variant="secondary"
                >
                  Gerenciar
                </Button>
              </div>
            </>
          ) : (
            <Button
              full
              icon="plug"
              onClick={() =>
                modal.open(
                  catalog.source === "linear" ? (
                    <ConnectLinearModal
                      catalog={catalog}
                      onConnected={onChanged}
                    />
                  ) : (
                    <ConnectIntegrationModal catalog={catalog} />
                  )
                )
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
  // reloadKey força o useAction a refazer a leitura depois de pausar/testar —
  // o estado do conector é escrito no servidor, então a tela recarrega em vez
  // de otimizar otimisticamente um estado que pode não ter sido gravado.
  const [reloadKey, setReloadKey] = useState(0);
  const {
    data: items,
    loading,
    error,
  } = useAction(listIntegrations, [reloadKey]);
  const reload = () => setReloadKey((k) => k + 1);

  const connectedSources = new Set((items ?? []).map((i) => i.source));
  const availableCatalog = CONNECTOR_CATALOG.filter(
    (entry) => !connectedSources.has(entry.source)
  );
  const errorCount = (items ?? []).filter((i) => i.status === "ERROR").length;
  const pausedCount = (items ?? []).filter((i) => i.status === "PAUSED").length;

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
            {pausedCount > 0 && (
              <Badge tone="amber">{pausedCount} pausadas</Badge>
            )}
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
            onChanged={reload}
          />
        ))}
        {!loading &&
          availableCatalog.map((entry) => (
            <ConnectorCard
              catalog={entry}
              key={entry.source}
              onChanged={reload}
            />
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
