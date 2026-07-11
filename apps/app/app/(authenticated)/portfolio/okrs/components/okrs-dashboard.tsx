"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@repo/design-system/components/ui/tabs";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { PlusIcon, TargetIcon } from "lucide-react";
import { useState, useTransition } from "react";
import {
  createOKR,
  deleteOKR,
  type KeyResultWithProgress,
  type OKRStatus,
  type OKRWithContext,
  updateKeyResult,
  updateOKRStatus,
} from "@/app/actions/okrs";
import { KpiCard, KpiGrid } from "@/app/(authenticated)/components/kpi-card";
import { ModalShell } from "@/app/(authenticated)/components/modal-shell";
import { OKRCardV2 } from "./okr-card-v2";
import { OKRCheckInModal } from "./okr-checkin-modal";
import { OKRDetailPanel } from "./okr-detail-panel";
import { ICON_ALERT, ICON_CHECK, ICON_GAUGE, ICON_TARGET } from "./okr-constants";

// ─── Types ──────────────────────────────────────────────────────

type PIOption = { id: string; name: string };

type Props = {
  initialOKRs: OKRWithContext[];
  piPlans: PIOption[];
};

// ─── Main Dashboard ─────────────────────────────────────────────

export function OKRsDashboard({ initialOKRs, piPlans }: Props) {
  const [okrs, setOkrs] = useState<OKRWithContext[]>(initialOKRs);
  const [selectedPi, setSelectedPi] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailOKR, setDetailOKR] = useState<OKRWithContext | null>(null);
  const [checkInOKR, setCheckInOKR] = useState<OKRWithContext | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    piPlanId: "",
  });
  const [isPending, startTransition] = useTransition();

  const filteredOKRs =
    selectedPi === "all" ? okrs : okrs.filter((o) => o.piPlanId === selectedPi);

  // ─── KPI grid (mirrors cosmos.html's flattened-KR stats — screen-okrs.jsx) ───

  const allKRs = okrs.flatMap((o) => o.keyResults);
  const avgProgress =
    allKRs.length > 0
      ? Math.round(allKRs.reduce((s, k) => s + k.progress, 0) / allKRs.length)
      : 0;
  const onTrackKRs = allKRs.filter((k) => k.progress >= 70).length;
  const atRiskKRs = allKRs.filter((k) => k.progress < 40).length;
  const withOwner = okrs.filter((o) => o.ownerId).length;

  // ─── Optimistic update helpers ──────────────────────────────────

  function handleDelete(id: string) {
    setOkrs((prev) => prev.filter((o) => o.id !== id));
    if (detailOKR?.id === id) {
      setDetailOKR(null);
    }
    startTransition(() => {
      void deleteOKR(id);
    });
  }

  function handleStatusChange(id: string, status: OKRStatus) {
    const update = (prev: OKRWithContext[]) =>
      prev.map((o) => (o.id === id ? { ...o, status } : o));
    setOkrs(update);
    setDetailOKR((prev) => (prev?.id === id ? { ...prev, status } : prev));
    startTransition(() => {
      void updateOKRStatus(id, status);
    });
  }

  function handleAddKeyResult(okrId: string, kr: KeyResultWithProgress) {
    const update = (prev: OKRWithContext[]) =>
      prev.map((o) => {
        if (o.id !== okrId) {
          return o;
        }
        const keyResults = [...o.keyResults, kr];
        const progress =
          keyResults.length > 0
            ? Math.round(
                keyResults.reduce((s, k) => s + k.progress, 0) /
                  keyResults.length
              )
            : 0;
        return { ...o, keyResults, progress };
      });
    setOkrs(update);
    setDetailOKR((prev) =>
      prev?.id === okrId ? (update([prev])[0] ?? prev) : prev
    );
  }

  function handleDeleteKeyResult(okrId: string, krId: string) {
    const update = (prev: OKRWithContext[]) =>
      prev.map((o) => {
        if (o.id !== okrId) {
          return o;
        }
        const keyResults = o.keyResults.filter((k) => k.id !== krId);
        const progress =
          keyResults.length > 0
            ? Math.round(
                keyResults.reduce((s, k) => s + k.progress, 0) /
                  keyResults.length
              )
            : 0;
        return { ...o, keyResults, progress };
      });
    setOkrs(update);
    setDetailOKR((prev) =>
      prev?.id === okrId ? (update([prev])[0] ?? prev) : prev
    );
  }

  function handleUpdateKRCurrent(okrId: string, krId: string, current: number) {
    const update = (prev: OKRWithContext[]) =>
      prev.map((o) => {
        if (o.id !== okrId) {
          return o;
        }
        const keyResults = o.keyResults.map((k) => {
          if (k.id !== krId) {
            return k;
          }
          const progress =
            k.target > 0
              ? Math.min(100, Math.round((current / k.target) * 100))
              : 0;
          return { ...k, current, progress };
        });
        const progress =
          keyResults.length > 0
            ? Math.round(
                keyResults.reduce((s, k) => s + k.progress, 0) /
                  keyResults.length
              )
            : 0;
        return { ...o, keyResults, progress };
      });
    setOkrs(update);
    setDetailOKR((prev) =>
      prev?.id === okrId ? (update([prev])[0] ?? prev) : prev
    );
    startTransition(() => {
      void updateKeyResult(krId, { current });
    });
  }

  function handleCheckInSuccess(okrId: string, krId: string, newValue: number) {
    handleUpdateKRCurrent(okrId, krId, newValue);
  }

  async function handleCreate() {
    if (!form.title.trim()) {
      return;
    }
    const optimistic: OKRWithContext = {
      id: `tmp-${Date.now()}`,
      title: form.title,
      description: form.description || null,
      status: "ON_TRACK",
      piPlanId: form.piPlanId || null,
      strategicThemeId: null,
      epicId: null,
      artId: null,
      teamId: null,
      type: "portfolio_theme",
      horizon: null,
      scope: null,
      ownerId: null,
      progress: 0,
      keyResults: [],
      themeTitle: null,
      themeColor: null,
      tenantId: "",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as unknown as OKRWithContext;
    setOkrs((prev) => [...prev, optimistic]);
    setForm({ title: "", description: "", piPlanId: "" });
    setDialogOpen(false);
    startTransition(() => {
      void createOKR({
        title: form.title,
        description: form.description || undefined,
        piPlanId: form.piPlanId || undefined,
      });
    });
  }

  // ─── Common props for card ──────────────────────────────────────

  const cardProps = {
    onDelete: handleDelete,
    onStatusChange: handleStatusChange,
    onAddKeyResult: handleAddKeyResult,
    onDeleteKeyResult: handleDeleteKeyResult,
    onUpdateKRCurrent: handleUpdateKRCurrent,
    onOpenDetail: (okr: OKRWithContext) => setDetailOKR(okr),
    onCheckIn: (okr: OKRWithContext) => setCheckInOKR(okr),
  };

  return (
    <div className="space-y-5">
      {/* ── KPI grid — mirrors screen-okrs.jsx's 4-card grid ──────────── */}
      <KpiGrid>
        <KpiCard
          badge="vs. check-in anterior"
          iconPath={ICON_GAUGE}
          label="Progresso médio dos OKRs"
          tone="accent"
          unit="%"
          value={avgProgress}
        />
        <KpiCard
          badge={`de ${allKRs.length} no total`}
          iconPath={ICON_CHECK}
          label="Key Results on track"
          tone="green"
          value={onTrackKRs}
        />
        <KpiCard
          badge="< 40% do alvo"
          iconPath={ICON_ALERT}
          label="Key Results em risco"
          tone="red"
          value={atRiskKRs}
        />
        <KpiCard
          badge={
            okrs.length > 0
              ? `${Math.round((withOwner / okrs.length) * 100)}% atribuídos`
              : "—"
          }
          iconPath={ICON_TARGET}
          label="Objetivos com dono"
          tone="purple"
          unit={`/${okrs.length}`}
          value={withOwner}
        />
      </KpiGrid>

      {/* ── Toolbar row ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {piPlans.length > 0 && (
          <Tabs onValueChange={setSelectedPi} value={selectedPi}>
            <TabsList>
              <TabsTrigger value="all">Todos os PIs</TabsTrigger>
              {piPlans.map((pi) => (
                <TabsTrigger key={pi.id} value={pi.id}>
                  {pi.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <div className="flex-1" />

        <Button onClick={() => setDialogOpen(true)} size="sm">
          <PlusIcon className="h-4 w-4" />
          Novo OKR
        </Button>
      </div>

      {/* ── Content ──────────────────────────────────────────────────── */}
      {filteredOKRs.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-[var(--r-lg)] border border-hairline border-dashed p-12 text-center">
          <TargetIcon className="h-10 w-10 text-[var(--ink-faint)]" />
          <div>
            <p className="font-medium text-sm">Nenhum OKR encontrado</p>
            <p className="mt-1 text-[var(--ink-muted)] text-xs">
              Defina objetivos e key results para medir o progresso do portfolio
              SAFe.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <PlusIcon className="h-4 w-4" /> Criar primeiro OKR
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filteredOKRs.map((okr) => (
            <OKRCardV2 key={okr.id} okr={okr} {...cardProps} />
          ))}
        </div>
      )}

      {/* ── Detail Panel ─────────────────────────────────────────────── */}
      <OKRDetailPanel
        okr={detailOKR}
        onCheckIn={setCheckInOKR}
        onClose={() => setDetailOKR(null)}
        onUpdateKRCurrent={handleUpdateKRCurrent}
        open={detailOKR !== null}
      />

      {/* ── Check-in Modal ───────────────────────────────────────────── */}
      {checkInOKR && (
        <OKRCheckInModal
          okr={checkInOKR}
          onCheckInSuccess={handleCheckInSuccess}
          onClose={() => setCheckInOKR(null)}
          open={checkInOKR !== null}
        />
      )}

      {/* ── Create Modal ─────────────────────────────────────────────── */}
      <ModalShell
        eyebrow="Defina um objetivo mensurável para o portfólio"
        footer={
          <>
            <Button onClick={() => setDialogOpen(false)} variant="outline">
              Cancelar
            </Button>
            <Button disabled={!form.title.trim()} onClick={handleCreate}>
              Criar OKR
            </Button>
          </>
        }
        onClose={() => setDialogOpen(false)}
        open={dialogOpen}
        title="Novo OKR"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="okr-title">Título</Label>
            <Input
              id="okr-title"
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Reduzir lead time do portfólio em 30%"
              value={form.title}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="okr-description">Descrição (opcional)</Label>
            <Textarea
              id="okr-description"
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Contexto adicional sobre o objetivo"
              rows={3}
              value={form.description}
            />
          </div>
          {piPlans.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="okr-pi-plan">PI Plan (opcional)</Label>
              <Select
                onValueChange={(v) => setForm((f) => ({ ...f, piPlanId: v }))}
                value={form.piPlanId}
              >
                <SelectTrigger id="okr-pi-plan">
                  <SelectValue placeholder="Selecione um PI" />
                </SelectTrigger>
                <SelectContent>
                  {piPlans.map((pi) => (
                    <SelectItem key={pi.id} value={pi.id}>
                      {pi.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </ModalShell>
    </div>
  );
}
