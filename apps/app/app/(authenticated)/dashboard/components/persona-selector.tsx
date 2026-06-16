"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { upsertHomeConfig } from "@/app/actions/home";

type PersonaKey = "rte" | "team" | "pm" | "lpm" | "spc" | "global";

type PersonaOption = {
  key: PersonaKey;
  label: string;
  description: string;
};

const PERSONAS: PersonaOption[] = [
  {
    key: "rte",
    label: "⚡ Release Train Engineer",
    description: "Saúde do ART, Flow Metrics, PI Planning",
  },
  {
    key: "team",
    label: "👥 Scrum Master / Team Lead",
    description: "Time, impedimentos, WIP, sprint",
  },
  {
    key: "pm",
    label: "🎯 Product Manager / PO",
    description: "OKRs, backlog, PI Objectives, WSJF",
  },
  {
    key: "lpm",
    label: "💼 Lean Portfolio Manager",
    description: "Budget, épicos, portfólio estratégico",
  },
  {
    key: "spc",
    label: "🎓 SPC / Agile Coach",
    description: "Coaching, Measure & Grow, melhoria contínua",
  },
  {
    key: "global",
    label: "🌐 Visão Geral",
    description: "Sem preferência específica",
  },
];

const STORAGE_KEY = "cosmos:persona-selected";

export default function PersonaSelector() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PersonaKey | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const alreadySelected = localStorage.getItem(STORAGE_KEY);
    if (!alreadySelected) {
      setOpen(true);
    }
  }, []);

  async function handleConfirm() {
    if (!selected) {
      return;
    }
    setLoading(true);
    try {
      await upsertHomeConfig({ persona: selected });
      localStorage.setItem(STORAGE_KEY, selected);
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Qual é o seu papel no SAFe?</DialogTitle>
          <DialogDescription>
            Vamos personalizar o COSMOS para o seu dia a dia. Você pode trocar
            quando quiser em Perfil.
          </DialogDescription>
        </DialogHeader>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: "12px",
            marginTop: "8px",
          }}
        >
          {PERSONAS.map((persona) => {
            const isSelected = selected === persona.key;
            return (
              <button
                key={persona.key}
                onClick={() => setSelected(persona.key)}
                style={{
                  background: isSelected ? "#0c1020" : "#141516",
                  border: `1px solid ${isSelected ? "#5e6ad2" : "#23252a"}`,
                  borderRadius: "10px",
                  padding: "14px",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.15s, background 0.15s",
                }}
                type="button"
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "14px",
                    color: isSelected ? "#a8b4f8" : "#e2e8f0",
                    marginBottom: "4px",
                  }}
                >
                  {persona.label}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#8891a4",
                  }}
                >
                  {persona.description}
                </div>
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginTop: "16px",
          }}
        >
          <Button disabled={!selected || loading} onClick={handleConfirm}>
            Começar →
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
