"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  PencilIcon,
  PlusIcon,
  ShieldAlertIcon,
  Trash2Icon,
  TargetIcon,
  TrendingUpIcon,
  UsersIcon,
} from "lucide-react";
import type { ART } from "@repo/database";
import type { AuditLogWithUser } from "@/app/actions/strategic-themes";
import { ThemeBudgetPanel } from "./theme-budget-panel";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/design-system/components/ui/avatar";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@repo/design-system/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
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
  STATUS_TRANSITIONS,
  TYPE_LABELS,
  computeThemeProgress,
  type MeasurementTypeType,
  type OKRTypeType,
  type StrategicThemeDetail,
  type ThemeStatusType,
} from "@/app/actions/strategic-themes/schema";

// ─── Types ───────────────────────────────────────────────────────────────────

type KRDraft = {
  title:           string;
  target:          number;
  unit:            string;
  metric?:         string;
  baseline?:       number;
  measurementType?: MeasurementTypeType;
  dueDate?:        string;
  dataSource?:     string;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ThemeStatusType, { label: string; cls: string }> = {
  DRAFT:    { label: "Rascunho",   cls: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  ANALYSIS: { label: "Em Análise", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" },
  APPROVED: { label: "Aprovado",   cls: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200" },
  ACTIVE:   { label: "Ativo",      cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" },
  CLOSING:  { label: "Encerrando", cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-200" },
  ARCHIVED: { label: "Arquivado",  cls: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400" },
};

const ACTION_LABELS: Record<string, string> = {
  created:        "Tema criado",
  updated:        "Tema atualizado",
  status_changed: "Status do tema alterado",
  deleted:        "Tema removido",
  epic_linked:    "Épico vinculado",
  art_linked:     "ART vinculada",
  art_unlinked:   "ART desvinculada",
  okr_created:    "OKR criado",
  okr_updated:    "OKR atualizado",
  okr_deleted:    "OKR removido",
  kr_created:     "Key Result criado",
  kr_updated:     "Key Result atualizado",
  kr_deleted:     "Key Result removido",
  risk_linked:    "Risco ROAM vinculado",
  risk_unlinked:  "Risco ROAM desvinculado",
};

function getActionLabel(log: AuditLogWithUser): string {
  const diff = log.diff;
  const isObj = diff !== null && typeof diff === "object" && !Array.isArray(diff);
  if (log.action === "okr_updated" && isObj && "status" in diff) {
    return "Status de OKR atualizado";
  }
  if (log.action === "kr_updated" && isObj && "current" in diff) {
    return "Progresso de Key Result atualizado";
  }
  return ACTION_LABELS[log.action] ?? log.action;
}

function userInitials(name: string | null): string {
  if (!name) return "?";
  return name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

// ─── Props ───────────────────────────────────────────────────────────────────

type TenantRisk = { id: string; title: string; status: string; impact: string; piPlanId: string | null };

type Props = {
  theme:          StrategicThemeDetail;
  auditLogs:      AuditLogWithUser[];
  allArts:        { id: string; name: string }[];
  allRisks:       TenantRisk[];
  linkedBudgets:  import("@/app/actions/lean-budget").LeanBudgetWithStats[];
  allBudgets:     import("@/app/actions/lean-budget").LeanBudgetWithStats[];
};

// ─── Component ───────────────────────────────────────────────────────────────

export function ThemeDetail({ theme: initialTheme, auditLogs, allArts, allRisks, linkedBudgets, allBudgets }: Props) {
  const [theme, setTheme] = useState(initialTheme);
  const [isPending, startTransition] = useTransition();

  const sb = STATUS_LABELS[theme.status as ThemeStatusType] ?? STATUS_LABELS.DRAFT;
  const allowedNext = STATUS_TRANSITIONS[theme.status as ThemeStatusType] ?? [];
  const progress = computeThemeProgress(theme.okrs);

  const linkedArtIds = useMemo(() => new Set(theme.arts.map((a) => a.art.id)), [theme.arts]);
  const availableArts = useMemo(
    () => allArts.filter((a) => !linkedArtIds.has(a.id)),
    [allArts, linkedArtIds],
  );

  // ─── Status workflow ─────────────────────────────────────────────────────

  function handleStatusChange(next: ThemeStatusType) {
    setTheme((prev) => ({ ...prev, status: next }));
    startTransition(() => { void updateThemeStatus(theme.id, { status: next }); });
  }

  // ─── ART associations ────────────────────────────────────────────────────

  const [artToAdd, setArtToAdd] = useState("");

  function handleAddArt() {
    if (!artToAdd) return;
    const art = allArts.find((a) => a.id === artToAdd);
    if (!art) return;

    const synthetic = {
      art: { id: art.id, name: art.name } as ART,
    };
    setTheme((prev) => ({ ...prev, arts: [...prev.arts, synthetic as unknown as StrategicThemeDetail["arts"][number]] }));
    setArtToAdd("");
    startTransition(() => { void linkArtToTheme(theme.id, { artId: art.id }); });
  }

  function handleRemoveArt(artId: string) {
    setTheme((prev) => ({ ...prev, arts: prev.arts.filter((a) => a.art.id !== artId) }));
    startTransition(() => { void unlinkArtFromTheme(theme.id, { artId }); });
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
    if (!newOkrTitle.trim()) return;
    const horizonSnapshot = newOkrHorizon;
    setOkrDialogOpen(false);
    startTransition(async () => {
      const result = await createThemeOkr(theme.id, {
        title:       newOkrTitle,
        description: newOkrDesc || undefined,
        horizon:     horizonSnapshot || undefined,
      });
      if (result.ok) {
        setTheme((prev) => ({
          ...prev,
          okrs: [...prev.okrs, { ...result.data, keyResults: [], linkedRisks: [] }],
        }));
      }
    });
  }

  function handleUpdateOkr(okrId: string, patch: { title?: string; description?: string; status?: string }) {
    setTheme((prev) => ({
      ...prev,
      okrs: prev.okrs.map((o) => (o.id === okrId ? { ...o, ...patch } : o)),
    }));
    startTransition(() => { void updateThemeOkr(okrId, patch); });
  }

  function handleDeleteOkr(okrId: string) {
    if (!confirm("Remover este OKR e seus Key Results?")) return;
    setTheme((prev) => ({ ...prev, okrs: prev.okrs.filter((o) => o.id !== okrId) }));
    startTransition(() => { void deleteThemeOkr(okrId); });
  }

  // ─── KR management ───────────────────────────────────────────────────────

  function handleAddKR(okrId: string, draft: KRDraft) {
    if (!draft.title.trim()) return;
    const payload = {
      okrId,
      title:           draft.title,
      target:          draft.target,
      current:         0,
      unit:            draft.unit,
      metric:          draft.metric || undefined,
      baseline:        draft.baseline,
      measurementType: draft.measurementType || undefined,
      dueDate:         draft.dueDate ? new Date(draft.dueDate) : undefined,
      dataSource:      draft.dataSource || undefined,
    };
    startTransition(async () => {
      const result = await createKeyResult(payload);
      if (result.ok) {
        setTheme((prev) => ({
          ...prev,
          okrs: prev.okrs.map((o) =>
            o.id === okrId ? { ...o, keyResults: [...o.keyResults, result.data] } : o,
          ),
        }));
      }
    });
  }

  function handleUpdateKR(krId: string, patch: { current?: number; target?: number; title?: string; unit?: string; metric?: string; baseline?: number | null }) {
    setTheme((prev) => ({
      ...prev,
      okrs: prev.okrs.map((o) => ({
        ...o,
        keyResults: o.keyResults.map((kr) => (kr.id === krId ? { ...kr, ...patch } : kr)),
      })),
    }));
    startTransition(() => { void updateKeyResult(krId, patch); });
  }

  function handleDeleteKR(krId: string) {
    setTheme((prev) => ({
      ...prev,
      okrs: prev.okrs.map((o) => ({
        ...o,
        keyResults: o.keyResults.filter((kr) => kr.id !== krId),
      })),
    }));
    startTransition(() => { void deleteKeyResult(krId); });
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
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: theme.color }} aria-hidden />
                <CardTitle className="text-base">Workflow</CardTitle>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${sb.cls}`}>{sb.label}</span>
              </div>
              {allowedNext.length > 0 && (
                <Select onValueChange={(v) => handleStatusChange(v as ThemeStatusType)}>
                  <SelectTrigger className="h-8 w-[180px] text-xs">
                    <SelectValue placeholder="Mover para..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedNext.map((s) => (
                      <SelectItem key={s} value={s}>{STATUS_LABELS[s].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Stat icon={<TrendingUpIcon className="h-4 w-4" />} label="Progresso" value={`${progress}%`} />
              <Stat icon={<TargetIcon className="h-4 w-4" />} label="OKRs" value={String(theme.okrs.length)} />
              <Stat icon={<CheckCircle2Icon className="h-4 w-4" />} label="Épicos" value={String(theme.epics.length)} />
              <Stat icon={<UsersIcon className="h-4 w-4" />} label="ARTs" value={String(theme.arts.length)} />
            </div>
            {(theme.code || theme.horizon || theme.themeType) && (
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                {theme.code && <Badge variant="outline">{theme.code}</Badge>}
                {theme.horizon && <Badge variant="outline">Horizonte: {theme.horizon}</Badge>}
                {theme.themeType && <Badge variant="outline">{theme.themeType}</Badge>}
                {theme.budgetTotal !== null && theme.budgetTotal !== undefined && (
                  <Badge variant="outline">Budget: {theme.budgetTotal}</Badge>
                )}
              </div>
            )}
            {theme.description && (
              <p className="mt-3 text-sm text-muted-foreground whitespace-pre-wrap">{theme.description}</p>
            )}
          </CardContent>
        </Card>

        {/* OKRs */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <TargetIcon className="h-4 w-4" /> Objetivos & Key Results
              </CardTitle>
              <Button size="sm" onClick={openOkrDialog}>
                <PlusIcon className="h-4 w-4 mr-1.5" /> Novo OKR
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {theme.okrs.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <TargetIcon className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">Nenhum OKR. Adicione um objetivo com 2-5 Key Results mensuráveis.</p>
                <Button size="sm" variant="outline" onClick={openOkrDialog}>
                  <PlusIcon className="h-3.5 w-3.5 mr-1.5" /> Adicionar primeiro OKR
                </Button>
              </div>
            ) : (
              theme.okrs.map((okr) => (
                <OkrCard
                  key={okr.id}
                  okr={okr}
                  allRisks={allRisks}
                  onUpdate={(p) => handleUpdateOkr(okr.id, p)}
                  onDelete={() => handleDeleteOkr(okr.id)}
                  onAddKR={(draft) => handleAddKR(okr.id, draft)}
                  onUpdateKR={handleUpdateKR}
                  onDeleteKR={handleDeleteKR}
                  onLinkRisk={(riskId, impact) => {
                    startTransition(() => { void linkRiskToOkr(okr.id, riskId, impact); });
                    setTheme((prev) => {
                      const risk = allRisks.find((r) => r.id === riskId);
                      if (!risk) return prev;
                      return {
                        ...prev,
                        okrs: prev.okrs.map((o) =>
                          o.id !== okr.id ? o : {
                            ...o,
                            linkedRisks: [...o.linkedRisks, {
                              riskId, okrId: okr.id, impact: impact ?? "medium",
                              notes: null, createdAt: new Date(),
                              risk: { ...risk, description: null, category: null, ownerUserId: null, probability: "medium", tenantId: "", piPlanId: risk.piPlanId, updatedAt: new Date(), createdAt: new Date() },
                            } as StrategicThemeDetail["okrs"][number]["linkedRisks"][number]],
                          }
                        ),
                      };
                    });
                  }}
                  onUnlinkRisk={(riskId) => {
                    startTransition(() => { void unlinkRiskFromOkr(okr.id, riskId); });
                    setTheme((prev) => ({
                      ...prev,
                      okrs: prev.okrs.map((o) =>
                        o.id !== okr.id ? o : { ...o, linkedRisks: o.linkedRisks.filter((r) => r.riskId !== riskId) },
                      ),
                    }));
                  }}
                />
              ))
            )}
          </CardContent>
        </Card>

        {/* Linked Epics */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">Épicos vinculados</CardTitle></CardHeader>
          <CardContent>
            {theme.epics.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhum épico vinculado.</p>
            ) : (
              <ul className="space-y-1.5">
                {theme.epics.map((e) => (
                  <li key={e.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                    <span className="truncate">{e.title}</span>
                    <Badge variant="secondary" className="text-[10px]">{e.statusId}</Badge>
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
          <CardHeader className="pb-2"><CardTitle className="text-base">ARTs</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {theme.arts.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Nenhuma ART associada.</p>
            ) : (
              <ul className="space-y-1.5">
                {theme.arts.map(({ art }) => (
                  <li key={art.id} className="flex items-center justify-between rounded bg-muted/40 px-2.5 py-1.5 text-sm">
                    <span className="truncate">{art.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveArt(art.id)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Desvincular ART"
                    >
                      <Trash2Icon className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {availableArts.length > 0 && (
              <div className="flex gap-2">
                <Select value={artToAdd} onValueChange={setArtToAdd}>
                  <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Vincular ART..." /></SelectTrigger>
                  <SelectContent>
                    {availableArts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleAddArt} disabled={!artToAdd}>+</Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lean Budgets */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span>💰</span> Lean Budgets
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeBudgetPanel
              themeId={theme.id}
              themeTitle={theme.title}
              budgetTotal={theme.budgetTotal ?? null}
              linkedBudgets={linkedBudgets}
              allBudgets={allBudgets}
            />
          </CardContent>
        </Card>

        {/* Audit history */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClockIcon className="h-4 w-4" /> Histórico
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sem alterações registradas.</p>
            ) : (
              <ul className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                {auditLogs.map((log) => (
                  <li key={log.id} className="flex gap-2.5 border-l-2 border-muted pl-2 py-0.5">
                    {log.user ? (
                      <Link href="/settings/members" className="shrink-0 mt-0.5" title={log.user.name ?? undefined}>
                        <Avatar className="size-5">
                          {log.user.image && <AvatarImage src={log.user.image} alt={log.user.name ?? ""} />}
                          <AvatarFallback className="text-[9px]">{userInitials(log.user.name)}</AvatarFallback>
                        </Avatar>
                      </Link>
                    ) : (
                      <div className="size-5 shrink-0 mt-0.5 rounded-full bg-muted flex items-center justify-center text-[9px] text-muted-foreground">?</div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium leading-tight">{getActionLabel(log)}</p>
                      {log.user?.name && (
                        <p className="text-[11px] text-muted-foreground">{log.user.name}</p>
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
    <Dialog open={okrDialogOpen} onOpenChange={setOkrDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TargetIcon className="h-5 w-5" /> Novo Objetivo (OKR)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs flex items-start gap-2">
            <Badge variant="secondary" className="text-[10px] shrink-0">{TYPE_LABELS.portfolio_theme.badge}</Badge>
            <span className="text-muted-foreground">{TYPE_LABELS.portfolio_theme.hint}</span>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Objetivo *</Label>
            <Textarea
              placeholder='Ex: "Acelerar time-to-market de serviços críticos para clientes enterprise"'
              rows={3}
              value={newOkrTitle}
              onChange={(e) => setNewOkrTitle(e.target.value)}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">Frase clara e inspiradora. Use verbo forte + resultado estratégico.</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Contexto / Justificativa (opcional)</Label>
            <Textarea
              placeholder="Por que este objetivo é importante agora?"
              rows={2}
              value={newOkrDesc}
              onChange={(e) => setNewOkrDesc(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Horizonte</Label>
            <Input
              placeholder="Ex: 2026, H1 2026, PI-2026-Q1"
              value={newOkrHorizon}
              onChange={(e) => setNewOkrHorizon(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">Período de validade do objetivo (6–12 meses recomendado).</p>
          </div>
          <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Próximos passos</p>
            <p>Após criar o objetivo, adicione 2–5 Key Results com métrica, baseline, meta e prazo.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOkrDialogOpen(false)}>Cancelar</Button>
          <Button onClick={handleCreateOkr} disabled={isPending || !newOkrTitle.trim()}>
            <PlusIcon className="h-4 w-4 mr-1.5" /> Criar Objetivo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="text-lg font-semibold mt-0.5">{value}</p>
    </div>
  );
}

const ROAM_COLORS: Record<string, string> = {
  IDENTIFIED: "bg-gray-100 text-gray-700",
  RESOLVED:   "bg-emerald-100 text-emerald-700",
  OWNED:      "bg-blue-100 text-blue-700",
  ACCEPTED:   "bg-amber-100 text-amber-800",
  MITIGATED:  "bg-purple-100 text-purple-700",
};
const RISK_IMPACT_COLORS: Record<string, string> = {
  low:      "text-green-600",
  medium:   "text-amber-600",
  high:     "text-orange-600",
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
  onUpdate: (p: { title?: string; description?: string; status?: string }) => void;
  onDelete: () => void;
  onAddKR: (draft: KRDraft) => void;
  onUpdateKR: (krId: string, patch: { current?: number; target?: number; title?: string; unit?: string; metric?: string; baseline?: number | null }) => void;
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
  const [krMeasurement, setKrMeasurement] = useState<MeasurementTypeType | "">("");
  const [krDueDate, setKrDueDate] = useState("");
  const [krDataSource, setKrDataSource] = useState("");

  const okrType = (okr as { type?: string }).type ?? "portfolio_theme";
  const typeMeta = TYPE_LABELS[okrType as OKRTypeType] ?? TYPE_LABELS.portfolio_theme;
  const okrHorizon = (okr as { horizon?: string | null }).horizon ?? null;

  const [editingKrId, setEditingKrId] = useState<string | null>(null);
  const [krEditTitle, setKrEditTitle] = useState("");
  const [krEditTarget, setKrEditTarget] = useState("");
  const [krEditUnit, setKrEditUnit] = useState("");
  const [krEditMetric, setKrEditMetric] = useState("");
  const [krEditBaseline, setKrEditBaseline] = useState("");

  function openKrEdit(kr: { id: string; title: string; target: number; unit: string } & { metric?: string | null; baseline?: number | null }) {
    setEditingKrId(kr.id);
    setKrEditTitle(kr.title);
    setKrEditTarget(String(kr.target));
    setKrEditUnit(kr.unit);
    setKrEditMetric(kr.metric ?? "");
    setKrEditBaseline(kr.baseline != null ? String(kr.baseline) : "");
  }

  function commitKrEdit() {
    if (!editingKrId) return;
    onUpdateKR(editingKrId, {
      title:    krEditTitle,
      target:   Number(krEditTarget),
      unit:     krEditUnit,
      metric:   krEditMetric || undefined,
      baseline: krEditBaseline ? Number(krEditBaseline) : null,
    });
    setEditingKrId(null);
  }

  const [riskToAdd, setRiskToAdd] = useState("");
  const [riskImpact, setRiskImpact] = useState("medium");

  const linkedRiskIds = new Set(okr.linkedRisks.map((lr) => lr.riskId));
  const availableRisks = allRisks.filter((r) => !linkedRiskIds.has(r.id));

  function commitLinkRisk() {
    if (!riskToAdd) return;
    onLinkRisk(riskToAdd, riskImpact);
    setRiskToAdd(""); setRiskImpact("medium");
  }

  function commitEdit() {
    onUpdate({ title, description: desc });
    setEditing(false);
  }

  function commitNewKR() {
    const target = Number(krTarget);
    if (!krTitle.trim() || Number.isNaN(target)) return;
    onAddKR({
      title:           krTitle,
      target,
      unit:            krUnit,
      metric:          krMetric || undefined,
      baseline:        krBaseline ? Number(krBaseline) : undefined,
      measurementType: krMeasurement || undefined,
      dueDate:         krDueDate || undefined,
      dataSource:      krDataSource || undefined,
    });
    setKrTitle(""); setKrTarget("100"); setKrBaseline(""); setKrUnit("%");
    setKrMetric(""); setKrMeasurement(""); setKrDueDate(""); setKrDataSource("");
    setShowNewKR(false);
  }

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-start justify-between gap-2">
        {editing ? (
          <div className="space-y-2 flex-1">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Descrição" />
            <div className="flex gap-2">
              <Button size="sm" onClick={commitEdit}>Salvar</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancelar</Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px]" title={typeMeta.label}>{typeMeta.badge}</Badge>
              {okrHorizon && <Badge variant="outline" className="text-[10px]">{okrHorizon}</Badge>}
            </div>
            <button type="button" onClick={() => setEditing(true)} className="text-sm font-medium hover:underline text-left mt-1">
              {okr.title}
            </button>
            {okr.description && <p className="text-xs text-muted-foreground mt-0.5">{okr.description}</p>}
          </div>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <Select value={okr.status} onValueChange={(v) => onUpdate({ status: v })}>
            <SelectTrigger className="h-7 w-[110px] text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ON_TRACK">No prazo</SelectItem>
              <SelectItem value="AT_RISK">Em risco</SelectItem>
              <SelectItem value="BEHIND">Atrasado</SelectItem>
              <SelectItem value="ACHIEVED">Alcançado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:text-destructive" onClick={onDelete}>
            <Trash2Icon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* KRs */}
      <div className="space-y-1.5">
        {okr.keyResults.length === 0 ? (
          <p className="text-[11px] text-muted-foreground italic">Sem Key Results.</p>
        ) : (
          okr.keyResults.map((kr) => {
            const pct = kr.target === 0 ? 0 : Math.min(100, Math.round((kr.current / kr.target) * 100));
            const krMeta = kr as typeof kr & {
              metric?: string | null;
              baseline?: number | null;
              measurementType?: string | null;
              dueDate?: Date | string | null;
              dataSource?: string | null;
            };
            const isEditing = editingKrId === kr.id;
            return (
              <div key={kr.id} className="rounded bg-muted/40 px-2.5 py-1.5">
                {isEditing ? (
                  <div className="space-y-2">
                    <Input
                      value={krEditTitle}
                      onChange={(e) => setKrEditTitle(e.target.value)}
                      className="h-7 text-xs"
                      placeholder="Título do KR"
                      autoFocus
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        type="number"
                        value={krEditBaseline}
                        onChange={(e) => setKrEditBaseline(e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Baseline"
                      />
                      <Input
                        type="number"
                        value={krEditTarget}
                        onChange={(e) => setKrEditTarget(e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Meta"
                      />
                      <Input
                        value={krEditUnit}
                        onChange={(e) => setKrEditUnit(e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Unidade"
                      />
                    </div>
                    <Input
                      value={krEditMetric}
                      onChange={(e) => setKrEditMetric(e.target.value)}
                      className="h-7 text-xs"
                      placeholder="Métrica (ex: Lead time médio)"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="ghost" className="h-6 text-xs px-2" onClick={() => setEditingKrId(null)}>Cancelar</Button>
                      <Button size="sm" className="h-6 text-xs px-2" onClick={commitKrEdit}>Salvar</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate flex-1">{kr.title}</span>
                      <div className="flex items-center gap-1.5 shrink-0 text-[11px] text-muted-foreground">
                        <Input
                          type="number"
                          value={kr.current}
                          onChange={(e) => onUpdateKR(kr.id, { current: Number(e.target.value) })}
                          className="h-6 w-16 text-[11px] px-1.5"
                        />
                        <span>/ {kr.target}{kr.unit}</span>
                        <button
                          type="button"
                          onClick={() => openKrEdit({ ...kr, metric: krMeta.metric, baseline: krMeta.baseline })}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label="Editar KR"
                        >
                          <PencilIcon className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteKR(kr.id)}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Excluir KR"
                        >
                          <Trash2Icon className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {(krMeta.metric || krMeta.baseline != null || krMeta.dueDate || krMeta.dataSource) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground">
                        {krMeta.metric && <span><strong>Métrica:</strong> {krMeta.metric}</span>}
                        {krMeta.baseline != null && <span><strong>Baseline:</strong> {krMeta.baseline}{kr.unit}</span>}
                        {krMeta.dueDate && (
                          <span><strong>Prazo:</strong> {new Date(krMeta.dueDate).toLocaleDateString("pt-BR")}</span>
                        )}
                        {krMeta.dataSource && <span><strong>Fonte:</strong> {krMeta.dataSource}</span>}
                      </div>
                    )}
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                        aria-hidden
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
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <ShieldAlertIcon className="h-3 w-3" /> Riscos ROAM associados
        </div>
        {okr.linkedRisks.length > 0 ? (
          <div className="space-y-1">
            {okr.linkedRisks.map((lr) => (
              <div key={lr.riskId} className="flex items-center justify-between gap-2 rounded bg-muted/30 px-2 py-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <AlertTriangleIcon className={`h-3 w-3 shrink-0 ${RISK_IMPACT_COLORS[lr.impact] ?? "text-muted-foreground"}`} />
                  <span className="text-[11px] truncate">{lr.risk.title}</span>
                  <span className={`text-[10px] px-1 rounded ${ROAM_COLORS[lr.risk.status] ?? "bg-muted"}`}>{lr.risk.status}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onUnlinkRisk(lr.riskId)}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Desvincular risco"
                >
                  <Trash2Icon className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic">Sem riscos vinculados.</p>
        )}
        {availableRisks.length > 0 && (
          <div className="flex gap-1.5">
            <Select value={riskToAdd} onValueChange={setRiskToAdd}>
              <SelectTrigger className="h-7 text-[11px] flex-1"><SelectValue placeholder="Vincular risco ROAM..." /></SelectTrigger>
              <SelectContent>
                {availableRisks.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.title}
                    <span className="ml-1.5 text-muted-foreground">({r.status})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={riskImpact} onValueChange={setRiskImpact}>
              <SelectTrigger className="h-7 w-[90px] text-[11px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baixo</SelectItem>
                <SelectItem value="medium">Médio</SelectItem>
                <SelectItem value="high">Alto</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" className="h-7 text-[11px] px-2" onClick={commitLinkRisk} disabled={!riskToAdd}>+</Button>
          </div>
        )}
      </div>

      {showNewKR ? (
        <div className="space-y-2 rounded border p-2 bg-muted/20">
          <Input
            placeholder="Título do KR (ex: Reduzir lead time)"
            value={krTitle}
            onChange={(e) => setKrTitle(e.target.value)}
            className="h-8 text-xs"
          />
          <Input
            placeholder="Métrica (ex: Lead time médio, NPS, MRR)"
            value={krMetric}
            onChange={(e) => setKrMetric(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="grid grid-cols-3 gap-2">
            <Input
              type="number"
              placeholder="Baseline"
              value={krBaseline}
              onChange={(e) => setKrBaseline(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              type="number"
              placeholder="Meta"
              value={krTarget}
              onChange={(e) => setKrTarget(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              placeholder="Unidade"
              value={krUnit}
              onChange={(e) => setKrUnit(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={krMeasurement || "__none"} onValueChange={(v) => setKrMeasurement(v === "__none" ? "" : v as MeasurementTypeType)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo de medição" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">—</SelectItem>
                <SelectItem value="absolute">Absoluto</SelectItem>
                <SelectItem value="percentage">Percentual</SelectItem>
                <SelectItem value="index">Índice</SelectItem>
                <SelectItem value="rate">Taxa</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={krDueDate}
              onChange={(e) => setKrDueDate(e.target.value)}
              className="h-8 text-xs"
              aria-label="Prazo"
            />
          </div>
          <Input
            placeholder="Fonte de dados (sistema, dashboard, survey...)"
            value={krDataSource}
            onChange={(e) => setKrDataSource(e.target.value)}
            className="h-8 text-xs"
          />
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowNewKR(false)}>Cancelar</Button>
            <Button size="sm" onClick={commitNewKR}>Adicionar KR</Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setShowNewKR(true)}>
          <PlusIcon className="h-3 w-3 mr-1" /> Adicionar Key Result
        </Button>
      )}
    </div>
  );
}
