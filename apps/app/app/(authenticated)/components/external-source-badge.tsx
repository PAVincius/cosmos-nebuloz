import { ExternalLinkIcon } from "lucide-react";

const SOURCE_CONFIG: Record<
  string,
  { label: string; color: string; icon: string }
> = {
  linear: {
    label: "Linear",
    color:
      "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-400/30",
    icon: "⬡",
  },
  github: {
    label: "GitHub",
    color:
      "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-400/30",
    icon: "⚙",
  },
  asana: {
    label: "Asana",
    color: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-400/30",
    icon: "◈",
  },
  gitlab: {
    label: "GitLab",
    color:
      "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-400/30",
    icon: "◆",
  },
};

type Props = {
  source: string | null | undefined;
  url?: string | null | undefined;
  size?: "xs" | "sm";
};

export function ExternalSourceBadge({ source, url, size = "xs" }: Props) {
  if (!source) {
    return null;
  }

  const cfg = SOURCE_CONFIG[source.toLowerCase()];
  if (!cfg) {
    return null;
  }

  const cls =
    size === "sm"
      ? "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
      : "inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[10px] font-medium";

  const content = (
    <span className={`${cls} ${cfg.color}`}>
      <span aria-hidden>{cfg.icon}</span>
      {cfg.label}
      {url ? <ExternalLinkIcon className="h-2.5 w-2.5 opacity-70" /> : null}
    </span>
  );

  if (url) {
    return (
      <a
        href={url}
        onClick={(e) => e.stopPropagation()}
        rel="noopener noreferrer"
        target="_blank"
        title={`Abrir no ${cfg.label}`}
      >
        {content}
      </a>
    );
  }

  return content;
}
