/**
 * Os gatilhos comerciais da proposta (FR-13.6).
 *
 * Quatro dos cinco avisos informam; só o desconto bloqueia. A assimetria é
 * deliberada: bloquear por pré-requisito faltando impediria vender para um
 * cliente que já tem o equivalente feito, e quem sabe disso é o vendedor na
 * call, não o sistema. Já o desconto acima do teto não é opinião — é alçada,
 * e alçada que a UI pudesse ignorar não seria alçada.
 *
 * Puro como a fórmula, e pelo mesmo motivo: a tela mostra, o servidor confere,
 * e os dois precisam chegar à mesma conclusão.
 */

import { LIMITE_DESCONTO_SEM_APROVACAO } from "../comercial";

export type ChaveDeAviso =
  | "ASSENTOS_ACIMA_DO_PLANO"
  | "ADDON_EXIGE_ENTERPRISE"
  | "DESCONTO_EXIGE_APROVACAO"
  | "PRE_REQUISITO_FORA_DO_ESCOPO"
  | "DEPENDE_DO_LAB";

export type Aviso = {
  chave: ChaveDeAviso;
  texto: string;
  tom: "amber" | "red" | "blue";
  /** Só o desconto impede o envio; o resto informa quem está negociando. */
  bloqueiaEnvio: boolean;
};

export type EntradaDeValidacao = {
  plano: {
    nome: string;
    /** Nulo = ilimitado; nesse caso assentos nunca acusam. */
    limiteUsuarios: number | null;
    permiteRolesCustom: boolean;
  };
  assentos: number;
  descontoPercent: number;
  addOns: { nome: string; exigeRolesCustom: boolean }[];
  servicos: {
    codigo: string;
    nome: string;
    exigeLab: boolean;
    preRequisitos: string[];
  }[];
};

export function validarProposta(entrada: EntradaDeValidacao): Aviso[] {
  const avisos: Aviso[] = [];

  if (
    entrada.plano.limiteUsuarios !== null &&
    entrada.assentos > entrada.plano.limiteUsuarios
  ) {
    avisos.push({
      chave: "ASSENTOS_ACIMA_DO_PLANO",
      texto: `${entrada.assentos} assentos passa do limite de ${entrada.plano.limiteUsuarios} do ${entrada.plano.nome} — subir de plano ou negociar limite custom.`,
      tom: "amber",
      bloqueiaEnvio: false,
    });
  }

  if (!entrada.plano.permiteRolesCustom) {
    for (const addOn of entrada.addOns.filter((a) => a.exigeRolesCustom)) {
      avisos.push({
        chave: "ADDON_EXIGE_ENTERPRISE",
        texto: `${addOn.nome} depende de roles custom, que o ${entrada.plano.nome} não inclui.`,
        tom: "amber",
        bloqueiaEnvio: false,
      });
    }
  }

  // Pré-requisito é aviso, não trava: o cliente pode já ter o equivalente
  // feito por outro fornecedor, e o vendedor confirma isso na conversa.
  const noEscopo = new Set(entrada.servicos.map((s) => s.codigo));
  for (const servico of entrada.servicos) {
    for (const requisito of servico.preRequisitos) {
      if (!noEscopo.has(requisito)) {
        avisos.push({
          chave: "PRE_REQUISITO_FORA_DO_ESCOPO",
          texto: `${servico.nome} pressupõe ${requisito}, que não está no escopo — confirmar se o cliente já tem equivalente feito.`,
          tom: "amber",
          bloqueiaEnvio: false,
        });
      }
    }
  }

  const comLab = entrada.servicos.filter((s) => s.exigeLab);
  if (comLab.length > 0) {
    avisos.push({
      chave: "DEPENDE_DO_LAB",
      texto: `${comLab.map((s) => s.nome).join(", ")} depende de capacidade no LAB — checar a fila de treino antes de prometer prazo.`,
      tom: "blue",
      bloqueiaEnvio: false,
    });
  }

  // `>` estrito: exatamente no teto ainda envia direto. Mesmo operador do
  // servidor em app/actions/proposals.ts — se os dois discordassem, a tela
  // prometeria um envio que a action recusaria.
  if (entrada.descontoPercent > LIMITE_DESCONTO_SEM_APROVACAO) {
    avisos.push({
      chave: "DESCONTO_EXIGE_APROVACAO",
      texto: `Desconto de ${entrada.descontoPercent}% passa de ${LIMITE_DESCONTO_SEM_APROVACAO}% e exige aprovação de RevOps antes de enviar.`,
      tom: "red",
      bloqueiaEnvio: true,
    });
  }

  return avisos;
}
