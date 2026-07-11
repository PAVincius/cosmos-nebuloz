"use client";

import type { ART } from "@repo/database";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
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
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  PencilIcon,
  PlusIcon,
  ShieldAlertIcon,
  TargetIcon,
  Trash2Icon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import type { AuditLogWithUser } from "@/app/actions/strategic-themes";
import {
  createKeyResult,
  createThemeOkr,
  deleteKeyResult,
  deleteThemeOkr,
  linkArtToTheme,
  linkRiskToOkr,
  unlinkArtFromTheme,
  unlinkRiskFromOkr,
  updateKeyResult,
  updateThemeOkr,
  updateThemeStatus,
} from "@/app/actions/strategic-themes";
import {
  computeThemeProgress,
  type MeasurementTypeType,
  type OKRTypeType,
  STATUS_TRANSITIONS,
  type StrategicThemeDetail,
  type ThemeStatusType,
  TYPE_LABELS,
} from "@/app/actions/strategic-themes/schema";
import { ThemeBudgetPanel } from "./theme-budget-panel";

// ─── Types ───────────────────────────────────────────────────────────────────

type KRDraft = {
  title: string;
  target: number;
  unit: string;
  metric?: string;
  baseline?: number;
  measurementType?: MeasurementTypeType;
  dueDate?: string;
  dataSource?: string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ThemeStatusType, { label: string; cls: string }> = {
  DRAFT: {
    label: "Rascunho",
    cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  },
  ANALYSIS: {
    label: "Em Análise",
    cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  },
  APPROVED: {
    label: "Aprovado",
    cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  },
  ACTIVE: {
    label: "Ativo",
    cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  },
  CLOSING: {
    label: "Encerrando",
    cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200",
  },
  ARCHIVED: {
    label: "Arquivado",
    cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

const ACTION_LABELS: Record<string, string> = {
  created: "Tema criado",
  updated: "Tema atualizado",
  status_changed: "Status do tema alterado",
  deleted: "Tema removido",
  epic_linked: "Épico vinculado",
  art_linked: "ART vinculada",
  art_unlinked: "ART desvinculada",
  okr_created: "OKR criado",
  okr_updated: "OKR atualizado",
  okr_deleted: "OKR removido",
  kr_created: "Key Result criado",
  kr_updated: "Key Result atualizado",
  kr_deleted: "Key Result removido",
  risk_linked: "Risco ROAM vinculado",
  risk_unlinked: "Risco ROAM desvinculado",
};

function getActionLabel(log: AuditLogWithUser): string {
  const diff = log.diff;
  const isObj =
    diff !== null && typeof diff === "object" && !Array.isArray(diff);
  if (log.action === "okr_updated" && isObj && "status" in diff) {
    return "Status de OKR atualizado";
  }
  if (log.action === "kr_updated" && isObj && "current" in diff) {
    return "Progresso de Key Result atualizado";
  }
  return ACTION_LABELS[log.action] ?? log.action;
}

function userInitials(name: string | null): string {
  if (!name) {
    return "?";
  }
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

// ─── Props ───────────────────────────────────────────────────────────────────

type TenantRisk = {
  id: string;
  title: string;
  status: string;
  impact: string;
  piPlanId: string | null;
};

type Props = {
  theme: StrategicThemeDetail;
  auditLogs: AuditLogWithUser[];
  allArts: { id: string; name: string }[];
  allRisks: TenantRisk[];
  linkedBudgets: import("@/app/actions/lean-budget/schema").LeanBudgetWithStats[];
  allBudgets: import("@/app/actions/lean-budget/schema").LeanBudgetWithStats[];
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ThemeDetail({
  theme: initialTheme,
  auditLogs,
  allArts,
  allRisks,
  linkedBudgets,
  allBudgets,
}: Props) {
  const [theme, setTheme] = useState(initialTheme);
  const [isPending, startTransition] = useTransition();

  const sb =
    STATUS_LABELS[theme.status as ThemeStatusType] ?? STATUS_LABELS.DRAFT;
  const allowedNext = STATUS_TRANSITIONS[theme.status as ThemeStatusType] ?? [];
  const progress = computeThemeProgress(theme.okrs);

  const linkedArtIds = useMemo(
    () => new Set(theme.arts.map((a) => a.art.id)),
    [theme.arts]
  );
  const availableArts = useMemo(
    () => allArts.filter((a) => !linkedArtIds.has(a.id)),
    [allArts, linkedArtIds]
  );

  // ─── Status workflow ─────────────────────────────────────────────────────

  function handleStatusChange(next: ThemeStatusType) {
    setTheme((prev) => ({ ...prev, status: next }));
    startTransition(() => {
      void updateThemeStatus(theme.id, { status: next });
    });
  }

  // ─── ART associations ────────────────────────────────────────────────────

  const [artToAdd, setArtToAdd] = useState("");

  function handleAddArt() {
    if (!artToAdd) {
      return;
    }
    const art = allArts.find((a) => a.id === artToAdd);
    if (!art) {
      return;
    }

    const synthetic = {
      art: { id: art.id, name: art.name } as ART,
    };
    setTheme((prev) => ({
      ...prev,
      arts: [
        ...prev.arts,
        synthetic as unknown as StrategicThemeDetail["arts"][number],
      ],
    }));
    setArtToAdd("");
    startTransition(() => {
      void linkArtToTheme(theme.id, { artId: art.id });
    });
  }

  function handleRemoveArt(artId: string) {
    setTheme((prev) => ({
      ...prev,
      arts: prev.arts.filter((a) => a.art.id !== artId),
    }));
    startTransition(() => {
      void unlinkArtFromTheme(theme.id, { artId });
    });
  }

  // ─── OKR management ──────────────────────────────────────────────────────

  const [okrDialogOpen, setOkrDialogOpen] = useState(false);
  const [newOkrTitle, setNewOkrTitle] = useState("");
  const [newOkrDesc, setNewOkrDesc] = useState("");
  const [newOkrHorizon, setNewOkrHorizon] = useState(theme.horizon ?? "");

  function openOkrDialog() {
    setNewOkrTitle("");
    setNewOkrDesc("");
    setNewOkrHorizon(theme.horizon ?? "");
    setOkrDialogOpen(true);
  }

  function handleCreateOkr() {
    if (!newOkrTitle.trim()) {
      return;
    }
    const horizonSnapshot = newOkrHorizon;
    setOkrDialogOpen(false);
    startTransition(async () => {
      const result = await createThemeOkr(theme.id, {
        title: newOkrTitle,
        description: newOkrDesc || undefined,
        horizon: horizonSnapshot || undefined,
      });
      if (result.ok) {
        setTheme((prev) => ({
          ...prev,
          okrs: [
            ...prev.okrs,
            { ...result.data, keyResults: [], linkedRisks: [] },
          ],
        }));
      }
    });
  }

  function handleUpdateOkr(
    okrId: string,
    patch: { title?: string; description?: string; status?: string }
  ) {
    setTheme((prev) => ({
      ...prev,
      okrs: prev.okrs.map((o) => (o.id === okrId ? { ...o, ...patch } : o)),
    }));
    startTransition(() => {
      void updateThemeOkr(okrId, patch);
    });
  }

  function handleDeleteOkr(okrId: string) {
    if (!confirm("Remover este OKR e seus Key Results?")) {
      return;
    }
    setTheme((prev) => ({
      ...prev,
      okrs: prev.okrs.filter((o) => o.id !== okrId),
    }));
    startTransition(() => {
      void deleteThemeOkr(okrId);
    });
  }

  // ─── KR management ───────────────────────────────────────────────────────

  function handleAddKR(okrId: string, draft: KRDraft) {
    if (!draft.title.trim()) {
      return;
    }
    const payload = {
      okrId,
      title: draft.title,
      target: draft.target,
      current: 0,
      unit: draft.unit,
      metric: draft.metric || undefined,
      baseline: draft.baseline,
      measurementType: draft.measurementType || undefined,
      dueDate: draft.dueDate ? new Date(draft.dueDate) : undefined,
      dataSource: draft.dataSource || undefined,
    };
    startTransition(async () => {
      const result = await createKeyResult(payload);
      if (result.ok) {
        setTheme((prev) => ({
          ...prev,
          okrs: prev.okrs.map((o) =>
            o.id === okrId
              ? { ...o, keyResults: [...o.keyResults, result.data] }
              : o
          ),
        }));
      }
    });
  }

  function handleUpdateKR(
    krId: string,
    patch: {
      current?: number;
      target?: number;
      title?: string;
      unit?: string;
      metric?: string;
      baseline?: number | null;
    }
  ) {
    setTheme((prev) => ({
      ...prev,
      okrs: prev.okrs.map((o) => ({
        ...o,
        keyResults: o.keyResults.map((kr) =>
          kr.id === krId ? { ...kr, ...patch } : kr
        ),
      })),
    }));
    startTransition(() => {
      void updateKeyResult(krId, patch);
    });
  }

  function handleDeleteKR(krId: string) {
    setTheme((prev) => ({
      ...prev,
      okrs: prev.okrs.map((o) => ({
        ...o,
        keyResults: o.keyResults.filter((kr) => kr.id !== krId),
      })),
    }));
    startTransition(() => {
      void deleteKeyResult(krId);
    });
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: main content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Status + workflow */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="h-4 w-4 rounded-full"
                    style={{ backgroundColor: theme.color }}
                  />
                  <CardTitle className="text-base">Workflow</CardTitle>
                  <span
                    className={`rounded px-2 py-0.5 font-medium text-xs ${sb.cls}`}
                  >
                    {sb.label}
                  </span>
                </div>
                {allowedNext.length > 0 && (
                  <Select
                    onValueChange={(v) =>
                      handleStatusChange(v as ThemeStatusType)
                    }
                  >
                    <SelectTrigger className="h-8 w-[180px] text-xs">
                      <SelectValue placeholder="Mover para..." />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedNext.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <Stat
                  icon={<TrendingUpIcon className="h-4 w-4" />}
                  label="Progresso"
                  value={`${progress}%`}
                />
                <Stat
                  icon={<TargetIcon className="h-4 w-4" />}
                  label="OKRs"
                  value={String(theme.okrs.length)}
                />
                <Stat
                  icon={<CheckCircle2Icon className="h-4 w-4" />}
                  label="Épicos"
                  value={String(theme.epics.length)}
                />
                <Stat
                  icon={<UsersIcon className="h-4 w-4" />}
                  label="ARTs"
                  value={String(theme.arts.length)}
                />
              </div>
              {(theme.code || theme.horizon || theme.themeType) && (
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  {theme.code && <Badge variant="outline">{theme.code}</Badge>}
                  {theme.horizon && (
                    <Badge variant="outline">Horizonte: {theme.horizon}</Badge>
                  )}
                  {theme.themeType && (
                    <Badge variant="outline">{theme.themeType}</Badge>
                  )}
                  {theme.budgetTotal !== null &&
                    theme.budgetTotal !== undefined && (
                      <Badge variant="outline">
                        Budget: {theme.budgetTotal}
                      </Badge>
                    )}
                </div>
              )}
              {theme.description && (
                <p className="mt-3 whitespace-pre-wrap text-muted-foreground text-sm">
                  {theme.description}
                </p>
              )}
            </CardContent>
          </Card>

          {/* OKRs */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TargetIcon className="h-4 w-4" /> Objetivos & Key Results
                </CardTitle>
                <Button onClick={openOkrDialog} size="sm">
                  <PlusIcon className="mr-1.5 h-4 w-4" /> Novo OKR
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {theme.okrs.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <TargetIcon className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-muted-foreground text-xs">
                    Nenhum OKR. Adicione um objetivo com 2-5 Key Results
                    mensuráveis.
                  </p>
                  <Button onClick={openOkrDialog} size="sm" variant="outline">
                    <PlusIcon className="mr-1.5 h-3.5 w-3.5" /> Adicionar
                    primeiro OKR
                  </Button>
                </div>
              ) : (
                theme.okrs.map((okr) => (
                  <OkrCard
                    allRisks={allRisks}
                    key={okr.id}
                    okr={okr}
                    onAddKR={(draft) => handleAddKR(okr.id, draft)}
                    onDelete={() => handleDeleteOkr(okr.id)}
                    onDeleteKR={handleDeleteKR}
                    onLinkRisk={(riskId, impact) => {
                      startTransition(() => {
                        void linkRiskToOkr(okr.id, riskId, impact);
                      });
                      setTheme((prev) => {
                        const risk = allRisks.find((r) => r.id === riskId);
                        if (!risk) {
                          return prev;
                        }
                        return {
                          ...prev,
                          okrs: prev.okrs.map((o) =>
                            o.id !== okr.id
                              ? o
                              : {
                                  ...o,
                                  linkedRisks: [
                                    ...o.linkedRisks,
                                    {
                                      riskId,
                                      okrId: okr.id,
                                      impact: impact ?? "medium",
                                      notes: null,
                                      createdAt: new Date(),
                                      risk: {
                                        ...risk,
                                        description: null,
                                        category: null,
                                        ownerUserId: null,
                                        probability: "medium",
                                        tenantId: "",
                                        piPlanId: risk.piPlanId,
                                        updatedAt: new Date(),
                                        createdAt: new Date(),
                                      },
                                    } as StrategicThemeDetail["okrs"][number]["linkedRisks"][number],
                                  ],
                                }
                          ),
                        };
                      });
                    }}
                    onUnlinkRisk={(riskId) => {
                      startTransition(() => {
                        void unlinkRiskFromOkr(okr.id, riskId);
                      });
                      setTheme((prev) => ({
                        ...prev,
                        okrs: prev.okrs.map((o) =>
                          o.id !== okr.id
                            ? o
                            : {
                                ...o,
                                linkedRisks: o.linkedRisks.filter(
                                  (r) => r.riskId !== riskId
                                ),
                              }
                        ),
                      }));
                    }}
                    onUpdate={(p) => handleUpdateOkr(okr.id, p)}
                    onUpdateKR={handleUpdateKR}
                  />
                ))
              )}
            </CardContent>
          </Card>

          {/* Linked Epics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Épicos vinculados</CardTitle>
            </CardHeader>
            <CardContent>
              {theme.epics.length === 0 ? (
                <p className="text-muted-foreground text-xs italic">
                  Nenhum épico vinculado.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {theme.epics.map((e) => (
                    <li
                      className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"
                      key={e.id}
                    >
                      <span className="truncate">{e.title}</span>
                      <Badge className="text-[10px]" variant="secondary">
                        {e.statusId}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: side panel */}
        <div className="space-y-6">
          {/* ARTs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">ARTs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {theme.arts.length === 0 ? (
                <p className="text-muted-foreground text-xs italic">
                  Nenhuma ART associada.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {theme.arts.map(({ art }) => (
                    <li
                      className="flex items-center justify-between rounded bg-muted/40 px-2.5 py-1.5 text-sm"
                      key={art.id}
                    >
                      <span className="truncate">{art.name}</span>
                      <button
                        aria-label="Desvincular ART"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleRemoveArt(art.id)}
                        type="button"
                      >
                        <Trash2Icon className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {availableArts.length > 0 && (
                <div className="flex gap-2">
                  <Select onValueChange={setArtToAdd} value={artToAdd}>
                    <SelectTrigger className="h-8 flex-1 text-xs">
                      <SelectValue placeholder="Vincular ART..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableArts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button disabled={!artToAdd} onClick={handleAddArt} size="sm">
                    +
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Lean Budgets */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span>💰</span> Lean Budgets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ThemeBudgetPanel
                allBudgets={allBudgets}
                budgetTotal={theme.budgetTotal ?? null}
                linkedBudgets={linkedBudgets}
                themeId={theme.id}
                themeTitle={theme.title}
              />
            </CardContent>
          </Card>

          {/* Audit history */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClockIcon className="h-4 w-4" /> Histórico
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-muted-foreground text-xs italic">
                  Sem alterações registradas.
                </p>
              ) : (
                <ul className="max-h-[400px] space-y-3 overflow-y-auto pr-1">
                  {auditLogs.map((log) => (
                    <li
                      className="flex gap-2.5 border-muted border-l-2 py-0.5 pl-2"
                      key={log.id}
                    >
                      {log.user ? (
                        <Link
                          className="mt-0.5 shrink-0"
                          href="/settings/members"
                          title={log.user.name ?? undefined}
                        >
                          <Avatar className="size-5">
                            {log.user.image && (
                              <AvatarImage
                                alt={log.user.name ?? ""}
                                src={log.user.image}
                              />
                            )}
                            <AvatarFallback className="text-[9px]">
                              {userInitials(log.user.name)}
                            </AvatarFallback>
                          </Avatar>
                        </Link>
                      ) : (
                        <div className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] text-muted-foreground">
                          ?
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-xs leading-tight">
                          {getActionLabel(log)}
                        </p>
                        {log.user?.name && (
                          <p className="text-[11px] text-muted-foreground">
                            {log.user.name}
                          </p>
                        )}
                        <p className="text-[11px] text-muted-foreground/70">
                          {new Date(log.createdAt).toLocaleString("pt-BR")}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Novo OKR Dialog */}
      <Dialog onOpenChange={setOkrDialogOpen} open={okrDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TargetIcon className="h-5 w-5" /> Novo Objetivo (OKR)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
              <Badge className="shrink-0 text-[10px]" variant="secondary">
                {TYPE_LABELS.portfolio_theme.badge}
              </Badge>
              <span className="text-muted-foreground">
                {TYPE_LABELS.portfolio_theme.hint}
              </span>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Objetivo *</Label>
              <Textarea
                autoFocus
                onChange={(e) => setNewOkrTitle(e.target.value)}
                placeholder='Ex: "Acelerar time-to-market de serviços críticos para clientes enterprise"'
                rows={3}
                value={newOkrTitle}
              />
              <p className="text-[11px] text-muted-foreground">
                Frase clara e inspiradora. Use verbo forte + resultado
                estratégico.
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                Contexto / Justificativa (opcional)
              </Label>
              <Textarea
                onChange={(e) => setNewOkrDesc(e.target.value)}
                placeholder="Por que este objetivo é importante agora?"
                rows={2}
                value={newOkrDesc}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Horizonte</Label>
              <Input
                onChange={(e) => setNewOkrHorizon(e.target.value)}
                placeholder="Ex: 2026, H1 2026, PI-2026-Q1"
                value={newOkrHorizon}
              />
              <p className="text-[11px] text-muted-foreground">
                Período de validade do objetivo (6–12 meses recomendado).
              </p>
            </div>
            <div className="space-y-1 rounded-lg bg-muted/40 p-3 text-muted-foreground text-xs">
              <p className="font-medium text-foreground">Próximos passos</p>
              <p>
                Após criar o objetivo, adicione 2–5 Key Results com métrica,
                baseline, meta e prazo.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setOkrDialogOpen(false)} variant="outline">
              Cancelar
            </Button>
            <Button
              disabled={isPending || !newOkrTitle.trim()}
              onClick={handleCreateOkr}
            >
              <PlusIcon className="mr-1.5 h-4 w-4" /> Criar Objetivo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <p className="mt-0.5 font-semibold text-lg">{value}</p>
    </div>
  );
}

const ROAM_COLORS: Record<string, string> = {
  IDENTIFIED: "bg-gray-100 text-gray-700",
  RESOLVED: "bg-emerald-100 text-emerald-700",
  OWNED: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-amber-100 text-amber-800",
  MITIGATED: "bg-purple-100 text-purple-700",
};
const RISK_IMPACT_COLORS: Record<string, string> = {
  low: "text-green-600",
  medium: "text-amber-600",
  high: "text-orange-600",
  critical: "text-red-600",
};

function OkrCard({
  okr,
  allRisks,
  onUpdate,
  onDelete,
  onAddKR,
  onUpdateKR,
  onDeleteKR,
  onLinkRisk,
  onUnlinkRisk,
}: {
  okr: StrategicThemeDetail["okrs"][number];
  allRisks: TenantRisk[];
  onUpdate: (p: {
    title?: string;
    description?: string;
    status?: string;
  }) => void;
  onDelete: () => void;
  onAddKR: (draft: KRDraft) => void;
  onUpdateKR: (
    krId: string,
    patch: {
      current?: number;
      target?: number;
      title?: string;
      unit?: string;
      metric?: string;
      baseline?: number | null;
    }
  ) => void;
  onDeleteKR: (krId: string) => void;
  onLinkRisk: (riskId: string, impact?: string) => void;
  onUnlinkRisk: (riskId: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(okr.title);
  const [desc, setDesc] = useState(okr.description ?? "");
  const [showNewKR, setShowNewKR] = useState(false);
  const [krTitle, setKrTitle] = useState("");
  const [krTarget, setKrTarget] = useState("100");
  const [krBaseline, setKrBaseline] = useState("");
  const [krUnit, setKrUnit] = useState("%");
  const [krMetric, setKrMetric] = useState("");
  const [krMeasurement, setKrMeasurement] = useState<MeasurementTypeType | "">(
    ""
  );
  const [krDueDate, setKrDueDate] = useState("");
  const [krDataSource, setKrDataSource] = useState("");

  const okrType = (okr as { type?: string }).type ?? "portfolio_theme";
  const typeMeta =
    TYPE_LABELS[okrType as OKRTypeType] ?? TYPE_LABELS.portfolio_theme;
  const okrHorizon = (okr as { horizon?: string | null }).horizon ?? null;

  const [editingKrId, setEditingKrId] = useState<string | null>(null);
  const [krEditTitle, setKrEditTitle] = useState("");
  const [krEditTarget, setKrEditTarget] = useState("");
  const [krEditUnit, setKrEditUnit] = useState("");
  const [krEditMetric, setKrEditMetric] = useState("");
  const [krEditBaseline, setKrEditBaseline] = useState("");

  function openKrEdit(
    kr: { id: string; title: string; target: number; unit: string } & {
      metric?: string | null;
      baseline?: number | null;
    }
  ) {
    setEditingKrId(kr.id);
    setKrEditTitle(kr.title);
    setKrEditTarget(String(kr.target));
    setKrEditUnit(kr.unit);
    setKrEditMetric(kr.metric ?? "");
    setKrEditBaseline(kr.baseline != null ? String(kr.baseline) : "");
  }

  function commitKrEdit() {
    if (!editingKrId) {
      return;
    }
    onUpdateKR(editingKrId, {
      title: krEditTitle,
      target: Number(krEditTarget),
      unit: krEditUnit,
      metric: krEditMetric || undefined,
      baseline: krEditBaseline ? Number(krEditBaseline) : null,
    });
    setEditingKrId(null);
  }

  const [riskToAdd, setRiskToAdd] = useState("");
  const [riskImpact, setRiskImpact] = useState("medium");

  const linkedRiskIds = new Set(okr.linkedRisks.map((lr) => lr.riskId));
  const availableRisks = allRisks.filter((r) => !linkedRiskIds.has(r.id));

  function commitLinkRisk() {
    if (!riskToAdd) {
      return;
    }
    onLinkRisk(riskToAdd, riskImpact);
    setRiskToAdd("");
    setRiskImpact("medium");
  }

  function commitEdit() {
    onUpdate({ title, description: desc });
    setEditing(false);
  }

  function commitNewKR() {
    const target = Number(krTarget);
    if (!krTitle.trim() || Number.isNaN(target)) {
      return;
    }
    onAddKR({
      title: krTitle,
      target,
      unit: krUnit,
      metric: krMetric || undefined,
      baseline: krBaseline ? Number(krBaseline) : undefined,
      measurementType: krMeasurement || undefined,
      dueDate: krDueDate || undefined,
      dataSource: krDataSource || undefined,
    });
    setKrTitle("");
    setKrTarget("100");
    setKrBaseline("");
    setKrUnit("%");
    setKrMetric("");
    setKrMeasurement("");
    setKrDueDate("");
    setKrDataSource("");
    setShowNewKR(false);
  }

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        {editing ? (
          <div className="flex-1 space-y-2">
            <Input onChange={(e) => setTitle(e.target.value)} value={title} />
            <Textarea
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Descrição"
              rows={2}
              value={desc}
            />
            <div className="flex gap-2">
              <Button onClick={commitEdit} size="sm">
                Salvar
              </Button>
              <Button
                onClick={() => setEditing(false)}
                size="sm"
                variant="ghost"
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                className="text-[10px]"
                title={typeMeta.label}
                variant="secondary"
              >
                {typeMeta.badge}
              </Badge>
              {okrHorizon && (
                <Badge className="text-[10px]" variant="outline">
                  {okrHorizon}
                </Badge>
              )}
            </div>
            <button
              className="mt-1 text-left font-medium text-sm hover:underline"
              onClick={() => setEditing(true)}
              type="button"
            >
              {okr.title}
            </button>
            {okr.description && (
              <p className="mt-0.5 text-muted-foreground text-xs">
                {okr.description}
              </p>
            )}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <Select
            onValueChange={(v) => onUpdate({ status: v })}
            value={okr.status}
          >
            <SelectTrigger className="h-7 w-[110px] text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ON_TRACK">No prazo</SelectItem>
              <SelectItem value="AT_RISK">Em risco</SelectItem>
              <SelectItem value="BEHIND">Atrasado</SelectItem>
              <SelectItem value="ACHIEVED">Alcançado</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="h-7 w-7 hover:text-destructive"
            onClick={onDelete}
            size="icon"
            variant="ghost"
          >
            <Trash2Icon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* KRs */}
      <div className="space-y-1.5">
        {okr.keyResults.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">
            Sem Key Results.
          </p>
        ) : (
          okr.keyResults.map((kr) => {
            const pct =
              kr.target === 0
                ? 0
                : Math.min(100, Math.round((kr.current / kr.target) * 100));
            const krMeta = kr as typeof kr & {
              metric?: string | null;
              baseline?: number | null;
              measurementType?: string | null;
              dueDate?: Date | string | null;
              dataSource?: string | null;
            };
            const isEditing = editingKrId === kr.id;
            return (
              <div className="rounded bg-muted/40 px-2.5 py-1.5" key={kr.id}>
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      autoFocus
                      className="h-7 text-xs"
                      onChange={(e) => setKrEditTitle(e.target.value)}
                      placeholder="Título do KR"
                      value={krEditTitle}
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        className="h-7 text-xs"
                        onChange={(e) => setKrEditBaseline(e.target.value)}
                        placeholder="Baseline"
                        type="number"
                        value={krEditBaseline}
                      />
                      <Input
                        className="h-7 text-xs"
                        onChange={(e) => setKrEditTarget(e.target.value)}
                        placeholder="Meta"
                        type="number"
                        value={krEditTarget}
                      />
                      <Input
                        className="h-7 text-xs"
                        onChange={(e) => setKrEditUnit(e.target.value)}
                        placeholder="Unidade"
                        value={krEditUnit}
                      />
                    </div>
                    <Input
                      className="h-7 text-xs"
                      onChange={(e) => setKrEditMetric(e.target.value)}
                      placeholder="Métrica (ex: Lead time médio)"
                      value={krEditMetric}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        className="h-6 px-2 text-xs"
                        onClick={() => setEditingKrId(null)}
                        size="sm"
                        variant="ghost"
                      >
                        Cancelar
                      </Button>
                      <Button
                        className="h-6 px-2 text-xs"
                        onClick={commitKrEdit}
                        size="sm"
                      >
                        Salvar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex-1 truncate font-medium text-xs">
                        {kr.title}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Input
                          className="h-6 w-16 px-1.5 text-[11px]"
                          onChange={(e) =>
                            onUpdateKR(kr.id, {
                              current: Number(e.target.value),
                            })
                          }
                          type="number"
                          value={kr.current}
                        />
                        <span>
                          / {kr.target}
                          {kr.unit}
                        </span>
                        <button
                          aria-label="Editar KR"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            openKrEdit({
                              ...kr,
                              metric: krMeta.metric,
                              baseline: krMeta.baseline,
                            })
                          }
                          type="button"
                        >
                          <PencilIcon className="h-3 w-3" />
                        </button>
                        <button
                          aria-label="Excluir KR"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => onDeleteKR(kr.id)}
                          type="button"
                        >
                          <Trash2Icon className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {(krMeta.metric ||
                      krMeta.baseline != null ||
                      krMeta.dueDate ||
                      krMeta.dataSource) && (
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                        {krMeta.metric && (
                          <span>
                            <strong>Métrica:</strong> {krMeta.metric}
                          </span>
                        )}
                        {krMeta.baseline != null && (
                          <span>
                            <strong>Baseline:</strong> {krMeta.baseline}
                            {kr.unit}
                          </span>
                        )}
                        {krMeta.dueDate && (
                          <span>
                            <strong>Prazo:</strong>{" "}
                            {new Date(krMeta.dueDate).toLocaleDateString(
                              "pt-BR"
                            )}
                          </span>
                        )}
                        {krMeta.dataSource && (
                          <span>
                            <strong>Fonte:</strong> {krMeta.dataSource}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        aria-hidden
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ROAM Risks */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 font-medium text-[11px] text-muted-foreground">
          <ShieldAlertIcon className="h-3 w-3" /> Riscos ROAM associados
        </div>
        {okr.linkedRisks.length > 0 ? (
          <div className="space-y-1">
            {okr.linkedRisks.map((lr) => (
              <div
                className="flex items-center justify-between gap-2 rounded bg-muted/30 px-2 py-1"
                key={lr.riskId}
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  <AlertTriangleIcon
                    className={`h-3 w-3 shrink-0 ${RISK_IMPACT_COLORS[lr.impact] ?? "text-muted-foreground"}`}
                  />
                  <span className="truncate text-[11px]">{lr.risk.title}</span>
                  <span
                    className={`rounded px-1 text-[10px] ${ROAM_COLORS[lr.risk.status] ?? "bg-muted"}`}
                  >
                    {lr.risk.status}
                  </span>
                </div>
                <button
                  aria-label="Desvincular risco"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onUnlinkRisk(lr.riskId)}
                  type="button"
                >
                  <Trash2Icon className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">
            Sem riscos vinculados.
          </p>
        )}
        {availableRisks.length > 0 && (
          <div className="flex gap-1.5">
            <Select onValueChange={setRiskToAdd} value={riskToAdd}>
              <SelectTrigger className="h-7 flex-1 text-[11px]">
                <SelectValue placeholder="Vincular risco ROAM..." />
              </SelectTrigger>
              <SelectContent>
                {availableRisks.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title}
                    <span className="ml-1.5 text-muted-foreground">
                      ({r.status})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select onValueChange={setRiskImpact} value={riskImpact}>
              <SelectTrigger className="h-7 w-[90px] text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixo</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
              </SelectContent>
            </Select>
            <Button
              className="h-7 px-2 text-[11px]"
              disabled={!riskToAdd}
              onClick={commitLinkRisk}
              size="sm"
            >
              +
            </Button>
          </div>
        )}
      </div>

      {showNewKR ? (
        <div className="space-y-2 rounded border bg-muted/20 p-2">
          <Input
            className="h-8 text-xs"
            onChange={(e) => setKrTitle(e.target.value)}
            placeholder="Título do KR (ex: Reduzir lead time)"
            value={krTitle}
          />
          <Input
            className="h-8 text-xs"
            onChange={(e) => setKrMetric(e.target.value)}
            placeholder="Métrica (ex: Lead time médio, NPS, MRR)"
            value={krMetric}
          />
          <div className="grid grid-cols-3 gap-2">
            <Input
              className="h-8 text-xs"
              onChange={(e) => setKrBaseline(e.target.value)}
              placeholder="Baseline"
              type="number"
              value={krBaseline}
            />
            <Input
              className="h-8 text-xs"
              onChange={(e) => setKrTarget(e.target.value)}
              placeholder="Meta"
              type="number"
              value={krTarget}
            />
            <Input
              className="h-8 text-xs"
              onChange={(e) => setKrUnit(e.target.value)}
              placeholder="Unidade"
              value={krUnit}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select
              onValueChange={(v) =>
                setKrMeasurement(
                  v === "__none" ? "" : (v as MeasurementTypeType)
                )
              }
              value={krMeasurement || "__none"}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Tipo de medição" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                <SelectItem value="absolute">Absoluto</SelectItem>
                <SelectItem value="percentage">Percentual</SelectItem>
                <SelectItem value="index">Índice</SelectItem>
                <SelectItem value="rate">Taxa</SelectItem>
              </SelectContent>
            </Select>
            <Input
              aria-label="Prazo"
              className="h-8 text-xs"
              onChange={(e) => setKrDueDate(e.target.value)}
              type="date"
              value={krDueDate}
            />
          </div>
          <Input
            className="h-8 text-xs"
            onChange={(e) => setKrDataSource(e.target.value)}
            placeholder="Fonte de dados (sistema, dashboard, survey...)"
            value={krDataSource}
          />
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => setShowNewKR(false)}
              size="sm"
              variant="ghost"
            >
              Cancelar
            </Button>
            <Button onClick={commitNewKR} size="sm">
              Adicionar KR
            </Button>
          </div>
        </div>
      ) : (
        <Button
          className="h-7 w-full text-xs"
          onClick={() => setShowNewKR(true)}
          size="sm"
          variant="outline"
        >
          <PlusIcon className="mr-1 h-3 w-3" /> Adicionar Key Result
        </Button>
      )}
    </div>
  );
}
