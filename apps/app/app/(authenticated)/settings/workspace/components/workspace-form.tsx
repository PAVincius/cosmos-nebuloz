"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { updateWorkspace } from "../../../../actions/settings/workspace";
import { SaveIcon, LoaderIcon, BuildingIcon } from "lucide-react";

type WorkspaceFormProps = {
  name: string;
  slug: string;
  logo: string | null;
  isAdmin: boolean;
};

export function WorkspaceForm({ name, slug, logo, isAdmin }: WorkspaceFormProps) {
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
        await updateWorkspace({ name: nameValue, slug: slugValue, logo: logoValue });
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar workspace.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BuildingIcon className="size-4" />
          Configurações do Workspace
        </CardTitle>
        <CardDescription>Informações gerais do seu workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ws-name">Nome do Workspace</Label>
            <Input
              id="ws-name"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              placeholder="Minha Organização"
              disabled={!isAdmin || isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-slug">Slug (URL)</Label>
            <Input
              id="ws-slug"
              value={slugValue}
              onChange={(e) => setSlugValue(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="minha-org"
              disabled={!isAdmin || isPending}
            />
            <p className="text-xs text-muted-foreground">Apenas letras minúsculas, números e hífens.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ws-logo">URL do Logo</Label>
            <Input
              id="ws-logo"
              value={logoValue}
              onChange={(e) => setLogoValue(e.target.value)}
              placeholder="https://..."
              disabled={!isAdmin || isPending}
            />
          </div>
          {!isAdmin && (
            <p className="text-xs text-muted-foreground">Apenas administradores podem editar as configurações do workspace.</p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">Workspace atualizado!</p>}
          {isAdmin && (
            <Button type="submit" disabled={isPending} className="gap-2">
              {isPending ? (
                <LoaderIcon className="size-4 animate-spin" />
              ) : (
                <SaveIcon className="size-4" />
              )}
              Salvar Workspace
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
