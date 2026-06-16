"use client";

type ViewSwitcherProps = {
  views: string[];
  active: string;
  onChange: (view: string) => void;
};

export function ViewSwitcher({ views, active, onChange }: ViewSwitcherProps) {
  return (
    <div
      style={{
        display: "inline-flex",
        gap: 2,
        padding: 3,
        background: "#141516",
        border: "1px solid #23252a",
        borderRadius: 8,
      }}
    >
      {views.map((view) => (
        <button
          key={view}
          onClick={() => onChange(view)}
          style={{
            padding: "5px 12px",
            borderRadius: 5,
            fontSize: 12,
            fontWeight: 500,
            border: "none",
            cursor: "pointer",
            transition: "all 0.15s ease",
            background: active === view ? "#191a1b" : "transparent",
            color: active === view ? "#f7f8f8" : "#62666d",
          }}
          type="button"
        >
          {view}
        </button>
      ))}
    </div>
  );
}
