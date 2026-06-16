"use client";

import { useEffect, useRef } from "react";

export type CardDisplayCfg = {
  hoverReveal: boolean;
  showInvest: boolean;
  investPos: "top" | "bottom";
  showWsjf: boolean;
  showOkrs: boolean;
  showDesc: boolean;
};

export const DEFAULT_CARD_CFG: CardDisplayCfg = {
  hoverReveal: true,
  showInvest: true,
  investPos: "top",
  showWsjf: true,
  showOkrs: true,
  showDesc: false,
};

export const CARD_TEMPLATES: {
  id: string;
  label: string;
  hint: string;
  cfg: CardDisplayCfg;
}[] = [
  {
    id: "foco",
    label: "Foco",
    hint: "Só o título",
    cfg: {
      hoverReveal: true,
      showInvest: false,
      investPos: "top",
      showWsjf: false,
      showOkrs: false,
      showDesc: false,
    },
  },
  {
    id: "padrao",
    label: "Padrão",
    hint: "Hover reveal",
    cfg: {
      hoverReveal: true,
      showInvest: true,
      investPos: "top",
      showWsjf: true,
      showOkrs: true,
      showDesc: false,
    },
  },
  {
    id: "completo",
    label: "Completo",
    hint: "Com descrição",
    cfg: {
      hoverReveal: false,
      showInvest: true,
      investPos: "top",
      showWsjf: true,
      showOkrs: true,
      showDesc: true,
    },
  },
  {
    id: "metricas",
    label: "Métricas",
    hint: "INVEST em foco",
    cfg: {
      hoverReveal: false,
      showInvest: true,
      investPos: "bottom",
      showWsjf: true,
      showOkrs: true,
      showDesc: false,
    },
  },
];

const CFG_KEYS: (keyof CardDisplayCfg)[] = [
  "hoverReveal",
  "showInvest",
  "investPos",
  "showWsjf",
  "showOkrs",
  "showDesc",
];

export function cfgMatchTemplate(
  cfg: CardDisplayCfg,
  tpl: (typeof CARD_TEMPLATES)[number]
) {
  return CFG_KEYS.every((k) => cfg[k] === tpl.cfg[k]);
}

function MiniCardPreview({ cfg }: { cfg: CardDisplayCfg }) {
  const { showInvest, investPos, showWsjf, showOkrs, showDesc, hoverReveal } =
    cfg;
  return (
    <div
      style={{
        width: 40,
        height: 32,
        border: "1px solid var(--border)",
        borderRadius: 4,
        overflow: "hidden",
        background: "var(--card)",
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        padding: "3px 2px",
        flexShrink: 0,
      }}
    >
      {showInvest && investPos === "top" && (
        <div
          style={{
            height: 2,
            width: "100%",
            background: "var(--muted-foreground)",
            opacity: 0.3,
            borderRadius: 1,
          }}
        />
      )}
      <div style={{ height: 0.5 }} />
      <div
        style={{
          height: 1.5,
          width: "70%",
          background: "var(--muted-foreground)",
          opacity: 0.56,
          borderRadius: 1,
        }}
      />
      {showDesc && (
        <>
          <div style={{ height: 0.5 }} />
          <div
            style={{
              height: 1.5,
              width: "88%",
              background: "var(--muted-foreground)",
              opacity: 0.33,
              borderRadius: 1,
            }}
          />
          <div
            style={{
              height: 1.5,
              width: "52%",
              background: "var(--muted-foreground)",
              opacity: 0.33,
              borderRadius: 1,
            }}
          />
        </>
      )}
      <div style={{ flex: 1 }} />
      <div style={{ display: "flex", gap: 1.5, alignItems: "center" }}>
        {showWsjf && (
          <div
            style={{
              height: 2,
              width: 14,
              background: "var(--muted-foreground)",
              opacity: 0.4,
              borderRadius: 1,
            }}
          />
        )}
        {showOkrs && (
          <div
            style={{
              height: 2,
              width: 8,
              background: "var(--primary)",
              opacity: 0.38,
              borderRadius: 1,
            }}
          />
        )}
        {hoverReveal && (
          <div
            style={{
              marginLeft: "auto",
              width: 3,
              height: 3,
              borderRadius: "50%",
              background: "var(--primary)",
              opacity: 0.72,
            }}
          />
        )}
      </div>
      {showInvest && investPos === "bottom" && (
        <div
          style={{
            height: 2,
            width: "100%",
            background: "var(--muted-foreground)",
            opacity: 0.3,
            borderRadius: 1,
          }}
        />
      )}
    </div>
  );
}

type Props = {
  cfg: CardDisplayCfg;
  onChange: (cfg: CardDisplayCfg) => void;
  onClose: () => void;
  wrapRef: React.RefObject<HTMLDivElement | null>;
};

const TOGGLE_FIELDS: { key: keyof CardDisplayCfg; label: string }[] = [
  { key: "hoverReveal", label: "Hover Reveal" },
  { key: "showInvest", label: "INVEST Score" },
  { key: "showWsjf", label: "WSJF" },
  { key: "showOkrs", label: "OKRs" },
  { key: "showDesc", label: "Prévia da descrição" },
];

export function CardConfigPanel({ cfg, onChange, onClose, wrapRef }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const activeId =
    CARD_TEMPLATES.find((t) => cfgMatchTemplate(cfg, t))?.id ?? "custom";

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose, wrapRef]);

  function toggle(key: keyof CardDisplayCfg) {
    onChange({ ...cfg, [key]: !cfg[key] });
  }

  return (
    <div
      className="absolute top-full left-0 z-50 mt-1 w-[196px] rounded-xl border border-border/60 bg-card p-3 shadow-xl"
      ref={ref}
    >
      {/* Templates */}
      <div className="mb-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
        Templates
      </div>
      <div className="mb-3 grid grid-cols-4 gap-1">
        {CARD_TEMPLATES.map((tpl) => (
          <button
            className={`flex flex-col items-center gap-1 rounded-lg border p-1.5 text-center transition-colors ${
              activeId === tpl.id
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-border/40 text-muted-foreground hover:border-border hover:bg-muted"
            }`}
            key={tpl.id}
            onClick={() => onChange({ ...cfg, ...tpl.cfg })}
            title={tpl.hint}
            type="button"
          >
            <MiniCardPreview cfg={tpl.cfg} />
            <span className="font-medium text-[9.5px]">{tpl.label}</span>
          </button>
        ))}
      </div>

      {/* Fields */}
      <div className="mb-1.5 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider">
        {activeId === "custom" ? (
          <>
            <span className="font-extrabold text-primary">●</span> Personalizado
          </>
        ) : (
          "Campos"
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {TOGGLE_FIELDS.map((f) => (
          <div
            className="flex cursor-pointer select-none items-center justify-between rounded px-1 py-1 hover:bg-muted/60"
            key={f.key}
            onClick={() => toggle(f.key)}
            onKeyDown={(e) =>
              (e.key === "Enter" || e.key === " ") && toggle(f.key)
            }
            role="button"
            tabIndex={0}
          >
            <span className="text-[12px] text-muted-foreground">{f.label}</span>
            <div
              className={`relative h-3.5 w-6 rounded-full transition-colors ${
                cfg[f.key] ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            >
              <div
                className={`absolute top-0 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${
                  cfg[f.key] ? "translate-x-2.5" : "translate-x-0"
                }`}
              />
            </div>
          </div>
        ))}
      </div>

      {/* INVEST position sub-control */}
      {cfg.showInvest && (
        <div className="mt-1.5 flex items-center justify-between px-1">
          <span className="pl-2 text-[11px] text-muted-foreground">
            ↳ Posição
          </span>
          <div className="flex gap-1">
            {(["top", "bottom"] as const).map((pos) => (
              <button
                className={`rounded px-1.5 py-0.5 text-[10px] transition-colors ${
                  cfg.investPos === pos
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                }`}
                key={pos}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange({ ...cfg, investPos: pos });
                }}
                type="button"
              >
                {pos === "top" ? "↑" : "↓"}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
