"use client";

// policy-section-editor.tsx — o Textarea do corpo da seção, com Cancelar e
// Salvar. Extraído de `policy.tsx` (na baseline do size:guard) ao ganhar o
// guarda de trabalho não salvo: o editor em página é o lugar onde a digitação
// somia sem perguntar, e cabe num arquivo só seu.
//
// `onCancel` já chega guardado por `useUnsavedGuard` — este componente não
// decide se pergunta, só desenha.

import { Button } from "@repo/design-system/cosmos/kit";
import { Textarea } from "../base";
import { FS } from "../type-scale";

export function PolicySectionEditor({
  draft,
  onDraftChange,
  onCancel,
  onSave,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <Textarea
        onChange={(e) => onDraftChange(e.target.value)}
        style={{ minHeight: 190, fontSize: FS.base }}
        value={draft}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <Button onClick={onCancel} size="sm" variant="ghost">
          Cancelar
        </Button>
        <Button icon="check" onClick={onSave} size="sm">
          Salvar
        </Button>
      </div>
      <div style={{ fontSize: FS.nota, color: "var(--ink-faint)" }}>
        Editar uma seção publicada a rebaixa automaticamente para revisão — o
        texto alterado não é mais o texto aprovado.
      </div>
    </div>
  );
}
