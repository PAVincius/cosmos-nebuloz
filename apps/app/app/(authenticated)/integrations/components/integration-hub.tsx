"use client";

import { Badge } from "@repo/design-system/components/cosmos/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  PlugZapIcon,
  PlusIcon,
  RefreshCwIcon,
  TrashIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteIntegration } from "@/app/actions/integrations";
import type { IntegrationRow } from "@/app/actions/integrations/schema";
import { ConnectWizard } from "./connect-wizard";

// ─── Motion (DESIGN.md §Motion) ────────────────────────────────────────────

const revealVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.25, 0, 0, 1] },
  },
} as const;

const staggerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
} as const;

// ─── Source config ────────────────────────────────────────────────────────────
// Re-skin of prototype's `.intg-card` (batch3.css) — tone rgb from DESIGN.md palette.

const SOURCE_CONFIG: Record<
  string,
  { label: string; rgb: string; logo: string }
> = {
  linear: { label: "Linear", rgb: "167,139,250", logo: "⬡" },
  github: { label: "GitHub Projects", rgb: "91,141,239", logo: "⚙" },
  asana: { label: "Asana", rgb: "251,113,133", logo: "◈" },
  gitlab: { label: "GitLab", rgb: "251,191,36", logo: "◆" },
};

const STATUS_CONFIG = {
  ACTIVE: { label: "Ativa", icon: CheckCircle2Icon, tone: "green" as const },
  INACTIVE: {
    label: "Inativa",
    icon: ClockIcon,
    tone: "neutral" as const,
  },
  ERROR: { label: "Erro", icon: AlertCircleIcon, tone: "red" as const },
};

function syncLogTone(status: string): "green" | "amber" | "red" {
  if (status === "success") {
    return "green";
  }
  if (status === "partial") {
    return "amber";
  }
  return "red";
}

function syncLogIcon(status: string): string {
  if (status === "success") {
    return "✓";
  }
  if (status === "partial") {
    return "~";
  }
  return "✗";
}

function SyncLogBadge({ log }: { log: IntegrationRow["syncLogs"][number] }) {
  const tone = syncLogTone(log.status);
  return (
    <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-muted">
      <span
        className="font-bold"
        style={{ color: `var(--${tone}-text)` }}
      >
        {syncLogIcon(log.status)}
      </span>
      <span>
        +{log.itemsCreated} ↻{log.itemsUpdated} ⊘{log.itemsSkipped}
      </span>
      <span className="text-ink-muted/60">
        {new Date(log.createdAt).toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}

function IntegrationCard({
  integration,
  arts,
  epics,
}: {
  integration: IntegrationRow;
  arts: { id: string; name: string }[];
  epics: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [importOpen, setImportOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const src = SOURCE_CONFIG[integration.source] ?? {
    label: integration.source,
    rgb: "154,161,178",
    logo: "◌",
  };
  const sts =
    STATUS_CONFIG[integration.status as keyof typeof STATUS_CONFIG] ??
    STATUS_CONFIG.INACTIVE;
  const StatusIcon = sts.icon;

  const totalItems = integration.syncLogs.reduce(
    (sum, log) => sum + log.itemsCreated + log.itemsUpdated,
    0
  );

  function handleDelete() {
    startTransition(async () => {
      await deleteIntegration(integration.id);
      router.refresh();
    });
  }

  return (
    <motion.div
      className="flex flex-col gap-3 rounded-2xl border border-hairline bg-surface p-[18px]"
      variants={revealVariants}
      whileHover={
        prefersReducedMotion
          ? undefined
          : { y: -3, boxShadow: "0 24px 80px rgba(0,0,0,0.40)" }
      }
      transition={{ duration: 0.22, ease: [0.25, 0, 0, 1] }}
    >
      {/* ── intg-top ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-bold text-sm"
          style={{
            color: `rgb(${src.rgb})`,
            background: `linear-gradient(180deg, rgba(${src.rgb},.2), rgba(${src.rgb},.08))`,
            borderColor: `rgba(${src.rgb},.3)`,
          }}
        >
          {src.logo}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold text-[15px] text-ink">
            {integration.name}
          </div>
          <div className="text-[11px] text-ink-muted">{src.label}</div>
        </div>
        <Badge dot tone={sts.tone}>
          <StatusIcon className="h-3 w-3" />
          {sts.label}
        </Badge>
      </div>

      {/* ── intg-desc ─────────────────────────────────────────────────────── */}
      <div className="flex-1 space-y-1.5 text-[12.5px] text-ink-muted leading-[1.5]">
        {integration.lastSyncAt ? (
          <p>
            Último sync:{" "}
            {new Date(integration.lastSyncAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        ) : (
          <p className="text-ink-muted">Ainda sem sincronização.</p>
        )}

        {integration.syncLogs.length > 0 && (
          <div className="space-y-1 border-hairline border-t pt-2">
            {integration.syncLogs.slice(0, 3).map((log) => (
              <SyncLogBadge key={log.id} log={log} />
            ))}
          </div>
        )}
      </div>

      {/* ── intg-stat ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-hairline border-t pt-3 font-mono text-[11px] text-ink-muted">
        <span>{totalItems ? `${totalItems} itens` : "sem dados"}</span>
        <span>
          sync:{" "}
          {integration.lastSyncAt
            ? new Date(integration.lastSyncAt).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "short",
              })
            : "nunca"}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button
          className="h-8 flex-1 gap-1.5 text-xs"
          onClick={() => setImportOpen(true)}
          size="sm"
          variant="outline"
        >
          <RefreshCwIcon className="h-3.5 w-3.5" />
          Importar
        </Button>
        <Button
          className="h-8 w-8 p-0 text-ink-muted hover:text-red-text"
          disabled={isPending}
          onClick={handleDelete}
          size="sm"
          variant="ghost"
        >
          <TrashIcon className="h-3.5 w-3.5" />
        </Button>
      </div>

      {importOpen ? (
        <ConnectWizard
          arts={arts}
          epics={epics}
          existingIntegration={integration}
          mode="import"
          onClose={() => setImportOpen(false)}
        />
      ) : null}
    </motion.div>
  );
}

// ─── Main hub ───────────────────────────────────────────────────────────────

type Props = {
  integrations: IntegrationRow[];
  arts: { id: string; name: string }[];
  epics: { id: string; title: string }[];
};

export function IntegrationHub({ integrations, arts, epics }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* ROI value proposition */}
      <div className="rounded-2xl border border-hairline bg-surface-2 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-[240px] flex-1">
            <p className="font-semibold text-[15px] text-ink tracking-tight">
              Continue no seu fluxo. Ganhe visibilidade SAFe.
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              Devs continuam no Linear ou GitHub. RTEs, LPMs e PMs veem Program
              Board, WSJF, Flow Metrics e PI Planning com os dados reais — sem
              pedir que o time troque de ferramenta.
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-[11px] text-ink-muted">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--green)" }}
                />
                Sem ruptura de stack
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--blue)" }}
                />
                Features importadas aparecem no Program Board + WSJF
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: "var(--purple)" }}
                />
                Link direto para o item original em cada card
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => (
              <span
                className="inline-flex items-center gap-1 rounded-pill border px-2 py-0.5 font-medium text-[11px]"
                key={key}
                style={{
                  color: `rgb(${cfg.rgb})`,
                  background: `rgba(${cfg.rgb},.1)`,
                  borderColor: `rgba(${cfg.rgb},.3)`,
                  opacity: key === "asana" || key === "gitlab" ? 0.4 : 1,
                }}
              >
                {cfg.logo} {cfg.label}
                {(key === "asana" || key === "gitlab") && (
                  <span className="ml-0.5 opacity-60">em breve</span>
                )}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Integration grid */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <p className="font-semibold text-[11px] text-ink-muted uppercase tracking-wide">
            Integrações ({integrations.length})
          </p>
          <Button
            className="h-8 gap-1.5"
            onClick={() => setWizardOpen(true)}
            size="sm"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Conectar ferramenta
          </Button>
        </div>

        {integrations.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-hairline border-dashed py-16 text-center">
            <PlugZapIcon className="h-8 w-8 text-ink-muted" />
            <div>
              <p className="font-semibold text-[13px] text-ink">
                Nenhuma integração configurada
              </p>
              <p className="mt-1 text-[12px] text-ink-muted">
                Conecte Linear ou GitHub Projects para importar features e
                stories diretamente para o COSMOS.
              </p>
            </div>
            <Button className="gap-1.5" onClick={() => setWizardOpen(true)}>
              <PlusIcon className="h-3.5 w-3.5" />
              Conectar agora
            </Button>
          </div>
        ) : (
          <motion.div
            animate="visible"
            className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))]"
            initial="hidden"
            variants={staggerVariants}
          >
            {integrations.map((i) => (
              <IntegrationCard
                arts={arts}
                epics={epics}
                integration={i}
                key={i.id}
              />
            ))}
          </motion.div>
        )}
      </div>

      {/* How it works */}
      <div className="space-y-3 rounded-2xl border border-hairline p-4">
        <p className="font-semibold text-[11px] text-ink-muted uppercase tracking-wide">
          Como funciona
        </p>
        <div className="grid gap-3 text-[12px] text-ink-muted sm:grid-cols-3">
          <div className="space-y-1">
            <p className="font-medium text-ink">1. Conecte</p>
            <p>
              Informe seu API key ou token. O COSMOS testa a conexão e lista
              seus projetos/times.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-ink">2. Importe</p>
            <p>
              Selecione o projeto e mapeie para Epic, PI ou Time no COSMOS.
              Issues viram Features ou Stories.
            </p>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-ink">3. Use no COSMOS</p>
            <p>
              Features importadas aparecem no Program Board, WSJF, Flow Metrics
              e PI Planning — com link para o item original.
            </p>
          </div>
        </div>
      </div>

      {wizardOpen ? (
        <ConnectWizard
          arts={arts}
          epics={epics}
          mode="connect"
          onClose={() => setWizardOpen(false)}
        />
      ) : null}
    </div>
  );
}
