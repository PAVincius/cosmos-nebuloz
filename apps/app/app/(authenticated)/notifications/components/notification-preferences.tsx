"use client";

import { useState } from "react";
import { SlidersHorizontalIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { Switch } from "@repo/design-system/components/ui/switch";
import { Label } from "@repo/design-system/components/ui/label";
import { Separator } from "@repo/design-system/components/ui/separator";

type Category = {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
};

const CATEGORIES: Category[] = [
  { id: "approvals",    label: "Aprovações de Épico",   description: "Solicitações de aprovação e mudanças de estado de governança",     defaultEnabled: true },
  { id: "risks",        label: "Riscos e ROAM",          description: "Novos riscos atribuídos, mudanças de status ROAM",                  defaultEnabled: true },
  { id: "pi_events",   label: "Eventos de PI",           description: "Início/fim de PI, confidence votes, mudanças de objetivo",          defaultEnabled: true },
  { id: "impediments", label: "Impedimentos",            description: "Impedimentos abertos no seu time e alertas de escalação",            defaultEnabled: true },
  { id: "mentions",    label: "Menções",                 description: "Quando alguém mencionar você em comentários ou objetivos",           defaultEnabled: true },
  { id: "budgets",     label: "Alertas de Budget",       description: "Lean Budgets próximos ao limite ou acima do guardrail",             defaultEnabled: false },
  { id: "flow",        label: "Flow Metrics",            description: "Alertas de Flow Load alto ou queda brusca de Predictability",       defaultEnabled: false },
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
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontalIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Preferências de notificação</span>
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
            <p className="text-xs text-muted-foreground">
              Controle quais categorias de notificação você deseja receber. Canais adicionais (email, Slack) em breve.
            </p>
          </div>
          <Separator />
          <div className="divide-y">
            {CATEGORIES.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <Label htmlFor={`pref-${cat.id}`} className="text-sm font-medium cursor-pointer">
                    {cat.label}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                </div>
                <Switch
                  id={`pref-${cat.id}`}
                  checked={prefs[cat.id] ?? false}
                  onCheckedChange={() => toggle(cat.id)}
                />
              </div>
            ))}
          </div>
          <div className="border-t px-4 py-3 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Persistência de preferências em breve — configurações aplicadas nesta sessão.
            </p>
            <Button size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
              Fechar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
