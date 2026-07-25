"use client";

import { CheckCircle2Icon, ShieldCheckIcon, XCircleIcon } from "lucide-react";

export type HealthCheckData = {
  hasPortfolio: boolean;
  hasART: boolean;
  hasPI: boolean;
  hasTeam: boolean;
  hasUsers: boolean;
};

type Props = {
  data: HealthCheckData;
};

export function StepHealthCheck({ data }: Props) {
  const items: { label: string; ok: boolean }[] = [
    { label: "Nome do portfólio definido", ok: data.hasPortfolio },
    { label: "Pelo menos 1 ART configurado", ok: data.hasART },
    { label: "PI Planning configurado", ok: data.hasPI },
    { label: "Pelo menos 1 time criado", ok: data.hasTeam },
    { label: "Usuários convidados", ok: data.hasUsers },
  ];
  const allGood = items.every((i) => i.ok);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <ShieldCheckIcon className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="font-semibold text-lg">Checklist final</h2>
          <p className="text-muted-foreground text-sm">
            Verifique se a estrutura SAFe mínima está configurada.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <div className="flex items-center gap-3" key={item.label}>
            {item.ok ? (
              <CheckCircle2Icon className="h-5 w-5 shrink-0 text-green-500" />
            ) : (
              <XCircleIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
            )}
            <span
              className={item.ok ? "text-foreground" : "text-muted-foreground"}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {allGood ? (
        <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-green-600 text-sm">
          Estrutura mínima completa. Clique em &ldquo;Concluir setup&rdquo; para
          começar.
        </div>
      ) : (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 text-sm text-yellow-700">
          Alguns itens estão pendentes. Você pode concluir e configurar depois.
        </div>
      )}
    </div>
  );
}
