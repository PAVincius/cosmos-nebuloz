"use server";

import { database } from "@repo/database";
import { logPlatformAudit } from "@repo/provisioning";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assertCanWrite,
  requirePlatformStaff,
  StaffAuthError,
  SYSTEM_TENANT_ID,
} from "@/lib/guard";
import { type Result, safeAction } from "@/lib/safe-action";

/**
 * Capacidade da equipe da Nebuloz, distribuída entre engajamentos.
 *
 * **Por pessoa, não por papel.** A equipe é multidisciplinar e a maioria é
 * fullstack; modelar por papel obrigaria a eleger um papel principal para cada
 * um e perderia exatamente a flexibilidade que existe. Habilidades são lista
 * pelo mesmo motivo.
 *
 * Isto não é o `TeamCapacitySnapshot` do Cosmos: aquele é capacidade de time
 * ágil DENTRO de um tenant. Este é a equipe da casa ENTRE clientes. Nomes
 * parecidos, assuntos diferentes.
 */

/** Acima disso é sobrecarga. Não é proibido — é o que exige justificativa. */
const CAPACIDADE_TOTAL = 100;

export type PessoaCapacidade = {
  id: string;
  nome: string;
  email: string;
  habilidades: string[];
  horasSemana: number;
  ativo: boolean;
  /** Soma das alocações em curso hoje. */
  ocupacaoAtual: number;
  alocacoes: {
    percentual: number;
    engajamento: string;
    inicioEm: string;
    fimEm: string | null;
  }[];
};

/** Se dois intervalos se cruzam. Fim aberto (`null`) significa "sem previsão de
 *  término", então cruza com tudo que vier depois do início. */
function cruzam(
  aInicio: Date,
  aFim: Date | null,
  bInicio: Date,
  bFim: Date | null
): boolean {
  const aTerminaAntes = aFim !== null && aFim < bInicio;
  const bTerminaAntes = bFim !== null && bFim < aInicio;
  return !(aTerminaAntes || bTerminaAntes);
}

export async function listCapacity(): Promise<Result<PessoaCapacidade[]>> {
  return await safeAction(async () => {
    await requirePlatformStaff();

    const pessoas = await database.staffPerson.findMany({
      where: { tenantId: SYSTEM_TENANT_ID },
      orderBy: [{ ativo: "desc" }, { nome: "asc" }],
      select: {
        id: true,
        nome: true,
        email: true,
        habilidades: true,
        horasSemana: true,
        ativo: true,
        alocacoes: {
          orderBy: { inicioEm: "desc" },
          select: {
            percentual: true,
            inicioEm: true,
            fimEm: true,
            engagement: { select: { codigo: true, nome: true } },
          },
        },
      },
    });

    const hoje = new Date();

    return pessoas.map((p) => ({
      id: p.id,
      nome: p.nome,
      email: p.email,
      habilidades: p.habilidades,
      horasSemana: p.horasSemana,
      ativo: p.ativo,
      // Só o que está em curso HOJE. Somar alocação encerrada mostraria alguém
      // ocupado por trabalho que já acabou.
      ocupacaoAtual: p.alocacoes
        .filter((a) => cruzam(a.inicioEm, a.fimEm, hoje, hoje))
        .reduce((s, a) => s + a.percentual, 0),
      alocacoes: p.alocacoes.map((a) => ({
        percentual: a.percentual,
        engajamento: `${a.engagement.codigo} · ${a.engagement.nome}`,
        inicioEm: a.inicioEm.toISOString(),
        fimEm: a.fimEm ? a.fimEm.toISOString() : null,
      })),
    }));
  });
}

const PessoaSchema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email(),
  habilidades: z.array(z.string().min(1).max(40)).max(20).optional(),
  horasSemana: z.number().int().min(1).max(80).optional(),
});

export async function createPersonAction(
  input: z.input<typeof PessoaSchema>
): Promise<Result<{ id: string; nome: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = PessoaSchema.parse(input);
    const email = dados.email.trim().toLowerCase();

    const jaExiste = await database.staffPerson.findFirst({
      where: { tenantId: SYSTEM_TENANT_ID, email },
      select: { id: true },
    });
    if (jaExiste) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `${email} já está cadastrado. Duas linhas para a mesma pessoa dividiriam a ocupação dela em duas e as duas pareceriam livres.`
      );
    }

    const criada = await database.staffPerson.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        nome: dados.nome,
        email,
        habilidades: dados.habilidades ?? [],
        horasSemana: dados.horasSemana ?? 40,
      },
      select: { id: true, nome: true },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "staff_person",
      entityId: criada.id,
      target: `${dados.nome} · ${email}`,
    });

    revalidatePath("/capacidade");
    return criada;
  });
}

const AlocarSchema = z.object({
  personId: z.string().min(1),
  engagementId: z.string().min(1),
  percentual: z.number().int().min(1).max(100),
  inicioEm: z.string().min(1),
  fimEm: z.string().optional(),
  /** Obrigatório quando a soma no período passa de 100%. */
  motivoExcesso: z.string().min(10).max(300).optional(),
});

export async function allocatePersonAction(
  input: z.input<typeof AlocarSchema>
): Promise<Result<{ id: string; ocupacaoNoPeriodo: number }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const dados = AlocarSchema.parse(input);
    const inicio = new Date(dados.inicioEm);
    const fim = dados.fimEm ? new Date(dados.fimEm) : null;
    if (fim && fim < inicio) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "O fim não pode ser antes do início."
      );
    }

    const pessoa = await database.staffPerson.findFirst({
      where: { id: dados.personId, tenantId: SYSTEM_TENANT_ID },
      select: { id: true, nome: true, email: true, horasSemana: true },
    });
    if (!pessoa) {
      throw new StaffAuthError("FORBIDDEN", "Pessoa não encontrada.");
    }

    const engajamento = await database.engagement.findFirst({
      where: { id: dados.engagementId, tenantId: SYSTEM_TENANT_ID },
      select: { id: true, codigo: true, nome: true },
    });
    if (!engajamento) {
      throw new StaffAuthError("FORBIDDEN", "Engajamento não encontrado.");
    }

    // Só as alocações cujo período CRUZA o novo. Tratar todas como
    // concorrentes diria que ninguém cabe em lugar nenhum, e a tela viraria
    // ruído que se aprende a ignorar.
    const existentes = await database.staffAllocation.findMany({
      where: { personId: pessoa.id },
      select: { percentual: true, inicioEm: true, fimEm: true },
    });
    const concorrentes = existentes.filter((a) =>
      cruzam(a.inicioEm, a.fimEm, inicio, fim)
    );
    const jaOcupado = concorrentes.reduce((s, a) => s + a.percentual, 0);
    const total = jaOcupado + dados.percentual;

    // Passar de 100% é permitido — a realidade às vezes é de sobrecarga, e
    // recusar sempre impediria registrá-la. Mas nunca em silêncio: sem motivo,
    // a tela mostraria alguém a 150% sem ninguém ter decidido isso.
    if (total > CAPACIDADE_TOTAL && !dados.motivoExcesso) {
      throw new StaffAuthError(
        "FORBIDDEN",
        `${pessoa.nome} já está em ${jaOcupado}% neste período; somar ${dados.percentual}% daria ${total}%. Se for intencional, escreva o motivo da sobrecarga.`
      );
    }

    const criada = await database.staffAllocation.create({
      data: {
        personId: pessoa.id,
        engagementId: engajamento.id,
        percentual: dados.percentual,
        inicioEm: inicio,
        fimEm: fim,
        nota: dados.motivoExcesso ?? null,
      },
      select: { id: true },
    });

    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "created",
      entityType: "staff_allocation",
      entityId: criada.id,
      target: `${pessoa.nome} → ${engajamento.codigo} (${dados.percentual}%)`,
      // O motivo da sobrecarga vai para a trilha, não só para a linha: é o que
      // permite perguntar depois por que alguém passou de 100% em março.
      note: dados.motivoExcesso,
    });

    revalidatePath("/capacidade");
    return { id: criada.id, ocupacaoNoPeriodo: total };
  });
}
