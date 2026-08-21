"use client";

import { useCallback, useReducer } from "react";
import { authClient, type RespostaDeErro } from "./client";

/**
 * Cadastro de segundo fator por aplicativo autenticador.
 *
 * O fluxo vivia dentro de `apps/app/app/onboarding/components/onboarding-wizard.tsx`,
 * alcançável só no onboarding e com três defeitos que esta extração fecha:
 *
 * 1. O QR era montado por `api.qrserver.com`, com o `otpauth://` — que carrega
 *    a chave compartilhada — numa query string. O segredo do segundo fator saía
 *    para um terceiro. Aqui o hook devolve a URI e quem desenha é o cliente.
 * 2. Os códigos de backup apareciam assim que `enable()` voltava, antes de
 *    qualquer verificação. Este hook os retém até o `verifyTotp` passar.
 * 3. `verifyTotp` era chamado dentro de `try/catch` sem checar o retorno. O
 *    cliente do better-auth devolve `{ error }` em vez de lançar, então código
 *    errado avançava o wizard como se tivesse verificado.
 *
 * Sem JSX de propósito: as duas apps não compartilham design system, e o que
 * elas precisam compartilhar é a ordem das chamadas, não o markup.
 */

export type PassoDoCadastro = "ocioso" | "senha" | "escaneando" | "codigos";

export type EstadoDoCadastro = {
  passo: PassoDoCadastro;
  /** `otpauth://…`. Nunca sai desta máquina para a rede. */
  totpURI: string | null;
  /** A chave em base32, para quem não consegue escanear. */
  chaveManual: string | null;
  /** Preenchido **apenas** no passo `codigos`. Ver retenção abaixo. */
  backupCodes: string[] | null;
  erro: string | null;
  pendente: boolean;
};

type EstadoInterno = EstadoDoCadastro & {
  /**
   * Os códigos chegam junto com a URI, no `enable()`. Ficam aqui, fora de
   * `backupCodes`, até a confirmação.
   *
   * Entregar código de recuperação para um 2FA que ainda não foi ativado produz
   * um papel que a pessoa guarda achando que vale — e não vale, porque
   * `twoFactorEnabled` só vira `true` depois do `verifyTotp`.
   */
  retidos: string[];
};

type Acao =
  | { tipo: "INICIAR" }
  | { tipo: "PEDIU" }
  | { tipo: "SEGREDO"; totpURI: string; backupCodes: string[] }
  | { tipo: "CONFIRMOU" }
  | { tipo: "FALHOU"; erro: string }
  | { tipo: "CANCELOU" };

const INICIAL: EstadoInterno = {
  passo: "ocioso",
  totpURI: null,
  chaveManual: null,
  backupCodes: null,
  erro: null,
  pendente: false,
  retidos: [],
};

/**
 * A chave em base32 de dentro da `otpauth://`, para digitação manual.
 *
 * `URL` não parseia `otpauth:` como hierárquica em todo runtime, então a busca
 * é feita sobre a query string crua — que é o que o padrão garante.
 */
export function extrairChaveManual(totpURI: string): string | null {
  const query = totpURI.split("?")[1];
  if (!query) {
    return null;
  }
  return new URLSearchParams(query).get("secret");
}

/**
 * Traduz o erro do better-auth para o que a pessoa lê.
 *
 * O ramo do bloqueio por tentativas não é zelo: o plugin trava a conta depois
 * de uma sequência de códigos errados, e sem ele a tela repete "código
 * inválido" para quem já não consegue acertar por outro motivo — o sintoma
 * vira "o 2FA está quebrado".
 *
 * A detecção é por sinal, não por código específico: a lib não documenta um
 * código estável para isso, e casar com uma string exata quebraria calado numa
 * atualização. Status 429 ou menção a bloqueio/tentativas caem aqui; o resto
 * cai no genérico, que é o desfecho seguro.
 */
function traduzirErro(erro: RespostaDeErro, contexto: "senha" | "codigo") {
  const mensagem = erro?.message ?? "";
  const minuscula = mensagem.toLowerCase();

  if (
    erro?.status === 429 ||
    /lock|too many|attempt|bloque|tentativ/.test(minuscula)
  ) {
    return "Muitas tentativas seguidas. A conta ficou bloqueada por alguns minutos — espere e tente de novo.";
  }

  // Só afirma "senha incorreta" quando o servidor disse isso. A versão anterior
  // devolvia essa frase para QUALQUER falha no passo da senha — que é o mesmo
  // defeito do wizard original, e o pior tipo: manda a pessoa conferir uma
  // coisa que está certa enquanto esconde a que está errada.
  if (
    contexto === "senha" &&
    (erro?.status === 401 || /password|credential|senha/.test(minuscula))
  ) {
    return "Senha incorreta.";
  }

  if (
    contexto === "codigo" &&
    (erro?.status === 400 || /code|otp|totp|invalid/.test(minuscula))
  ) {
    return "Código inválido. Confira o aplicativo autenticador.";
  }

  // Desconhecido: repassa o que veio, com o código, em vez de inventar causa.
  // Feio de ler e honesto — e é o que permite diagnosticar sem adivinhação.
  const detalhe = [mensagem, erro?.code, erro?.status]
    .filter(Boolean)
    .join(" · ");
  return detalhe
    ? `Falha ao ativar: ${detalhe}`
    : "Falha ao ativar, sem detalhe do servidor. Recarregue e tente de novo.";
}

function reducer(estado: EstadoInterno, acao: Acao): EstadoInterno {
  switch (acao.tipo) {
    case "INICIAR":
      return { ...INICIAL, passo: "senha" };
    case "PEDIU":
      return { ...estado, pendente: true, erro: null };
    case "SEGREDO":
      return {
        ...estado,
        passo: "escaneando",
        pendente: false,
        erro: null,
        totpURI: acao.totpURI,
        chaveManual: extrairChaveManual(acao.totpURI),
        retidos: acao.backupCodes,
      };
    case "CONFIRMOU":
      return {
        ...estado,
        passo: "codigos",
        pendente: false,
        erro: null,
        backupCodes: estado.retidos,
      };
    case "FALHOU":
      return { ...estado, pendente: false, erro: acao.erro };
    case "CANCELOU":
      return INICIAL;
    default:
      return estado;
  }
}

export type Cadastro = EstadoDoCadastro & {
  iniciar: () => void;
  cancelar: () => void;
  /** Passo 1: confirma a senha e recebe o segredo. Não liga o 2FA ainda. */
  gerarSegredo: (senha: string) => Promise<void>;
  /** Passo 2: é aqui que `twoFactorEnabled` vira `true`. */
  confirmar: (codigo: string) => Promise<void>;
};

export function useTwoFactorEnrollment(): Cadastro {
  const [estado, despachar] = useReducer(reducer, INICIAL);

  const iniciar = useCallback(() => despachar({ tipo: "INICIAR" }), []);
  const cancelar = useCallback(() => despachar({ tipo: "CANCELOU" }), []);

  const gerarSegredo = useCallback(async (senha: string) => {
    despachar({ tipo: "PEDIU" });
    try {
      const resposta = await authClient.twoFactor.enable({ password: senha });
      if (resposta.error) {
        despachar({
          tipo: "FALHOU",
          erro: traduzirErro(resposta.error, "senha"),
        });
        return;
      }
      // Sem erro e sem segredo é caso próprio, não "senha incorreta": o
      // servidor aceitou e não devolveu o que devia.
      if (!resposta.data?.totpURI) {
        despachar({
          tipo: "FALHOU",
          erro: "O servidor aceitou a senha mas não devolveu o segredo. Recarregue e tente de novo.",
        });
        return;
      }
      despachar({
        tipo: "SEGREDO",
        totpURI: resposta.data.totpURI,
        backupCodes: resposta.data.backupCodes ?? [],
      });
    } catch {
      // Só rede ou falha inesperada chegam aqui: credencial errada volta em
      // `error`, não como exceção.
      despachar({
        tipo: "FALHOU",
        erro: "Não foi possível falar com o servidor. Tente de novo.",
      });
    }
  }, []);

  const confirmar = useCallback(async (codigo: string) => {
    despachar({ tipo: "PEDIU" });
    try {
      // `trustDevice: false` fixo, e explícito. O padrão da lib é `true` —
      // confiar no dispositivo por 30 dias como efeito colateral de cadastrar
      // é surpresa. Essa escolha pertence à tela de login, sobre aquela sessão.
      const resposta = await authClient.twoFactor.verifyTotp({
        code: codigo,
        trustDevice: false,
      });
      if (resposta.error) {
        despachar({
          tipo: "FALHOU",
          erro: traduzirErro(resposta.error, "codigo"),
        });
        return;
      }
      despachar({ tipo: "CONFIRMOU" });
    } catch {
      despachar({
        tipo: "FALHOU",
        erro: "Não foi possível falar com o servidor. Tente de novo.",
      });
    }
  }, []);

  return {
    passo: estado.passo,
    totpURI: estado.totpURI,
    chaveManual: estado.chaveManual,
    backupCodes: estado.backupCodes,
    erro: estado.erro,
    pendente: estado.pendente,
    iniciar,
    cancelar,
    gerarSegredo,
    confirmar,
  };
}
