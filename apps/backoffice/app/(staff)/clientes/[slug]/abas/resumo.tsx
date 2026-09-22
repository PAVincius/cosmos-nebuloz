import { Badge } from "@repo/design-system/cosmos/kit";
import type { ReactNode } from "react";
import type { IntegracaoRow } from "@/app/actions/tenant-observability";
import { MetaCell } from "@/components/meta-cell";
import { Secao } from "@/components/secao";
import { formatarData } from "@/lib/data";
import { rotuloDoModulo } from "@/lib/rotulo-do-modulo";

/**
 * Aba Resumo — a primeira leitura do tenant.
 *
 * O handoff faz duas colunas: o que se opera à esquerda, o que se consulta à
 * direita — Plano, Ambientes e Zona de risco. Aqui é uma coluna só, e não por
 * economia: das três, Ambientes e Zona de risco não têm modelo, e Plano
 * duplicava o cabeçalho, onde o plano e a contagem de membros já são selos.
 * Uma coluna com um cartão redundante é pior que nenhuma coluna.
 */

const TOM_MODULO: Record<string, "green" | "amber" | "red" | "neutral"> = {
  ACTIVE: "green",
  TRIAL: "amber",
  SUSPENDED: "red",
  CANCELED: "neutral",
};

const ROTULO_MODULO: Record<string, string> = {
  ACTIVE: "Ativo",
  TRIAL: "Trial",
  SUSPENDED: "Suspenso",
  CANCELED: "Cancelado",
};

export function AbaResumo({
  modulos,
  integracoes,
  acoesDeModulo,
}: {
  modulos: { module: string; status: string; expiresAt: string | null }[];
  integracoes: IntegracaoRow[];
  /** O formulário de contratação vem de fora: ele é cliente e esta aba não. */
  acoesDeModulo: ReactNode;
}) {
  const erros = integracoes.filter((i) => i.status === "ERROR").length;
  const ok = integracoes.filter((i) => i.status === "ACTIVE").length;
  const inativas = integracoes.filter((i) => i.status === "INACTIVE").length;
  const tomDaSaude = erros > 0 ? "red" : "green";
  // Fora do JSX: o lint lê ternário inline como valor vazando para o render.
  const tomDoErro: "red" | undefined = erros > 0 ? "red" : undefined;

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <Secao
        icon="layers"
        subtitle="o que este cliente comprou"
        title="Módulos contratados"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {modulos.map((m) => (
            // A barra tonal à esquerda é do handoff, e faz trabalho: numa
            // lista de módulos o status é a informação que se varre, e a
            // barra deixa varrer sem ler.
            <div
              key={m.module}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 15px",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--hairline)",
                background: "var(--surface-2)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  background: `var(--${TOM_MODULO[m.status] ?? "neutral"})`,
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "var(--fs-base)", fontWeight: 700 }}>
                    {rotuloDoModulo(m.module)}
                  </span>
                  <Badge dot tone={TOM_MODULO[m.status] ?? "neutral"}>
                    {ROTULO_MODULO[m.status] ?? m.status}
                  </Badge>
                </span>
                {m.expiresAt ? (
                  <span
                    className="mono"
                    style={{
                      display: "block",
                      marginTop: 3,
                      fontSize: "var(--fs-nota)",
                      color: "var(--ink-faint)",
                    }}
                  >
                    expira em {formatarData(m.expiresAt)}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
          {acoesDeModulo}
        </div>
      </Secao>

      <Secao
        icon="eye"
        subtitle="Integrações e sincronização"
        title="Saúde"
        tone={tomDaSaude}
      >
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <MetaCell label="OK" mono tone="green">
            {ok}
          </MetaCell>
          <MetaCell label="Com erro" mono tone={tomDoErro}>
            {erros}
          </MetaCell>
          <MetaCell label="Não conectadas" mono>
            {inativas}
          </MetaCell>
        </div>
      </Secao>
    </div>
  );
}
