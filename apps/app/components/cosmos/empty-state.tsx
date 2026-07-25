"use client";

// empty-state.tsx — shared empty-state-with-CTA (RF-96, cosmos-widgets.jsx handoff).
// Centered card matching SectionCard's visual language: icon in a tinted
// circle, title, optional description, optional CTA.
import type { ReactNode } from "react";
import type { IconName } from "./icons";
import { Icon } from "./icons";
import { Button } from "./kit";

type EmptyStateAction = { label: string; onClick: () => void } | ReactNode;

function isActionConfig(
  action: EmptyStateAction
): action is { label: string; onClick: () => void } {
  return (
    typeof action === "object" &&
    action !== null &&
    "label" in action &&
    "onClick" in action
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description?: string;
  action?: EmptyStateAction;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: 12,
        padding: "40px 24px",
      }}
    >
      <span
        style={{
          display: "grid",
          placeItems: "center",
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: "rgba(var(--accent-rgb),.12)",
          border: "1px solid rgba(var(--accent-rgb),.25)",
          color: "var(--accent)",
        }}
      >
        <Icon name={icon} size={22} strokeWidth={1.8} />
      </span>
      <div>
        <div
          className="display"
          style={{
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "-.015em",
            color: "var(--ink)",
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              marginTop: 4,
              maxWidth: 320,
              fontSize: 13,
              color: "var(--ink-faint)",
            }}
          >
            {description}
          </div>
        )}
      </div>
      {action &&
        (isActionConfig(action) ? (
          <Button onClick={action.onClick} size="sm" style={{ marginTop: 4 }}>
            {action.label}
          </Button>
        ) : (
          action
        ))}
    </div>
  );
}
