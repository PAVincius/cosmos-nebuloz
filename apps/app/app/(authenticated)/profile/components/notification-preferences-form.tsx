"use client";

import { useState, useTransition } from "react";
import { Button } from "@repo/design-system/components/ui/button";
import { Checkbox } from "@repo/design-system/components/ui/checkbox";
import { Label } from "@repo/design-system/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import { updateNotificationPreferences } from "../../../actions/users/profile";
import { SaveIcon, LoaderIcon } from "lucide-react";

const NOTIFICATION_TYPES = [
  { key: "pi_planning", label: "PI Planning", description: "Sessões de planejamento e votações de confiança" },
  { key: "risk_alerts", label: "Alertas de Risco", description: "Novos riscos identificados e mudanças de status" },
  { key: "feature_updates", label: "Atualizações de Features", description: "Mudanças em features que você é responsável" },
  { key: "team_changes", label: "Mudanças de Time", description: "Alterações em membros e configurações do time" },
  { key: "weekly_digest", label: "Resumo Semanal", description: "Relatório semanal de atividades do workspace" },
] as const;

type NotificationPrefsFormProps = {
  initialPrefs: Record<string, boolean>;
};

export function NotificationPreferencesForm({ initialPrefs }: NotificationPrefsFormProps) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initialPrefs);
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (key: string, checked: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: checked }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        await updateNotificationPreferences(prefs);
        setSuccess(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar preferências.");
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferências de Notificação</CardTitle>
        <CardDescription>Escolha quais notificações você deseja receber.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            {NOTIFICATION_TYPES.map(({ key, label, description }) => (
              <div key={key} className="flex items-start gap-3">
                <Checkbox
                  id={key}
                  checked={prefs[key] ?? false}
                  onCheckedChange={(checked) => handleToggle(key, !!checked)}
                  disabled={isPending}
                  className="mt-0.5"
                />
                <div className="space-y-0.5">
                  <Label htmlFor={key} className="cursor-pointer font-medium">
                    {label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && <p className="text-sm text-green-600">Preferências salvas!</p>}
          <Button type="submit" disabled={isPending} size="sm" className="gap-2">
            {isPending ? (
              <LoaderIcon className="size-4 animate-spin" />
            ) : (
              <SaveIcon className="size-4" />
            )}
            Salvar Preferências
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
