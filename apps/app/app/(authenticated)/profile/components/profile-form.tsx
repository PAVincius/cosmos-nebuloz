"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { LoaderIcon, SaveIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { updateProfile } from "../../../actions/users/profile";

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
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              disabled={isPending}
              id="name"
              onChange={(e) => setNameValue(e.target.value)}
              placeholder="Seu nome completo"
              value={nameValue}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image">URL do Avatar</Label>
            <Input
              disabled={isPending}
              id="image"
              onChange={(e) => setImageValue(e.target.value)}
              placeholder="https://..."
              value={imageValue}
            />
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          {success && (
            <p className="text-green-600 text-sm">
              Perfil atualizado com sucesso!
            </p>
          )}
          <Button className="gap-2" disabled={isPending} type="submit">
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
