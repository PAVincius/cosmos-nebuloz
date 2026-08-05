"use client";

import { Icon } from "@repo/design-system/cosmos/icons";
import {
  Badge,
  Button,
  CopyId,
  ErrorState,
  IconButton,
  PageHeader,
  SectionCard,
  type Tone,
} from "@repo/design-system/cosmos/kit";
// webhooks.tsx — Webhooks, wired a listWebhooks() + createWebhook() +
// setWebhookActive() + sendTestWebhook(). Lista os endpoints com a saúde
// derivada do histórico de entrega (falhas consecutivas, não só a última),
// permite pausar/retomar um endpoint que está quebrando, e disparar um evento
// sintético `ping` pelo mesmo pipeline de entrega dos eventos reais. O segredo
// de assinatura é gerado no servidor e exibido uma única vez, na visão
// pós-criação do modal — depois não é mais recuperável.
import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import {
  createWebhook,
  listWebhooks,
  sendTestWebhook,
  setWebhookActive,
  type WebhookView,
} from "@/app/(cosmos)/actions/webhooks";
import {
  DEGRADED_AFTER_CONSECUTIVE_FAILURES,
  FAILING_DELIVERY_STATUSES,
} from "@/app/(cosmos)/actions/webhooks.constants";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

function isFailing(status: string | null): boolean {
  return status !== null && FAILING_DELIVERY_STATUSES.has(status);
}

// Rótulo de saúde: "Degradado" só a partir do limiar de falhas consecutivas do
// FR-020 AC-006. Uma falha isolada continua sendo "Falhando" — é ruído de rede
// até virar padrão, e chamar as duas coisas pelo mesmo nome faria a leitora
// ignorar as duas.
function healthLabel(h: WebhookView): { label: string; tone: Tone } {
  if (h.degraded) {
    return { label: "Degradado", tone: "red" };
  }
  if (!h.active) {
    return { label: "Pausado", tone: "neutral" };
  }
  if (isFailing(h.lastDeliveryStatus)) {
    return { label: "Falhando", tone: "amber" };
  }
  return { label: "Ativo", tone: "green" };
}

function fmtLastDelivery(h: WebhookView): string {
  if (!h.lastDeliveryAt) {
    return "Sem entregas";
  }
  const when = new Date(h.lastDeliveryAt).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  // O código HTTP é o que diz se a falha é do endpoint (5xx), do contrato
  // (4xx) ou nem chegou a haver resposta.
  const code =
    h.lastDeliveryCode === null ? "sem resposta" : `HTTP ${h.lastDeliveryCode}`;
  return `Última entrega ${when} · ${code}`;
}

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

  const toggleActive = async (h: WebhookView) => {
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () => setWebhookActive({ id: h.id, active: !h.active }),
      {
        loading: h.active ? "Pausando webhook..." : "Retomando webhook...",
        success: h.active ? "Webhook pausado." : "Webhook retomado.",
        error: (err: string) => `Não foi possível alterar o webhook: ${err}`,
      }
    );
    if (res.ok) {
      load();
    }
  };

  const sendTest = async (h: WebhookView) => {
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(() => sendTestWebhook({ id: h.id }), {
      loading: "Disparando evento de teste...",
      success: "Evento de teste enfileirado.",
      error: (err: string) => `Não foi possível disparar o teste: ${err}`,
    });
    if (res.ok) {
      load();
    }
  };

  const activeCount = hooks.filter((h) => h.active).length;
  const degradedCount = hooks.filter((h) => h.degraded).length;

  return (
    <div className="fade-in">
      <PageHeader
        eyebrow="Plataforma"
        meta={
          <>
            <Badge tone="accent">{hooks.length} webhooks</Badge>
            <Badge dot tone="green">
              {activeCount} ativos
            </Badge>
            {degradedCount > 0 && (
              <Badge tone="red">{degradedCount} degradado</Badge>
            )}
          </>
        }
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
          {hooks.map((h) => {
            const health = healthLabel(h);
            const leftBorderColor = h.degraded
              ? "var(--red)"
              : isFailing(h.lastDeliveryStatus)
                ? "var(--amber)"
                : h.active
                  ? "var(--green)"
                  : "var(--hairline-strong)";
            return (
              <div
                key={h.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: "1px solid var(--hairline)",
                  borderLeft: `3px solid ${leftBorderColor}`,
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
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <Badge dot tone={health.tone}>
                    {health.label}
                  </Badge>
                  <div
                    className="mono"
                    style={{
                      marginTop: 5,
                      fontSize: 11,
                      color: h.degraded
                        ? "var(--red-text)"
                        : "var(--ink-subtle)",
                    }}
                  >
                    {fmtLastDelivery(h)}
                  </div>
                  {h.consecutiveFailures >=
                    DEGRADED_AFTER_CONSECUTIVE_FAILURES && (
                    <div
                      style={{
                        marginTop: 3,
                        fontSize: 11,
                        color: "var(--red-text)",
                      }}
                    >
                      {h.consecutiveFailures} falhas seguidas
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {h.active && (
                    <IconButton
                      name="send"
                      onClick={() => sendTest(h)}
                      size={30}
                      title={`Disparar evento de teste em ${h.url}`}
                    />
                  )}
                  <IconButton
                    name={h.active ? "pause" : "play"}
                    onClick={() => toggleActive(h)}
                    size={30}
                    title={`${h.active ? "Pausar" : "Retomar"} ${h.url}`}
                  />
                </div>
              </div>
            );
          })}
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
