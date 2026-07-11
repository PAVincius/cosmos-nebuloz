"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import {
  ArrowUpRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  PlusIcon,
  StarIcon,
  Trash2Icon,
} from "lucide-react";
import { useState, useTransition } from "react";
import {
  createKeyResult,
  deleteKeyResult,
  type KeyResultWithProgress,
  type OKRStatus,
  type OKRWithContext,
  updateKeyResult,
  updateOKRStatus,
} from "@/app/actions/okrs";
import { OkrBadge } from "./okr-badge";
import { STATUS_CONFIG, TYPE_CONFIG, toneForProgress } from "./okr-constants";

type KeyResultRowProps = {
  okrId: string;
  index: number;
  kr: KeyResultWithProgress;
  onDeleteKeyResult: (okrId: string, krId: string) => void;
  onUpdateKRCurrent: (okrId: string, krId: string, current: number) => void;
};

function KeyResultRow({
  okrId,
  index,
  kr,
  onDeleteKeyResult,
  onUpdateKRCurrent,
}: KeyResultRowProps) {
  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState(String(kr.current));
  const [isPending, startTransition] = useTransition();
  const tone = toneForProgress(kr.progress);

  function handleSave() {
    const newVal = Number.parseFloat(inputVal);
    if (Number.isNaN(newVal) || newVal === kr.current) {
      setEditing(false);
      return;
    }
    startTransition(async () => {
      await updateKeyResult(kr.id, { current: newVal });
      onUpdateKRCurrent(okrId, kr.id, newVal);
      setEditing(false);
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      handleSave();
    }
    if (e.key === "Escape") {
      setInputVal(String(kr.current));
      setEditing(false);
    }
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteKeyResult(kr.id);
      onDeleteKeyResult(okrId, kr.id);
    });
  }

  return (
    <div className="group border-hairline border-b py-[11px] last:border-b-0">
      <div className="mb-[7px] flex items-baseline justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 font-mono text-[10px] text-[var(--ink-muted)]">
            KR{index + 1}
          </span>
          <span className="truncate text-[13px] text-[var(--ink-muted)]">
            {kr.title}
          </span>
        </span>
        <div className="flex shrink-0 items-center gap-1.5">
          {editing ? (
            <>
              <Input
                autoFocus
                className="h-6 w-20 text-xs"
                disabled={isPending}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={handleKeyDown}
                step="any"
                type="number"
                value={inputVal}
              />
              <Button
                className="h-6 w-6 p-0"
                disabled={isPending}
                onClick={handleSave}
                size="sm"
                variant="ghost"
              >
                <CheckIcon className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <button
              className="cursor-pointer whitespace-nowrap font-mono font-bold text-xs"
              onClick={() => {
                setInputVal(String(kr.current));
                setEditing(true);
              }}
              style={{ color: `var(--${tone}-text)` }}
              type="button"
            >
              {kr.current}
              {kr.unit} / {kr.target}
              {kr.unit}
            </button>
          )}
          <Button
            className="h-6 w-6 p-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
            disabled={isPending}
            onClick={handleDelete}
            size="sm"
            variant="ghost"
          >
            <Trash2Icon className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div
        className="h-[7px] overflow-hidden rounded-full shadow-[inset_0_1px_2px_rgba(0,0,0,.5)]"
        style={{ background: "var(--surface-3)" }}
      >
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${Math.round(kr.progress)}%`,
            background: `var(--${tone})`,
          }}
        />
      </div>
    </div>
  );
}

type AddKeyResultRowProps = {
  okrId: string;
  onAddKeyResult: (okrId: string, kr: KeyResultWithProgress) => void;
};

function AddKeyResultRow({ okrId, onAddKeyResult }: AddKeyResultRowProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    if (!title.trim()) {
      return;
    }
    startTransition(async () => {
      const newKR = await createKeyResult({
        okrId,
        title: title.trim(),
        target: Number.parseFloat(target) || 100,
        unit: unit.trim() || "%",
        current: 0,
      });
      if (newKR && "data" in newKR && newKR.data) {
        onAddKeyResult(okrId, newKR.data);
      }
      setTitle("");
      setTarget("");
      setUnit("");
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <button
        className="mt-2 flex w-full items-center gap-1 rounded-md px-2 py-1 text-[var(--ink-muted)] text-xs transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <PlusIcon className="h-3 w-3" />
        Key Result
      </button>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1.5 rounded-md bg-[var(--surface-2)] px-2 py-1.5">
      <Input
        autoFocus
        className="h-7 flex-1 text-xs"
        disabled={isPending}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            handleAdd();
          }
          if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Título do KR"
        value={title}
      />
      <Input
        className="h-7 w-16 text-xs"
        disabled={isPending}
        onChange={(e) => setTarget(e.target.value)}
        placeholder="Meta"
        type="number"
        value={target}
      />
      <Input
        className="h-7 w-16 text-xs"
        disabled={isPending}
        onChange={(e) => setUnit(e.target.value)}
        placeholder="Unidade"
        value={unit}
      />
      <Button
        className="h-7 px-2 text-xs"
        disabled={isPending || !title.trim()}
        onClick={handleAdd}
        size="sm"
        variant="ghost"
      >
        <CheckIcon className="h-3.5 w-3.5" />
      </Button>
      <Button
        className="h-7 px-2 text-xs"
        disabled={isPending}
        onClick={() => setOpen(false)}
        size="sm"
        variant="ghost"
      >
        ✕
      </Button>
    </div>
  );
}

type OKRCardV2Props = {
  okr: OKRWithContext;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: OKRStatus) => void;
  onAddKeyResult: (okrId: string, kr: KeyResultWithProgress) => void;
  onDeleteKeyResult: (okrId: string, krId: string) => void;
  onUpdateKRCurrent: (okrId: string, krId: string, current: number) => void;
  onOpenDetail: (okr: OKRWithContext) => void;
  onCheckIn: (okr: OKRWithContext) => void;
};

/** Dashboard objective card — mirrors cosmos.html's ObjectiveCard (screen-okrs.jsx). */
export function OKRCardV2({
  okr,
  onDelete,
  onStatusChange,
  onAddKeyResult,
  onDeleteKeyResult,
  onUpdateKRCurrent,
  onOpenDetail,
  onCheckIn,
}: OKRCardV2Props) {
  const [expanded, setExpanded] = useState(true);
  const [isPending, startTransition] = useTransition();

  const statusKey = okr.status as OKRStatus;
  const statusCfg = STATUS_CONFIG[statusKey];
  const typeCfg = TYPE_CONFIG[okr.type];
  const ringTone = toneForProgress(okr.progress);

  function handleStatusChange(value: string) {
    const newStatus = value as OKRStatus;
    startTransition(async () => {
      await updateOKRStatus(okr.id, newStatus);
      onStatusChange(okr.id, newStatus);
    });
  }

  function handleDelete() {
    startTransition(() => {
      onDelete(okr.id);
    });
  }

  return (
    <div className="overflow-hidden rounded-[var(--r-lg)] border border-hairline bg-surface shadow-[var(--card-shadow)] transition-all duration-200 hover:border-hairline-strong hover:shadow-[var(--hover-shadow)]">
      {/* okr-head — matches ObjectiveCard's header row (icon circle + tone left-border) */}
      <div
        className="flex items-start gap-3.5 border-hairline border-b px-[18px] py-4 shadow-[inset_0_1px_0_rgba(255,255,255,.05)]"
        style={{
          background:
            "linear-gradient(180deg, var(--surface-3), var(--surface-2))",
          borderLeft: `3px solid var(--${ringTone})`,
        }}
      >
        <span
          aria-hidden
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{
            color: `var(--${ringTone})`,
            background: `var(--${ringTone}-soft)`,
            border: `1px solid rgba(var(--${ringTone}-rgb),.22)`,
          }}
        >
          <StarIcon className="h-5 w-5" strokeWidth={1.8} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {okr.scope ? (
              <OkrBadge dot tone={ringTone}>
                {okr.scope}
              </OkrBadge>
            ) : typeCfg ? (
              <OkrBadge dot tone={ringTone}>
                {typeCfg.icon} {typeCfg.label}
              </OkrBadge>
            ) : null}
            {okr.themeTitle ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-medium text-xs leading-none"
                style={{
                  background: "var(--surface-4)",
                  color: "var(--ink-muted)",
                  borderLeft: okr.themeColor
                    ? `3px solid ${okr.themeColor}`
                    : undefined,
                }}
              >
                {okr.themeTitle}
              </span>
            ) : null}
          </div>
          <p className="mt-1.5 font-bold text-[15px] leading-[1.3] tracking-[-0.01em]">
            {okr.title}
          </p>
          <span className="mt-1 block font-mono text-[11px] text-[var(--ink-muted)]">
            {okr.keyResults.length} KR{okr.keyResults.length !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span
            className="font-bold font-mono text-[15px]"
            style={{ color: `var(--${ringTone}-text)` }}
          >
            {Math.round(okr.progress)}%
          </span>
          <Select
            disabled={isPending}
            onValueChange={handleStatusChange}
            value={okr.status}
          >
            <SelectTrigger
              className="h-6 rounded-full border-0 px-2.5 text-[11.5px] shadow-none"
              style={{
                background: statusCfg ? `var(--${statusCfg.tone}-soft)` : undefined,
                color: statusCfg ? `var(--${statusCfg.tone}-text)` : undefined,
              }}
            >
              <SelectValue>{statusCfg?.label ?? okr.status}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                <SelectItem key={key} value={key}>
                  {cfg.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* action row */}
      <div className="flex items-center gap-0.5 border-hairline border-b px-[18px] py-1.5">
        <button
          aria-label={expanded ? "Recolher KRs" : "Expandir KRs"}
          className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setExpanded((p) => !p)}
          type="button"
        >
          {expanded ? (
            <ChevronDownIcon className="h-3.5 w-3.5" />
          ) : (
            <ChevronRightIcon className="h-3.5 w-3.5" />
          )}
        </button>
        <button
          aria-label="Ver detalhes"
          className="flex h-6 w-6 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => onOpenDetail(okr)}
          type="button"
        >
          <ArrowUpRightIcon className="h-3.5 w-3.5" />
        </button>
        <Button
          className="h-6 gap-1 px-1.5 text-xs"
          onClick={() => onCheckIn(okr)}
          size="sm"
          variant="ghost"
        >
          <ClipboardCheckIcon className="h-3.5 w-3.5" />
          Check-in
        </Button>
        <div className="flex-1" />
        <Button
          aria-label="Excluir OKR"
          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
          disabled={isPending}
          onClick={handleDelete}
          size="sm"
          variant="ghost"
        >
          <Trash2Icon className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* okr-krs */}
      {expanded ? (
        <div className="px-[18px] pt-2 pb-4">
          {okr.keyResults.map((kr, i) => (
            <KeyResultRow
              index={i}
              key={kr.id}
              kr={kr}
              okrId={okr.id}
              onDeleteKeyResult={onDeleteKeyResult}
              onUpdateKRCurrent={onUpdateKRCurrent}
            />
          ))}
          <AddKeyResultRow okrId={okr.id} onAddKeyResult={onAddKeyResult} />
        </div>
      ) : null}
    </div>
  );
}
