"use client";

// prefs.tsx — preferências de apresentação do Signal.
//
// Alto contraste e movimento reduzido são escolhas EXPLÍCITAS do usuário dentro
// do produto, e vivem em `localStorage` + atributo no <html>. Não vão para o
// banco: são por pessoa e por dispositivo, e um round-trip ao servidor para
// trocar contraste é latência sem ganho. (Os limiares de veredito, esses sim,
// são do tenant e ficam em `SignalSettings` — mudam o veredito de todo mundo e
// entram na trilha.)
//
// O tema não está aqui: já é do `next-themes`, que a plataforma inteira usa.
//
// `data-motion="reduced"` NÃO substitui `prefers-reduced-motion`: os dois
// caminhos coexistem no CSS de propósito. Quem desliga animação no sistema
// operacional não deveria precisar mexer no produto, e quem desliga no produto
// pode querer manter animação no resto do sistema.

import { useCallback, useEffect, useState } from "react";

const CONTRAST_KEY = "signal:contrast";
const MOTION_KEY = "signal:motion";

export type ContrastPref = "normal" | "high";
export type MotionPref = "full" | "reduced";

/** Leitura tolerante: navegador em modo privado, storage bloqueado por política
 *  ou valor corrompido não podem derrubar a casca. Sem preferência = padrão. */
function read<T extends string>(key: string, fallback: T, valid: T[]): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw && (valid as string[]).includes(raw) ? (raw as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preferência que não persiste ainda vale para a sessão corrente.
  }
}

function apply(attr: string, value: string, isDefault: boolean): void {
  const root = document.documentElement;
  if (isDefault) {
    root.removeAttribute(attr);
    return;
  }
  root.setAttribute(attr, value);
}

/**
 * Monta os atributos no <html> a partir do que estiver salvo.
 *
 * Renderiza nada. Fica no shell para rodar uma vez por sessão de layout, não
 * por tela.
 */
export function SignalPrefs() {
  useEffect(() => {
    const contrast = read<ContrastPref>(CONTRAST_KEY, "normal", [
      "normal",
      "high",
    ]);
    const motion = read<MotionPref>(MOTION_KEY, "full", ["full", "reduced"]);
    apply("data-contrast", contrast, contrast === "normal");
    apply("data-motion", motion, motion === "full");
  }, []);

  return null;
}

/** Hook para a tela de configurações ler e escrever as duas preferências. */
export function useSignalPrefs() {
  const [contrast, setContrastState] = useState<ContrastPref>("normal");
  const [motion, setMotionState] = useState<MotionPref>("full");

  useEffect(() => {
    setContrastState(
      read<ContrastPref>(CONTRAST_KEY, "normal", ["normal", "high"])
    );
    setMotionState(read<MotionPref>(MOTION_KEY, "full", ["full", "reduced"]));
  }, []);

  const setContrast = useCallback((value: ContrastPref) => {
    setContrastState(value);
    write(CONTRAST_KEY, value);
    apply("data-contrast", value, value === "normal");
  }, []);

  const setMotion = useCallback((value: MotionPref) => {
    setMotionState(value);
    write(MOTION_KEY, value);
    apply("data-motion", value, value === "full");
  }, []);

  return { contrast, setContrast, motion, setMotion };
}
