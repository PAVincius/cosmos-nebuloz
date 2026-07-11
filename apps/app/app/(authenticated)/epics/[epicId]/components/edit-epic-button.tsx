"use client";

import { PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { updateEpic } from "@/app/actions/epics/update-epic";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";

const STATUS_OPTIONS = [
  { value: "BACKLOG", label: "Backlog" },
  { value: "REVIEW", label: "Review" },
  { value: "ANALYSIS", label: "Analysis" },
  { value: "IMPLEMENTING", label: "Implementing" },
  { value: "DONE", label: "Done" },
] as const;

type ThemeOption = { id: string; title: string };

type EditEpicButtonProps = {
  epicId: string;
  title: string;
  statusId: string;
  strategicThemeId: string | null;
  dueDate: string | null;
  themes: ThemeOption[];
};

const FIELD_LABEL_STYLE: React.CSSProperties = {
  display: "block",
  marginBottom: 6,
  fontSize: 11,
  fontWeight: 600,
  color: "var(--ink-faint)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
};

const FIELD_INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: "var(--cosmos-r-md)",
  border: "1px solid var(--hairline)",
  background: "var(--surface-2)",
  color: "var(--ink)",
  fontSize: 13,
};

export function EditEpicButton({
  epicId,
  title,
  statusId,
  strategicThemeId,
  dueDate,
  themes,
}: EditEpicButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState(title);
  const [formStatusId, setFormStatusId] = useState(statusId);
  const [formThemeId, setFormThemeId] = useState(strategicThemeId ?? "");
  const [formDueDate, setFormDueDate] = useState(dueDate ?? "");

  function handleClose() {
    if (isPending) return;
    setOpen(false);
    setError(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateEpic({
        epicId,
        title: formTitle,
        statusId: formStatusId,
        strategicThemeId: formThemeId || null,
        dueDate: formDueDate ? new Date(formDueDate).toISOString() : null,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 14px",
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          background: "var(--surface-3)",
          border: "1px solid var(--hairline)",
          color: "var(--ink-muted)",
        }}
      >
        <PencilIcon style={{ width: 14, height: 14 }} />
        Editar
      </button>

      <ModalShell
        eyebrow={`EP-${epicId.slice(-4).toUpperCase()}`}
        onClose={handleClose}
        open={open}
        title="Editar Épico"
        footer={
          <>
            <button
              disabled={isPending}
              onClick={handleClose}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: "var(--surface-2)",
                border: "1px solid var(--hairline)",
                color: "var(--ink-muted)",
              }}
              type="button"
            >
              Cancelar
            </button>
            <button
              disabled={isPending}
              form="edit-epic-form"
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                background: "var(--accent-c)",
                border: "none",
                color: "#03050a",
                opacity: isPending ? 0.7 : 1,
              }}
              type="submit"
            >
              {isPending ? "A guardar…" : "Guardar"}
            </button>
          </>
        }
      >
        <form
          id="edit-epic-form"
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div>
            <label htmlFor="epic-title" style={FIELD_LABEL_STYLE}>
              Título
            </label>
            <input
              id="epic-title"
              maxLength={200}
              onChange={(event) => setFormTitle(event.target.value)}
              required
              style={FIELD_INPUT_STYLE}
              type="text"
              value={formTitle}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label htmlFor="epic-theme" style={FIELD_LABEL_STYLE}>
                Strategic Theme
              </label>
              <select
                id="epic-theme"
                onChange={(event) => setFormThemeId(event.target.value)}
                style={FIELD_INPUT_STYLE}
                value={formThemeId}
              >
                <option value="">— Nenhum —</option>
                {themes.map((theme) => (
                  <option key={theme.id} value={theme.id}>
                    {theme.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="epic-status" style={FIELD_LABEL_STYLE}>
                Status
              </label>
              <select
                id="epic-status"
                onChange={(event) => setFormStatusId(event.target.value)}
                style={FIELD_INPUT_STYLE}
                value={formStatusId}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="epic-due-date" style={FIELD_LABEL_STYLE}>
              Due date
            </label>
            <input
              id="epic-due-date"
              onChange={(event) => setFormDueDate(event.target.value)}
              style={FIELD_INPUT_STYLE}
              type="date"
              value={formDueDate}
            />
          </div>

          {error && (
            <p style={{ fontSize: 12.5, color: "var(--red-text)", margin: 0 }}>
              {error}
            </p>
          )}
        </form>
      </ModalShell>
    </>
  );
}
