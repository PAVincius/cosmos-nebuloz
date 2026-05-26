"use client";

import type { ArtifactMetadata } from "@repo/storage";

type Props = { artifact: ArtifactMetadata };

const TYPE_LABELS: Record<string, string> = {
  prompt: "Prompt",
  prd: "PRD",
  spec: "Spec",
  playbook: "Playbook",
  transcript: "Transcrição",
};

export function ArtifactViewer({ artifact }: Props) {
  return (
    <div className="rounded-lg border p-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg">{artifact.title}</h2>
          <p className="text-muted-foreground text-xs">
            {TYPE_LABELS[artifact.type] ?? artifact.type}
            {" · "}
            {new Date(artifact.createdAt).toLocaleString("pt-BR")}
            {" · "}
            {Math.round(artifact.sizeBytes / 1024)}KB comprimido
          </p>
        </div>
      </div>
      <p className="text-muted-foreground text-sm">
        Conteúdo armazenado no Supabase Storage (caminho: {artifact.storagePath}).
        Download direto em breve.
      </p>
    </div>
  );
}
