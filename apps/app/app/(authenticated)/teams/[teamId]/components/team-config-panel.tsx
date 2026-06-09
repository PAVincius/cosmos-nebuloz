"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import {
  PlusIcon,
  SaveIcon,
  SettingsIcon,
  TrashIcon,
  UsersIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TeamMember } from "../../actions";
import { updateTeamConfig } from "../../actions";

const ROLES = [
  "SM",
  "PO",
  "DEV",
  "QA",
  "DevOps",
  "UX",
  "Arquiteto",
  "Analista",
];

const SKILL_SUGGESTIONS = [
  "React",
  "Next.js",
  "TypeScript",
  "Node.js",
  "Python",
  "Java",
  "Go",
  "PostgreSQL",
  "AWS",
  "Docker",
  "Kubernetes",
  "Figma",
  "GraphQL",
  "REST",
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
  const [activeTab, setActiveTab] = useState<
    "members" | "capacity" | "settings"
  >("members");

  const [members, setMembers] = useState<TeamMember[]>(team.members);
  const [velocity, setVelocity] = useState<string>(
    team.velocity?.toString() ?? ""
  );
  const [sprintLength, setSprintLength] = useState<string>(
    team.sprintLengthDays.toString()
  );
  const [teamName, setTeamName] = useState(team.name);
  const [artId, setArtId] = useState(team.artId ?? "none");
  const [saved, setSaved] = useState(false);

  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("DEV");
  const [newMemberHours, setNewMemberHours] = useState("40");
  const [newMemberSkills, setNewMemberSkills] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState("");

  function addMember() {
    if (!newMemberName.trim()) {
      return;
    }
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
            className={`flex items-center gap-2 px-4 py-3 font-medium text-sm transition-colors ${
              activeTab === key
                ? "border-primary border-b-2 text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
            key={key}
            onClick={() => setActiveTab(key)}
            type="button"
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
        <div className="ml-auto flex items-center pr-3">
          <Button
            disabled={isPending}
            onClick={handleSave}
            size="sm"
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
              <p className="mb-3 font-medium text-sm">Adicionar membro</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    onChange={(e) => setNewMemberName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addMember()}
                    placeholder="Nome do membro"
                    value={newMemberName}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs">Papel</Label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-foreground text-sm shadow-sm"
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    value={newMemberRole}
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
                    className="text-center"
                    max={60}
                    min={1}
                    onChange={(e) => setNewMemberHours(e.target.value)}
                    type="number"
                    value={newMemberHours}
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    className="w-full"
                    disabled={!newMemberName.trim()}
                    onClick={addMember}
                    size="sm"
                  >
                    <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
                    Adicionar
                  </Button>
                </div>
              </div>

              <div className="mt-3 flex flex-col gap-1.5">
                <Label className="text-xs">
                  Skills (pressione Enter para adicionar)
                </Label>
                <div className="flex min-h-8 flex-wrap gap-1.5">
                  {newMemberSkills.map((s) => (
                    <Badge
                      className="cursor-pointer gap-1"
                      key={s}
                      onClick={() => removeSkill(s)}
                      variant="secondary"
                    >
                      {s}
                      <XIcon className="h-2.5 w-2.5" />
                    </Badge>
                  ))}
                  <Input
                    className="h-7 w-32 text-xs"
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addSkill(skillInput);
                      }
                    }}
                    placeholder="ex: React, Node..."
                    value={skillInput}
                  />
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {SKILL_SUGGESTIONS.filter((s) => !newMemberSkills.includes(s))
                    .slice(0, 8)
                    .map((s) => (
                      <button
                        className="rounded border px-2 py-0.5 text-muted-foreground text-xs transition-colors hover:border-primary hover:text-primary"
                        key={s}
                        onClick={() => addSkill(s)}
                        type="button"
                      >
                        + {s}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            {members.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
                <UsersIcon className="mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-muted-foreground text-sm">
                  Nenhum membro adicionado ainda.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {members.map((m, i) => (
                  <div
                    className="flex items-center gap-3 rounded-lg border px-4 py-3"
                    key={m.id ?? `member-${i}`}
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-xs">
                      {m.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{m.name}</span>
                        <Badge className="text-xs" variant="outline">
                          {m.role}
                        </Badge>
                        <span className="text-muted-foreground text-xs">
                          {m.hoursPerWeek}h/sem
                        </span>
                      </div>
                      {m.skills.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {m.skills.map((s) => (
                            <Badge
                              className="text-xs"
                              key={s}
                              variant="secondary"
                            >
                              {s}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      className="text-muted-foreground transition-colors hover:text-destructive"
                      onClick={() => removeMember(m.id)}
                      type="button"
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
                  min={0}
                  onChange={(e) => setVelocity(e.target.value)}
                  placeholder="ex: 40"
                  type="number"
                  value={velocity}
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
                      className={`rounded-lg border px-3 py-2 font-medium text-sm transition-colors ${
                        sprintLength === d.toString()
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/50"
                      }`}
                      key={d}
                      onClick={() => setSprintLength(d.toString())}
                      type="button"
                    >
                      {d}d
                    </button>
                  ))}
                </div>
                <Input
                  className="mt-1"
                  max={90}
                  min={1}
                  onChange={(e) => setSprintLength(e.target.value)}
                  placeholder="Personalizado..."
                  type="number"
                  value={
                    [7, 14, 21].includes(Number(sprintLength))
                      ? ""
                      : sprintLength
                  }
                />
              </div>
            </div>

            {members.length > 0 && (
              <div className="space-y-3 rounded-lg bg-muted/30 p-4">
                <p className="font-medium text-sm">Resumo de capacidade</p>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div>
                    <p className="font-semibold text-xl">{members.length}</p>
                    <p className="text-muted-foreground text-xs">membros</p>
                  </div>
                  <div>
                    <p className="font-semibold text-xl">
                      {members.reduce((s, m) => s + m.hoursPerWeek, 0)}h
                    </p>
                    <p className="text-muted-foreground text-xs">
                      h/semana total
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-xl">{totalCapacity}h</p>
                    <p className="text-muted-foreground text-xs">
                      cap. por sprint
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold text-xl">{spPerHour ?? "—"}</p>
                    <p className="text-muted-foreground text-xs">
                      SP/hora (throughput)
                    </p>
                  </div>
                </div>
                {velocity && totalCapacity > 0 && (
                  <div className="rounded border border-primary/20 bg-primary/5 px-3 py-2 text-muted-foreground text-xs">
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
                onChange={(e) => setTeamName(e.target.value)}
                value={teamName}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>ART vinculado</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-foreground text-sm shadow-sm"
                onChange={(e) => setArtId(e.target.value)}
                value={artId}
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
