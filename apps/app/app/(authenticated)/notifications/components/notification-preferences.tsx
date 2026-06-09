"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Label } from "@repo/design-system/components/ui/label";
import { Separator } from "@repo/design-system/components/ui/separator";
import { Switch } from "@repo/design-system/components/ui/switch";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  SlidersHorizontalIcon,
} from "lucide-react";
import { useState } from "react";

type Category = {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
};

const CATEGORIES: Category[] = [
  {
    id: "approvals",
    label: "Aprovações de Épico",
    description: "Solicitações de aprovação e mudanças de estado de governança",
    defaultEnabled: true,
  },
  {
    id: "risks",
    label: "Riscos e ROAM",
    description: "Novos riscos atribuídos, mudanças de status ROAM",
    defaultEnabled: true,
  },
  {
    id: "pi_events",
    label: "Eventos de PI",
    description: "Início/fim de PI, confidence votes, mudanças de objetivo",
    defaultEnabled: true,
  },
  {
    id: "impediments",
    label: "Impedimentos",
    description: "Impedimentos abertos no seu time e alertas de escalação",
    defaultEnabled: true,
  },
  {
    id: "mentions",
    label: "Menções",
    description: "Quando alguém mencionar você em comentários ou objetivos",
    defaultEnabled: true,
  },
  {
    id: "budgets",
    label: "Alertas de Budget",
    description: "Lean Budgets próximos ao limite ou acima do guardrail",
    defaultEnabled: false,
  },
  {
    id: "flow",
    label: "Flow Metrics",
    description: "Alertas de Flow Load alto ou queda brusca de Predictability",
    defaultEnabled: false,
  },
];

export function NotificationPreferences() {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map((c) => [c.id, c.defaultEnabled]))
  );

  function toggle(id: string) {
    setPrefs((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="rounded-lg border">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/30"
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontalIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-sm">
            Preferências de notificação
          </span>
        </div>
        {open ? (
          <ChevronUpIcon className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t">
          <div className="px-4 py-2">
            <p className="text-muted-foreground text-xs">
              Controle quais categorias de notificação você deseja receber.
              Canais adicionais (email, Slack) em breve.
            </p>
          </div>
          <Separator />
          <div className="divide-y">
            {CATEGORIES.map((cat) => (
              <div
                className="flex items-center justify-between gap-4 px-4 py-3"
                key={cat.id}
              >
                <div className="min-w-0 flex-1">
                  <Label
                    className="cursor-pointer font-medium text-sm"
                    htmlFor={`pref-${cat.id}`}
                  >
                    {cat.label}
                  </Label>
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    {cat.description}
                  </p>
                </div>
                <Switch
                  checked={prefs[cat.id] ?? false}
                  id={`pref-${cat.id}`}
                  onCheckedChange={() => toggle(cat.id)}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-3 border-t px-4 py-3">
            <p className="text-muted-foreground text-xs">
              Persistência de preferências em breve — configurações aplicadas
              nesta sessão.
            </p>
            <Button
              className="h-7 text-xs"
              onClick={() => setOpen(false)}
              size="sm"
            >
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
