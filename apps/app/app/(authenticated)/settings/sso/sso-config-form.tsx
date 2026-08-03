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
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { type SSOConfigData, saveSSOConfig } from "@/app/actions/settings/sso";

type Props = {
  initial: SSOConfigData | null;
};

export function SSOConfigForm({ initial }: Props) {
  const [enabled, setEnabled] = useState(initial?.enabled ?? false);
  const [idpMetadataUrl, setIdpMetadataUrl] = useState(
    initial?.idpMetadataUrl ?? ""
  );
  const [idpEntityId, setIdpEntityId] = useState(initial?.idpEntityId ?? "");
  const [idpCertificate, setIdpCertificate] = useState(
    initial?.idpCertificate ?? ""
  );
  const [spEntityId, setSpEntityId] = useState(initial?.spEntityId ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await saveSSOConfig({
        enabled,
        idpMetadataUrl: idpMetadataUrl || null,
        idpEntityId: idpEntityId || null,
        idpCertificate: idpCertificate || null,
        spEntityId: spEntityId || null,
      });
      if (result.ok) {
        toast.success("Configuração SSO salva");
      } else {
        toast.error(`Erro: ${result.error}`);
      }
    });
  }

  return (
    <div className="max-w-xl space-y-5">
      <div className="space-y-1.5">
        <Label htmlFor="sso-enabled">SSO/SAML</Label>
        <Select
          onValueChange={(v) => setEnabled(v === "true")}
          value={enabled ? "true" : "false"}
        >
          <SelectTrigger className="w-40" id="sso-enabled">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="false">Desativado</SelectItem>
            <SelectItem value="true">Ativado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="idp-metadata-url">URL de Metadados do IdP</Label>
        <Input
          id="idp-metadata-url"
          onChange={(e) => setIdpMetadataUrl(e.target.value)}
          placeholder="https://idp.example.com/saml/metadata"
          value={idpMetadataUrl}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="idp-entity-id">Entity ID do IdP</Label>
        <Input
          id="idp-entity-id"
          onChange={(e) => setIdpEntityId(e.target.value)}
          placeholder="https://idp.example.com"
          value={idpEntityId}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sp-entity-id">Entity ID do SP (COSMOS)</Label>
        <Input
          id="sp-entity-id"
          onChange={(e) => setSpEntityId(e.target.value)}
          placeholder="https://app.cosmos.example.com"
          value={spEntityId}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="idp-certificate">Certificado X.509 do IdP</Label>
        <Textarea
          className="min-h-[120px] resize-none font-mono text-xs"
          id="idp-certificate"
          onChange={(e) => setIdpCertificate(e.target.value)}
          placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
          value={idpCertificate}
        />
      </div>

      <Button disabled={isPending} onClick={handleSave}>
        {isPending ? "Salvando…" : "Salvar configuração"}
      </Button>
    </div>
  );
}
