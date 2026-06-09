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
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { PlusIcon, SaveIcon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { upsertLACE } from "../../../actions/lace";

type LACEData = {
  id: string;
  name: string;
  description: string | null;
  principles: unknown;
} | null;

export function LACEWorkspace({ initialLace }: { initialLace: LACEData }) {
  const router = useRouter();
  const [name, setName] = useState(initialLace?.name ?? "LACE");
  const [description, setDescription] = useState(
    initialLace?.description ?? ""
  );
  const [principles, setPrinciples] = useState<string[]>(
    Array.isArray(initialLace?.principles)
      ? (initialLace.principles as string[])
      : []
  );
  const [newPrinciple, setNewPrinciple] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function addPrinciple() {
    const trimmed = newPrinciple.trim();
    if (!trimmed || principles.includes(trimmed)) {
      return;
    }
    setPrinciples((prev) => [...prev, trimmed]);
    setNewPrinciple("");
  }

  function removePrinciple(index: number) {
    setPrinciples((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      try {
        await upsertLACE({
          name,
          description: description || undefined,
          principles,
        });
        setSuccess(true);
        router.refresh();
        setTimeout(() => setSuccess(false), 3000);
      } catch {
        setError("Erro ao salvar LACE. Tente novamente.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidade do LACE</CardTitle>
          <CardDescription>
            Configure o nome e a missão do seu Lean-Agile Center of Excellence.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lace-name">
              Nome <span className="text-destructive">*</span>
            </Label>
            <Input
              id="lace-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: LACE Central, CoE Agile..."
              value={name}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lace-description">Descrição / Missão</Label>
            <Textarea
              id="lace-description"
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva a missão e o propósito do LACE..."
              rows={3}
              value={description}
            />
          </div>
        </CardContent>
      </Card>

      {/* Lean-Agile Principles */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Princípios Lean-Agile</CardTitle>
          <CardDescription>
            Defina os princípios que guiam a adoção SAFe na organização.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {principles.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              Nenhum princípio definido ainda. Adicione os princípios Lean-Agile
              que guiam a organização.
            </p>
          ) : (
            <ol className="flex flex-col gap-2">
              {principles.map((principle, index) => (
                <li
                  className="flex items-start gap-3 rounded-lg border bg-muted/30 px-4 py-3"
                  key={index}
                >
                  <span className="mt-0.5 shrink-0 font-semibold text-primary text-sm">
                    {index + 1}.
                  </span>
                  <span className="flex-1 text-sm">{principle}</span>
                  <Button
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => removePrinciple(index)}
                    size="icon"
                    variant="ghost"
                  >
                    <Trash2Icon className="h-3.5 w-3.5" />
                  </Button>
                </li>
              ))}
            </ol>
          )}

          <div className="flex gap-2">
            <Input
              className="flex-1"
              onChange={(e) => setNewPrinciple(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPrinciple()}
              placeholder="ex: Tomar decisões econômicas..."
              value={newPrinciple}
            />
            <Button
              disabled={!newPrinciple.trim()}
              onClick={addPrinciple}
              size="icon"
              variant="outline"
            >
              <PlusIcon className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Actions */}
      <div className="flex items-center justify-between">
        <div>
          {error && <p className="text-destructive text-sm">{error}</p>}
          {success && (
            <p className="text-green-600 text-sm">LACE salvo com sucesso!</p>
          )}
        </div>
        <Button disabled={isPending || !name.trim()} onClick={handleSave}>
          <SaveIcon className="mr-2 h-4 w-4" />
          {isPending ? "Salvando..." : "Salvar LACE"}
        </Button>
      </div>
    </div>
  );
}
