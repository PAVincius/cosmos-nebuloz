"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  createScheduledReport,
  deleteScheduledReport,
  updateScheduledReport,
} from "@/app/actions/reporting/scheduled-reports";

type ReportRow = {
  id: string;
  name: string;
  cronExpression: string;
  enabled: boolean;
  recipients: string[];
  slackChannelId: string | null;
  executions: {
    status: string;
    executedAt: Date | null;
    pdfUrl: string | null;
  }[];
};

export function CreateReportButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const recipients = (fd.get("recipients") as string)
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);

    startTransition(async () => {
      const res = await createScheduledReport({
        name: fd.get("name") as string,
        cronExpression: fd.get("cronExpression") as string,
        timezone: (fd.get("timezone") as string) || "UTC",
        recipients,
        slackChannelId: (fd.get("slackChannelId") as string) || undefined,
        config: {},
      });
      if (res.ok) {
        toast.success("Relatório agendado criado.");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao criar relatório.");
      }
    });
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogTrigger asChild>
        <Button size="sm">
          <PlusIcon className="mr-2 h-4 w-4" />
          Novo Relatório
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Agendar Relatório</DialogTitle>
        </DialogHeader>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              placeholder="Relatório Semanal PI"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="cronExpression">Cadência (cron)</Label>
            <Input
              id="cronExpression"
              name="cronExpression"
              placeholder="0 8 * * 1  (Segunda às 8h)"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="timezone">Fuso horário</Label>
            <Input
              defaultValue="America/Sao_Paulo"
              id="timezone"
              name="timezone"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="recipients">Destinatários (e-mails, vírgula)</Label>
            <Input
              id="recipients"
              name="recipients"
              placeholder="a@empresa.com, b@empresa.com"
              required
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="slackChannelId">Canal Slack (opcional)</Label>
            <Input
              id="slackChannelId"
              name="slackChannelId"
              placeholder="#pi-reports"
            />
          </div>
          <Button className="w-full" disabled={isPending} type="submit">
            {isPending ? "Criando..." : "Criar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ReportActions({ report }: { report: ReportRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function toggleEnabled() {
    startTransition(async () => {
      const res = await updateScheduledReport(report.id, {
        enabled: !report.enabled,
      });
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao atualizar.");
      }
    });
  }

  function handleDelete() {
    if (!confirm(`Excluir "${report.name}"?`)) {
      return;
    }
    startTransition(async () => {
      const res = await deleteScheduledReport(report.id);
      if (res.ok) {
        toast.success("Relatório excluído.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Erro ao excluir.");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button
        className={`rounded-full px-3 py-1 font-medium text-xs transition-colors ${
          report.enabled
            ? "bg-green-100 text-green-800 hover:bg-green-200"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        }`}
        disabled={isPending}
        onClick={toggleEnabled}
        type="button"
      >
        {report.enabled ? "Ativo" : "Pausado"}
      </button>
      <button
        className="text-destructive text-xs hover:underline"
        disabled={isPending}
        onClick={handleDelete}
        type="button"
      >
        Excluir
      </button>
    </div>
  );
}
