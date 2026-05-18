"use client";

import {
  useState,
  useRef,
  useEffect,
  useTransition,
  useCallback,
  type KeyboardEvent,
} from "react";
import { SearchIcon, MailPlusIcon, ArrowRightIcon } from "lucide-react";
import { Input } from "@repo/design-system/components/ui/input";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import { Label } from "@repo/design-system/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@repo/design-system/components/ui/dialog";
import Fuse from "fuse.js";
import {
  searchMembersWithCrossTenant,
  sendMemberInvite,
} from "@/app/actions/teams/members";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TenantMemberResult = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  source: "current_tenant";
};

type CrossTenantMemberResult = {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  workspaceName: string;
  source: "other_tenant";
};

export type MemberSearchInputProps = {
  initialMembers: TenantMemberResult[];
  excludeUserIds?: string[];
  onMemberSelect: (member: {
    userId: string;
    name: string;
    email: string;
  }) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return name.slice(0, 2).toUpperCase();
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}

function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hasExactMatchInCurrent(
  members: TenantMemberResult[],
  query: string
): boolean {
  const q = query.toLowerCase();
  return members.some(
    (m) =>
      m.name.toLowerCase() === q || m.email.toLowerCase() === q
  );
}

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

interface AvatarProps {
  name: string;
  image: string | null;
}

function Avatar({ name, image }: AvatarProps) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt={name}
        className="h-8 w-8 rounded-full object-cover"
      />
    );
  }
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
      {getInitials(name)}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirmation dialog (cross-tenant)
// ---------------------------------------------------------------------------

interface ConfirmDialogProps {
  member: CrossTenantMemberResult | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmCrossTenantDialog({
  member,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={member !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirmar adição</DialogTitle>
          <DialogDescription>
            {member && (
              <>
                <strong>{member.name}</strong> já é membro do workspace{" "}
                <strong>{member.workspaceName}</strong>. Confirma a adição ao
                seu workspace?
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={onConfirm}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Invite dialog
// ---------------------------------------------------------------------------

interface InviteDialogProps {
  open: boolean;
  query: string;
  onClose: () => void;
}

function InviteDialog({ open, query, onClose }: InviteDialogProps) {
  const isEmail = looksLikeEmail(query);
  const [email, setEmail] = useState(isEmail ? query : "");
  const [name, setName] = useState(!isEmail ? query : "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Sync state when query changes
  useEffect(() => {
    if (open) {
      setEmail(looksLikeEmail(query) ? query : "");
      setName(!looksLikeEmail(query) ? query : "");
      setError(null);
      setSuccess(null);
    }
  }, [open, query]);

  const handleSubmit = () => {
    if (!email.trim()) {
      setError("Informe o e-mail para envio do convite.");
      return;
    }
    if (!looksLikeEmail(email.trim())) {
      setError("Informe um e-mail válido.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        await sendMemberInvite({ email: email.trim(), name: name.trim() });
        setSuccess(`Convite enviado para ${email.trim()}`);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao enviar convite."
        );
      }
    });
  };

  const handleClose = () => {
    setEmail("");
    setName("");
    setError(null);
    setSuccess(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Convidar para o Cosmos</DialogTitle>
          <DialogDescription>
            Deseja enviar um convite para{" "}
            <strong>{email || query || "este usuário"}</strong> ingressar no
            workspace?
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <p className="rounded-md bg-green-500/10 px-4 py-3 text-sm text-green-600 dark:text-green-400">
            {success}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-email">
                E-mail{" "}
                <span className="text-destructive" aria-hidden>
                  *
                </span>
              </Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="nome@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="invite-name">Nome (opcional)</Label>
              <Input
                id="invite-name"
                placeholder="Nome do convidado"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isPending}
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        <DialogFooter>
          {success ? (
            <Button onClick={handleClose}>Fechar</Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isPending}>
                Cancelar
              </Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? "Enviando..." : "Enviar convite"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MemberSearchInput({
  initialMembers,
  excludeUserIds = [],
  onMemberSelect,
}: MemberSearchInputProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [crossTenantResults, setCrossTenantResults] = useState<
    CrossTenantMemberResult[]
  >([]);
  const [confirmMember, setConfirmMember] =
    useState<CrossTenantMemberResult | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);

  const [, startCrossTenantTransition] = useTransition();

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fuse instance — memoised on initialMembers
  const fuseRef = useRef<Fuse<TenantMemberResult> | null>(null);
  useEffect(() => {
    fuseRef.current = new Fuse(initialMembers, {
      keys: ["name", "email"],
      threshold: 0.35,
      distance: 100,
    });
  }, [initialMembers]);

  // Filtered current-tenant members (client-side fuzzy)
  const filteredCurrent: TenantMemberResult[] = (() => {
    const available = initialMembers.filter(
      (m) => !excludeUserIds.includes(m.userId)
    );
    if (!query.trim()) return available;
    const fuse = fuseRef.current;
    if (!fuse) return available;
    return fuse
      .search(query)
      .map((r) => r.item)
      .filter((m) => !excludeUserIds.includes(m.userId));
  })();

  const filteredCrossTenant = crossTenantResults.filter(
    (m) => !excludeUserIds.includes(m.userId)
  );

  const showInviteRow =
    query.trim().length > 0 && !hasExactMatchInCurrent(filteredCurrent, query);

  const hasAnyResult =
    filteredCurrent.length > 0 ||
    filteredCrossTenant.length > 0 ||
    showInviteRow;

  // Cross-tenant search — debounced 300ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < 2) {
      setCrossTenantResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      startCrossTenantTransition(async () => {
        try {
          const { otherTenants } = await searchMembersWithCrossTenant(query);
          const mapped: CrossTenantMemberResult[] = otherTenants.map((m) => ({
            userId: m.userId,
            name: m.name,
            email: m.email,
            image: m.image,
            workspaceName: m.tenantName,
            source: "other_tenant" as const,
          }));
          setCrossTenantResults(mapped);
        } catch {
          // Silently ignore search errors — cross-tenant is best-effort
          setCrossTenantResults([]);
        }
      });
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  // Close on Escape
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const handleSelectCurrent = useCallback(
    (member: TenantMemberResult) => {
      onMemberSelect({
        userId: member.userId,
        name: member.name,
        email: member.email,
      });
      setQuery("");
      setIsOpen(false);
      setCrossTenantResults([]);
    },
    [onMemberSelect]
  );

  const handleSelectCrossTenant = (member: CrossTenantMemberResult) => {
    setConfirmMember(member);
    setIsOpen(false);
  };

  const handleConfirmCrossTenant = () => {
    if (!confirmMember) return;
    onMemberSelect({
      userId: confirmMember.userId,
      name: confirmMember.name,
      email: confirmMember.email,
    });
    setQuery("");
    setCrossTenantResults([]);
    setConfirmMember(null);
  };

  const handleInviteClick = () => {
    setIsOpen(false);
    setInviteOpen(true);
  };

  return (
    <>
      <div ref={containerRef} className="relative w-full">
        {/* Search field */}
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder="Buscar membro por nome ou e-mail..."
            value={query}
            className="pl-9"
            onFocus={() => setIsOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            aria-label="Buscar membros"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            role="combobox"
          />
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-lg border border-border bg-background shadow-lg"
          >
            {!hasAnyResult && (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                Nenhum resultado encontrado.
              </p>
            )}

            {/* Section A — current tenant */}
            {filteredCurrent.length > 0 && (
              <>
                <div className="bg-muted/30 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Neste workspace
                </div>
                {filteredCurrent.map((member) => (
                  <button
                    key={member.userId}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => handleSelectCurrent(member)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <Avatar name={member.name} image={member.image} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {member.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.email}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {member.role}
                    </Badge>
                  </button>
                ))}
              </>
            )}

            {/* Section B — cross-tenant */}
            {filteredCrossTenant.length > 0 && (
              <>
                <div className="bg-muted/30 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Outros workspaces
                </div>
                {filteredCrossTenant.map((member) => (
                  <button
                    key={member.userId}
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => handleSelectCrossTenant(member)}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
                  >
                    <Avatar name={member.name} image={member.image} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {member.name}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {member.email}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        workspace:{" "}
                        <span className="font-medium">
                          {member.workspaceName}
                        </span>
                      </p>
                    </div>
                  </button>
                ))}
              </>
            )}

            {/* Section C — invite */}
            {showInviteRow && (
              <button
                type="button"
                onClick={handleInviteClick}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-primary transition-colors hover:bg-primary/5 focus-visible:bg-primary/5 focus-visible:outline-none"
              >
                <MailPlusIcon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate text-left">
                  Convidar{" "}
                  <span className="font-medium">&apos;{query}&apos;</span> para
                  o workspace
                </span>
                <ArrowRightIcon className="h-3.5 w-3.5 shrink-0 opacity-60" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Confirmation dialog */}
      <ConfirmCrossTenantDialog
        member={confirmMember}
        onConfirm={handleConfirmCrossTenant}
        onCancel={() => setConfirmMember(null)}
      />

      {/* Invite dialog */}
      <InviteDialog
        open={inviteOpen}
        query={query}
        onClose={() => setInviteOpen(false)}
      />
    </>
  );
}
