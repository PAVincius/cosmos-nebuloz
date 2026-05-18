"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { updateProfile } from "../../../actions/users/profile";
import { SaveIcon, LoaderIcon } from "lucide-react";

type ProfileFormProps = {
  name: string | null;
  image: string | null;
};

export function ProfileForm({ name, image }: ProfileFormProps) {
  const [nameValue, setNameValue] = useState(name ?? "");
  const [imageValue, setImageValue] = useState(image ?? "");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        await updateProfile({ name: nameValue, image: imageValue });
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar perfil.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Informações Pessoais</CardTitle>
        <CardDescription>Atualize seu nome e foto de perfil.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              placeholder="Seu nome completo"
              disabled={isPending}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image">URL do Avatar</Label>
            <Input
              id="image"
              value={imageValue}
              onChange={(e) => setImageValue(e.target.value)}
              placeholder="https://..."
              disabled={isPending}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">Perfil atualizado com sucesso!</p>}
          <Button type="submit" disabled={isPending} className="gap-2">
            {isPending ? (
              <LoaderIcon className="size-4 animate-spin" />
            ) : (
              <SaveIcon className="size-4" />
            )}
            Salvar Alterações
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
