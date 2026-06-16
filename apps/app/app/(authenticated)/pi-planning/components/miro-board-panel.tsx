"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { ExternalLinkIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveMiroBoardUrl } from "@/app/actions/arts/pi-plans";

type Props = {
  piPlanId: string;
  initialUrl: string | null;
};

function toEmbedUrl(raw: string): string {
  // Convert share URL https://miro.com/app/board/... to embed URL
  const match = raw.match(/miro\.com\/app\/board\/([^/?#]+)/);
  if (match) {
    return `https://miro.com/app/live-embed/${match[1]}/`;
  }
  // Already an embed URL or custom — return as-is
  return raw;
}

export function MiroBoardPanel({ piPlanId, initialUrl }: Props) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [savedUrl, setSavedUrl] = useState(initialUrl);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const trimmed = url.trim() || null;
    startTransition(async () => {
      const result = await saveMiroBoardUrl(piPlanId, trimmed);
      if (result.ok) {
        setSavedUrl(trimmed);
        toast.success("URL do Miro salvo");
      } else {
        toast.error("Erro ao salvar URL do Miro");
      }
    });
  }

  const embedUrl = savedUrl ? toEmbedUrl(savedUrl) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="miro-url">URL do Miro Board</Label>
          <Input
            id="miro-url"
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://miro.com/app/board/..."
            value={url}
          />
        </div>
        <Button
          disabled={isPending || url.trim() === (savedUrl ?? "")}
          onClick={handleSave}
          size="sm"
          variant="secondary"
        >
          {isPending ? "Salvando…" : "Salvar"}
        </Button>
        {savedUrl && (
          <a
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-3 py-2 text-sm hover:bg-muted"
            href={savedUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            <ExternalLinkIcon className="h-4 w-4" />
            Abrir
          </a>
        )}
      </div>

      {embedUrl ? (
        <div className="overflow-hidden rounded-lg border">
          <iframe
            allow="fullscreen; clipboard-read; clipboard-write"
            allowFullScreen
            className="h-[560px] w-full"
            src={embedUrl}
            title="Miro Board"
          />
        </div>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
          Cole a URL do Miro Board acima para incorporar o quadro aqui.
        </div>
      )}
    </div>
  );
}
