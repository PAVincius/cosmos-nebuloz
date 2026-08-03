"use client";

import { Building2Icon, ImageIcon } from "lucide-react";
import { useState } from "react";
import { SectionCard } from "../../../components/section-card";
import { EditWorkspaceModal } from "./edit-workspace-modal";
import { PLAN_LABELS } from "./plan-labels";

type IdentityCardProps = {
  name: string;
  slug: string;
  logo: string | null;
  plan: string;
  createdAt: Date;
  isAdmin: boolean;
  membersCount: number;
};

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  month: "short",
  year: "numeric",
});

export function IdentityCard({
  name,
  slug,
  logo,
  plan,
  createdAt,
  isAdmin,
  membersCount,
}: IdentityCardProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const planLabel = PLAN_LABELS[plan] ?? plan;

  const fields = [
    { l: "Nome do workspace", v: name },
    { l: "Domínio", v: slug },
    { l: "Plano", v: planLabel },
    { l: "Criado em", v: DATE_FORMATTER.format(new Date(createdAt)) },
  ];

  return (
    <SectionCard
      icon={Building2Icon}
      subtitle="Nome, plano e domínio"
      title="Identidade do workspace"
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          marginBottom: 18,
        }}
      >
        <span
          className="font-semibold"
          style={{
            width: 56,
            height: 56,
            borderRadius: 10,
            display: "grid",
            placeItems: "center",
            background: "var(--accent)",
            color: "#fff",
            fontSize: 20,
            boxShadow: "0 8px 20px -6px rgba(var(--accent-rgb),.7)",
          }}
        >
          {initialsOf(name)}
        </span>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>
            {name}
          </div>
          <div
            style={{ fontSize: 12.5, color: "var(--ink-subtle)", marginTop: 2 }}
          >
            {slug} · {membersCount} membros
          </div>
        </div>
        {isAdmin && (
          <button
            className="ml-auto flex items-center gap-2 rounded-md border border-hairline bg-surface-2 px-3 py-1.5 font-medium text-ink text-sm hover:border-hairline-strong"
            onClick={() => setModalOpen(true)}
            type="button"
          >
            <ImageIcon className="size-3.5" />
            Trocar logo
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {fields.map((f) => (
          <div key={f.l}>
            <span className="mb-1.5 block font-bold text-[11px] text-ink-muted uppercase tracking-[0.04em]">
              {f.l}
            </span>
            <div className="rounded-md border border-hairline bg-surface-2 px-3.5 py-2.5 font-medium text-[13.5px] text-ink">
              {f.v}
            </div>
          </div>
        ))}
      </div>

      {!isAdmin && (
        <p className="mt-3 text-ink-subtle text-xs">
          Apenas administradores podem editar a identidade do workspace.
        </p>
      )}

      {isAdmin && (
        <EditWorkspaceModal
          logo={logo}
          name={name}
          onClose={() => setModalOpen(false)}
          open={modalOpen}
          slug={slug}
        />
      )}
    </SectionCard>
  );
}
