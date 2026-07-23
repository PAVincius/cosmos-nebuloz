"use client";

// dependencies.tsx — Dependências, wired to listDependencies(). Lists real
// DependencyLink rows (blocking → blocked feature) with status + critical-path flag.
import { useCallback, useEffect, useState } from "react";
import {
  createDependency,
  type DependencyView,
  listDependencies,
} from "@/app/(cosmos)/actions/dependencies";
import type { EntityOption } from "@/app/(cosmos)/actions/entity-search";
import { EntityLinkField } from "../entity-link-field";
import { Icon } from "../icons";
import { Badge, Button, ErrorState, PageHeader, SectionCard } from "../kit";
import { ModalCard, ModalProvider, useModal } from "../modal";
import { useActionToast } from "../use-action-toast";

const STATUS_TONE: Record<string, "green" | "amber" | "red" | "neutral"> = {
  "not-started": "neutral",
  "on-track": "green",
  "at-risk": "amber",
  blocked: "red",
  completed: "green",
};

function NewDependencyModal({ onCreated }: { onCreated?: () => void }) {
  const { close } = useModal();
  const [blocking, setBlocking] = useState<EntityOption | null>(null);
  const [blocked, setBlocked] = useState<EntityOption | null>(null);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!(blocking && blocked) || saving) {
      return;
    }
    setSaving(true);
    // biome-ignore lint/correctness/useHookAtTopLevel: not a React hook, plain async helper
    const res = await useActionToast(
      () =>
        createDependency({
          blockingFeatureId: blocking.id,
          blockedFeatureId: blocked.id,
          description: description.trim() || undefined,
        }),
      {
        loading: "Registrando dependência...",
        success: "Dependência registrada.",
        error: (err: string) =>
          `Não foi possível registrar a dependência: ${err}`,
      }
    );
    setSaving(false);
    close();
    if (res.ok) {
      onCreated?.();
    }
  };

  return (
    <ModalCard
      icon={<Icon name="plus" size={16} strokeWidth={2.4} />}
      subtitle="Vincular uma feature bloqueadora a uma feature bloqueada"
      title="Nova dependência"
      width={480}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <EntityLinkField
          kind="feature"
          label="Feature bloqueadora"
          onChange={setBlocking}
          value={blocking}
        />
        <EntityLinkField
          kind="feature"
          label="Feature bloqueada"
          onChange={setBlocked}
          value={blocked}
        />

        <div>
          <label
            htmlFor="dependency-description"
            style={{
              display: "block",
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: ".04em",
              textTransform: "uppercase",
              color: "var(--ink-faint)",
              marginBottom: 6,
            }}
          >
            Descrição
          </label>
          <textarea
            id="dependency-description"
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contexto da dependência…"
            rows={3}
            style={{
              width: "100%",
              padding: "10px 12px",
              fontSize: 14,
              borderRadius: "var(--r-md)",
              border: "1px solid var(--hairline-strong)",
              background: "var(--surface)",
              color: "var(--ink)",
              fontFamily: "inherit",
              outline: "none",
              resize: "vertical",
            }}
            value={description}
          />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Button onClick={close} size="sm" variant="secondary">
            Cancelar
          </Button>
          <Button onClick={create} size="sm" variant="primary">
            Registrar dependência
          </Button>
        </div>
      </div>
    </ModalCard>
  );
}

function DependenciesBody() {
  const modal = useModal();
  const [deps, setDeps] = useState<DependencyView[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    listDependencies().then((r) => {
      if (r.ok) {
        setDeps(r.data);
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
        eyebrow="ART Board"
        meta={<Badge tone="accent">{deps.length} dependências</Badge>}
        subtitle="Vínculos entre features de times diferentes, com status e caminho crítico."
        title="Dependências"
      >
        <Button
          icon="plus"
          onClick={() => modal.open(<NewDependencyModal onCreated={load} />)}
          size="md"
          variant="primary"
        >
          Nova dependência
        </Button>
      </PageHeader>
      {error && <ErrorState />}
      <SectionCard
        bodyStyle={{ padding: "12px 16px" }}
        icon="gitBranch"
        title="Registro de dependências"
        tone="accent"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {!(loading || error) && deps.length === 0 && (
            <span style={{ color: "var(--ink-muted)", fontSize: 13 }}>
              Nenhuma dependência registrada.
            </span>
          )}
          {deps.map((d) => {
            const tone = STATUS_TONE[d.status] ?? "neutral";
            return (
              <div
                key={d.id}
                style={{
                  alignItems: "center",
                  background: "var(--surface)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 12,
                  display: "flex",
                  gap: 12,
                  padding: "12px 16px",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      color: "var(--ink)",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    {d.title}
                  </div>
                  <div style={{ color: "var(--ink-faint)", fontSize: 11.5 }}>
                    {d.blockingTitle} → {d.blockedTitle}
                  </div>
                </div>
                {d.criticalPath && <Badge tone="red">Caminho crítico</Badge>}
                <Badge tone={tone}>{d.status}</Badge>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

export default function DependenciesScreen() {
  return (
    <ModalProvider>
      <DependenciesBody />
    </ModalProvider>
  );
}
