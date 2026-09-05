"use server";

import { database, withTenantDb } from "@repo/database";
import { log } from "@repo/observability/log";
import { logPlatformAudit, platformDb } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { gerarCodigoEngajamento } from "@/lib/comercial";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Scaffold V1 (ADR-0014): a ligação entre a promoção do Meridian e o
 * `Engagement` que a entrega. Não é módulo novo — é a única peça de
 * engenharia que o PRD (§7) pedia, porque a lacuna vive no tenant do cliente
 * e o engajamento vive no tenant de sistema.
 *
 * Duas ações:
 *  - `listarPromocoesPendentes` lê cross-tenant via `platformDb`, que o
 *    ADR-0013 autoriza para o back-office.
 *  - `materializarEngajamento` escreve dos dois lados: `Engagement` no tenant
 *    de sistema (sem `withTenantDb` — nem `Engagement` nem `Service` têm RLS
 *    hoje, o mesmo caminho de `app/actions/engagements.ts`) e o vínculo de
 *    volta em `MeridianGapPromotion`, no tenant do cliente, via
 *    `withTenantDb` — o caminho que `bootstrapCharter` já usa.
 */

export type PromocaoPendenteRow = {
  id: string;
  gapCode: string;
  gapStatement: string;
  severity: string;
  effort: string;
  costOfDelay: number;
  promotedAt: string;
};

export type PromocoesPorCliente = {
  clienteTenantId: string;
  clienteNome: string;
  clienteSlug: string;
  promocoes: PromocaoPendenteRow[];
};

export async function listarPromocoesPendentes(): Promise<
  Result<PromocoesPorCliente[]>
> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    // `targetEntityId: null` + `revokedAt: null` é a fila do ADR-0014: a
    // promoção declarou a intenção no Meridian e ainda não aterrissou aqui.
    // `tenant.isSystem: false` segue a regra do ADR-0013 — toda listagem
    // cross-tenant filtra o tenant interno, que não é cliente.
    const linhas = await platformDb.meridianGapPromotion.findMany({
      where: {
        targetProduct: "SCAFFOLD",
        targetEntityId: null,
        revokedAt: null,
        tenant: { isSystem: false },
      },
      orderBy: [{ tenantId: "asc" }, { promotedAt: "asc" }],
      include: {
        gap: {
          select: {
            code: true,
            statement: true,
            severity: true,
            effort: true,
            costOfDelay: true,
          },
        },
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });

    const porCliente = new Map<string, PromocoesPorCliente>();
    for (const p of linhas) {
      let grupo = porCliente.get(p.tenantId);
      if (!grupo) {
        grupo = {
          clienteTenantId: p.tenantId,
          clienteNome: p.tenant.name,
          clienteSlug: p.tenant.slug,
          promocoes: [],
        };
        porCliente.set(p.tenantId, grupo);
      }
      grupo.promocoes.push({
        id: p.id,
        gapCode: p.gap.code,
        gapStatement: p.gap.statement,
        severity: p.gap.severity,
        effort: p.gap.effort,
        costOfDelay: p.gap.costOfDelay,
        promotedAt: p.promotedAt.toISOString(),
      });
    }

    return [...porCliente.values()];
  });
}

const MaterializarSchema = z.object({
  promotionIds: z
    .array(z.string().min(1))
    .min(1, "Selecione ao menos uma lacuna promovida."),
  nome: z.string().min(2).max(160),
  serviceId: z.string().min(1).optional(),
  escopo: z.string().max(4000).optional(),
  valorCentavos: z.number().int().min(0).default(0),
});

/** Busca as promoções pedidas e recusa tudo que a materialização não aceita:
 *  alguma já não está pendente, ou elas não são todas do mesmo cliente. Um
 *  `Engagement` tem um cliente só — misturar tenants aqui teria que decidir
 *  qual `clienteTenantId` o engajamento herda, e não há resposta certa. */
async function buscarPromocoesMaterializaveis(promotionIds: string[]) {
  const promocoes = await platformDb.meridianGapPromotion.findMany({
    where: {
      id: { in: promotionIds },
      targetProduct: "SCAFFOLD",
      targetEntityId: null,
      revokedAt: null,
    },
    include: {
      gap: { select: { code: true } },
      tenant: { select: { id: true, isSystem: true, name: true } },
    },
  });

  if (promocoes.length !== promotionIds.length) {
    throw new StaffAuthError(
      "FORBIDDEN",
      "Uma ou mais promoções não estão mais pendentes — já foram materializadas ou revogadas. Recarregue a fila."
    );
  }

  const tenantsDistintos = new Set(promocoes.map((p) => p.tenantId));
  if (tenantsDistintos.size > 1) {
    throw new StaffAuthError(
      "FORBIDDEN",
      "As promoções selecionadas são de clientes diferentes. Um engajamento tem um cliente só — materialize cada cliente em separado."
    );
  }

  const clienteTenantId = promocoes[0].tenantId;
  if (promocoes[0].tenant.isSystem || clienteTenantId === SYSTEM_TENANT_ID) {
    // Defensivo: `listarPromocoesPendentes` já filtra `isSystem: false`, mas
    // esta action não depende daquela leitura para decidir — ela refaz a
    // checagem com o que buscou.
    throw new StaffAuthError(
      "FORBIDDEN",
      "O tenant interno não é cliente. Um engajamento apontado para ele contaminaria o Benchmark."
    );
  }

  return { promocoes, clienteTenantId };
}

/**
 * Grava `targetEntityId` nas promoções, no tenant do cliente. Se falhar —
 * inclusive se a contagem de linhas atualizadas não bater, sinal de que algo
 * mudou de estado entre a leitura e aqui — compensa apagando o `Engagement`
 * recém-criado (ver o comentário de atomicidade em `materializarEngajamento`)
 * e relança o erro original.
 */
async function vincularOuCompensar(params: {
  clienteTenantId: string;
  promotionIds: string[];
  engagementId: string;
}): Promise<void> {
  const { clienteTenantId, promotionIds, engagementId } = params;
  try {
    const vinculo = await withTenantDb(clienteTenantId, (db) =>
      db.meridianGapPromotion.updateMany({
        where: {
          id: { in: promotionIds },
          targetProduct: "SCAFFOLD",
          revokedAt: null,
          targetEntityId: null,
        },
        data: { targetEntityId: engagementId },
      })
    );
    if (vinculo.count !== promotionIds.length) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Uma ou mais promoções mudaram de estado enquanto o engajamento era criado. Nada foi gravado — recarregue a fila e tente de novo."
      );
    }
  } catch (e) {
    await database.engagement
      .delete({ where: { id: engagementId } })
      .catch((delErr: unknown) => {
        log.error("[scaffold] engajamento órfão após falha no vínculo", {
          engagementId,
          clienteTenantId,
          error: String(delErr),
        });
      });
    throw e;
  }
}

/** Confere que o serviço, se informado, está no catálogo ativo do tenant de
 *  sistema — a tela só oferece o que já existe (PRD §7: fora de escopo semear
 *  catálogo de Scaffold), mas a action não confia só na tela. */
async function validarServicoOpcional(serviceId: string | undefined) {
  if (!serviceId) {
    return;
  }
  const servico = await database.service.findFirst({
    where: { id: serviceId, tenantId: SYSTEM_TENANT_ID, ativo: true },
    select: { id: true },
  });
  if (!servico) {
    throw new StaffAuthError(
      "FORBIDDEN",
      "Serviço não encontrado no catálogo ativo."
    );
  }
}

/**
 * Cria o `Engagement` a partir de uma ou mais promoções do mesmo cliente e
 * grava `targetEntityId` de volta em cada uma.
 *
 * ## Atomicidade entre os dois tenants
 *
 * `Engagement` mora no tenant de sistema; `MeridianGapPromotion`, no tenant do
 * cliente. Os dois já vivem no mesmo Postgres físico — `withTenantDb` só abre
 * uma transação e seta `app.tenant_id` via `SET LOCAL` nela — então uma
 * transação única *funcionaria* hoje. Não é o caminho escolhido: o ADR-0012
 * prevê um papel de aplicação sem `BYPASSRLS`, que troca essa fronteira de
 * convenção por conexão separada — nesse mundo, compor as duas escritas numa
 * transação só deixa de ser possível. Tratar as duas escritas como
 * independentes agora é o que faz este código continuar correto depois.
 *
 * A ordem é: primeiro o `Engagement` (tenant de sistema, sem RLS — a escrita
 * mais barata de desfazer), depois o vínculo (tenant do cliente, sob RLS). Se
 * o vínculo falhar, a compensação apaga o `Engagement` recém-criado — melhor
 * um retry limpo do que um engajamento sem nenhuma promoção apontando para
 * ele. Se a própria compensação falhar (falha dupla, rara), sobra um
 * engajamento órfão; fica logado para achar e limpar manualmente. O caminho
 * inverso — vincular primeiro — foi descartado porque o resultado de uma
 * falha ali é pior: uma promoção apontando para um `Engagement` que nunca
 * chegou a existir, um ponteiro morto em vez de um registro órfão e visível.
 */
export async function materializarEngajamento(
  input: z.input<typeof MaterializarSchema>
): Promise<Result<{ id: string; codigo: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = MaterializarSchema.parse(input);

    const { promocoes, clienteTenantId } = await buscarPromocoesMaterializaveis(
      dados.promotionIds
    );
    await validarServicoOpcional(dados.serviceId);

    const codigo = gerarCodigoEngajamento();

    const criado = await database.engagement.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        nome: dados.nome,
        codigo,
        clienteTenantId,
        serviceId: dados.serviceId ?? null,
        escopo: dados.escopo ?? null,
        status: "PROPOSTO",
        valorCentavos: dados.valorCentavos,
      },
      select: { id: true, codigo: true },
    });

    await vincularOuCompensar({
      clienteTenantId,
      promotionIds: dados.promotionIds,
      engagementId: criado.id,
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "engagement",
      entityId: criado.id,
      target: `${codigo} · ${dados.nome} · Scaffold (${promocoes
        .map((p) => p.gap.code)
        .join(", ")})`,
    });

    revalidatePath("/scaffold");
    revalidatePath("/delivery");
    return criado;
  });
}
