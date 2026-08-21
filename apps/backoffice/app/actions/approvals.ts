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
import { err, type Result, safeAction } from "@/lib/safe-action";

/**
 * Fila de aprovação do Big Bang (SRD FR-8).
 *
 * Existe porque cinco operações não executam no clique, por decisão de produto
 * (PRD §6.3): deleção de tenant, MCP writes avançadas, desconto acima de 15%,
 * export sensível e mudança grande de plano. Todas viram `PENDING_APPROVAL`.
 *
 * Ler é de todo staff; decidir é escrita e passa por `assertCanWrite`. A
 * distinção não é cosmética: auditar sem poder mudar nada é exatamente o papel
 * de Security interno descrito no FR-0.
 */

export type PlatformApprovalRow = {
  id: string;
  acao: string;
  alvoTipo: string;
  alvoLabel: string;
  motivo: string;
  impacto: string;
  status: string;
  solicitanteNome: string | null;
  criadoEm: string;
  decisorNome: string | null;
  decididoEm: string | null;
  nota: string | null;
};

const StatusFiltro = z.enum(["PENDING_APPROVAL", "APPROVED", "REJECTED"]);

export async function listPlatformApprovals(
  status?: string
): Promise<Result<PlatformApprovalRow[]>> {
  return await safeAction(async () => {
    // Sem assertCanWrite de propósito: leitura é de todo staff.
    await requirePlatformStaff();

    const filtro = StatusFiltro.safeParse(status);
    const rows = await database.platformApproval.findMany({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        ...(filtro.success ? { status: filtro.data } : {}),
      },
      orderBy: { criadoEm: "desc" },
      take: 200,
    });

    return rows.map((r) => ({
      id: r.id,
      acao: r.acao,
      alvoTipo: r.alvoTipo,
      alvoLabel: r.alvoLabel,
      motivo: r.motivo,
      impacto: r.impacto,
      status: r.status,
      solicitanteNome: r.solicitanteNome,
      criadoEm: r.criadoEm.toISOString(),
      decisorNome: r.decisorNome,
      decididoEm: r.decididoEm ? r.decididoEm.toISOString() : null,
      nota: r.nota,
    }));
  });
}

/**
 * FR-8.2 — motivo e impacto são obrigatórios na **criação**, não campos que o
 * solicitante preenche depois se lembrar. Aprovador sem contexto ou aprova no
 * escuro ou trava a fila; nenhum dos dois é decisão.
 */
const PedidoSchema = z.object({
  acao: z.string().min(1).max(64),
  alvoTipo: z.enum(["tenant", "module", "policy", "export", "proposal"]),
  alvoId: z.string().min(1),
  alvoLabel: z.string().min(1).max(200),
  motivo: z.string().min(10, "O motivo precisa dizer por quê."),
  impacto: z.string().min(1, "O impacto estimado é obrigatório."),
  payload: z.record(z.string(), z.unknown()).optional(),
  targetTenantId: z.string().optional(),
});

export async function requestPlatformApproval(
  input: z.input<typeof PedidoSchema>
): Promise<Result<{ id: string }>> {
  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    // Pedir é escrita: quem só lê não enfileira operação sensível.
    assertCanWrite(staff);

    const dados = PedidoSchema.parse(input);

    const criado = await database.platformApproval.create({
      data: {
        tenantId: SYSTEM_TENANT_ID,
        acao: dados.acao,
        alvoTipo: dados.alvoTipo,
        alvoId: dados.alvoId,
        alvoLabel: dados.alvoLabel,
        motivo: dados.motivo,
        impacto: dados.impacto,
        payload: (dados.payload ?? {}) as object,
        status: "PENDING_APPROVAL",
        solicitanteId: staff.userId,
        solicitanteNome: staff.name,
        targetTenantId: dados.targetTenantId ?? null,
      },
      select: { id: true },
    });

    // O pedido entra na trilha, não só a decisão. Sem isto o Audit Explorer
    // (FR-10.3) mostra quem liberou e não mostra quem pediu — e não mostra de
    // jeito nenhum o pedido que foi criado e nunca decidido, que é justamente
    // o que uma auditoria procura. A linha existe em `PlatformApproval`, mas
    // quem audita olha o `AuditLog`.
    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: "requested",
      entityType: "platform_approval",
      entityId: criado.id,
      // Sem `diff`: criação não tem estado anterior, e `AuditDiff` exige
      // `before: string`. O motivo é o que carrega contexto aqui, e ele já é
      // obrigatório na criação (FR-8.2) — vai na nota.
      note: dados.motivo,
      target: `${dados.acao} · ${dados.alvoLabel}`,
    });

    revalidatePath("/aprovacoes");
    return { id: criado.id };
  });
}

const DecisaoSchema = z.object({
  id: z.string().min(1),
  outcome: z.enum(["APPROVED", "REJECTED"]),
  nota: z.string().max(2000).optional(),
});

export async function decidePlatformApprovalAction(
  input: z.input<typeof DecisaoSchema>
): Promise<Result<{ status: string }>> {
  const dados = DecisaoSchema.safeParse(input);
  if (!dados.success) {
    return err("Decisão inválida.");
  }

  return await safeAction(async () => {
    const staff = await requirePlatformStaff();
    assertCanWrite(staff);

    const pedido = await database.platformApproval.findFirst({
      where: { id: dados.data.id, tenantId: SYSTEM_TENANT_ID },
      select: {
        id: true,
        status: true,
        acao: true,
        alvoLabel: true,
        solicitanteId: true,
      },
    });
    if (!pedido) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Pedido de aprovação não encontrado."
      );
    }

    // A fila existe para separar quem pede de quem aprova. Sem esta checagem
    // ela é decorativa: a operação sensível volta a executar no clique, só que
    // com um passo a mais e a aparência de ter sido revisada — que é pior que
    // não ter fila, porque a auditoria mostra um aprovador.
    //
    // Vale também para rejeitar: retirar o próprio pedido da fila sem ninguém
    // olhar é o mesmo furo ao contrário.
    if (pedido.solicitanteId === staff.userId) {
      throw new StaffAuthError(
        "FORBIDDEN",
        "Você pediu esta operação e não pode decidi-la. Outra pessoa da equipe precisa revisar."
      );
    }

    // FR-8.5 — pedido decidido mostra a decisão em vez dos botões. O servidor
    // recusa de novo: dois aprovadores abrindo a fila juntos é o caso normal,
    // não a exceção, e o segundo clique não pode sobrescrever o primeiro.
    if (pedido.status !== "PENDING_APPROVAL") {
      // `throw` puro aqui vira "Não foi possível concluir a operação." no
      // safeAction — o catch genérico existe para erro inesperado, e violação
      // de regra não é inesperada: é a resposta. StaffAuthError preserva a
      // mensagem porque safeAction a traduz em vez de engolir.
      throw new StaffAuthError(
        "FORBIDDEN",
        `Este pedido já foi decidido (${pedido.status}) e não aceita nova decisão.`
      );
    }

    await database.platformApproval.update({
      where: { id: pedido.id },
      data: {
        status: dados.data.outcome,
        decisorId: staff.userId,
        decisorNome: staff.name,
        decididoEm: new Date(),
        nota: dados.data.nota ?? null,
      },
    });

    // A decisão entra na trilha, não só o pedido. Sem isto a fila registra
    // metade do ato: fica gravado que alguém pediu, e não quem liberou — que é
    // exatamente a pergunta que uma auditoria faz.
    await logPlatformAudit(database, {
      tenantId: SYSTEM_TENANT_ID,
      actorUserId: staff.userId,
      actorName: staff.name,
      action: dados.data.outcome === "APPROVED" ? "approved" : "rejected",
      entityType: "platform_approval",
      entityId: pedido.id,
      target: `${pedido.acao} · ${pedido.alvoLabel}`,
      diff: [["status", pedido.status, dados.data.outcome]],
    });

    // FR-8.4 diz que aprovar executa a ação original. Ainda não há o que
    // executar: nenhuma das cinco operações sensíveis existe (deleção de
    // tenant, MCP full, desconto >15%, export sensível, mudança de plano são
    // ondas 3 a 5). O despacho entra junto com a primeira delas, lendo
    // `payload` — que já é gravado aqui para não precisar de migration depois.
    revalidatePath("/aprovacoes");
    return { status: dados.data.outcome };
  });
}
