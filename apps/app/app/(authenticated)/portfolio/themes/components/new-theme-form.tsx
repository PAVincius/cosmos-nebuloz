"use client";

import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { CheckIcon } from "lucide-react";
import type { ThemeTypeType } from "@/app/actions/strategic-themes/schema";

// Same 5 tones as strategy-map's NewThemeButton. "accent" (var(--accent-c))
// is omitted — it is not a valid #RRGGBB and fails CreateThemeSchema.color.
export const COLOR_OPTIONS = [
  { name: "blue", hex: "#2563eb" },
  { name: "purple", hex: "#7c3aed" },
  { name: "green", hex: "#16a34a" },
  { name: "amber", hex: "#d97706" },
  { name: "red", hex: "#e11d48" },
] as const;

const THEME_TYPE_OPTIONS: { value: ThemeTypeType; label: string }[] = [
  { value: "GROWTH", label: "Crescimento" },
  { value: "EFFICIENCY", label: "Eficiência" },
  { value: "INNOVATION", label: "Inovação" },
  { value: "COMPLIANCE", label: "Compliance" },
  { value: "CUSTOMER_EXPERIENCE", label: "Experiência do cliente" },
];

export type NewThemeFormState = {
  title: string;
  description: string;
  code: string;
  color: string;
  horizon: string;
  themeType: ThemeTypeType | "";
  budgetTotal: string;
  targetAllocationPct: string;
};

export const INITIAL_NEW_THEME_FORM: NewThemeFormState = {
  title: "",
  description: "",
  code: "",
  color: COLOR_OPTIONS[0].hex,
  horizon: "",
  themeType: "",
  budgetTotal: "",
  targetAllocationPct: "",
};

type NewThemeFormProps = {
  form: NewThemeFormState;
  setField: <K extends keyof NewThemeFormState>(
    key: K,
    value: NewThemeFormState[K]
  ) => void;
};

export function NewThemeForm({ form, setField }: NewThemeFormProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="theme-title">Nome do tema</Label>
          <Input
            id="theme-title"
            onChange={(event) => setField("title", event.target.value)}
            placeholder="Ex.: Modernização da Plataforma"
            value={form.title}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="theme-code">Código</Label>
          <Input
            id="theme-code"
            onChange={(event) =>
              setField("code", event.target.value.toUpperCase())
            }
            placeholder="TH-7"
            value={form.code}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Label htmlFor="theme-description">Descrição</Label>
        <Textarea
          id="theme-description"
          onChange={(event) => setField("description", event.target.value)}
          placeholder="Como esse tema conecta apostas do portfolio à visão do produto…"
          rows={3}
          value={form.description}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <Label>Cor</Label>
        <div style={{ display: "flex", gap: 8 }}>
          {COLOR_OPTIONS.map((option) => (
            <button
              aria-label={option.name}
              aria-pressed={form.color === option.hex}
              key={option.hex}
              onClick={() => setField("color", option.hex)}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: option.hex,
                display: "grid",
                placeItems: "center",
                border:
                  form.color === option.hex
                    ? "2px solid var(--ink)"
                    : "2px solid transparent",
                transition: "border-color .15s",
              }}
              type="button"
            >
              {form.color === option.hex ? (
                <CheckIcon color="#fff" size={14} strokeWidth={3} />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="theme-type">Tipo</Label>
          <Select
            onValueChange={(value) =>
              setField("themeType", value as ThemeTypeType)
            }
            value={form.themeType}
          >
            <SelectTrigger id="theme-type">
              <SelectValue placeholder="Selecionar" />
            </SelectTrigger>
            <SelectContent>
              {THEME_TYPE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="theme-horizon">Horizonte</Label>
          <Input
            id="theme-horizon"
            onChange={(event) => setField("horizon", event.target.value)}
            placeholder="PI-27 → PI-29"
            value={form.horizon}
          />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="theme-budget">Orçamento total</Label>
          <Input
            id="theme-budget"
            min={0}
            onChange={(event) => setField("budgetTotal", event.target.value)}
            placeholder="0"
            type="number"
            value={form.budgetTotal}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <Label htmlFor="theme-target">Alvo de alocação (%)</Label>
          <Input
            id="theme-target"
            max={100}
            min={0}
            onChange={(event) =>
              setField("targetAllocationPct", event.target.value)
            }
            placeholder="0"
            type="number"
            value={form.targetAllocationPct}
          />
        </div>
      </div>
    </div>
  );
}
