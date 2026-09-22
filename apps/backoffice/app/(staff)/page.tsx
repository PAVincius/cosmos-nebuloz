import { Badge, KpiCard, PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import {
  listPlatformHealth,
  type SaudeDaPlataforma,
} from "@/app/actions/access";
import { listPlatformApprovals } from "@/app/actions/approvals";
import { Erro } from "@/components/campo";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota, tituloDaAba } from "@/components/nav";
import { Secao } from "@/components/secao";
import { Vazio } from "@/components/vazio";
import { formatarDataHora } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Pendentes na fila, ou o motivo de não saber. Uma falha aqui não pode virar
 *  zero: "Nada exige atenção" sobre dado que não veio é mentira. */
type FilaDeAprovacoes = { pendentes: number } | { erro: string };

/** "1 acesso recusado" / "3 acessos recusados" — plural real, não entre parênteses. */
function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** Sem o número não há como dizer verde: o "não sei" fica âmbar. */
function tomDasAprovacoes(pendentes: number | null): "amber" | "green" {
  if (pendentes === null || pendentes > 0) {
    return "amber";
  }
  return "green";
}

/** O item de aprovações na lista do que exige atenção: o aviso de falha (com
 *  o erro, `role=alert`) ou a contagem — nunca os dois, nunca nada quando
 *  não se sabe. */
function ItemDeAprovacoes({ aprovacoes }: { aprovacoes: FilaDeAprovacoes }) {
  if ("erro" in aprovacoes) {
    return (
      <li>
        <Erro>
          {`Não foi possível carregar aprovações: ${aprovacoes.erro}`}
        </Erro>
        <Link href="/aprovacoes" style={ATALHO}>
          Abrir a fila →
        </Link>
      </li>
    );
  }
  if (aprovacoes.pendentes === 0) {
    return null;
  }
  return (
    <li>
      <Badge dot tone="amber">
        {plural(
          aprovacoes.pendentes,
          "aprovação pendente",
          "aprovações pendentes"
        )}
      </Badge>
      <Link href="/aprovacoes" style={ATALHO}>
        Abrir a fila →
      </Link>
    </li>
  );
}

const ATALHO = {
  display: "inline-block",
  marginTop: 10,
  fontSize: "var(--fs-base)",
  fontWeight: 700,
  color: "var(--accent-text)",
};

/**
 * Home: o que exige atenção agora.
 *
 * Mora na raiz (`/`) desde a crítica rodada 5 — antes era `/home`, que agora
 * só redireciona para cá. Não repete a carteira de clientes, que é a tela
 * `/clientes`. O que esta responde é "preciso fazer alguma coisa hoje?", e por
 * isso ela só mostra o que está pendente ou quebrado. Uma home que lista tudo obriga a procurar o problema no
 * meio do que está bem.
 */
function Conteudo({
  saude,
  aprovacoes,
}: {
  saude: SaudeDaPlataforma;
  aprovacoes: FilaDeAprovacoes;
}) {
  const quebradas = saude.integracoes.length;
  const pendentes = "pendentes" in aprovacoes ? aprovacoes.pendentes : null;
  const tudoCalmo = quebradas === 0 && pendentes === 0 && saude.recusas === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div className="bo-kpis">
        <KpiCard
          hint="na carteira"
          icon="building"
          label="Clientes"
          tone="blue"
          value={saude.tenants}
        />
        <KpiCard
          hint={pendentes === null ? "não carregou" : "esperando decisão"}
          icon="approve"
          label="Aprovações pendentes"
          tone={tomDasAprovacoes(pendentes)}
          value={pendentes ?? "—"}
        />
        <KpiCard
          hint="em todos os clientes"
          icon="eye"
          label="Integrações com erro"
          tone={quebradas > 0 ? "red" : "green"}
          value={quebradas}
        />
        <KpiCard
          hint="nas últimas 50 entradas"
          icon="userCheck"
          label="Acessos recusados"
          tone={saude.recusas > 0 ? "amber" : "green"}
          value={saude.recusas}
        />
      </div>

      {tudoCalmo ? (
        <Secao icon="check" title="Nada exige atenção" tone="green">
          <Vazio>
            Sem aprovação parada, sem integração com erro e sem acesso recusado.
            Esta tela fica vazia quando está tudo bem — é o comportamento
            pretendido, não falta de dado.
          </Vazio>
        </Secao>
      ) : (
        <Secao
          icon="alert"
          subtitle="o que está esperando alguém"
          title="Exige atenção"
          tone="amber"
        >
          <ul
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <ItemDeAprovacoes aprovacoes={aprovacoes} />
            {quebradas > 0 ? (
              <li>
                <Badge dot tone="red">
                  {plural(quebradas, "integração", "integrações")} com erro
                </Badge>
                <Link href="/observabilidade" style={ATALHO}>
                  Ver quais →
                </Link>
              </li>
            ) : null}
            {saude.recusas > 0 ? (
              <li>
                <Badge dot tone="amber">
                  {plural(
                    saude.recusas,
                    "acesso recusado",
                    "acessos recusados"
                  )}
                </Badge>
                <Link href="/observabilidade" style={ATALHO}>
                  Ver a trilha →
                </Link>
              </li>
            ) : null}
          </ul>
        </Secao>
      )}

      <Secao
        icon="history"
        subtitle="últimos 10 de todos os clientes"
        title="Eventos de auditoria"
      >
        {saude.ultimosEventos.length === 0 ? (
          <Vazio>Nada registrado ainda.</Vazio>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {saude.ultimosEventos.map((e, i) => (
              <li
                key={e.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 2px",
                  borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                  fontSize: "var(--fs-base)",
                }}
              >
                <span
                  className="mono"
                  style={{ fontSize: "var(--fs-nota)", fontWeight: 700 }}
                >
                  {e.action}
                </span>
                <span
                  style={{ flex: 1, minWidth: 0, color: "var(--ink-muted)" }}
                >
                  {e.alvo ?? "—"}
                </span>
                <span
                  className="mono"
                  style={{
                    fontSize: "var(--fs-nota)",
                    color: "var(--ink-faint)",
                  }}
                >
                  {formatarDataHora(e.quando)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <Link href="/audit" style={ATALHO}>
          Abrir o Audit Explorer →
        </Link>
      </Secao>
    </div>
  );
}

export const metadata = { title: tituloDaAba("/") };

export default async function HomePage() {
  const [saude, aprovacoes] = await Promise.all([
    listPlatformHealth(),
    listPlatformApprovals(),
  ]);

  // A falha de aprovações não derruba a Home nem vira zero: desce como erro
  // e a tela mostra o aviso no lugar do número.
  const filaDeAprovacoes = aprovacoes.ok
    ? {
        pendentes: aprovacoes.data.filter(
          (a) => a.status === "PENDING_APPROVAL"
        ).length,
      }
    : { erro: aprovacoes.error };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow={`${secaoDaRota("/")} · visão geral`}
        subtitle="O que exige atenção agora. A carteira de clientes fica em Clientes — esta tela responde se você precisa fazer alguma coisa hoje."
        title="Home"
      />
      {saude.ok ? (
        <Conteudo aprovacoes={filaDeAprovacoes} saude={saude.data} />
      ) : (
        <FalhaAoCarregar
          motivo={saude.error}
          titulo="Não foi possível carregar a saúde da plataforma"
        />
      )}
    </div>
  );
}
