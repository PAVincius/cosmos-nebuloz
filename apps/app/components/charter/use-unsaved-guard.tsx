"use client";

// use-unsaved-guard.tsx — confirmação de descarte para editor que vive em
// PÁGINA, não em modal.
//
// `DirtyCtx` + `ModalHost.tryClose` (form-kit.tsx / modal.tsx) já perguntam
// antes de fechar um modal com campo preenchido. Só que os três lugares onde
// se escreve o texto que vira registro de auditoria — corpo de seção da
// política, perfil do workspace e cláusulas do fornecedor — editam na própria
// tela, e lá clicar noutra seção, noutra aba ou no BackLink descartava calado.
//
// O guarda é ESCOPADO AO CHARTER de propósito. Elevar `DirtyCtx` acima do
// `ModalProvider` resolveria o mesmo, mas `form-kit.tsx` é consumido por
// cosmos, meridian, scaffold e signal: mudar a API dele espalha risco por
// quatro módulos para um problema de três telas. Aqui não muda assinatura de
// nada fora daqui.
//
// Sujo é "difere do que o servidor entregou", nunca "o usuário tocou no
// campo" — digitar e desfazer não pode disparar confirmação. Quem chama é
// responsável por calcular `dirty` dessa forma.

import { Button } from "@repo/design-system/cosmos/kit";
import { useCallback, useEffect } from "react";
import { ModalShell, useModal } from "./modal";
import { FS } from "./type-scale";

/** Confirmação de descarte. Mesma copy do `alertdialog` de `modal.tsx`, no
 *  molde de `screens/settings-confirm-role.tsx`: nomeia a consequência antes
 *  de oferecer o botão que a causa. */
export function DiscardChangesModal({
  what,
  onClose,
  onConfirm,
}: {
  what: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell
      footer={
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "flex-end",
            width: "100%",
          }}
        >
          <Button onClick={onClose} size="md" variant="secondary">
            Cancelar
          </Button>
          <Button
            icon="x"
            onClick={onConfirm}
            size="md"
            style={{ background: "var(--red)", borderColor: "var(--red)" }}
          >
            Descartar
          </Button>
        </div>
      }
      icon="alert"
      onClose={onClose}
      title="Descartar alterações?"
      tone="red"
      width={440}
    >
      <div style={{ padding: 20 }}>
        <p
          style={{
            fontSize: FS.base,
            color: "var(--ink-muted)",
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          {what} ainda não foi registrado na trilha de auditoria. Sair agora
          apaga o que você digitou.
        </p>
      </div>
    </ModalShell>
  );
}

/** Enquanto `dirty`, segura o fechamento da aba e faz toda ação de saída
 *  passar por confirmação.
 *
 *  @param dirty  o editor diverge do valor carregado do servidor
 *  @param what   o que se perde, para a confirmação nomear (ex.: "O texto
 *                editado da seção 03 · Uso aceitável")
 *  @returns `guard(acao)` — roda `acao` direto se limpo; se sujo, só depois de
 *           o usuário confirmar o descarte.
 */
export function useUnsavedGuard({
  dirty,
  what,
}: {
  dirty: boolean;
  what: string;
}): (acao: () => void) => void {
  const { open, close } = useModal();

  useEffect(() => {
    if (!dirty) {
      return;
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      // F5 / fechar aba: o navegador só mostra o próprio diálogo se o evento
      // for cancelado. `returnValue` continua sendo o que o Safari lê.
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  return useCallback(
    (acao: () => void) => {
      if (!dirty) {
        acao();
        return;
      }
      open(
        <DiscardChangesModal
          onClose={close}
          onConfirm={() => {
            close();
            acao();
          }}
          what={what}
        />
      );
    },
    [dirty, what, open, close]
  );
}
