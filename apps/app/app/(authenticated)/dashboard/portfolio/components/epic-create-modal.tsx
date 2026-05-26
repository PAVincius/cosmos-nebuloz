"use client";

import { createEpic } from "@/app/actions/epics/create-epic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { useState, useTransition } from "react";

type Theme = { id: string; title: string; color: string };

type Props = {
  statusId: string;
  onClose: () => void;
  onCreated: (epic: { id: string; title: string; statusId: string; order: number }) => void;
  themes: Theme[];
};

export function EpicCreateModal({ statusId, onClose, onCreated, themes }: Props) {
  const [title, setTitle] = useState("");
  const [themeId, setThemeId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      const result = await createEpic({
        title: title.trim(),
        statusId,
        strategicThemeId: themeId,
      });
      if (result.ok && result.data) {
        onCreated(result.data);
        onClose();
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Épico</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            autoFocus
            placeholder="Título do épico…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isPending}
          />
          {themes.length > 0 && (
            <Select onValueChange={(v) => setThemeId(v === "none" ? null : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Tema estratégico (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem tema</SelectItem>
                {themes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.title}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !title.trim()}>
              {isPending ? "Criando…" : "Criar Épico"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
