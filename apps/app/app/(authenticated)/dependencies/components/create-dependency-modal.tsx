"use client";

import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type FormEvent,
  type ReactNode,
  useState,
  useTransition,
} from "react";
import { createDependency } from "@/app/actions/dependencies";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";
import type { DependenciesEpic } from "./dependency-dashboard";

export type CreateDependencyModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  epics: DependenciesEpic[];
};

const FIELD_STYLE: CSSProperties = {
  background: "var(--surface-2)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-sm)",
  color: "var(--ink)",
  fontSize: 13,
  padding: "9px 10px",
  width: "100%",
};

const LABEL_STYLE: CSSProperties = {
  color: "var(--ink-subtle)",
  fontSize: 11.5,
  fontWeight: 600,
  marginBottom: 5,
};

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      <span style={LABEL_STYLE}>{label}</span>
      {children}
    </label>
  );
}

export function CreateDependencyModal({ open, onOpenChange, epics }: CreateDependencyModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const features = epics.flatMap((epic) =>
    epic.features.map((feature) => ({ ...feature, epicTitle: epic.title }))
  );

  function handleClose() {
    setError(null);
    onOpenChange(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const raw = {
      blockingFeatureId: formData.get("blockingFeatureId"),
      blockedFeatureId: formData.get("blockedFeatureId"),
      description: formData.get("description") || undefined,
      status: formData.get("status"),
      type: formData.get("type"),
      severity: formData.get("severity"),
      dueDate: formData.get("dueDate") || undefined,
    };

    startTransition(async () => {
      try {
        await createDependency(raw);
        router.refresh();
        handleClose();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Não foi possível mapear a dependência.");
      }
    });
  }

  return (
    <ModalShell
      eyebrow="Feature → Feature"
      footer={
        <>
          <button
            className="rounded-md border border-hairline bg-surface-2 px-3.5 py-2 font-semibold text-ink-subtle text-xs hover:bg-surface-3"
            onClick={handleClose}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="rounded-md px-3.5 py-2 font-semibold text-xs disabled:opacity-50"
            disabled={isPending}
            form="create-dependency-form"
            style={{ background: "var(--accent-c)", color: "var(--on-accent)" }}
            type="submit"
          >
            {isPending ? "Mapeando…" : "Mapear dependência"}
          </button>
        </>
      }
      onClose={handleClose}
      open={open}
      size="md"
      title="Mapear dependência"
    >
      <form
        id="create-dependency-form"
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <Field label="Feature bloqueadora">
          <select name="blockingFeatureId" required style={FIELD_STYLE}>
            <option value="">Selecione…</option>
            {features.map((feature) => (
              <option key={feature.id} value={feature.id}>
                {feature.epicTitle} · {feature.title}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Feature bloqueada">
          <select name="blockedFeatureId" required style={FIELD_STYLE}>
            <option value="">Selecione…</option>
            {features.map((feature) => (
              <option key={feature.id} value={feature.id}>
                {feature.epicTitle} · {feature.title}
              </option>
            ))}
          </select>
        </Field>

        <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(3, 1fr)" }}>
          <Field label="Status">
            <select defaultValue="not-started" name="status" style={FIELD_STYLE}>
              <option value="not-started">Não iniciada</option>
              <option value="on-track">No prazo</option>
              <option value="at-risk">Em risco</option>
              <option value="blocked">Bloqueada</option>
              <option value="completed">Concluída</option>
            </select>
          </Field>
          <Field label="Tipo">
            <select defaultValue="technical" name="type" style={FIELD_STYLE}>
              <option value="technical">Técnico</option>
              <option value="business">Negócio</option>
              <option value="organizational">Organizacional</option>
              <option value="external">Externo</option>
            </select>
          </Field>
          <Field label="Severidade">
            <select defaultValue="medium" name="severity" style={FIELD_STYLE}>
              <option value="critical">Crítica</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </Field>
        </div>

        <Field label="Prazo combinado (opcional)">
          <input name="dueDate" style={FIELD_STYLE} type="date" />
        </Field>

        <Field label="Descrição (opcional)">
          <textarea
            name="description"
            rows={3}
            style={{ ...FIELD_STYLE, resize: "vertical" }}
          />
        </Field>

        {error ? (
          <div style={{ color: "var(--red-text)", fontSize: 12 }} role="alert">
            {error}
          </div>
        ) : null}
      </form>
    </ModalShell>
  );
}
