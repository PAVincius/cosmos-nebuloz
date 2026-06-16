"use client";

import { Button } from "@repo/design-system/components/ui/button";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@repo/design-system/components/ui/tabs";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import {
  LayoutListIcon,
  NetworkIcon,
  PlusIcon,
  TargetIcon,
} from "lucide-react";
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
import { OKRCardV2 } from "./okr-card-v2";
import { OKRCheckInModal } from "./okr-checkin-modal";
import { OKRDetailPanel } from "./okr-detail-panel";
import { OKRTreeView } from "./okr-tree-view";

// ─── Types ────────────────────────────────────────────────────────────────────

type PIOption = { id: string; name: string };
type View = "list" | "tree";

type Props = {
  initialOKRs: OKRWithContext[];
  piPlans: PIOption[];
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function OKRsDashboard({ initialOKRs, piPlans }: Props) {
  const [okrs, setOkrs] = useState<OKRWithContext[]>(initialOKRs);
  const [view, setView] = useState<View>("list");
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

  // ─── Optimistic update helpers ─────────────────────────────────────────────

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

  // ─── Common props for card/tree ────────────────────────────────────────────

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
      {/* ── Toolbar row ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* View toggle */}
        <div className="flex items-center gap-0.5 rounded-md border border-border/80 p-0.5">
          <button
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-medium text-xs transition-colors ${
              view === "list"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            onClick={() => setView("list")}
            type="button"
          >
            <LayoutListIcon className="h-3.5 w-3.5" />
            Lista
          </button>
          <button
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 font-medium text-xs transition-colors ${
              view === "tree"
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            onClick={() => setView("tree")}
            type="button"
          >
            <NetworkIcon className="h-3.5 w-3.5" />
            Árvore
          </button>
        </div>

        {/* PI Plan filter */}
        {piPlans.length > 0 && (
          <Tabs onValueChange={setSelectedPi} value={selectedPi}>
            <TabsList className="h-8">
              <TabsTrigger className="h-7 text-xs" value="all">
                Todos os PIs
              </TabsTrigger>
              {piPlans.map((pi) => (
                <TabsTrigger className="h-7 text-xs" key={pi.id} value={pi.id}>
                  {pi.name}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        <div className="flex-1" />

        <Button onClick={() => setDialogOpen(true)} size="sm">
          <PlusIcon className="mr-1.5 h-4 w-4" />
          Novo OKR
        </Button>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────────── */}
      {filteredOKRs.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-12 text-center">
          <TargetIcon className="h-10 w-10 text-muted-foreground/30" />
          <div>
            <p className="font-medium text-sm">Nenhum OKR encontrado</p>
            <p className="mt-1 text-muted-foreground text-xs">
              Defina objetivos e key results para medir o progresso do portfolio
              SAFe.
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <PlusIcon className="mr-1.5 h-4 w-4" /> Criar primeiro OKR
          </Button>
        </div>
      ) : view === "list" ? (
        <div className="flex flex-col gap-3">
          {filteredOKRs.map((okr) => (
            <OKRCardV2 key={okr.id} okr={okr} {...cardProps} />
          ))}
        </div>
      ) : (
        <OKRTreeView okrs={filteredOKRs} {...cardProps} />
      )}

      {/* ── Detail Panel ─────────────────────────────────────────────────────── */}
      <OKRDetailPanel
        okr={detailOKR}
        onCheckIn={setCheckInOKR}
        onClose={() => setDetailOKR(null)}
        onUpdateKRCurrent={handleUpdateKRCurrent}
        open={detailOKR !== null}
      />

      {/* ── Check-in Modal ───────────────────────────────────────────────────── */}
      {checkInOKR && (
        <OKRCheckInModal
          okr={checkInOKR}
          onCheckInSuccess={handleCheckInSuccess}
          onClose={() => setCheckInOKR(null)}
          open={checkInOKR !== null}
        />
      )}

      {/* ── Create Dialog ────────────────────────────────────────────────────── */}
      <Dialog onOpenChange={setDialogOpen} open={dialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo OKR</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label>Objetivo *</Label>
              <Input
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="Ex: Aumentar satisfação do cliente"
                value={form.title}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Descrição (opcional)</Label>
              <Textarea
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Contexto e detalhes do objetivo..."
                rows={3}
                value={form.description}
              />
            </div>
            {piPlans.length > 0 && (
              <div className="grid gap-1.5">
                <Label>PI Plan (opcional)</Label>
                <Select
                  onValueChange={(v) =>
                    setForm({ ...form, piPlanId: v === "none" ? "" : v })
                  }
                  value={form.piPlanId || "none"}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nenhum" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
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
          <DialogFooter>
            <Button onClick={() => setDialogOpen(false)} variant="outline">
              Cancelar
            </Button>
            <Button
              disabled={isPending || !form.title.trim()}
              onClick={handleCreate}
            >
              Criar OKR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
