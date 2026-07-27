"use client";

import type { ArtifactMetadata } from "@repo/storage";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteArtifact } from "@/app/actions/artifacts";
import { ArtifactViewer } from "./artifact-viewer";

const TYPE_LABELS: Record<string, string> = {
  prompt: "Prompt",
  prd: "PRD",
  spec: "Spec",
  playbook: "Playbook",
  transcript: "Transcrição",
};

type Props = { initialArtifacts: ArtifactMetadata[] };

export function ArtifactBrowser({ initialArtifacts }: Props) {
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleDelete = (id: string) => {
    startTransition(async () => {
      const result = await deleteArtifact(id);
      if (result.ok) {
        setArtifacts((prev) => prev.filter((a) => a.id !== id));
        if (selectedId === id) {
          setSelectedId(null);
        }
        toast.success("Artefato removido");
      } else {
        toast.error("Erro ao remover artefato");
      }
    });
  };

  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-muted-foreground">Nenhum artefato ainda.</p>
        <p className="text-muted-foreground text-sm">
          Gere prompts de implementação nos épicos para ver artefatos aqui.
        </p>
      </div>
    );
  }

  const selected = artifacts.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-2">
        {artifacts.map((artifact) => (
          <button
            className={`w-full rounded-lg border p-3 text-left transition-colors ${
              selectedId === artifact.id
                ? "border-primary bg-primary/5"
                : "border-border hover:bg-muted"
            }`}
            key={artifact.id}
            onClick={() => setSelectedId(artifact.id)}
            type="button"
          >
            <div className="flex items-center justify-between">
              <span className="truncate font-medium text-sm">
                {artifact.title}
              </span>
              <span className="ml-2 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                {TYPE_LABELS[artifact.type] ?? artifact.type}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              {new Date(artifact.createdAt).toLocaleDateString("pt-BR")}
            </p>
            <button
              className="mt-1 text-[10px] text-red-500 hover:text-red-700"
              disabled={isPending}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(artifact.id);
              }}
              type="button"
            >
              Remover
            </button>
          </button>
        ))}
      </div>

      <div className="lg:col-span-2">
        {selected ? (
          <ArtifactViewer artifact={selected} />
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed p-8 text-center text-muted-foreground text-sm">
            Selecione um artefato para visualizar
          </div>
        )}
      </div>
    </div>
  );
}
