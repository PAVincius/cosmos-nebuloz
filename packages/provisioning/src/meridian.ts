import { type AuditWriter, logPlatformAudit } from "./audit";
import { ProvisioningError } from "./errors";

export type MeridianBatteryQuestion = {
  code: string;
  axis: "DATA" | "PROCESS" | "PEOPLE" | "GOVERNANCE" | "INFRASTRUCTURE";
  ordinal: number;
  type: "LIKERT" | "YES_NO" | "SCALE";
  text: string;
  /** Peso na média ponderada do eixo. */
  weight: number;
  /** True quando a opção mais alta é a pior resposta. Inverte a normalização. */
  inverted: boolean;
  /** Rótulos das faixas, só para type = SCALE. */
  scaleLabels: string[];
};

/** Nome e versão do template inicial. A versão é única por tenant
 *  (`@@unique([tenantId, version])`): reusar a mesma string aqui é o que faz o
 *  bootstrap não brigar com o seed num banco de desenvolvimento. */
export const MERIDIAN_TEMPLATE_NAME = "Bateria de prontidão para IA";
export const MERIDIAN_TEMPLATE_VERSION = "v3.2";

/**
 * A bateria v3.2: três perguntas por eixo, cinco eixos.
 *
 * Mora aqui, e não no seed, porque o seed não roda em produção — e a lista já
 * provou custar caro quando existe em duas cópias: cada cópia envelhece
 * sozinha e a divergência é sintaticamente invisível.
 *
 * Data leva a pergunta invertida (fração fora do ambiente governado), que é o
 * caso onde a normalização erraria em silêncio se `inverted` não existisse.
 */
export const MERIDIAN_BATTERY: MeridianBatteryQuestion[] = [
  {
    code: "Q-D01",
    axis: "DATA",
    ordinal: 1,
    type: "LIKERT",
    text: "As fontes de dado críticas do negócio estão catalogadas, com dono e descrição atualizados.",
    weight: 2,
    inverted: false,
    scaleLabels: [],
  },
  {
    code: "Q-D02",
    axis: "DATA",
    ordinal: 2,
    type: "LIKERT",
    text: "Existe medição automática de qualidade (completude, frescor, consistência) nas fontes principais.",
    weight: 1,
    inverted: false,
    scaleLabels: [],
  },
  {
    code: "Q-D03",
    axis: "DATA",
    ordinal: 3,
    type: "SCALE",
    text: "Que fração dos dados usados em análises vive fora do ambiente governado (planilhas, exports locais)?",
    weight: 1,
    inverted: true,
    scaleLabels: ["0–10%", "10–25%", "25–50%", "50%+"],
  },
  {
    code: "Q-P01",
    axis: "PROCESS",
    ordinal: 1,
    type: "LIKERT",
    text: "Os processos candidatos a IA estão mapeados com baseline de tempo e custo.",
    weight: 1,
    inverted: false,
    scaleLabels: [],
  },
  {
    code: "Q-P02",
    axis: "PROCESS",
    ordinal: 2,
    type: "YES_NO",
    text: "Existe critério econômico comparável para priorizar casos de uso?",
    weight: 1,
    inverted: false,
    scaleLabels: [],
  },
  {
    code: "Q-P03",
    axis: "PROCESS",
    ordinal: 3,
    type: "LIKERT",
    text: "As exceções do processo são registradas e revisadas periodicamente.",
    weight: 1,
    inverted: false,
    scaleLabels: [],
  },
  {
    code: "Q-E01",
    axis: "PEOPLE",
    ordinal: 1,
    type: "LIKERT",
    text: "Existe trilha de capacitação em IA por persona, com participação medida.",
    weight: 1,
    inverted: false,
    scaleLabels: [],
  },
  {
    code: "Q-E02",
    axis: "PEOPLE",
    ordinal: 2,
    type: "YES_NO",
    text: "Os papéis de dado (steward, owner) estão formalizados nas descrições de cargo?",
    weight: 1,
    inverted: false,
    scaleLabels: [],
  },
  {
    code: "Q-E03",
    axis: "PEOPLE",
    ordinal: 3,
    type: "LIKERT",
    text: "O conhecimento de IA está distribuído além de um pequeno grupo de campeões.",
    weight: 1,
    inverted: false,
    scaleLabels: [],
  },
  {
    code: "Q-G01",
    axis: "GOVERNANCE",
    ordinal: 1,
    type: "LIKERT",
    text: "A política de uso de IA está aprovada, versionada e comunicada.",
    weight: 1,
    inverted: false,
    scaleLabels: [],
  },
  {
    code: "Q-G02",
    axis: "GOVERNANCE",
    ordinal: 2,
    type: "YES_NO",
    text: "O comitê de IA revisou algum caso nos últimos seis meses?",
    weight: 2,
    inverted: false,
    scaleLabels: [],
  },
  {
    code: "Q-G03",
    axis: "GOVERNANCE",
    ordinal: 3,
    type: "LIKERT",
    text: "Dados sensíveis têm classificação e controle de acesso aplicados na prática.",
    weight: 1,
    inverted: false,
    scaleLabels: [],
  },
  {
    code: "Q-I01",
    axis: "INFRASTRUCTURE",
    ordinal: 1,
    type: "LIKERT",
    text: "Existe ambiente segregado para experimentação com dado sensível.",
    weight: 1,
    inverted: false,
    scaleLabels: [],
  },
  {
    code: "Q-I02",
    axis: "INFRASTRUCTURE",
    ordinal: 2,
    type: "LIKERT",
    text: "O ciclo de vida de modelos tem versionamento e rollback.",
    weight: 1,
    inverted: false,
    scaleLabels: [],
  },
  {
    code: "Q-I03",
    axis: "INFRASTRUCTURE",
    ordinal: 3,
    type: "YES_NO",
    text: "O custo de inferência é observável por caso de uso?",
    weight: 1,
    inverted: false,
    scaleLabels: [],
  },
];

/** Mesma escolha do `CharterDb`: argumento `unknown` porque o client real do
 *  Prisma tem genéricos que não cabem numa forma escrita à mão, e sintaxe de
 *  método porque sob `strictFunctionTypes` a forma com seta seria contravariante
 *  e o `withTenantDb` real deixaria de ser atribuível. */
export type MeridianDb = AuditWriter & {
  tenant: {
    findUnique(args: unknown): Promise<{ id: string; slug: string } | null>;
  };
  user: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
  };
  meridianMembership: { upsert(args: unknown): Promise<{ id: string }> };
  meridianTemplate: {
    findFirst(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  meridianQuestion: { createMany(args: unknown): Promise<{ count: number }> };
};

export type BootstrapMeridianDeps = {
  withTenantDb<T>(
    tenantId: string,
    fn: (db: MeridianDb) => Promise<T>
  ): Promise<T>;
};

export type BootstrapMeridianInput = {
  tenantId: string;
  consultantEmail: string;
  actorUserId: string;
  actorName?: string | null;
};

/**
 * Deixa o Meridian utilizável para um tenant: papel CONSULTANT para o
 * responsável e o template inicial com a bateria dos cinco eixos.
 *
 * Existe pelo mesmo motivo do `bootstrapCharter`: contratar o módulo não dá
 * acesso a ninguém, e nenhuma action do produto cria template. Sem os dois, o
 * consultor entra em /meridian e não consegue abrir assessment nenhum.
 *
 * O template nasce sem `lockedAt`: travar é decisão do primeiro uso, não do
 * provisionamento — enquanto está destravado o consultor ainda pode ajustar a
 * bateria antes do primeiro assessment.
 */
export async function bootstrapMeridian(
  deps: BootstrapMeridianDeps,
  input: BootstrapMeridianInput
): Promise<{ templateId: string; created: boolean }> {
  return await deps.withTenantDb(input.tenantId, async (db) => {
    const tenant = await db.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, slug: true },
    });
    if (!tenant) {
      throw new ProvisioningError(
        "TENANT_NOT_FOUND",
        `Nenhum tenant com id ${input.tenantId}.`
      );
    }

    const email = input.consultantEmail.trim().toLowerCase();
    const user = await db.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      throw new ProvisioningError(
        "USER_NOT_FOUND",
        `Nenhuma conta com o e-mail ${email}. A pessoa precisa entrar ao menos uma vez antes de receber o papel.`
      );
    }

    await db.meridianMembership.upsert({
      where: {
        tenantId_userId: { tenantId: input.tenantId, userId: user.id },
      },
      create: {
        tenantId: input.tenantId,
        userId: user.id,
        role: "CONSULTANT",
        updatedBy: input.actorUserId,
      },
      update: { role: "CONSULTANT", updatedBy: input.actorUserId },
    });

    const existing = await db.meridianTemplate.findFirst({
      where: { tenantId: input.tenantId },
      select: { id: true },
    });

    if (existing) {
      await logPlatformAudit(db, {
        tenantId: input.tenantId,
        actorUserId: input.actorUserId,
        actorName: input.actorName,
        action: "meridian.bootstrap_skipped",
        entityType: "MeridianTemplate",
        entityId: existing.id,
        target: `${tenant.slug} · template já existia`,
      });
      return { templateId: existing.id, created: false };
    }

    const template = await db.meridianTemplate.create({
      data: {
        tenantId: input.tenantId,
        name: MERIDIAN_TEMPLATE_NAME,
        version: MERIDIAN_TEMPLATE_VERSION,
      },
    });

    await db.meridianQuestion.createMany({
      data: MERIDIAN_BATTERY.map((question) => ({
        tenantId: input.tenantId,
        templateId: template.id,
        code: question.code,
        axis: question.axis,
        ordinal: question.ordinal,
        type: question.type,
        text: question.text,
        weight: question.weight,
        inverted: question.inverted,
        scaleLabels: question.scaleLabels,
      })),
    });

    await logPlatformAudit(db, {
      tenantId: input.tenantId,
      actorUserId: input.actorUserId,
      actorName: input.actorName,
      action: "meridian.bootstrapped",
      entityType: "MeridianTemplate",
      entityId: template.id,
      target: `${tenant.slug} · ${MERIDIAN_BATTERY.length} perguntas`,
    });

    return { templateId: template.id, created: true };
  });
}
