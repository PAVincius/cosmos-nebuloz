"use client";

// webhooks.tsx — Webhooks, wired to listWebhooks() + createWebhook(). Lists
// configured endpoints and registers new WebhookEndpoint rows via
// NewWebhookModal. The signing secret is generated server-side and shown
// exactly once, in the modal's post-creation view — it cannot be retrieved
// again afterwards.
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  createWebhook,
  listWebhooks,
  type WebhookView,
} from "@/app/(cosmos)/actions/webhooks";
import { Icon } from "../icons";
import {
  Badge,
  Button,
  CopyId,
  ErrorState,
  PageHeader,
  SectionCard,
} from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

const EVENT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "epic.created", label: "Epic criado" },
  { value: "sprint.activated", label: "Sprint ativado" },
  { value: "sprint.completed", label: "Sprint concluído" },
  { value: "story.status_changed", label: "Status de história alterado" },
  { value: "story.assigned", label: "História atribuída" },
  { value: "risk.created", label: "Risco criado" },
  { value: "risk.status_changed", label: "Status de risco alterado" },
  { value: "defect.created", label: "Defeito criado" },
  { value: "impediment.created", label: "Impedimento criado" },
  { value: "pi.created", label: "PI criado" },
  {
    value: "pi.confidence_vote_required",
    label: "Voto de confiança do PI necessário",
  },
  { value: "feature.created", label: "Feature criada" },
  { value: "feature.updated", label: "Feature atualizada" },
  { value: "feature.wsjf_updated", label: "WSJF de feature atualizado" },
];

const fieldLabelStyle: CSSProperties = {
  display: "block",
  fontSize: 11.5,
  fontWeight: 700,
  letterSpacing: ".04em",
  textTransform: "uppercase",
  color: "var(--ink-faint)",
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  fontSize: 14,
  borderRadius: "var(--r-md)",
  border: "1px solid var(--hairline-strong)",
  background: "var(--surface)",
  color: "var(--ink)",
  fontFamily: "inherit",
  outline: "none",
};

function NewWebhookModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [url, setUrl] = useState("");
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<{
    id: string;
    secret: string;
  } | null>(null);

  const toggleEvent = (value: string) => {
    setEventTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const create = async () => {
    if (!(url.trim() && eventTypes.length > 0) || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => createWebhook({ url: url.trim(), eventTypes }),
      {
        loading: "Criando webhook...",
        success: "Webhook criado.",
        error: (err: string) => `Não foi possível criar o webhook: ${err}`,
      }
    );
    setSaving(false);
    if (res.ok) {
      // Do NOT auto-close — the secret is shown exactly once, here.
      setCreated(res.data);
      onCreated?.();
    }
  };

  if (created) {
    return (
      <ModalCard
        icon={<Icon name="webhook" size={16} />}
        subtitle="Copie o segredo agora — ele não será exibido novamente"
        title="Webhook criado"
        width={480}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              padding: "10px 12px",
              borderRadius: "var(--r-md)",
              border: "1px solid rgba(var(--amber-rgb),.3)",
              background: "var(--amber-soft)",
              fontSize: 12.5,
              color: "var(--amber-text)",
              lineHeight: 1.5,
            }}
          >
            Este é o único momento em que o segredo (HMAC) do webhook é exibido.
            Copie e armazene em local seguro — não será possível recuperá-lo
            depois.
          </div>
          <div>
            <label style={fieldLabelStyle}>Segredo (HMAC)</label>
            <div
              className="mono"
              style={{
                padding: "10px 12px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--hairline-strong)",
                background: "var(--surface)",
                fontSize: 12.5,
                color: "var(--ink)",
                wordBreak: "break-all",
              }}
            >
              <CopyId value={created.secret}>{created.secret}</CopyId>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button onClick={close} size="sm" variant="primary">
              Fechar
            </Button>
          </div>
        </div>
      </ModalCard>
    );
  }

  return (
    <ModalCard
      icon={<Icon name="webhook" size={16} />}
      subtitle="Endpoint HTTPS para eventos críticos do portfólio"
      title="Novo webhook"
      width={480}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <label htmlFor="webhook-url" style={fieldLabelStyle}>
            URL
          </label>
          <input
            id="webhook-url"
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://exemplo.com/hooks/cosmos"
            style={inputStyle}
            value={url}
          />
        </div>

        <div>
          <label style={fieldLabelStyle}>Eventos</label>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              maxHeight: 220,
              overflowY: "auto",
              padding: "8px 10px",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--hairline-strong)",
              background: "var(--surface)",
            }}
          >
            {EVENT_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 13,
                  color: "var(--ink)",
                  cursor: "pointer",
                }}
              >
                <input
                  checked={eventTypes.includes(opt.value)}
                  onChange={() => toggleEvent(opt.value)}
                  type="checkbox"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={create} size="sm" variant="primary">
            Criar webhook
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function WebhooksBody() {
  const modal = useModal();
  const [hooks, setHooks] = useState<WebhookView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listWebhooks().then((r) => {
      if (r.ok) {
        setHooks(r.data);
      } else {
        setError(true);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Plataforma"
        meta={<Badge tone="accent">{hooks.length} webhooks</Badge>}
        subtitle="Endpoints configurados para eventos críticos do portfólio."
        title="Webhooks"
      >
        <Button
          icon="plus"
          onClick={() => modal.open(<NewWebhookModal onCreated={load} />)}
          size="sm"
          variant="primary"
        >
          Novo webhook
        </Button>
      </PageHeader>
      {error && <ErrorState />}
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="webhook"
        title="Endpoints"
        tone="accent"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!(loading || error) && hooks.length === 0 && (
            <span style={{ fontSize: 13, color: "var(--ink-muted)" }}>
              Nenhum webhook configurado.
            </span>
          )}
          {hooks.map((h) => (
            <div
              key={h.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "12px 16px",
                borderRadius: 12,
                border: "1px solid var(--hairline)",
                background: "var(--surface)",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {h.url}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                  }}
                >
                  {h.eventTypes.map((e) => (
                    <Badge key={e} tone="neutral">
                      {e}
                    </Badge>
                  ))}
                </div>
              </div>
              <Badge dot tone={h.active ? "green" : "neutral"}>
                {h.active ? "Ativo" : "Inativo"}
              </Badge>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

export default function WebhooksScreen() {
  return (
    <ModalProvider>
      <WebhooksBody />
    </ModalProvider>
  );
}
