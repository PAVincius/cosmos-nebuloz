"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type NavBinding = { key: string; label: string; path: string };

export const NAV_BINDINGS: NavBinding[] = [
  { key: "d", label: "Dashboard", path: "/cosmos/dashboard" },
  { key: "p", label: "Portfolio", path: "/portfolio" },
  { key: "k", label: "PI Planning", path: "/pi-planning" },
  { key: "t", label: "Times", path: "/teams" },
  { key: "m", label: "Reuniões", path: "/meetings" },
  { key: "r", label: "Riscos", path: "/risks" },
  { key: "s", label: "Configurações", path: "/settings" },
];

type UseKeyboardNavReturn = {
  pendingPrefix: string | null;
  helpOpen: boolean;
  setHelpOpen: (v: boolean) => void;
};

export function useKeyboardNav(): UseKeyboardNavReturn {
  const router = useRouter();
  const [pendingPrefix, setPendingPrefix] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isEditable =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest("[role=dialog]") !== null ||
        target.closest("[data-radix-popper-content-wrapper]") !== null;

      if (isEditable) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      if (pendingPrefix === "g") {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        setPendingPrefix(null);
        const binding = NAV_BINDINGS.find((b) => b.key === e.key);
        if (binding) {
          e.preventDefault();
          router.push(binding.path);
        }
        return;
      }

      if (e.key === "g") {
        e.preventDefault();
        setPendingPrefix("g");
        timeoutRef.current = setTimeout(() => setPendingPrefix(null), 1500);
        return;
      }

      if (e.key === "?") {
        e.preventDefault();
        setHelpOpen((v) => !v);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [pendingPrefix, router]);

  return { pendingPrefix, helpOpen, setHelpOpen };
}
