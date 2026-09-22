"use client";

import type { ProductModule } from "@repo/database";
import { useState, useTransition } from "react";
import { contractModuleAction } from "@/app/actions/provisioning";
import { Erro } from "@/components/campo";
import { Confirmacao } from "@/components/confirmacao";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { MOTIVO_SOMENTE_LEITURA } from "@/components/write-button";

const STATUSES = ["ACTIVE", "TRIAL", "SUSPENDED", "CANCELED"] as const;

/** O enum vai para a action; a pessoa lê o rótulo — o mesmo de `abas/resumo.tsx`. */
const ROTULO_STATUS: Record<(typeof STATUSES)[number], string> = {
  ACTIVE: "Ativo",
  TRIAL: "Trial",
  SUSPENDED: "Suspenso",
  CANCELED: "Cancelado",
};

function rotuloDe(status: string): string {
  return ROTULO_STATUS[status as (typeof STATUSES)[number]] ?? status;
}

/** Cortar acesso chega ao cliente em segundos e não tem desfazer — tom
 *  vermelho. Liberar é reversível, mas também chega ao cliente em segundos e
 *  vai para a auditoria com o nome de quem clicou: decisão do dono, passa pela
 *  mesma barreira, em tom accent. */
const CORTAM_O_CLIENTE = new Set(["SUSPENDED", "CANCELED"]);

/** O que `contractModule` faz de verdade (packages/provisioning): grava o
 *  status, invalida o cache do gate (o acesso muda na próxima requisição) e
 *  registra na auditoria. Não há cobrança automática nem prazo: `expiresAt`
 *  fica nulo, então um trial não expira sozinho. */
const CONSEQUENCIA: Record<(typeof STATUSES)[number], string> = {
  ACTIVE:
    "O cliente ganha acesso ao módulo na próxima requisição, sem cobrança automática; fica na auditoria com o seu nome.",
  TRIAL:
    "O cliente ganha acesso ao módulo na próxima requisição. O trial não expira sozinho: encerrá-lo é outra troca aqui.",
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
  canWrite,
}: {
  slug: string;
  modules: ModuleRow[];
  modulos: ProductModule[];
  /** SRD FR-0.4 — MEMBER vê a tabela e não troca nada. A action recusa de
   *  novo no servidor; aqui o botão desabilita **com o motivo escrito**. */
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // A última troca gravada, em prosa — só na linha que agiu. Sem isto o
  // clique em "Trial" trocava o texto da célula e mais nada: quem não viu a
  // célula mudar não sabia se deu certo.
  const [confirmada, setConfirmada] = useState<{
    module: string;
    texto: string;
  } | null>(null);

  const apply = (module: ProductModule, status: (typeof STATUSES)[number]) =>
    startTransition(async () => {
      setError(null);
      setConfirmada(null);
      const result = await contractModuleAction({ slug, module, status });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setConfirmada({
        module,
        texto: `${module} de ${slug} agora está ${ROTULO_STATUS[status]}`,
      });
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Motivo do bloqueio em texto, uma vez — um botão desabilitado nem
          recebe foco, então `title` não chegaria a ninguém. */}
      {canWrite ? null : (
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-nota)",
            color: "var(--ink-muted)",
          }}
        >
          {MOTIVO_SOMENTE_LEITURA}
        </p>
      )}
      {error ? <Erro>{error}</Erro> : null}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {modulos.map((module) => {
            const current = modules.find((m) => m.module === module);
            // Cancelar o que não está contratado (ou já foi cancelado) não faz
            // nada — e um botão que não faz nada só assusta.
            const podeCancelar =
              current !== undefined && current.status !== "CANCELED";
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
                  {current ? rotuloDe(current.status) : "não contratado"}
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
                    {STATUSES.map((status) => {
                      if (status === "CANCELED" && !podeCancelar) {
                        return null;
                      }
                      return (
                        <ConfirmarAcao
                          alvo={`${module} · ${slug}`}
                          consequencia={CONSEQUENCIA[status]}
                          // O status vigente não é pergunta: o botão dele
                          // fica cinza, como antes.
                          desabilitado={!canWrite || current?.status === status}
                          executando={pending}
                          key={status}
                          onConfirmar={() => apply(module, status)}
                          rotulo={ROTULO_STATUS[status]}
                          tom={CORTAM_O_CLIENTE.has(status) ? "red" : "accent"}
                        />
                      );
                    })}
                  </span>
                  {/* O sucesso nasce onde a ação foi feita. */}
                  {confirmada?.module === module ? (
                    <div style={{ marginTop: 8 }}>
                      <Confirmacao>{confirmada.texto}</Confirmacao>
                    </div>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
