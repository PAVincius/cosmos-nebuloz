import { SectionCard } from "@repo/design-system/cosmos/kit";
import { MetaCell } from "@/components/meta-cell";
import { SemModelo } from "@/components/sem-modelo";

/**
 * As abas que o handoff desenha e o schema ainda não sustenta.
 *
 * Ficam num arquivo só porque são a mesma decisão repetida quatro vezes, e
 * porque juntas elas viram uma lista de trabalho: cada uma nomeia o modelo que
 * falta. Quando um deles existir, a aba correspondente sai daqui.
 */

export function AbaBilling({
  plano,
  membros,
}: {
  plano: string;
  membros: number;
}) {
  return (
    <div className="bo-detalhe">
      {/* Metade tem dado: plano e contagem de usuários são reais. O que falta é
          o teto — e sem teto, "12 usuários" não responde a pergunta que a aba
          existe para responder, que é "está perto do limite?". */}
      <SectionCard
        icon="tag"
        subtitle="o que existe hoje no schema"
        title="Plano"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <MetaCell label="Plano contratado">{plano}</MetaCell>
          <MetaCell label="Usuários no tenant" mono>
            {membros}
          </MetaCell>
        </div>
      </SectionCard>

      <SemModelo
        icone="gauge"
        precisa={[
          "limites por plano",
          "model BillingAccount",
          "consumo (MCP, storage)",
        ]}
        titulo="Limites e billing"
      >
        O desenho mostra uso contra teto — usuários, integrações e ambientes — e
        avisa quando passa de 80%. O teto não existe: `Tenant.plan` é um texto,
        sem tabela que diga o que cada plano permite. Sem isso, o número de cima
        é contagem, não alerta.
      </SemModelo>
    </div>
  );
}

export function AbaPoliticas() {
  return (
    <SemModelo
      icone="clock"
      precisa={[
        "retenção por tipo de dado",
        "residência",
        "política de export",
      ]}
      titulo="Dados, retenção e export"
    >
      O desenho controla por tenant quanto tempo logs, métricas e artefatos são
      guardados, em que região ficam, e se export sensível passa por aprovação.
      Nada disso está no schema — hoje a retenção é a do banco, igual para todo
      mundo, e não há como um cliente pedir diferente.
    </SemModelo>
  );
}

export function AbaMcp() {
  return (
    <SemModelo
      icone="bot"
      precisa={[
        "model TenantMcpConfig",
        "allowlist de clients",
        "modo de acesso",
      ]}
      titulo="MCP"
    >
      O desenho liga e desliga acesso de agentes por tenant e por ambiente, com
      allowlist de clients e modo de acesso — e manda writes avançadas para
      aprovação. O back-office não tem onde guardar essa configuração, então
      ligar aqui não mudaria nada em lugar nenhum.
    </SemModelo>
  );
}

export function AbaSignal() {
  return (
    <SemModelo
      icone="chart"
      precisa={["defaults de ROI", "pesos por eixo", "papéis que criam"]}
      titulo="Defaults do Signal"
    >
      O desenho define, por tenant, quem cria iniciativa, como a baseline é
      revisada e os pesos de tempo, qualidade e risco que toda iniciativa nova
      herda. O módulo Signal existe como contrato; estes ajustes, não.
    </SemModelo>
  );
}
