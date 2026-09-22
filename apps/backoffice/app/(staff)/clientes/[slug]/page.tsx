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
import { Confirmacao } from "@/components/confirmacao";
import { FalhaAoCarregar } from "@/components/falha-ao-carregar";
import { tituloDaAba } from "@/components/nav";
import { formatarData } from "@/lib/data";
import { requirePlatformStaff } from "@/lib/guard";
import { MODULOS_DA_PLATAFORMA } from "@/lib/modulos";
import { CharterBootstrap } from "./charter-bootstrap";
import { DetalheDoTenant } from "./detalhe";
import { MeridianBootstrap } from "./meridian-bootstrap";
import { ModuleForm } from "./module-form";
import { faltaPreparar, ProntidaoDoModulo } from "./prontidao";

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
      : tituloDaAba("/"),
  };
}

const TOM_DO_PLANO: Record<string, "green" | "amber" | "blue" | "purple"> = {
  ORBIT: "blue",
  SCALE: "purple",
  ENTERPRISE: "green",
};

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
        <PageHeader eyebrow={`cliente · ${slug}`} title={slug} />
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
        {/* Volta acima do cabeçalho, como no handoff. */}
        <Link
          href="/"
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
          eyebrow={`cliente · ${client.slug}`}
          meta={
            <>
              <Badge tone={TOM_DO_PLANO[client.plan] ?? "neutral"}>
                {client.plan}
              </Badge>
              <Badge tone="neutral">
                {client.memberCount} membro
                {client.memberCount === 1 ? "" : "s"}
              </Badge>
            </>
          }
          subtitle={`Cliente desde ${formatarData(client.createdAt)}`}
          title={client.name}
          tone={TOM_DO_PLANO[client.plan] ?? "accent"}
        />
        {recemCriado ? (
          <Confirmacao>Cliente {client.name} provisionado.</Confirmacao>
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
        slug={client.slug}
      />
    </div>
  );
}
