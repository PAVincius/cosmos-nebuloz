"use client";

import { useRouter } from "next/navigation";
import { SeletorDePeriodo } from "@/components/seletor-de-periodo";
import {
  type Intervalo,
  PRESETS_CAIXA,
  PRESETS_COMPETENCIA,
} from "@/lib/empresa/periodo";

/**
 * Ponte cliente entre `SeletorDePeriodo` e a URL da página server de
 * Financeiro: cada aba tem seu próprio padrão e presets (spec 2026-09-06 §6),
 * então quem aplica o intervalo precisa saber para qual aba está navegando.
 *
 * Os presets são escolhidos AQUI, e não recebidos por prop, porque cada
 * `Preset` carrega `intervalo` como função: passar o array de um server
 * component para um client component quebra a serialização do RSC em runtime
 * ("Functions cannot be passed directly to Client Components"). O tipo não
 * denuncia isso — o teste presets-no-servidor.test.ts denuncia.
 */
export function SeletorDaAba({
  aba,
  valor,
}: {
  aba: "dre" | "caixa";
  valor: Intervalo;
}) {
  const router = useRouter();
  const presets = aba === "caixa" ? PRESETS_CAIXA : PRESETS_COMPETENCIA;
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
