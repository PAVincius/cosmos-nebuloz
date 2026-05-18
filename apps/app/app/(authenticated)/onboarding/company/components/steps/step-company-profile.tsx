"use client";

import { useState } from "react";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { BuildingIcon } from "lucide-react";
import {
  WizardStepHeader,
  wizardInputClassName,
} from "../../../../components/wizard-ui";

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Asia/Tokyo",
] as const;

const LOCALES = [
  { value: "pt-BR", label: "Português (Brasil)" },
  { value: "en-US", label: "English (US)" },
  { value: "es-ES", label: "Español" },
] as const;

export interface CompanyProfileFormData {
  legalName: string;
  displayName: string;
  country: string;
  timezone: string;
  locale: string;
}

interface StepCompanyProfileProps {
  defaultValues?: Partial<CompanyProfileFormData>;
  onChange: (data: CompanyProfileFormData) => void;
}

export function StepCompanyProfile({
  defaultValues,
  onChange,
}: StepCompanyProfileProps) {
  const [data, setData] = useState<CompanyProfileFormData>({
    legalName: defaultValues?.legalName ?? "",
    displayName: defaultValues?.displayName ?? "",
    country: defaultValues?.country ?? "BR",
    timezone: defaultValues?.timezone ?? "America/Sao_Paulo",
    locale: defaultValues?.locale ?? "pt-BR",
  });

  function update(patch: Partial<CompanyProfileFormData>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-6">
      <WizardStepHeader
        icon={<BuildingIcon className="h-4 w-4" />}
        title="Perfil da empresa"
        description="Informações básicas que identificam o tenant no COSMOS."
      />

      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="legalName">
              Nome legal{" "}
              <span className="text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="legalName"
              className={wizardInputClassName}
              value={data.legalName}
              onChange={(e) => update({ legalName: e.target.value })}
              placeholder="Acme Tecnologia LTDA"
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="displayName">
              Nome de exibição{" "}
              <span className="text-destructive" aria-hidden>
                *
              </span>
            </Label>
            <Input
              id="displayName"
              className={wizardInputClassName}
              value={data.displayName}
              onChange={(e) => update({ displayName: e.target.value })}
              placeholder="Acme"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="timezone">Fuso horário</Label>
            <Select
              value={data.timezone}
              onValueChange={(v) => update({ timezone: v })}
            >
              <SelectTrigger id="timezone" className={wizardInputClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="locale">Idioma padrão</Label>
            <Select
              value={data.locale}
              onValueChange={(v) => update({ locale: v })}
            >
              <SelectTrigger id="locale" className={wizardInputClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}

export function validateCompanyProfile(
  data: CompanyProfileFormData
): string | null {
  if (!data.legalName.trim()) return "Nome legal é obrigatório.";
  if (!data.displayName.trim()) return "Nome de exibição é obrigatório.";
  return null;
}
