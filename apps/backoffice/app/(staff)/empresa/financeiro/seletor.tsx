"use client";

import { useRouter } from "next/navigation";
import { SeletorDePeriodo } from "@/components/seletor-de-periodo";
import type { Intervalo, Preset } from "@/lib/empresa/periodo";

/**
 * Ponte cliente entre `SeletorDePeriodo` e a URL da página server de
 * Financeiro: cada aba tem seu próprio padrão e presets (spec 2026-09-06 §6),
 * então quem aplica o intervalo precisa saber para qual aba está navegando.
 */
export function SeletorDaAba({
  aba,
  valor,
  presets,
}: {
  aba: "dre" | "caixa";
  valor: Intervalo;
  presets: Preset[];
}) {
  const router = useRouter();
  return (
    <SeletorDePeriodo
      onAplicar={(i) =>
        router.push(`/empresa/financeiro?aba=${aba}&de=${i.de}&ate=${i.ate}`)
      }
      presets={presets}
      valor={valor}
    />
  );
}
