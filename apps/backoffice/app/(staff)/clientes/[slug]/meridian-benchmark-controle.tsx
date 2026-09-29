"use client";

import { useState, useTransition } from "react";
import { setMeridianBenchmarkAction } from "@/app/actions/meridian-benchmark";
import { Erro, INPUT } from "@/components/campo";
import { Confirmacao } from "@/components/confirmacao";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { MOTIVO_SOMENTE_LEITURA } from "@/components/write-button";
import { formatarData } from "@/lib/data";

type Estado = {
  enabled: boolean;
  agreementRef: string | null;
  updatedAt: string | null;
  isInternalTenant: boolean;
};

const NOTA = {
  margin: 0,
  fontSize: "var(--fs-nota)",
  color: "var(--ink-subtle)",
  lineHeight: 1.55,
} as const;

/**
 * Habilitação do benchmark anônimo do Meridian para este cliente
 * (specs/012-benchmark-travado-tenant). Desligada por padrão; só staff liga,
 * com a referência do aditivo (DPA §2.1) — tenant interno liga sem ela.
 * A action recusa staff de leitura e o escritor recusa a falta da referência;
 * o que a tela faz é dizer isso antes e depois do clique.
 */
export function MeridianBenchmarkControle({
  slug,
  estado,
  canWrite,
}: {
  slug: string;
  estado: Estado;
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [ref, setRef] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const referencia = ref.trim();
  // Tenant externo só liga com a referência do aditivo; interno liga sem.
  const faltaReferencia = estado.isInternalTenant ? false : referencia === "";

  const run = (enabled: boolean) =>
    startTransition(async () => {
      setError(null);
      setMessage(null);
      const result = await setMeridianBenchmarkAction({
        slug,
        enabled,
        agreementRef: enabled && referencia ? referencia : null,
      });

      if (result.ok) {
        setMessage(
          enabled
            ? "Benchmark ligado para este cliente."
            : "Benchmark desligado para este cliente."
        );
        return;
      }
      setError(result.error);
    });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: 16,
        borderRadius: "var(--r-md)",
        border: "1px solid var(--hairline)",
        background: "var(--surface-2)",
      }}
    >
      <p style={{ margin: 0, fontSize: "var(--fs-base)", fontWeight: 700 }}>
        Benchmark do Meridian
      </p>
      <p style={NOTA}>
        Autoriza os diagnósticos deste cliente a contribuir para o benchmark
        anônimo. Cada avaliação ainda precisa do próprio opt-in.
      </p>

      <p style={{ margin: 0, fontSize: "var(--fs-base)" }}>
        <strong>{estado.enabled ? "Ligado" : "Desligado"}</strong>
        {estado.agreementRef ? (
          <span style={{ color: "var(--ink-subtle)" }}>
            {" "}
            · aditivo <span className="mono">{estado.agreementRef}</span>
          </span>
        ) : null}
        {estado.updatedAt ? (
          <span style={{ color: "var(--ink-subtle)" }}>
            {" "}
            · alterado em {formatarData(estado.updatedAt)}
          </span>
        ) : null}
      </p>

      {error ? <Erro>{error}</Erro> : null}
      {message ? <Confirmacao>{message}</Confirmacao> : null}

      {estado.enabled ? (
        <div>
          <ConfirmarAcao
            alvo={slug}
            consequencia="Contribuições futuras ficam bloqueadas na hora. O que já contribuiu não é apagado."
            desabilitado={!canWrite || pending}
            executando={pending}
            onConfirmar={() => run(false)}
            rotulo="Desligar"
          />
        </div>
      ) : (
        <>
          {estado.isInternalTenant ? null : (
            <>
              <label className="sr-only" htmlFor="benchmark-agreement-ref">
                Referência do aditivo (DPA §2.1)
              </label>
              <input
                disabled={!canWrite}
                id="benchmark-agreement-ref"
                maxLength={200}
                onChange={(e) => setRef(e.target.value)}
                placeholder="referência do aditivo (DPA §2.1)"
                style={INPUT}
                type="text"
                value={ref}
              />
              <p style={NOTA}>
                Obrigatória para ligar um cliente: a referência do aditivo
                contratual assinado (DPA §2.1).
              </p>
            </>
          )}
          <div>
            <ConfirmarAcao
              alvo={slug}
              consequencia="Os diagnósticos deste cliente passam a poder contribuir para o benchmark anônimo, assessment por assessment."
              desabilitado={!canWrite || pending || faltaReferencia}
              executando={pending}
              onConfirmar={() => run(true)}
              rotulo="Ligar"
              tom="accent"
            />
          </div>
        </>
      )}

      {canWrite ? null : <p style={NOTA}>{MOTIVO_SOMENTE_LEITURA}</p>}
    </div>
  );
}
