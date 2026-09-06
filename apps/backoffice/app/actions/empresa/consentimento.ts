"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AVISOS,
  camposEmAberto,
  type PecaDoAviso,
  renderAviso,
} from "@/lib/empresa/aviso";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Consentimento de gravação — o lado da Nebuloz
 * (docs/compliance/aviso-de-gravacao.md). O produto garante que alguém afirmou
 * ter consentimento; isto é o que faz o consentimento existir: o aviso, a
 * cláusula e a base legal que o parecer ainda não escolheu.
 */

export const ROTA_CONSENTIMENTO = "/empresa/consentimento";

const BASES = ["SEM_DECISAO", "CONSENTIMENTO", "LEGITIMO_INTERESSE"] as const;
const PARECERES = ["PENDENTE", "ENVIADO", "RECEBIDO"] as const;

export type DecisaoView = {
  ferramenta: string | null;
  prazoRetencao: string | null;
  contatoTitular: string | null;
  baseLegal: (typeof BASES)[number];
  standingHabilitavel: boolean | null;
  parecer: (typeof PARECERES)[number];
  parecerEnviadoEm: string | null;
  parecerRecebidoEm: string | null;
};

export type PerguntaView = {
  numero: number;
  pergunta: string;
  donoPapel: string;
  resposta: string | null;
  respondidaEm: string | null;
};

export type ConsentimentoView = {
  decisao: DecisaoView;
  camposEmAberto: string[];
  avisos: {
    peca: PecaDoAviso;
    titulo: string;
    nota: string;
    texto: string;
    abertos: string[];
  }[];
  perguntas: PerguntaView[];
  abertas: number;
};

const VAZIA: DecisaoView = {
  ferramenta: null,
  prazoRetencao: null,
  contatoTitular: null,
  baseLegal: "SEM_DECISAO",
  standingHabilitavel: null,
  parecer: "PENDENTE",
  parecerEnviadoEm: null,
  parecerRecebidoEm: null,
};

const SELECT_DECISAO = {
  ferramenta: true,
  prazoRetencao: true,
  contatoTitular: true,
  baseLegal: true,
  standingHabilitavel: true,
  parecer: true,
  parecerEnviadoEm: true,
  parecerRecebidoEm: true,
} as const;

type DecisaoDb = Omit<DecisaoView, "parecerEnviadoEm" | "parecerRecebidoEm"> & {
  parecerEnviadoEm: Date | null;
  parecerRecebidoEm: Date | null;
};

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

function paraDecisao(d: DecisaoDb | null): DecisaoView {
  if (!d) {
    return VAZIA;
  }
  return {
    ...d,
    parecerEnviadoEm: iso(d.parecerEnviadoEm),
    parecerRecebidoEm: iso(d.parecerRecebidoEm),
  };
}

async function lerDecisao(): Promise<DecisaoView> {
  const d = (await database.decisaoDeConsentimento.findUnique({
    where: { tenantId: SYSTEM_TENANT_ID },
    select: SELECT_DECISAO,
  })) as DecisaoDb | null;
  return paraDecisao(d);
}

const PECAS: PecaDoAviso[] = [
  "INTERNA_PT",
  "EXTERNA_PT",
  "EXTERNA_EN",
  "CLAUSULA_PT",
];

export async function lerConsentimento(): Promise<Result<ConsentimentoView>> {
  return await safeAction(async () => {
    await requirePlatformStaff();
    const [decisao, perguntas] = await Promise.all([
      lerDecisao(),
      database.perguntaAoParecer.findMany({
        where: { tenantId: SYSTEM_TENANT_ID },
        orderBy: { numero: "asc" },
        select: {
          numero: true,
          pergunta: true,
          donoPapel: true,
          resposta: true,
          respondidaEm: true,
        },
      }),
    ]);
    const avisos = PECAS.map((peca) => ({
      peca,
      ...AVISOS[peca],
      ...renderAviso(peca, decisao),
    }));
    const lista = perguntas.map((p) => ({
      ...p,
      respondidaEm: iso(p.respondidaEm),
    }));
    return {
      decisao,
      camposEmAberto: camposEmAberto(decisao),
      avisos,
      perguntas: lista,
      abertas: lista.filter((p) => p.resposta === null).length,
    };
  });
}

const DecisaoSchema = z.object({
  ferramenta: z.string().nullable().optional(),
  prazoRetencao: z.string().nullable().optional(),
  contatoTitular: z.string().nullable().optional(),
  baseLegal: z.enum(BASES).optional(),
  standingHabilitavel: z.boolean().nullable().optional(),
});

function soDefinidos<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => v !== undefined)
  ) as Partial<T>;
}

async function gravarDecisao(
  update: Record<string, unknown>,
  staff: { userId: string; name: string | null },
  action: string
): Promise<DecisaoView> {
  const d = (await database.decisaoDeConsentimento.upsert({
    where: { tenantId: SYSTEM_TENANT_ID },
    create: { tenantId: SYSTEM_TENANT_ID, ...update },
    update,
    select: SELECT_DECISAO,
  })) as DecisaoDb;
  await logPlatformAudit(database, {
    tenantId: SYSTEM_TENANT_ID,
    actorUserId: staff.userId,
    actorName: staff.name,
    action,
    entityType: "DecisaoDeConsentimento",
    entityId: SYSTEM_TENANT_ID,
    target: "consentimento de gravação",
    diff: Object.entries(update).map(([k, v]): [string, string, string] => [
      k,
      "",
      String(v ?? ""),
    ]),
  });
  revalidatePath(ROTA_CONSENTIMENTO);
  return paraDecisao(d);
}

export async function salvarDecisao(
  input: z.infer<typeof DecisaoSchema>
): Promise<Result<DecisaoView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const update = soDefinidos(DecisaoSchema.parse(input));
    return await gravarDecisao(update, staff, "empresa.consentimento.decisao");
  });
}

const RespostaSchema = z.object({
  numero: z.number().int().min(1),
  resposta: z.string().nullable(),
});

export async function responderPergunta(
  input: z.infer<typeof RespostaSchema>
): Promise<Result<PerguntaView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { numero, resposta } = RespostaSchema.parse(input);
    const where = { tenantId_numero: { tenantId: SYSTEM_TENANT_ID, numero } };

    const existe = await database.perguntaAoParecer.findUnique({
      where,
      select: { numero: true },
    });
    if (!existe) {
      throw new StaffAuthError("FORBIDDEN", `Pergunta ${numero} não existe.`);
    }
    const texto = resposta?.trim() ? resposta.trim() : null;
    const p = await database.perguntaAoParecer.update({
      where,
      data: { resposta: texto, respondidaEm: texto ? new Date() : null },
      select: {
        numero: true,
        pergunta: true,
        donoPapel: true,
        resposta: true,
        respondidaEm: true,
      },
    });
    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "empresa.consentimento.responder",
      entityType: "PerguntaAoParecer",
      entityId: String(numero),
      target: `pergunta ${numero}`,
    });
    revalidatePath(ROTA_CONSENTIMENTO);
    return { ...p, respondidaEm: iso(p.respondidaEm) };
  });
}

const ParecerSchema = z.object({ status: z.enum(["ENVIADO", "RECEBIDO"]) });

export async function marcarParecer(
  input: z.infer<typeof ParecerSchema>
): Promise<Result<DecisaoView>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);
    const { status } = ParecerSchema.parse(input);
    const atual = await lerDecisao();
    if (status === "RECEBIDO" && atual.parecer !== "ENVIADO") {
      throw new StaffAuthError(
        "FORBIDDEN",
        "O parecer só pode ser recebido depois de enviado."
      );
    }
    const update =
      status === "ENVIADO"
        ? { parecer: status, parecerEnviadoEm: new Date() }
        : { parecer: status, parecerRecebidoEm: new Date() };
    return await gravarDecisao(
      update,
      staff,
      `empresa.consentimento.parecer_${status.toLowerCase()}`
    );
  });
}
