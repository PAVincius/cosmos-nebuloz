"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type DraftMeta = {
  savedAt: number; // unix ms
  hasDraft: boolean;
};

export function useDraftState<T>(
  key: string,
  initial: T
): [T, (patch: Partial<T> | ((prev: T) => T)) => void, () => void, DraftMeta] {
  const [state, _setState] = useState<T>(() => {
    if (typeof window === "undefined") return initial;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      const parsed = JSON.parse(raw) as { data: T; savedAt: number };
      return parsed.data ?? initial;
    } catch {
      return initial;
    }
  });

  const [meta, setMeta] = useState<DraftMeta>(() => {
    if (typeof window === "undefined") return { savedAt: 0, hasDraft: false };
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { savedAt: 0, hasDraft: false };
      const parsed = JSON.parse(raw) as { savedAt: number };
      return { savedAt: parsed.savedAt ?? 0, hasDraft: true };
    } catch {
      return { savedAt: 0, hasDraft: false };
    }
  });

  // Debounce saves to avoid thrashing
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setState = useCallback(
    (patch: Partial<T> | ((prev: T) => T)) => {
      _setState((prev) => {
        const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
        if (saveTimer.current) clearTimeout(saveTimer.current);
        saveTimer.current = setTimeout(() => {
          try {
            const savedAt = Date.now();
            localStorage.setItem(key, JSON.stringify({ data: next, savedAt }));
            setMeta({ savedAt, hasDraft: true });
          } catch {}
        }, 400);
        return next;
      });
    },
    [key]
  );

  const clearDraft = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      localStorage.removeItem(key);
    } catch {}
    setMeta({ savedAt: 0, hasDraft: false });
  }, [key]);

  return [state, setState, clearDraft, meta];
}

export function formatDraftAge(savedAt: number): string {
  if (!savedAt) return "";
  const diff = Math.floor((Date.now() - savedAt) / 1000);
  if (diff < 60) return "agora mesmo";
  if (diff < 3600) return `há ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)}h`;
  return `há ${Math.floor(diff / 86400)}d`;
}
