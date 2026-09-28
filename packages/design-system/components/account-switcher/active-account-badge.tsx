import { cn } from "@repo/design-system/lib/utils";
import type { CSSProperties } from "react";

export type ActiveAccountBadgeProps = {
  name: string;
  className?: string;
  /** Cada shell tem seu próprio sistema visual (CSS vars por produto); o
   *  componente não impõe cor/tamanho — só garante que o nome é texto. */
  style?: CSSProperties;
};

/**
 * Nome da conta ativa, sempre como texto na tela — nunca só em `title`
 * (FR-001). Causa direta do incidente do dogfood: o Meridian mostrava a
 * conta só em tooltip, e um diagnóstico foi criado na conta errada.
 */
export function ActiveAccountBadge({
  name,
  className,
  style,
}: ActiveAccountBadgeProps) {
  return (
    <span
      className={cn("truncate font-medium text-sm", className)}
      data-testid="active-account-badge"
      style={style}
    >
      {name}
    </span>
  );
}
