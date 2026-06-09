"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { BuildingIcon, LoaderIcon, SaveIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { updateWorkspace } from "../../../../actions/settings/workspace";

type WorkspaceFormProps = {
  name: string;
  slug: string;
  logo: string | null;
  isAdmin: boolean;
};

export function WorkspaceForm({
  name,
  slug,
  logo,
  isAdmin,
}: WorkspaceFormProps) {
  const [nameValue, setNameValue] = useState(name);
  const [slugValue, setSlugValue] = useState(slug);
  const [logoValue, setLogoValue] = useState(logo ?? "");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        await updateWorkspace({
          name: nameValue,
          slug: slugValue,
          logo: logoValue,
        });
        setSuccess(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao salvar workspace."
        );
      }
    });
  };

  return (
    <div className="rounded-xl border border-hairline bg-surface shadow-[var(--card-shadow)]">
      <div className="border-hairline border-b bg-surface-2 px-5 py-4">
        <h2 className="flex items-center gap-2 font-semibold text-sm tracking-tight">
          <BuildingIcon className="size-4 text-primary" />
          Configurações do Workspace
        </h2>
        <p className="mt-1 text-muted-foreground text-xs">
          Informações gerais do seu workspace.
        </p>
      </div>
      <div className="p-5">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="ws-name">Nome do Workspace</Label>
            <Input
              disabled={!isAdmin || isPending}
              id="ws-name"
              onChange={(e) => setNameValue(e.target.value)}
              placeholder="Minha Organização"
              value={nameValue}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-slug">Slug (URL)</Label>
            <Input
              disabled={!isAdmin || isPending}
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
            <Label htmlFor="ws-logo">URL do Logo</Label>
            <Input
              disabled={!isAdmin || isPending}
              id="ws-logo"
              onChange={(e) => setLogoValue(e.target.value)}
              placeholder="https://..."
              value={logoValue}
            />
          </div>
          {!isAdmin && (
            <p className="text-muted-foreground text-xs">
              Apenas administradores podem editar as configurações do workspace.
            </p>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
          {success && (
            <p className="text-green-600 text-sm">Workspace atualizado!</p>
          )}
          {isAdmin && (
            <Button className="gap-2" disabled={isPending} type="submit">
              {isPending ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <SaveIcon className="size-4" />
              )}
              Salvar Workspace
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}
