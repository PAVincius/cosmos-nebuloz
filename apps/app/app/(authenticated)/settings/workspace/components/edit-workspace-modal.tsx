"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Loader2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { updateWorkspace } from "../../../../actions/settings/workspace";
import { ModalShell } from "../../../components/modal-shell";

type EditWorkspaceModalProps = {
  open: boolean;
  onClose: () => void;
  name: string;
  slug: string;
  logo: string | null;
};

export function EditWorkspaceModal({
  open,
  onClose,
  name,
  slug,
  logo,
}: EditWorkspaceModalProps) {
  const [nameValue, setNameValue] = useState(name);
  const [slugValue, setSlugValue] = useState(slug);
  const [logoValue, setLogoValue] = useState(logo ?? "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    setError(null);
    startTransition(async () => {
      try {
        await updateWorkspace({
          name: nameValue,
          slug: slugValue,
          logo: logoValue,
        });
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao salvar workspace."
        );
      }
    });
  };

  return (
    <ModalShell
      eyebrow="Workspace"
      onClose={onClose}
      open={open}
      size="md"
      title="Editar identidade do workspace"
      footer={
        <>
          <Button disabled={isPending} onClick={onClose} variant="outline">
            Cancelar
          </Button>
          <Button disabled={isPending} onClick={handleSubmit}>
            {isPending && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Salvar
          </Button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="space-y-2">
          <Label htmlFor="ws-name">Nome do workspace</Label>
          <Input
            disabled={isPending}
            id="ws-name"
            onChange={(e) => setNameValue(e.target.value)}
            placeholder="Minha Organização"
            value={nameValue}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ws-slug">Domínio</Label>
          <Input
            disabled={isPending}
            id="ws-slug"
            onChange={(e) =>
              setSlugValue(
                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-")
              )
            }
            placeholder="minha-org"
            value={slugValue}
          />
          <p className="text-muted-foreground text-xs">
            Apenas letras minúsculas, números e hífens.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ws-logo">URL do logo</Label>
          <Input
            disabled={isPending}
            id="ws-logo"
            onChange={(e) => setLogoValue(e.target.value)}
            placeholder="https://..."
            value={logoValue}
          />
        </div>
        {error && <p className="text-destructive text-sm">{error}</p>}
      </div>
    </ModalShell>
  );
}
