import { Icon } from "@repo/design-system/cosmos/icons";
import { Badge, PageHeader } from "@repo/design-system/cosmos/kit";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getClient } from "@/app/actions/clients";
import { listTenantMembers } from "@/app/actions/tenant-members";
import {
  listTenantAudit,
  listTenantIntegrations,
} from "@/app/actions/tenant-observability";
import { ConfirmacaoDeUmaVez } from "@/components/confirmacao-de-uma-vez";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { secaoDaRota, tituloDaAba } from "@/components/nav";
import { formatarData } from "@/lib/data";
import { requirePlatformStaff } from "@/lib/guard";
import { MODULOS_DA_PLATAFORMA } from "@/lib/modulos";
import { CharterBootstrap } from "./charter-bootstrap";
import { DetalheDoTenant } from "./detalhe";
import { MeridianBenchmark } from "./meridian-benchmark";
import { MeridianBootstrap } from "./meridian-bootstrap";
import { ModuleForm } from "./module-form";
import { faltaPreparar, ProntidaoDoModulo } from "./prontidao";
import { ScaffoldBootstrap } from "./scaffold-bootstrap";

export const dynamic = "force-dynamic";

// `cache` do React: `generateMetadata` e a página leem o mesmo cliente na
// mesma requisição, e sem isto seriam duas idas ao banco.
const lerCliente = cache((slug: string) => getClient(slug));

/** A aba diz qual cliente está aberto — trinta abas iguais não se acham. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const res = await lerCliente(slug);
  return {
    title: res.ok
      ? `${res.data.name} — Cliente — Back-office Nebuloz`
      : tituloDaAba("/clientes"),
  };
}

// O enum real (`SubscriptionPlan` em `tenant.prisma`). O mapa antigo tinha
// SCALE/ENTERPRISE, que não existem: GALAXY, NEBULA e UNIVERSE caíam no neutro
// e o selo mostrava o enum cru. A 9a consolida isto em `lib/rotulos.ts`.
const TOM_DO_PLANO: Record<string, "green" | "amber" | "blue" | "purple"> = {
  ORBIT: "blue",
  GALAXY: "purple",
  NEBULA: "amber",
  UNIVERSE: "green",
};

const ROTULO_DO_PLANO: Record<string, string> = {
  ORBIT: "Orbit",
  GALAXY: "Galaxy",
  NEBULA: "Nebula",
  UNIVERSE: "Universe",
};

/** A seção do menu e a faceta, como as outras telas do painel. */
const EYEBROW = `${secaoDaRota("/clientes")} · cliente`;

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ criado?: string }>;
}) {
  const { slug } = await params;
  // `?criado=1` chega do provisionamento: a tela abre dizendo o nome do
  // cliente que acabou de nascer, em vez de o redirect terminar em silêncio.
  // A `ConfirmacaoDeUmaVez` tira o param da URL depois de dizer — senão o F5
  // repetia "provisionado".
  const recemCriado = (await searchParams)?.criado === "1";
  // Em paralelo: são leituras independentes, e serializá-las só somaria
  // latência numa tela que o operador abre o dia inteiro.
  const [staff, result, membros, integracoes, auditoria] = await Promise.all([
    requirePlatformStaff(),
    lerCliente(slug),
    listTenantMembers(slug),
    listTenantIntegrations(slug),
    listTenantAudit(slug),
  ]);

  if (!result.ok) {
    if (result.code === "TENANT_NOT_FOUND") {
      notFound();
    }
    // Erro dentro da moldura: o cabeçalho leva o slug (o nome não chegou) e a
    // saída é o botão, não um parágrafo solto.
    return (
      <div
        style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
      >
        <PageHeader eyebrow={EYEBROW} title={slug} />
        <FalhaAoCarregar
          motivo={result.error}
          titulo="Não foi possível abrir o cliente"
        />
      </div>
    );
  }

  const client = result.data;
  // Cliente com tudo pronto não vê ação que não faz nada: só aparece quando
  // o módulo está contratado e falta papel ou política.
  const needsCharterBootstrap = faltaPreparar({
    moduleContracted: client.charter.moduleContracted,
    requisitos: [client.charter.hasCompliance, client.charter.hasPolicy],
  });
  const needsMeridianBootstrap = faltaPreparar({
    moduleContracted: client.meridian.moduleContracted,
    requisitos: [client.meridian.hasConsultant, client.meridian.hasTemplate],
  });

  // Só o que está de fato contratado abre aba de módulo. `CANCELED` continua na
  // lista de módulos (o histórico importa) mas não devolve a aba: ela leria um
  // módulo que o cliente não tem mais.
  const contratados = new Set(
    client.modules
      .filter((m) => m.status !== "CANCELED")
      .map((m) => m.module as string)
  );

  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: "var(--gap)" }}
    >
      <div>
        {/* Volta acima do cabeçalho, como no handoff — para a carteira, que
            mora em `/clientes` (`/` é a Home). */}
        <Link
          href="/clientes"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
            color: "var(--ink-subtle)",
            fontSize: "var(--fs-nota)",
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          <Icon name="arrowLeft" size={14} />
          Clientes
        </Link>

        <PageHeader
          eyebrow={EYEBROW}
          meta={
            <>
              <Badge tone={TOM_DO_PLANO[client.plan] ?? "neutral"}>
                {ROTULO_DO_PLANO[client.plan] ?? client.plan}
              </Badge>
              <Badge tone="neutral">
                {client.memberCount} membro
                {client.memberCount === 1 ? "" : "s"}
              </Badge>
            </>
          }
          subtitle={`${client.slug} · cliente desde ${formatarData(client.createdAt)}`}
          title={client.name}
          tone={TOM_DO_PLANO[client.plan] ?? "accent"}
        />
        {recemCriado ? (
          <ConfirmacaoDeUmaVez param="criado">
            Cliente {client.name} provisionado.
          </ConfirmacaoDeUmaVez>
        ) : null}
      </div>

      <DetalheDoTenant
        acoesDeModulo={
          <ModuleForm
            canWrite={staff.canWrite}
            modules={client.modules}
            modulos={MODULOS_DA_PLATAFORMA}
            slug={client.slug}
          />
        }
        auditoria={auditoria}
        canWrite={staff.canWrite}
        charter={
          <ProntidaoDoModulo
            acao={
              needsCharterBootstrap ? (
                <CharterBootstrap
                  canWrite={staff.canWrite}
                  slug={client.slug}
                />
              ) : null
            }
            icone="approve"
            selos={[
              {
                rotulo: "Módulo contratado",
                ok: client.charter.moduleContracted,
              },
              { rotulo: "Papel Compliance", ok: client.charter.hasCompliance },
              { rotulo: "Política criada", ok: client.charter.hasPolicy },
            ]}
            subtitulo="o que o módulo de governança precisa para funcionar"
            titulo="Charter"
          />
        }
        contratados={contratados}
        integracoes={integracoes}
        membros={membros}
        meridian={
          <ProntidaoDoModulo
            acao={
              needsMeridianBootstrap ? (
                <MeridianBootstrap
                  canWrite={staff.canWrite}
                  slug={client.slug}
                />
              ) : null
            }
            extra={
              <MeridianBenchmark canWrite={staff.canWrite} slug={client.slug} />
            }
            icone="target"
            selos={[
              {
                rotulo: "Módulo contratado",
                ok: client.meridian.moduleContracted,
              },
              { rotulo: "Papel Consultor", ok: client.meridian.hasConsultant },
              { rotulo: "Template criado", ok: client.meridian.hasTemplate },
            ]}
            subtitulo="o que o módulo de diagnóstico precisa para funcionar"
            titulo="Meridian"
          />
        }
        modulos={client.modules}
        scaffold={
          // Sem selos de papel: `getClient` não lê o papel do Scaffold, e a
          // action é idempotente — o cartão vale sempre que o módulo existe.
          <ProntidaoDoModulo
            acao={
              <ScaffoldBootstrap canWrite={staff.canWrite} slug={client.slug} />
            }
            icone="layers"
            selos={[{ rotulo: "Módulo contratado", ok: true }]}
            subtitulo="quem administra o acesso ao módulo de contratação"
            titulo="Scaffold"
          />
        }
        slug={client.slug}
      />
    </div>
  );
}
