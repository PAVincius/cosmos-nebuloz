import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@repo/design-system/components/ui/alert-dialog";
import type { ActiveAccountTenant } from "./types";

export type SwitchAccountDialogProps = {
  open: boolean;
  /** Conta escolhida no seletor, ainda não confirmada. `null` fecha o
   *  diálogo (nenhuma troca em curso). */
  targetTenant: Pick<ActiveAccountTenant, "id" | "name"> | null;
  /** Só chamado com o clique explícito de confirmação (FR-004). */
  onConfirm: () => void;
  /** Cancelar não tem efeito colateral — conta ativa permanece a mesma
   *  (FR-005). */
  onCancel: () => void;
};

/**
 * Passo de confirmação explícito antes de trocar de conta. Sem ele, um
 * clique acidental no seletor reproduz o incidente do dogfood — trocar de
 * conta sem perceber (FR-004).
 */
export function SwitchAccountDialog({
  open,
  targetTenant,
  onConfirm,
  onCancel,
}: SwitchAccountDialogProps) {
  return (
    <AlertDialog
      onOpenChange={(next) => {
        if (!next) {
          onCancel();
        }
      }}
      open={open}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Trocar de conta?</AlertDialogTitle>
          <AlertDialogDescription>
            {targetTenant
              ? `Você vai sair da conta atual e entrar em "${targetTenant.name}".`
              : null}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>
            Trocar de conta
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
