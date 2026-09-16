"use client";

import { BotaoPrimario } from "@/components/campo";
import { ConfirmarAcao } from "@/components/confirmar-acao";

/**
 * O painel de envio do gerador — e o que decide se a tela está à frente do
 * banco.
 *
 * Saiu de `gerador.tsx` pela catraca de tamanho (921 linhas de baseline). É
 * um bloco coeso: a assinatura do escopo gravado, a regra de "pode enviar",
 * e os botões Salvar / "Salvar e enviar" / Enviar com a barreira. O `Gerador`
 * continua dono do estado e das actions; aqui só se decide o que o botão diz
 * e quando ele trava.
 */

/** FR-13.7: enviar exige contato com e-mail — o servidor valida de novo. */
const EMAIL = /.+@.+\..+/;

/** O escopo como `salvarEscopoAction` o recebe. */
export type EscopoDaProposta = {
  titulo: string;
  clienteNome: string | undefined;
  contatoEmail: string | undefined;
  planoSlug: string;
  assentos: number;
  modulos: string[];
  addOnSlugs: string[];
  termoSlug: string;
  descontoPercent: number;
  servicoIds: string[];
};

/** O escopo em texto e com as listas ordenadas — é o que se compara com a
 *  última gravação para saber se a tela está à frente do banco. Ordenar
 *  porque marcar COSMOS e depois CHARTER é o mesmo escopo que marcar na ordem
 *  inversa. */
export function assinaturaDoEscopo(escopo: EscopoDaProposta): string {
  return JSON.stringify({
    ...escopo,
    modulos: [...escopo.modulos].sort(),
    addOnSlugs: [...escopo.addOnSlugs].sort(),
    servicoIds: [...escopo.servicoIds].sort(),
  });
}

/** Título, contato com e-mail válido e ao menos um módulo — o mínimo que o
 *  servidor aceita para enviar. */
export function podeEnviarProposta(
  titulo: string,
  contato: string,
  modulos: string[]
): boolean {
  return titulo.trim().length >= 2 && EMAIL.test(contato) && modulos.length > 0;
}

/** O que o botão de envio diz. "Salvar e enviar" vence os outros dois: com
 *  edição pendente, o nome precisa avisar que vai gravar antes. */
function rotuloDeEnvio(sujo: boolean, precisaAprovacao: boolean): string {
  if (sujo) {
    return "Salvar e enviar";
  }
  return precisaAprovacao ? "Enviar para aprovação" : "Enviar proposta";
}

export function PainelDeEnvio({
  editavel,
  somenteLeitura,
  temRascunho,
  salvando,
  podeEnviar,
  sujo,
  precisaAprovacao,
  titulo,
  cliente,
  onEnviar,
}: {
  /** Pode escrever e a proposta ainda é rascunho. */
  editavel: boolean;
  /** A proposta já saiu da casa — o cartão de bloqueio mora no `Gerador`. */
  somenteLeitura: boolean;
  /** Já existe rascunho gravado; sem ele, só "Criar rascunho". */
  temRascunho: boolean;
  salvando: boolean;
  podeEnviar: boolean;
  /** A tela está à frente do que foi gravado. */
  sujo: boolean;
  precisaAprovacao: boolean;
  titulo: string;
  cliente: string;
  onEnviar: () => void;
}) {
  if (!editavel) {
    if (somenteLeitura) {
      return null;
    }
    return (
      <span style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}>
        Somente leitura: seu papel no back-office é MEMBER. Um ADMIN precisa
        fazer esta ação.
      </span>
    );
  }

  // Rótulo, alvo e consequência — fora do JSX para o lint não ler o ternário
  // como valor vazando para o render.
  const rotulo = rotuloDeEnvio(sujo, precisaAprovacao);
  const consequencia = precisaAprovacao
    ? "A proposta vai para a fila de aprovação; não há como editar depois de enviada."
    : "O cliente recebe esta versão; não há como editar depois de enviada.";
  const alvo = cliente.trim()
    ? `${titulo.trim()} · ${cliente.trim()}`
    : titulo.trim();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <BotaoPrimario disabled={salvando || !podeEnviar}>
        {temRascunho ? "Salvar alterações" : "Criar rascunho"}
      </BotaoPrimario>
      {temRascunho ? (
        // Enviar é sem volta — o servidor não deixa editar depois. O grid
        // faz o gatilho ocupar a largura do botão de cima.
        <div style={{ display: "grid" }}>
          <ConfirmarAcao
            alvo={alvo}
            consequencia={consequencia}
            desabilitado={!podeEnviar}
            executando={salvando}
            onConfirmar={onEnviar}
            rotulo={rotulo}
            tom="accent"
          />
        </div>
      ) : null}
      {podeEnviar ? null : (
        <span style={{ fontSize: "var(--fs-nota)", color: "var(--ink-faint)" }}>
          Para enviar: título, contato com e-mail válido e ao menos um módulo.
        </span>
      )}
    </div>
  );
}
