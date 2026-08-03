import { Badge } from "@repo/design-system/components/cosmos/badge";
import { UsersIcon } from "lucide-react";
import Link from "next/link";
import { SectionCard } from "../../../components/section-card";
import { InviteControl } from "./invite-control";
import { avatarStyleForRole, ROLE_LABELS } from "./member-tone";

const PREVIEW_LIMIT = 5;

type Member = {
  id: string;
  role: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

type Invitation = {
  id: string;
  email: string;
  role: string;
  createdAt: Date;
};

type MembersPreviewCardProps = {
  members: Member[];
  invitations: Invitation[];
  membersCount: number;
  isAdmin: boolean;
};

function initialsOf(label: string) {
  return label
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function MembersPreviewCard({
  members,
  invitations,
  membersCount,
  isAdmin,
}: MembersPreviewCardProps) {
  const preview = members.slice(0, PREVIEW_LIMIT);

  return (
    <SectionCard
      actions={isAdmin && <InviteControl pendingInvitations={invitations} />}
      icon={UsersIcon}
      subtitle={`${preview.length} de ${membersCount} mostrados`}
      title="Membros & papéis"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {preview.map((m) => {
          const label = m.user.name ?? m.user.email;
          const avatar = avatarStyleForRole(m.role);
          return (
            <div
              className="rounded-md border border-hairline bg-surface-2"
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
              }}
            >
              <span
                className="shrink-0 font-semibold text-xs"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "grid",
                  placeItems: "center",
                  background: avatar.bg,
                  color: avatar.text,
                }}
              >
                {initialsOf(label)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-[13px] text-ink">
                  {label}
                </div>
                <div className="truncate text-[11.5px] text-ink-subtle">
                  {m.user.email}
                </div>
              </div>
              <Badge tone={m.role === "ADMIN" ? "accent" : "neutral"}>
                {ROLE_LABELS[m.role] ?? m.role}
              </Badge>
            </div>
          );
        })}
      </div>
      {membersCount > preview.length && (
        <Link
          className="mt-3 inline-block font-medium text-[13px] text-accent hover:underline"
          href="/settings/members"
        >
          Ver todos os {membersCount} membros →
        </Link>
      )}
    </SectionCard>
  );
}
