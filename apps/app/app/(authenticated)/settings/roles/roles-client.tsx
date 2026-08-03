"use client";

import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  type CustomRoleRow,
  createCustomRole,
  deleteCustomRole,
  updateCustomRole,
} from "@/app/actions/settings/custom-roles";
import { ALLOWED_PERMISSIONS } from "@/app/actions/settings/permissions";

type Props = {
  roles: CustomRoleRow[];
};

type EditState = {
  id: string | null; // null = new
  name: string;
  permissions: Set<string>;
};

const PERMISSION_LABELS: Record<string, string> = {
  "epic:read": "Épicos: Leitura",
  "epic:write": "Épicos: Escrita",
  "epic:transition": "Épicos: Transição",
  "feature:read": "Features: Leitura",
  "feature:write": "Features: Escrita",
  "story:read": "Stories: Leitura",
  "story:write": "Stories: Escrita",
  "sprint:read": "Sprints: Leitura",
  "sprint:manage": "Sprints: Gerenciar",
  "standup:write": "Standup: Registrar",
  "art:manage": "ART: Gerenciar",
  "pi-plan:read": "PI Plan: Leitura",
  "pi-plan:manage": "PI Plan: Gerenciar",
  "governance:approve": "Governance: Aprovar",
  "budget:read": "Budget: Leitura",
  "budget:write": "Budget: Escrita",
  "member:read": "Membros: Leitura",
  "analytics:read": "Analytics: Leitura",
  "reporting:export": "Relatórios: Exportar",
  "impediment:manage": "Impedimentos: Gerenciar",
  "retro:manage": "Retrospectiva: Gerenciar",
  "wsjf:write": "WSJF: Editar",
};

function RoleEditorDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: EditState;
  onClose: () => void;
  onSaved: (role: CustomRoleRow) => void;
}) {
  const [name, setName] = useState(initial.name);
  const [selected, setSelected] = useState<Set<string>>(initial.permissions);
  const [isPending, startTransition] = useTransition();

  function toggle(perm: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) {
        next.delete(perm);
      } else {
        next.add(perm);
      }
      return next;
    });
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    startTransition(async () => {
      const payload = { name: name.trim(), permissions: [...selected] };
      const result =
        initial.id === null
          ? await createCustomRole(payload)
          : await updateCustomRole(initial.id, payload);
      if (result.ok) {
        toast.success(initial.id ? "Role atualizada" : "Role criada");
        onSaved(result.data);
        onClose();
      } else {
        toast.error(`Erro: ${result.error}`);
      }
    });
  }

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial.id ? "Editar Role" : "Nova Role"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">Nome</Label>
            <Input
              id="role-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Stakeholder Externo"
              value={name}
            />
          </div>

          <div className="space-y-2">
            <Label>Permissões</Label>
            <div className="grid grid-cols-2 gap-1.5">
              {ALLOWED_PERMISSIONS.map((perm) => (
                <label
                  className="flex cursor-pointer items-center gap-2 rounded border px-2 py-1.5 text-xs hover:bg-muted"
                  key={perm}
                >
                  <input
                    checked={selected.has(perm)}
                    className="accent-primary"
                    onChange={() => toggle(perm)}
                    type="checkbox"
                  />
                  {PERMISSION_LABELS[perm] ?? perm}
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={onClose} variant="outline">
              Cancelar
            </Button>
            <Button disabled={isPending} onClick={handleSave}>
              {isPending ? "Salvando…" : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RolesClient({ roles: initialRoles }: Props) {
  const [roles, setRoles] = useState<CustomRoleRow[]>(initialRoles);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteCustomRole(id);
      if (result.ok) {
        setRoles((prev) => prev.filter((r) => r.id !== id));
        toast.success("Role excluída");
      } else {
        toast.error(`Erro: ${result.error}`);
      }
    });
  }

  function handleSaved(role: CustomRoleRow) {
    setRoles((prev) => {
      const idx = prev.findIndex((r) => r.id === role.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = role;
        return next;
      }
      return [...prev, role];
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() =>
            setEditing({ id: null, name: "", permissions: new Set() })
          }
          size="sm"
        >
          <PlusIcon className="mr-1.5 h-4 w-4" />
          Nova Role
        </Button>
      </div>

      {roles.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          Nenhuma role customizada criada ainda.
        </p>
      ) : (
        <div className="divide-y rounded-lg border">
          {roles.map((role) => (
            <div
              className="flex items-start justify-between gap-4 p-4"
              key={role.id}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{role.name}</span>
                  <Badge variant="secondary">
                    {role.assignmentCount} membro
                    {role.assignmentCount !== 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 6).map((p) => (
                    <span
                      className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                      key={p}
                    >
                      {PERMISSION_LABELS[p] ?? p}
                    </span>
                  ))}
                  {role.permissions.length > 6 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{role.permissions.length - 6} mais
                    </span>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  onClick={() =>
                    setEditing({
                      id: role.id,
                      name: role.name,
                      permissions: new Set(role.permissions),
                    })
                  }
                  size="sm"
                  variant="outline"
                >
                  Editar
                </Button>
                <Button
                  disabled={isPending || role.assignmentCount > 0}
                  onClick={() => handleDelete(role.id)}
                  size="sm"
                  variant="ghost"
                >
                  <Trash2Icon className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <RoleEditorDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
