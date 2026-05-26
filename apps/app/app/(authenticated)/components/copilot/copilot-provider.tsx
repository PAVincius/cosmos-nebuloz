"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { CopilotFab } from "./copilot-fab";

// ssr: false prevents CopilotPanel → CopilotSuggestions → server actions import chain
// from entering the SSR bundle, which would cause Turbopack chunk evaluation failures.
const CopilotPanel = dynamic(
  () => import("./copilot-panel").then((m) => m.CopilotPanel),
  {
    ssr: false,
  }
);

export type CopilotMode = "rte" | "lpm" | "pm" | "team" | "spc" | "global";
export type CopilotSurface =
  | "pi_workspace"
  | "portfolio_dashboard"
  | "flow_dashboard"
  | "lean_budget"
  | "risk_board"
  | "global";

export type CopilotConfig = {
  mode: CopilotMode;
  surface: CopilotSurface;
  contextRef: Record<string, string>;
  sessionId?: string;
};

type CopilotContextType = {
  isOpen: boolean;
  config: CopilotConfig;
  openCopilot: (config: Partial<CopilotConfig>) => void;
  closeCopilot: () => void;
  setSessionId: (id: string) => void;
};

const DEFAULT_CONFIG: CopilotConfig = {
  mode: "global",
  surface: "global",
  contextRef: {},
};

const CopilotCtx = createContext<CopilotContextType>({
  isOpen: false,
  config: DEFAULT_CONFIG,
  openCopilot: () => null,
  closeCopilot: () => null,
  setSessionId: () => null,
});

export function useCopilot() {
  return useContext(CopilotCtx);
}

export function CopilotProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<CopilotConfig>(DEFAULT_CONFIG);
  // mounted gates CopilotPanel + CopilotFab so SSR and initial client render
  // are identical — prevents Radix useId mismatch caused by dynamic ssr:false
  // creating a different fiber tree depth on server vs client.
  const [mounted, setMounted] = useState(false);

  const openCopilot = (partial: Partial<CopilotConfig>) => {
    setConfig((prev) => ({ ...DEFAULT_CONFIG, ...prev, ...partial }));
    setIsOpen(true);
  };

  const closeCopilot = () => setIsOpen(false);

  const setSessionId = (id: string) => {
    setConfig((prev) => ({ ...prev, sessionId: id }));
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        // Don't intercept if user is typing in an input
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA") {
          return;
        }
        e.preventDefault();
        setIsOpen((prev) => {
          if (!prev) {
            setConfig(DEFAULT_CONFIG);
          }
          return !prev;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <CopilotCtx.Provider
      value={{ isOpen, config, openCopilot, closeCopilot, setSessionId }}
    >
      {children}
      {mounted && <CopilotPanel />}
      {mounted && !pathname.startsWith("/copilot") && <CopilotFab />}
    </CopilotCtx.Provider>
  );
}
