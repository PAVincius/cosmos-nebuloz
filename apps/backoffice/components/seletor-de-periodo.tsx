"use client";

import { Calendar } from "@repo/design-system/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@repo/design-system/components/ui/popover";
import { ptBR } from "date-fns/locale";
import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { EntradaDeData } from "@/components/entrada-de-data";
import {
  type Intervalo,
  intervaloValido,
  type Preset,
  rotuloDoIntervalo,
} from "@/lib/empresa/periodo";

/**
 * Seletor de intervalo — porte do date-range-picker-for-shadcn (johnpolacek)
 * para a paleta do back-office: presets em coluna, entrada digitada, calendário
 * de dois meses. Sem "comparar" (spec 2026-09-06 §2). Controlado: `valor` vem
 * da URL; `onAplicar` só dispara quando o intervalo muda.
 */

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;

// Data local ao meio-dia: o react-day-picker compara em horário local, e um
// Date UTC à meia-noite (ou ao meio-dia UTC, a oeste de fusos > UTC-12) vira
// "ontem" a oeste de Greenwich.
const local = (valorIso: string) => new Date(`${valorIso}T12:00:00`);

function paraRange(i: Intervalo): DateRange {
  return { from: local(i.de), to: local(i.ate) };
}

export function SeletorDePeriodo({
  valor,
  presets,
  onAplicar,
  align = "end",
}: {
  valor: Intervalo;
  presets: Preset[];
  onAplicar: (i: Intervalo) => void;
  align?: "start" | "center" | "end";
}) {
  const [aberto, setAberto] = useState(false);
  const [rascunho, setRascunho] = useState<Intervalo>(valor);
  const [estreito, setEstreito] = useState(false);
  const hoje = new Date();

  // Reseta só na transição fechado→aberto: `valor.de`/`valor.ate` (não
  // `valor`) na lista de deps evita que um novo objeto literal
  // referencialmente distinto, mas com o mesmo intervalo, apague o
  // rascunho enquanto o popover já está aberto.
  // biome-ignore lint/correctness/useExhaustiveDependencies: valor.de/valor.ate cobrem todo o conteúdo relevante de `valor`
  useEffect(() => {
    if (aberto) {
      setRascunho(valor);
    }
  }, [aberto, valor.de, valor.ate]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return;
    }
    const mq = window.matchMedia("(max-width: 900px)");
    const aplicar = () => setEstreito(mq.matches);
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, []);

  const aplicar = () => {
    if (!intervaloValido(rascunho)) {
      return;
    }
    setAberto(false);
    if (rascunho.de !== valor.de || rascunho.ate !== valor.ate) {
      onAplicar(rascunho);
    }
  };

  const presetAtivo = (p: Preset) => {
    const r = p.intervalo(hoje);
    return r.de === rascunho.de && r.ate === rascunho.ate;
  };

  return (
    <Popover onOpenChange={setAberto} open={aberto}>
      <PopoverTrigger asChild>
        <button className="btn" style={GATILHO} type="button">
          {rotuloDoIntervalo(valor, presets, hoje)}
          <span aria-hidden style={{ opacity: 0.6 }}>
            ▾
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} style={PAINEL}>
        <div style={{ display: "flex", gap: 16 }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minWidth: 170,
            }}
          >
            {presets.map((p) => (
              <button
                aria-pressed={presetAtivo(p)}
                className="btn"
                key={p.id}
                onClick={() => setRascunho(p.intervalo(hoje))}
                style={{
                  ...PRESET,
                  ...(presetAtivo(p) ? PRESET_ATIVO : {}),
                }}
                type="button"
              >
                {p.rotulo}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
              <EntradaDeData
                onChange={(de) =>
                  setRascunho((r) =>
                    de <= r.ate ? { ...r, de } : { ate: de, de }
                  )
                }
                rotulo="Início"
                valor={rascunho.de}
              />
              <span style={{ color: "var(--ink-faint)" }}>–</span>
              <EntradaDeData
                onChange={(ate) =>
                  setRascunho((r) =>
                    ate >= r.de ? { ...r, ate } : { ate, de: ate }
                  )
                }
                rotulo="Fim"
                valor={rascunho.ate}
              />
            </div>
            <Calendar
              defaultMonth={local(rascunho.de)}
              locale={ptBR}
              mode="range"
              numberOfMonths={estreito ? 1 : 2}
              onSelect={(r) => {
                if (r?.from) {
                  const de = iso(r.from);
                  let ate = de;
                  if (r.to) {
                    ate = iso(r.to);
                  }
                  const candidato = { ate, de };
                  if (intervaloValido(candidato)) {
                    setRascunho(candidato);
                  }
                }
              }}
              selected={paraRange(rascunho)}
            />
          </div>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "flex-end",
            marginTop: 12,
          }}
        >
          <button
            className="btn"
            onClick={() => setAberto(false)}
            style={SECUNDARIO}
            type="button"
          >
            Cancelar
          </button>
          <button
            className="btn"
            onClick={aplicar}
            style={PRIMARIO}
            type="button"
          >
            Aplicar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const GATILHO = {
  alignItems: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-md)",
  color: "var(--ink)",
  cursor: "pointer",
  display: "inline-flex",
  fontFamily: "inherit",
  fontSize: "var(--fs-base)",
  fontWeight: 600,
  gap: 8,
  padding: "8px 12px",
} as const;
const PAINEL = {
  background: "var(--surface)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-lg)",
  boxShadow: "var(--card-shadow)",
  color: "var(--ink)",
  padding: 14,
  width: "auto",
} as const;
const PRESET = {
  background: "none",
  border: "1px solid transparent",
  borderRadius: "var(--r-sm)",
  color: "var(--ink-muted)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "var(--fs-nota)",
  fontWeight: 600,
  padding: "6px 10px",
  textAlign: "left",
} as const;
const PRESET_ATIVO = {
  background: "var(--accent-soft)",
  borderColor: "rgba(var(--accent-rgb),.45)",
  color: "var(--ink)",
} as const;
const SECUNDARIO = {
  background: "var(--surface-2)",
  border: "1px solid var(--hairline)",
  borderRadius: "var(--r-md)",
  color: "var(--ink-muted)",
  cursor: "pointer",
  fontFamily: "inherit",
  fontSize: "var(--fs-nota)",
  fontWeight: 600,
  padding: "7px 12px",
} as const;
const PRIMARIO = {
  ...SECUNDARIO,
  background: "var(--accent)",
  borderColor: "var(--accent)",
  color: "var(--accent-fg)",
} as const;
