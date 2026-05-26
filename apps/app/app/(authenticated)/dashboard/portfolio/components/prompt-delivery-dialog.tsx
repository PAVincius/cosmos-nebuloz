"use client";

import { generateAndDeliverPrompt, type PromptTarget } from "@/app/actions/ai-prompt/generate-prompt";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Button } from "@repo/design-system/components/ui/button";
import { useState, useTransition } from "react";
import { toast } from "sonner";

const TARGETS: { value: PromptTarget; label: string; icon: string }[] = [
  { value: "cursor",      label: "Cursor",        icon: "⚡" },
  { value: "windsurf",    label: "Windsurf",      icon: "🏄" },
  { value: "vscode",      label: "VS Code/Cline", icon: "💻" },
  { value: "claude-code", label: "Claude Code",   icon: "◆" },
  { value: "claude-ai",   label: "Claude.ai",     icon: "🤖" },
  { value: "chatgpt",     label: "ChatGPT",       icon: "💬" },
  { value: "groq",        label: "Groq",          icon: "⚙" },
  { value: "gemini",      label: "Gemini",        icon: "✨" },
  { value: "perplexity",  label: "Perplexity",    icon: "🔍" },
];

type Props = {
  epicId: string;
  epicTitle: string;
  onClose: () => void;
};

export function PromptDeliveryDialog({ epicId, epicTitle, onClose }: Props) {
  const [selectedTarget, setSelectedTarget] = useState<PromptTarget>("cursor");
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleGenerate = () => {
    startTransition(async () => {
      const result = await generateAndDeliverPrompt({
        epicId,
        target: selectedTarget,
        ragDocIds: [],
      });

      if (!result.ok) {
        toast.error("Erro ao gerar prompt");
        return;
      }

      const { prompt, deepLink } = result.data;
      setGeneratedPrompt(prompt);

      try {
        await navigator.clipboard.writeText(prompt);
      } catch {
        // clipboard may not be available in all environments
      }
      window.open(deepLink, "_blank");

      const targetLabel = TARGETS.find((t) => t.value === selectedTarget)?.label ?? selectedTarget;
      toast.success(`Prompt copiado e ${targetLabel} aberto — cole com Ctrl+V`);
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Gerar Prompt — {epicTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Selecione o destino:</p>
          <div className="grid grid-cols-3 gap-2">
            {TARGETS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setSelectedTarget(t.value)}
                className={`flex items-center gap-2 rounded-lg border p-3 text-sm transition-colors ${
                  selectedTarget === t.value
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border hover:bg-muted"
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {generatedPrompt && (
            <details className="text-xs">
              <summary className="cursor-pointer text-muted-foreground">Ver prompt gerado</summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">
                {generatedPrompt}
              </pre>
            </details>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Fechar</Button>
            <Button onClick={handleGenerate} disabled={isPending}>
              {isPending ? "Gerando…" : "Gerar + Abrir"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
