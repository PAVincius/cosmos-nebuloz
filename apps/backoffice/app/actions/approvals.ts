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

/** `DECIDIDOS` é aprovado ou rejeitado: a tela separa o que ainda espera
 *  decisão do que já foi decidido, e os dois lados são consultas próprias —
 *  um `take` só sobre tudo cortava pendentes antigos quando os decididos
 *  recentes enchiam a página. */
const StatusFiltro = z.enum([
  "PENDING_APPROVAL",
  "APPROVED",
  "REJECTED",
  "DECIDIDOS",
]);

function whereDeStatus(status: string | undefined) {
  const filtro = StatusFiltro.safeParse(status);
  if (!filtro.success) {
    return {};
  }
  if (filtro.data === "DECIDIDOS") {
    return { status: { in: ["APPROVED", "REJECTED"] } };
  }
  return { status: filtro.data };
}

export async function listPlatformApprovals(
  status?: string
): Promise<Result<PlatformApprovalRow[]>> {
  return await safeAction(async () => {
    // Sem assertCanWrite de propósito: leitura é de todo staff.
    await requirePlatformStaff();

    const rows = await database.platformApproval.findMany({
      where: {
        tenantId: SYSTEM_TENANT_ID,
        ...whereDeStatus(status),
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
        // Os dois são o que o despacho lê para saber o que executar. Fora do
        // select eles chegam `undefined`, e a aprovação voltaria a não fazer
        // nada — só que silenciosamente, que é pior do que não despachar.
        alvoTipo: true,
        alvoId: true,
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

    // FR-8.4 — aprovar executa a ação original.
    //
    // A primeira das cinco operações sensíveis chegou: o desconto acima do
    // limite. Sem este despacho a fila era um beco — a proposta entrava em
    // AGUARDANDO_APROVACAO, alguém aprovava, e nada acontecia com ela; nenhuma
    // action escrevia ENVIADA a partir daquele estado.
    //
    // O despacho vem depois da auditoria, e falha dele não desfaz a decisão:
    // decidir é o registro, executar é o efeito. Perder o efeito é um problema
    // que se resolve reenviando; perder o registro de quem decidiu, não.
    await despacharAcaoAprovada(pedido, dados.data.outcome);

    revalidatePath("/aprovacoes");
    return { status: dados.data.outcome };
  });
}

/**
 * Executa o que foi aprovado.
 *
 * Um despachante por `alvoTipo`. Hoje só `proposal` tem executor — as outras
 * quatro operações sensíveis do PRD §6.3 ainda não existem, e alvo sem
 * despachante passa em silêncio de propósito: a decisão já foi registrada e
 * auditada, e faltar efeito não pode impedir o registro.
 *
 * Não é exportado: chamar isto fora do fluxo de decisão executaria uma ação
 * sensível sem passar pela alçada, que é justamente o que a fila existe para
 * impedir.
 */
async function despacharAcaoAprovada(
  pedido: { id: string; alvoTipo: string; alvoId: string },
  outcome: "APPROVED" | "REJECTED"
): Promise<void> {
  if (pedido.alvoTipo !== "proposal") {
    return;
  }

  const proposta = await database.proposal.findFirst({
    where: { id: pedido.alvoId, tenantId: SYSTEM_TENANT_ID },
    select: { id: true, numero: true, status: true },
  });

  // Só age sobre a proposta que ainda está esperando esta decisão. Se ela já
  // andou — foi aceita, recusada, ou o pedido é antigo —, mexer agora
  // reescreveria um estado mais novo com um mais velho.
  if (!proposta || proposta.status !== "AGUARDANDO_APROVACAO") {
    return;
  }

  // Rejeitado volta para rascunho, não morre: desconto recusado costuma virar
  // desconto menor, e uma proposta presa obrigaria a redigitar tudo.
  const novoStatus = outcome === "APPROVED" ? "ENVIADA" : "RASCUNHO";

  await database.proposal.update({
    where: { id: proposta.id },
    data: {
      status: novoStatus,
      // Campo que existia no schema e nunca era escrito: sem ele a proposta
      // não sabe dizer qual decisão destravou o desconto dela.
      ...(outcome === "APPROVED" ? { aprovacaoId: pedido.id } : {}),
    },
  });

  revalidatePath("/propostas");
  revalidatePath(`/propostas/${proposta.id}`);
}
