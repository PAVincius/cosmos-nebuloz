"use client";

// Vínculos do entregável com item externo (Norte e.2, S6): Cosmos, Linear,
// GitHub e Jira, de 0 a N. É referência: a tela mostra o link, o servidor não o
// busca, e o estado do item externo nunca muda o do entregável.

import { Button } from "@repo/design-system/cosmos/kit";
import { useState } from "react";
import {
  addDeliverableLink,
  removeDeliverableLink,
} from "@/app/(scaffold)/actions/deliverables";
import {
  type LinkProvider,
  PROVIDER_LABEL,
  safeHref,
} from "@/lib/scaffold/external-links";
import { Field, Input, ModalShell, Select } from "./base";

export type LinkItem = {
  id: string;
  provider: string;
  externalId: string;
  url: string;
};

const PROVIDERS = (Object.keys(PROVIDER_LABEL) as LinkProvider[]).map((p) => ({
  value: p,
  label: PROVIDER_LABEL[p],
}));

const labelOf = (provider: string) =>
  PROVIDER_LABEL[provider as LinkProvider] ?? provider;

export function DeliverableLinks({
  deliverableId,
  code,
  links,
  access,
  onChanged,
  onClose,
}: {
  deliverableId: string;
  code: string;
  links: LinkItem[];
  access: { allowed: boolean; reason: string | null };
  onChanged: () => void;
  onClose: () => void;
}) {
  const [provider, setProvider] = useState<LinkProvider>("LINEAR");
  const [externalId, setExternalId] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const fail = (res: { error: string; blockers?: string[] }) =>
    setErrors(res.blockers?.length ? res.blockers : [res.error]);

  const add = async () => {
    setBusy(true);
    setErrors([]);
    const res = await addDeliverableLink({
      deliverableId,
      provider,
      externalId,
      url,
    });
    setBusy(false);
    if (res.ok) {
      setExternalId("");
      setUrl("");
      onChanged();
    } else {
      // Mantém o que foi digitado: a pessoa corrige, não redigita.
      fail(res as { error: string; blockers?: string[] });
    }
  };

  const remove = async (linkId: string) => {
    setBusy(true);
    setErrors([]);
    const res = await removeDeliverableLink({ linkId });
    setBusy(false);
    if (res.ok) {
      onChanged();
    } else {
      fail(res as { error: string; blockers?: string[] });
    }
  };

  const locked = !access.allowed;

  return (
    <ModalShell
      actions={
        <Button onClick={onClose} variant="secondary">
          Fechar
        </Button>
      }
      icon="link2"
      onClose={onClose}
      subtitle="O estado do item externo não muda o entregável: a aprovação continua aqui."
      title={`Vínculos — ${code}`}
      tone="accent"
      width={560}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {links.length === 0 ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-muted)" }}>
            Nenhum vínculo ainda.
          </p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {links.map((l) => {
              const href = safeHref(l.url);
              const name = `${labelOf(l.provider)} · ${l.externalId}`;
              return (
                <li
                  key={l.id}
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--hairline)",
                  }}
                >
                  {href ? (
                    <a
                      href={href}
                      rel="noopener noreferrer"
                      style={{ fontSize: 13, color: "var(--accent-text)" }}
                      target="_blank"
                    >
                      {name}
                    </a>
                  ) : (
                    <span style={{ fontSize: 13 }}>{name}</span>
                  )}
                  <Button
                    disabled={busy || locked}
                    onClick={() => remove(l.id)}
                    size="sm"
                    variant="secondary"
                  >
                    Remover <span className="sr-only">vínculo {name}</span>
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {locked ? (
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-muted)" }}>
            {access.reason}
          </p>
        ) : null}

        <Field htmlFor="dl-provider" label="Provedor">
          <Select
            id="dl-provider"
            onChange={setProvider}
            options={PROVIDERS}
            value={provider}
          />
        </Field>
        <Field htmlFor="dl-id" label="Identificador" required>
          <Input
            disabled={busy || locked}
            id="dl-id"
            onChange={(e) => setExternalId(e.target.value)}
            placeholder="ENG-123, org/repo#42, PROJ-45"
            value={externalId}
          />
        </Field>
        <Field htmlFor="dl-url" label="URL" required>
          <Input
            disabled={busy || locked}
            id="dl-url"
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
            value={url}
          />
        </Field>

        {errors.length > 0 && (
          <div
            role="alert"
            style={{
              padding: "8px 12px",
              borderRadius: "var(--r-sm)",
              background: "var(--red-soft)",
              color: "var(--red-text)",
              fontSize: 12.5,
            }}
          >
            {errors.map((e) => (
              <div key={e}>{e}</div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button
            disabled={busy || locked || !externalId.trim() || !url.trim()}
            icon="plus"
            onClick={add}
          >
            Ligar
          </Button>
        </div>
      </div>
    </ModalShell>
  );
}
