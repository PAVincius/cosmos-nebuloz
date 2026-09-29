"use client";

// O que a pessoa pode fazer, para a tela desabilitar o controle com o motivo.
//
// Enquanto o acesso não chegou, nada de escrita é oferecido: habilitar e deixar
// o servidor recusar era o defeito (Crivo F2). Se a leitura FALHAR, o controle
// volta a ficar disponível: o servidor repete o guard em toda action, e uma
// falha de leitura não pode travar quem tem permissão.

import type { ScaffoldPermission } from "@repo/rbac";
import { useEffect, useState } from "react";
import {
  getScaffoldAccess,
  type PermissionView,
  type ScaffoldAccess,
} from "@/app/(scaffold)/actions/access";

type State =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; access: ScaffoldAccess };

export function useScaffoldAccess(): {
  can: (permission: ScaffoldPermission) => PermissionView;
} {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let live = true;
    getScaffoldAccess().then((res) => {
      if (live) {
        setState(
          res.ok ? { status: "ready", access: res.data } : { status: "failed" }
        );
      }
    });
    return () => {
      live = false;
    };
  }, []);

  return {
    can: (permission) => {
      if (state.status === "ready") {
        return state.access.can[permission];
      }
      return { allowed: state.status === "failed", reason: null };
    },
  };
}
