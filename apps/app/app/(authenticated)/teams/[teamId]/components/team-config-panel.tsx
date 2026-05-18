"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  PlusIcon,
  TrashIcon,
  SaveIcon,
  UsersIcon,
  ZapIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Badge } from "@repo/design-system/components/ui/badge";
import { updateTeamConfig } from "../../actions";
import type { TeamMember } from "../../actions";

const ROLES = ["SM", "PO", "DEV", "QA", "DevOps", "UX", "Arquiteto", "Analista"];

const SKILL_SUGGESTIONS = [
  "React", "Next.js", "TypeScript", "Node.js", "Python", "Java", "Go",
  "PostgreSQL", "AWS", "Docker", "Kubernetes", "Figma", "GraphQL", "REST",
];

type TeamData = {
  id: string;
  name: string;
  artId: string | null | undefined;
  velocity: number | null | undefined;
  sprintLengthDays: number;
  members: TeamMember[];
};

type Art = { id: string; name: string };

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

export function TeamConfigPanel({
  team,
  arts,
}: {
  team: TeamData;
  arts: Art[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<"members" | "capacity" | "settings">("members");

  const [members, setMembers] = useState<TeamMember[]>(team.members);
  const [velocity, setVelocity] = useState<string>(team.velocity?.toString() ?? "");
  const [sprintLength, setSprintLength] = useState<string>(team.sprintLengthDays.toString());
  const [teamName, setTeamName] = useState(team.name);
  const [artId, setArtId] = useState(team.artId ?? "none");
  const [saved, setSaved] = useState(false);

  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("DEV");
  const [newMemberHours, setNewMemberHours] = useState("40");
  const [newMemberSkills, setNewMemberSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  function addMember() {
    if (!newMemberName.trim()) return;
    setMembers((prev) => [
      ...prev,
      {
        id: generateId(),
        name: newMemberName.trim(),
        role: newMemberRole,
        skills: newMemberSkills,
        hoursPerWeek: Number(newMemberHours) || 40,
      },
    ]);
    setNewMemberName("");
    setNewMemberSkills([]);
    setSkillInput("");
  }

  function removeMember(id: string) {
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }

  function addSkill(skill: string) {
    const s = skill.trim();
    if (s && !newMemberSkills.includes(s)) {
      setNewMemberSkills((prev) => [...prev, s]);
    }
    setSkillInput("");
  }

  function removeSkill(skill: string) {
    setNewMemberSkills((prev) => prev.filter((s) => s !== skill));
  }

  function handleSave() {
    startTransition(async () => {
      await updateTeamConfig({
        teamId: team.id,
        name: teamName,
        artId: artId === "none" ? null : artId,
        velocity: velocity ? Number(velocity) : null,
        sprintLengthDays: Number(sprintLength) || 14,
        members,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    });
  }

  const totalCapacity = members.reduce(
    (sum, m) =>
      sum + Math.round((m.hoursPerWeek / 5) * (Number(sprintLength) || 14)),
    0
  );

  const spPerHour =
    totalCapacity > 0 && velocity
      ? (Number(velocity) / totalCapacity).toFixed(2)
      : null;

  const tabs = [
    { key: "members" as const, label: "Membros", icon: UsersIcon },
    { key: "capacity" as const, label: "Capacidade", icon: ZapIcon },
    { key: "settings" as const, label: "Configurações", icon: SettingsIcon },
  ];

  return (
    <div className="rounded-lg border">
      <div className="flex border-b">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center pr-3">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isPending}
            variant={saved ? "outline" : "default"}
          >
            <SaveIcon className="mr-1.5 h-3.5 w-3.5" />
            {saved ? "Salvo!" : isPending ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="p-5">
        {activeTab === "members" && (
          <div className="flex flex-col gap-5">
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="text-sm font-medium mb-3">Adicionar membro</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    placeholder="Nome do membro"
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addMember()}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Papel</Label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Horas/semana</Label>
                  <Input
                    type="number"
                    min={1}
                    max={60}
                    value={newMemberHours}
                    onChange={(e) => setNewMemberHours(e.target.value)}
                    className="text-center"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={addMember}
                    disabled={!newMemberName.trim()}
                    className="w-full"
                    size="sm"
                  >
                    <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                    Adicionar
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-1.5">
                <Label className="text-xs">Skills (pressione Enter para adicionar)</Label>
                <div className="flex flex-wrap gap-1.5 min-h-8">
                  {newMemberSkills.map((s) => (
                    <Badge
                      key={s}
                      variant="secondary"
                      className="cursor-pointer gap-1"
                      onClick={() => removeSkill(s)}
                    >
                      {s}
                      <XIcon className="h-2.5 w-2.5" />
                    </Badge>
                  ))}
                  <Input
                    placeholder="ex: React, Node..."
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addSkill(skillInput);
                      }
                    }}
                    className="h-7 w-32 text-xs"
                  />
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {SKILL_SUGGESTIONS.filter(
                    (s) => !newMemberSkills.includes(s)
                  ).slice(0, 8).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addSkill(s)}
                      className="rounded border px-2 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                    >
                      + {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
                <UsersIcon className="text-muted-foreground mb-2 h-8 w-8" />
                <p className="text-muted-foreground text-sm">
                  Nenhum membro adicionado ainda.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {members.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0">
                      {m.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{m.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {m.role}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {m.hoursPerWeek}h/sem
                        </span>
                      </div>
                      {m.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {m.skills.map((s) => (
                            <Badge
                              key={s}
                              variant="secondary"
                              className="text-xs"
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeMember(m.id)}
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "capacity" && (
          <div className="flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label>Velocidade (story points / sprint)</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="ex: 40"
                  value={velocity}
                  onChange={(e) => setVelocity(e.target.value)}
                />
                <p className="text-muted-foreground text-xs">
                  Média histórica de SPs entregues por sprint.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label>Duração do sprint (dias)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {[7, 14, 21].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSprintLength(d.toString())}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        sprintLength === d.toString()
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  placeholder="Personalizado..."
                  value={![7, 14, 21].includes(Number(sprintLength)) ? sprintLength : ""}
                  onChange={(e) => setSprintLength(e.target.value)}
                  className="mt-1"
                />
              </div>
            </div>

            {members.length > 0 && (
              <div className="rounded-lg bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-medium">Resumo de capacidade</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="text-xl font-semibold">{members.length}</p>
                    <p className="text-muted-foreground text-xs">membros</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold">
                      {members.reduce((s, m) => s + m.hoursPerWeek, 0)}h
                    </p>
                    <p className="text-muted-foreground text-xs">h/semana total</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold">{totalCapacity}h</p>
                    <p className="text-muted-foreground text-xs">cap. por sprint</p>
                  </div>
                  <div>
                    <p className="text-xl font-semibold">
                      {spPerHour ?? "—"}
                    </p>
                    <p className="text-muted-foreground text-xs">SP/hora (throughput)</p>
                  </div>
                </div>
                {velocity && totalCapacity > 0 && (
                  <div className="rounded bg-primary/5 border border-primary/20 px-3 py-2 text-xs text-muted-foreground">
                    Com velocidade de <strong>{velocity} SP</strong> e{" "}
                    <strong>{totalCapacity}h</strong> de capacidade, o time
                    entrega <strong>{spPerHour} SP/hora</strong>. Baseline para
                    previsibilidade de entrega.
                  </div>
                )}
              </div>
            )}

            {members.length === 0 && (
              <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
                Adicione membros na aba "Membros" para calcular capacidade.
              </div>
            )}
          </div>
        )}

        {activeTab === "settings" && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label>Nome do time</Label>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>ART vinculado</Label>
              <select
                value={artId}
                onChange={(e) => setArtId(e.target.value)}
                className="border-input bg-background text-foreground flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-sm"
              >
                <option value="none">Sem ART (time independente)</option>
                {arts.map((art) => (
                  <option key={art.id} value={art.id}>
                    {art.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
