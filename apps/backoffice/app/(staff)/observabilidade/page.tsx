import { Badge, PageHeader, SectionCard } from "@repo/design-system/cosmos/kit";
import {
  type AcessoRow,
  type IntegracaoQuebrada,
  listPlatformHealth,
} from "@/app/actions/access";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota, tituloDaAba } from "@/components/nav";
import { Vazio } from "@/components/vazio";
import { formatarDataHora } from "@/lib/data";

export const dynamic = "force-dynamic";

const TOM_EVENTO = {
  LOGIN: "green",
  LOGOUT: "neutral",
  RECUSADO: "red",
} as const;

/** O evento como a pessoa lê, não como o enum grava. */
const ROTULO_EVENTO: Record<string, string> = {
  LOGIN: "Entrou",
  LOGOUT: "Saiu",
  RECUSADO: "Recusado",
};

function Integracoes({ linhas }: { linhas: IntegracaoQuebrada[] }) {
  if (linhas.length === 0) {
    // Vazio aqui é boa notícia, e a tela precisa dizer isso — "nenhum
    // resultado" num painel de saúde parece falha de carregamento.
    return <Vazio>Nenhuma integração com erro em nenhum cliente.</Vazio>;
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {linhas.map((i, idx) => (
        <li
          key={i.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 2px",
            borderTop: idx === 0 ? "none" : "1px solid var(--hairline)",
          }}
        >
          <Badge tone="blue">{i.tenantSlug}</Badge>
          <span style={{ flex: 1, minWidth: 0, fontSize: "var(--fs-base)" }}>
            {i.name}
            <span
              className="mono"
              style={{
                marginLeft: 8,
                fontSize: "var(--fs-nota)",
                color: "var(--ink-faint)",
              }}
            >
              {i.source}
            </span>
          </span>
          <span
            className="mono"
            style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
          >
            {i.ultimoSync
              ? `último sync ${formatarDataHora(i.ultimoSync)}`
              : "nunca sincronizou"}
          </span>
          <Badge dot tone="red">
            Erro
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function Acessos({ linhas }: { linhas: AcessoRow[] }) {
  if (linhas.length === 0) {
    return (
      <Vazio>
        Nenhum acesso registrado ainda. A trilha começa a encher no próximo
        login — inclusive nas tentativas recusadas.
      </Vazio>
    );
  }

  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {linhas.map((a, idx) => (
        <li
          key={a.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "9px 2px",
            borderTop: idx === 0 ? "none" : "1px solid var(--hairline)",
          }}
        >
          <Badge dot tone={TOM_EVENTO[a.evento as "LOGIN"] ?? "neutral"}>
            {ROTULO_EVENTO[a.evento] ?? a.evento}
          </Badge>
          <span
            className="mono"
            style={{ flex: 1, minWidth: 0, fontSize: "var(--fs-base)" }}
          >
            {a.email}
          </span>
          {a.motivo ? (
            <span
              style={{ fontSize: "var(--fs-nota)", color: "var(--red-text)" }}
            >
              {a.motivo}
            </span>
          ) : null}
          <span
            className="mono"
            style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}
          >
            {a.ip ?? "sem ip"} · {formatarDataHora(a.quando)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export const metadata = { title: tituloDaAba("/observabilidade") };

export default async function ObservabilidadePage() {
  const res = await listPlatformHealth();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow={`${secaoDaRota("/observabilidade")} · saúde`}
        subtitle="Falha de integração de todos os clientes num lugar só, e quem entrou no painel — inclusive quem tentou e não conseguiu."
        title="Observabilidade"
      />

      {res.ok ? (
        <>
          {/* NFR-1.7: a credencial é write-only — a query não a seleciona, e a
              tela diz isso na língua do operador, não do SQL. */}
          <SectionCard
            icon="eye"
            subtitle="Nome, fonte e erro de cada integração — a credencial não chega a esta tela."
            title="Integrações com falha"
          >
            <Integracoes linhas={res.data.integracoes} />
          </SectionCard>

          {/* FR-30: registro de acesso ao painel. */}
          <SectionCard
            icon="userCheck"
            subtitle={
              res.data.recusas > 0
                ? `${res.data.recusas} ${res.data.recusas === 1 ? "tentativa recusada" : "tentativas recusadas"} nas últimas 50`
                : "Quem entrou, quando e de onde"
            }
            title="Acessos ao Big Bang"
          >
            <Acessos linhas={res.data.acessos} />
          </SectionCard>
        </>
      ) : (
        <FalhaAoCarregar
          motivo={res.error}
          titulo="Não foi possível carregar a saúde da plataforma"
        />
      )}
    </div>
  );
}
