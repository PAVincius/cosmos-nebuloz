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
import { PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";
import { useState } from "react";

const SAFE_ROLES = [
  "RTE",
  "LPM",
  "PM",
  "SYSTEM_ARCHITECT",
  "PO",
  "SM",
  "DEVELOPER",
  "BUSINESS_OWNER",
] as const;

type SAFeRole = (typeof SAFE_ROLES)[number];

export type InviteDraft = {
  email: string;
  name: string;
  safeRole: SAFeRole;
};

export type TeamDraft = {
  name: string;
  artName: string;
};

export type UsersTeamsFormData = {
  invites: InviteDraft[];
  teams: TeamDraft[];
};

type Props = {
  defaultValues?: Partial<UsersTeamsFormData>;
  artNames: string[];
  onChange: (data: UsersTeamsFormData) => void;
};

export function StepUsersTeams({ defaultValues, artNames, onChange }: Props) {
  const [data, setData] = useState<UsersTeamsFormData>({
    invites: defaultValues?.invites ?? [
      { email: "", name: "", safeRole: "DEVELOPER" },
    ],
    teams: defaultValues?.teams ?? [{ name: "", artName: artNames[0] ?? "" }],
  });

  function update(patch: Partial<UsersTeamsFormData>) {
    const next = { ...data, ...patch };
    setData(next);
    onChange(next);
  }

  function updateInvite(i: number, patch: Partial<InviteDraft>) {
    update({
      invites: data.invites.map((inv, j) =>
        j === i ? { ...inv, ...patch } : inv
      ),
    });
  }

  function updateTeam(i: number, patch: Partial<TeamDraft>) {
    update({
      teams: data.teams.map((t, j) => (j === i ? { ...t, ...patch } : t)),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <UsersIcon className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="font-semibold text-lg">
            Usuários, times e papéis SAFe
          </h2>
          <p className="text-muted-foreground text-sm">
            Convide as lideranças-chave e crie os times do ART.
          </p>
        </div>
      </div>

      {/* Invites */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Convidar usuários</Label>
          <Button
            onClick={() =>
              update({
                invites: [
                  ...data.invites,
                  { email: "", name: "", safeRole: "DEVELOPER" },
                ],
              })
            }
            size="sm"
            variant="outline"
          >
            <PlusIcon className="mr-1 h-3.5 w-3.5" /> Convidar
          </Button>
        </div>
        {data.invites.map((inv, i) => (
          <div className="grid grid-cols-3 items-center gap-2" key={i}>
            <Input
              onChange={(e) => updateInvite(i, { email: e.target.value })}
              placeholder="email@empresa.com"
              type="email"
              value={inv.email}
            />
            <Input
              onChange={(e) => updateInvite(i, { name: e.target.value })}
              placeholder="Nome"
              value={inv.name}
            />
            <div className="flex gap-1">
              <Select
                onValueChange={(v) =>
                  updateInvite(i, { safeRole: v as SAFeRole })
                }
                value={inv.safeRole}
              >
                <SelectTrigger className="flex-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAFE_ROLES.map((r) => (
                    <SelectItem className="text-xs" key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data.invites.length > 1 && (
                <Button
                  onClick={() =>
                    update({
                      invites: data.invites.filter((_, j) => j !== i),
                    })
                  }
                  size="sm"
                  variant="ghost"
                >
                  <Trash2Icon className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Teams */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Times do ART</Label>
          <Button
            onClick={() =>
              update({
                teams: [
                  ...data.teams,
                  { name: "", artName: artNames[0] ?? "" },
                ],
              })
            }
            size="sm"
            variant="outline"
          >
            <PlusIcon className="mr-1 h-3.5 w-3.5" /> Time
          </Button>
        </div>
        {data.teams.map((team, i) => (
          <div className="flex items-center gap-2" key={i}>
            <Input
              className="flex-1"
              onChange={(e) => updateTeam(i, { name: e.target.value })}
              placeholder="Nome do time"
              value={team.name}
            />
            {artNames.length > 0 && (
              <Select
                onValueChange={(v) => updateTeam(i, { artName: v })}
                value={team.artName}
              >
                <SelectTrigger className="w-40 text-xs">
                  <SelectValue placeholder="ART" />
                </SelectTrigger>
                <SelectContent>
                  {artNames.map((a) => (
                    <SelectItem className="text-xs" key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {data.teams.length > 1 && (
              <Button
                onClick={() =>
                  update({
                    teams: data.teams.filter((_, j) => j !== i),
                  })
                }
                size="sm"
                variant="ghost"
              >
                <Trash2Icon className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export function validateUsersTeams(data: UsersTeamsFormData): string | null {
  for (const inv of data.invites) {
    if (inv.email && !inv.name.trim()) {
      return "Informe o nome de cada usuário convidado.";
    }
  }
  for (const team of data.teams) {
    if (!team.name.trim()) {
      return "Todos os times precisam de nome.";
    }
  }
  return null;
}
