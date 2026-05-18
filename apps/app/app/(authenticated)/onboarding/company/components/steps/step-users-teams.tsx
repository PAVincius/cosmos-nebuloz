"use client";

import { useState } from "react";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { PlusIcon, Trash2Icon, UsersIcon } from "lucide-react";

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

export interface InviteDraft {
  email: string;
  name: string;
  safeRole: SAFeRole;
}

export interface TeamDraft {
  name: string;
  artName: string;
}

export interface UsersTeamsFormData {
  invites: InviteDraft[];
  teams: TeamDraft[];
}

interface Props {
  defaultValues?: Partial<UsersTeamsFormData>;
  artNames: string[];
  onChange: (data: UsersTeamsFormData) => void;
}

export function StepUsersTeams({ defaultValues, artNames, onChange }: Props) {
  const [data, setData] = useState<UsersTeamsFormData>({
    invites: defaultValues?.invites ?? [
      { email: "", name: "", safeRole: "DEVELOPER" },
    ],
    teams: defaultValues?.teams ?? [
      { name: "", artName: artNames[0] ?? "" },
    ],
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
          <h2 className="text-lg font-semibold">Usuários, times e papéis SAFe</h2>
          <p className="text-sm text-muted-foreground">
            Convide as lideranças-chave e crie os times do ART.
          </p>
        </div>
      </div>

      {/* Invites */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Label>Convidar usuários</Label>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                invites: [
                  ...data.invites,
                  { email: "", name: "", safeRole: "DEVELOPER" },
                ],
              })
            }
          >
            <PlusIcon className="mr-1 h-3.5 w-3.5" /> Convidar
          </Button>
        </div>
        {data.invites.map((inv, i) => (
          <div key={i} className="grid grid-cols-3 gap-2 items-center">
            <Input
              value={inv.email}
              onChange={(e) => updateInvite(i, { email: e.target.value })}
              placeholder="email@empresa.com"
              type="email"
            />
            <Input
              value={inv.name}
              onChange={(e) => updateInvite(i, { name: e.target.value })}
              placeholder="Nome"
            />
            <div className="flex gap-1">
              <Select
                value={inv.safeRole}
                onValueChange={(v) =>
                  updateInvite(i, { safeRole: v as SAFeRole })
                }
              >
                <SelectTrigger className="flex-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SAFE_ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {data.invites.length > 1 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    update({
                      invites: data.invites.filter((_, j) => j !== i),
                    })
                  }
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
            size="sm"
            variant="outline"
            onClick={() =>
              update({
                teams: [
                  ...data.teams,
                  { name: "", artName: artNames[0] ?? "" },
                ],
              })
            }
          >
            <PlusIcon className="mr-1 h-3.5 w-3.5" /> Time
          </Button>
        </div>
        {data.teams.map((team, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input
              value={team.name}
              onChange={(e) => updateTeam(i, { name: e.target.value })}
              placeholder="Nome do time"
              className="flex-1"
            />
            {artNames.length > 0 && (
              <Select
                value={team.artName}
                onValueChange={(v) => updateTeam(i, { artName: v })}
              >
                <SelectTrigger className="w-40 text-xs">
                  <SelectValue placeholder="ART" />
                </SelectTrigger>
                <SelectContent>
                  {artNames.map((a) => (
                    <SelectItem key={a} value={a} className="text-xs">
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {data.teams.length > 1 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  update({
                    teams: data.teams.filter((_, j) => j !== i),
                  })
                }
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
    if (inv.email && !inv.name.trim())
      return "Informe o nome de cada usuário convidado.";
  }
  for (const team of data.teams) {
    if (!team.name.trim()) return "Todos os times precisam de nome.";
  }
  return null;
}
