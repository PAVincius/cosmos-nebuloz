"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useState } from "react";
import { createBillingIntegration } from "@/app/actions/billing";

type Provider = "billing_aws" | "billing_gcp" | "billing_azure";

type Props = {
  open: boolean;
  provider: Provider;
  onClose: () => void;
};

const PROVIDER_LABELS: Record<Provider, string> = {
  billing_aws: "AWS Cost Explorer",
  billing_gcp: "GCP BigQuery Billing",
  billing_azure: "Azure Cost Management",
};

const STEPS = [
  "Credenciais",
  "Testar conexão",
  "Escopo",
  "Regras de tag",
  "Backfill",
];

export function BillingConnectWizard({ open, provider, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleArn, setRoleArn] = useState("");
  const [extId, setExtId] = useState("");
  const [name, setName] = useState(`${PROVIDER_LABELS[provider]} Principal`);

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const result = await createBillingIntegration({
        source: provider,
        name,
        config: { roleArn, externalId: extId },
      });
      if (!result.ok) {
        throw new Error(result.error ?? "Erro desconhecido");
      }
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  function handleDialogChange(isOpen: boolean) {
    if (!isOpen) {
      onClose();
    }
  }

  function handleBack() {
    if (step > 1) {
      setStep(step - 1);
    } else {
      onClose();
    }
  }

  function handleNext() {
    setStep(step + 1);
  }

  function renderStepContent() {
    if (step === 1 && provider === "billing_aws") {
      return (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Crie uma role IAM com permissão <code>ce:GetCostAndUsage</code> e
            forneça o ARN abaixo.
          </p>
          <div className="space-y-2">
            <Label htmlFor="integration-name">Nome da integração</Label>
            <Input
              id="integration-name"
              onChange={(e) => setName(e.target.value)}
              value={name}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="role-arn">Role ARN</Label>
            <Input
              id="role-arn"
              onChange={(e) => setRoleArn(e.target.value)}
              placeholder="arn:aws:iam::123456789012:role/CosmosBillingRole"
              value={roleArn}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="external-id">External ID</Label>
            <Input
              id="external-id"
              onChange={(e) => setExtId(e.target.value)}
              placeholder="cosmos-<your-tenant-id>"
              value={extId}
            />
          </div>
        </div>
      );
    }

    if (step === 1) {
      return (
        <div className="py-8 text-center text-muted-foreground text-sm">
          <p>Suporte a {PROVIDER_LABELS[provider]} disponível em breve.</p>
        </div>
      );
    }

    if (step === 2) {
      return (
        <div className="py-8 text-center text-muted-foreground text-sm">
          <p>✓ Credenciais salvas. Conexão será testada no primeiro sync.</p>
        </div>
      );
    }

    if (step === 3) {
      return (
        <div className="py-8 text-center text-muted-foreground text-sm">
          <p>Todas as contas da role serão incluídas no v1.</p>
          <p className="mt-1">Filtragem por conta disponível na v2.</p>
        </div>
      );
    }

    if (step === 4) {
      return (
        <div className="py-8 text-center text-muted-foreground text-sm">
          <p>
            Regras de tag configuradas em{" "}
            <a className="underline" href="/portfolio/budgets/tag-rules">
              Portfolio → Tag Rules
            </a>{" "}
            após o primeiro sync.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Escolha o período de histórico a importar. Custos de API AWS
          aplicam-se.
        </p>
        <div className="flex gap-2">
          {[30, 90, 365].map((days) => (
            <Button className="flex-1" key={days} size="sm" variant="outline">
              {days === 365 ? "12 meses" : `${days} dias`}
            </Button>
          ))}
        </div>
      </div>
    );
  }

  const isNextDisabled = step === 1 && provider === "billing_aws" && !roleArn;

  return (
    <Dialog onOpenChange={handleDialogChange} open={open}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Conectar {PROVIDER_LABELS[provider]}</DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="mb-4 flex gap-2">
          {STEPS.map((label, i) => {
            const isActive = i + 1 === step;
            const isPast = i + 1 < step;
            let circleClass: string;
            if (isActive) {
              circleClass = "bg-primary text-primary-foreground";
            } else if (isPast) {
              circleClass = "bg-primary/20 text-primary";
            } else {
              circleClass = "bg-muted text-muted-foreground";
            }

            return (
              <div className="flex items-center gap-1" key={label}>
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full font-medium text-xs ${circleClass}`}
                >
                  {i + 1}
                </div>
                {i < STEPS.length - 1 && <div className="h-px w-4 bg-border" />}
              </div>
            );
          })}
        </div>

        {renderStepContent()}

        {error !== null && <p className="text-destructive text-sm">{error}</p>}

        <div className="mt-4 flex justify-between">
          <Button onClick={handleBack} variant="ghost">
            {step === 1 ? "Cancelar" : "← Voltar"}
          </Button>
          {step < STEPS.length ? (
            <Button disabled={isNextDisabled} onClick={handleNext}>
              Próximo →
            </Button>
          ) : (
            <Button disabled={loading} onClick={handleSave}>
              {loading ? "Salvando…" : "Conectar"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
