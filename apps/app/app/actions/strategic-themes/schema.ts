import { z } from "zod";
import type { Epic, StrategicTheme, OKR, KeyResult, ART, Risk, RiskOKR } from "@repo/database";
import { nnStr, optStr, optCuid, optDate } from "@/app/actions/_base";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const ThemeStatus = z.enum([
  "DRAFT",
  "ANALYSIS",
  "APPROVED",
  "ACTIVE",
  "CLOSING",
  "ARCHIVED",
]);
export type ThemeStatusType = z.infer<typeof ThemeStatus>;

export const ThemeType = z.enum([
  "GROWTH",
  "EFFICIENCY",
  "INNOVATION",
  "COMPLIANCE",
  "CUSTOMER_EXPERIENCE",
]);
export type ThemeTypeType = z.infer<typeof ThemeType>;

/** Allowed status transitions (workflow). */
export const STATUS_TRANSITIONS: Record<ThemeStatusType, ThemeStatusType[]> = {
  DRAFT:    ["ANALYSIS", "ARCHIVED"],
  ANALYSIS: ["DRAFT", "APPROVED", "ARCHIVED"],
  APPROVED: ["ACTIVE", "ARCHIVED"],
  ACTIVE:   ["CLOSING", "ARCHIVED"],
  CLOSING:  ["ACTIVE", "ARCHIVED"],
  ARCHIVED: [],
};

// ─── Theme schemas ────────────────────────────────────────────────────────────

const colorRegex = /^#[0-9A-Fa-f]{6}$/;

export const CreateThemeSchema = z.object({
  title:       nnStr,
  description: optStr,
  code:        z.string().regex(/^[A-Z0-9-]{1,32}$/, "Código inválido (A-Z, 0-9, -)").optional(),
  color:       z.string().regex(colorRegex, "Cor inválida (#RRGGBB)").default("#6366f1"),
  order:       z.number().int().nonnegative().default(0),
  horizon:     z.string().max(64).optional(),
  themeType:   ThemeType.optional(),
  ownerUserId: optCuid,
  budgetTotal: z.number().nonnegative().optional(),
});

export const UpdateThemeSchema = CreateThemeSchema.partial();

export const ThemeFiltersSchema = z.object({
  status:      ThemeStatus.optional(),
  themeType:   ThemeType.optional(),
  ownerUserId: optCuid,
  horizon:     z.string().optional(),
  search:      z.string().max(120).optional(),
});

export const ChangeStatusSchema = z.object({
  status: ThemeStatus,
});

// ─── OKR schemas ──────────────────────────────────────────────────────────────

export const OKRStatusEnum = z.enum(["ON_TRACK", "AT_RISK", "BEHIND", "ACHIEVED"]);
export type OKRStatusType = z.infer<typeof OKRStatusEnum>;

export const OKRType = z.enum([
  "portfolio_theme",
  "portfolio_epic",
  "pi_art",
  "team_pi",
  "improvement",
]);
export type OKRTypeType = z.infer<typeof OKRType>;

export const OKRScope = z.enum(["portfolio", "art", "team"]);

export const MeasurementType = z.enum(["absolute", "percentage", "index", "rate"]);
export type MeasurementTypeType = z.infer<typeof MeasurementType>;

/** Map type → required link fields. Used by both UI and server validation. */
export const TYPE_REQUIRED_LINKS: Record<OKRTypeType, readonly string[]> = {
  portfolio_theme: ["strategicThemeId"],
  portfolio_epic:  ["epicId"],
  pi_art:          ["piPlanId", "artId"],
  team_pi:         ["piPlanId", "teamId"],
  improvement:     ["scope"],
};

export const TYPE_LABELS: Record<OKRTypeType, { label: string; badge: string; hint: string }> = {
  portfolio_theme: {
    label: "Tema Estratégico (Portfólio)",
    badge: "Portfólio",
    hint:  "OKR ligado a um Tema Estratégico, horizonte 6-12 meses.",
  },
  portfolio_epic: {
    label: "Épico de Portfólio",
    badge: "Épico",
    hint:  "Outcomes de um épico — adoção, fluxo, satisfação.",
  },
  pi_art: {
    label: "PI / ART",
    badge: "PI",
    hint:  "Objetivos de PI em nível de ART/Solution Train.",
  },
  team_pi: {
    label: "Time no PI",
    badge: "Time",
    hint:  "Contribuição de cada time para OKRs do PI/Tema.",
  },
  improvement: {
    label: "Melhoria / Saúde",
    badge: "Melhoria",
    hint:  "Maturidade técnica, fluxo, DevOps, capacidade.",
  },
};

const BaseOkrFields = {
  title:       nnStr,
  description: optStr,
  ownerId:     optCuid,
  horizon:     z.string().max(64).optional(),
  scope:       OKRScope.optional(),
  piPlanId:    optCuid,
  epicId:      optCuid,
  artId:       optCuid,
  teamId:      optCuid,
} as const;

export const CreateOkrSchema = z.object({
  type: OKRType.default("portfolio_theme"),
  ...BaseOkrFields,
}).superRefine((val, ctx) => {
  const required = TYPE_REQUIRED_LINKS[val.type];
  for (const key of required) {
    const v = val[key as keyof typeof val];
    if (!v) {
      ctx.addIssue({
        code:    "custom",
        path:    [key],
        message: `Campo obrigatório para tipo "${val.type}".`,
      });
    }
  }
});

/** Backward-compat: theme-scoped create. Forces portfolio_theme. */
export const CreateThemeOkrSchema = z.object({
  title:       nnStr,
  description: optStr,
  ownerId:     optCuid,
  horizon:     z.string().max(64).optional(),
});

export const UpdateThemeOkrSchema = z.object({
  title:       nnStr.optional(),
  description: optStr,
  ownerId:     optCuid,
  horizon:     z.string().max(64).optional(),
  status:      OKRStatusEnum.optional(),
});

export const CreateKeyResultSchema = z.object({
  okrId:           z.string().cuid(),
  title:           nnStr,
  metric:          z.string().max(120).optional(),
  baseline:        z.number().optional(),
  current:         z.number().default(0),
  target:          z.number(),
  unit:            z.string().max(16).default("%"),
  measurementType: MeasurementType.optional(),
  dueDate:         z.coerce.date().optional(),
  ownerId:         optCuid,
  dataSource:      z.string().max(255).optional(),
});

export const UpdateKeyResultSchema = z.object({
  title:           nnStr.optional(),
  metric:          z.string().max(120).optional(),
  baseline:        z.number().optional(),
  current:         z.number().optional(),
  target:          z.number().optional(),
  unit:            z.string().max(16).optional(),
  measurementType: MeasurementType.optional(),
  dueDate:         z.coerce.date().optional(),
  ownerId:         optCuid,
  dataSource:      z.string().max(255).optional(),
});

// ─── ART schemas ──────────────────────────────────────────────────────────────

export const LinkArtSchema = z.object({
  artId: z.string().cuid(),
});

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateThemeInput   = z.infer<typeof CreateThemeSchema>;
export type UpdateThemeInput   = z.infer<typeof UpdateThemeSchema>;
export type ThemeFiltersInput  = z.infer<typeof ThemeFiltersSchema>;
export type CreateOkrInput     = z.infer<typeof CreateThemeOkrSchema>;
export type UpdateOkrInput     = z.infer<typeof UpdateThemeOkrSchema>;
export type CreateKRInput      = z.infer<typeof CreateKeyResultSchema>;
export type UpdateKRInput      = z.infer<typeof UpdateKeyResultSchema>;

export type StrategicThemeWithCount = StrategicTheme & {
  _count: { epics: number; okrs: number };
};

export type RiskOKRWithRisk = RiskOKR & { risk: Risk };

export type StrategicThemeDetail = StrategicTheme & {
  epics: Epic[];
  okrs: (OKR & { keyResults: KeyResult[]; linkedRisks: RiskOKRWithRisk[] })[];
  arts: { art: ART }[];
};

export type EpicForTheme = {
  id:               string;
  title:            string;
  statusId:         string;
  strategicThemeId: string | null;
};

/** Backward-compat flat shape used by some UI components. */
export type ThemeListItem = {
  id:          string;
  code:        string | null;
  title:       string;
  description: string | null;
  color:       string;
  order:       number;
  status:      string;
  horizon:     string | null;
  themeType:   string | null;
  ownerUserId: string | null;
  budgetTotal: number | null;
  epicCount:   number;
  okrCount:    number;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Compute aggregated progress (0-100) from KRs of a theme's OKRs. */
export function computeThemeProgress(
  okrs: ReadonlyArray<{ keyResults: ReadonlyArray<{ current: number; target: number }> }>,
): number {
  const krs = okrs.flatMap((o) => o.keyResults);
  if (krs.length === 0) return 0;
  const sum = krs.reduce((acc, kr) => {
    if (kr.target === 0) return acc;
    return acc + Math.min(100, (kr.current / kr.target) * 100);
  }, 0);
  return Math.round(sum / krs.length);
}

export function canTransition(from: ThemeStatusType, to: ThemeStatusType): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
