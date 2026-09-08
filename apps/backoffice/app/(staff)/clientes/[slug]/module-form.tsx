"use client";

import type { ProductModule } from "@repo/database";
import { useState, useTransition } from "react";
import { contractModuleAction } from "@/app/actions/provisioning";
import { BotaoSecundario, Erro } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";

const STATUSES = ["ACTIVE", "TRIAL", "SUSPENDED", "CANCELED"] as const;

/** Liberar acesso é reversível e barato de errar: segue como clique direto.
 *  Cortar acesso chega ao cliente em segundos e não tem desfazer. */
const CORTAM_O_CLIENTE = new Set(["SUSPENDED", "CANCELED"]);

const CONSEQUENCIA: Record<string, string> = {
  SUSPENDED:
    "O cliente perde acesso ao módulo agora. Quem estiver usando é interrompido na próxima requisição.",
  CANCELED:
    "O cliente perde acesso ao módulo e o contrato passa a constar como encerrado.",
};

const CELULA: React.CSSProperties = {
  padding: "10px 0",
  borderBottom: "1px solid var(--hairline)",
  fontSize: "var(--fs-base)",
};

type ModuleRow = { module: string; status: string; expiresAt: string | null };

export function ModuleForm({
  slug,
  modules,
  modulos,
}: {
  slug: string;
  modules: ModuleRow[];
  modulos: ProductModule[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const apply = (module: ProductModule, status: (typeof STATUSES)[number]) =>
    startTransition(async () => {
      setError(null);
      const result = await contractModuleAction({ slug, module, status });
      if (!result.ok) {
        setError(result.error);
      }
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {error ? <Erro>{error}</Erro> : null}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {modulos.map((module) => {
            const current = modules.find((m) => m.module === module);
            return (
              <tr key={module}>
                <td style={{ ...CELULA, fontWeight: 700 }}>{module}</td>
                <td
                  className="mono"
                  style={{
                    ...CELULA,
                    fontSize: "var(--fs-nota)",
                    color: "var(--ink-faint)",
                  }}
                >
                  {current?.status ?? "não contratado"}
                </td>
                <td style={{ ...CELULA, textAlign: "right" }}>
                  <span
                    style={{
                      display: "inline-flex",
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                      gap: 6,
                    }}
                  >
                    {STATUSES.map((status) =>
                      CORTAM_O_CLIENTE.has(status) ? (
                        <ConfirmarAcao
                          alvo={`${module} · ${slug}`}
                          consequencia={CONSEQUENCIA[status]}
                          executando={pending}
                          key={status}
                          onConfirmar={() => apply(module, status)}
                          rotulo={status}
                        />
                      ) : (
                        <BotaoSecundario
                          disabled={pending || current?.status === status}
                          key={status}
                          onClick={() => apply(module, status)}
                          rotulo={`Definir ${module} para ${status}`}
                        >
                          {status}
                        </BotaoSecundario>
                      )
                    )}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
