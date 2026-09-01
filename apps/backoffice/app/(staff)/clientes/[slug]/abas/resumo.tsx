import { Badge, SectionCard } from "@repo/design-system/cosmos/kit";
import type { ReactNode } from "react";
import type { IntegracaoRow } from "@/app/actions/tenant-observability";
import { MetaCell } from "@/components/meta-cell";
import { SemModelo } from "@/components/sem-modelo";

/**
 * Aba Resumo — a primeira leitura do tenant.
 *
 * Layout do `TenantResumoTab`: duas colunas, o que se opera à esquerda e o que
 * se consulta à direita. A coluna estreita do handoff tem Plano, Ambientes e
 * Zona de risco; das três, só Plano tem dado — as outras duas dizem o que
 * falta em vez de mostrar número inventado.
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
  plano,
  membros,
  modulos,
  integracoes,
  acoesDeModulo,
}: {
  plano: string;
  membros: number;
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
    <div className="bo-detalhe">
      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
      >
        <SectionCard
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
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      style={{ fontSize: "var(--fs-base)", fontWeight: 700 }}
                    >
                      {m.module}
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
                      expira em{" "}
                      {new Date(m.expiresAt).toLocaleDateString("pt-BR")}
                    </span>
                  ) : null}
                </span>
              </div>
            ))}
            {acoesDeModulo}
          </div>
        </SectionCard>

        <SectionCard
          icon="eye"
          subtitle="Integrações e sincronização"
          title="Health"
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
        </SectionCard>
      </div>

      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
      >
        <SectionCard icon="tag" title="Plano">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <MetaCell label="Plano">{plano}</MetaCell>
            <MetaCell label="Usuários" mono>
              {membros}
            </MetaCell>
          </div>
        </SectionCard>

        {/* O handoff tem "Ambientes" e "Zona de risco" aqui. Nenhum dos dois
            tem modelo: não há tabela de ambiente por tenant, e deleção agendada
            não existe como fluxo. */}
        <SemModelo
          icone="server"
          precisa={["model TenantEnvironment", "credenciais por ambiente"]}
          titulo="Ambientes"
        >
          O desenho separa dados e credenciais por ambiente, e marca produção
          para que toda mudança diga em qual ambiente está acontecendo. Hoje o
          tenant não tem ambientes — existe um só, implícito.
        </SemModelo>
      </div>
    </div>
  );
}
