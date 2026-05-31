"use client";

import { cn } from "@repo/design-system/lib/utils";
import { useState } from "react";

type AITool = {
  id: string;
  label: string;
  phrase: string;
  color: string;
  icon: string;
  buildUrl: (context: string) => string;
};

const AI_TOOLS: AITool[] = [
  {
    id: "claude",
    label: "Claude",
    phrase: "Let's rock!",
    color: "#CC785C",
    icon: "✦",
    buildUrl: (ctx) => `https://claude.ai/new?q=${encodeURIComponent(ctx)}`,
  },
  {
    id: "chatgpt",
    label: "ChatGPT",
    phrase: "Let's go!",
    color: "#10A37F",
    icon: "⬡",
    buildUrl: (ctx) => `https://chatgpt.com/?q=${encodeURIComponent(ctx)}`,
  },
  {
    id: "gemini",
    label: "Gemini",
    phrase: "Vamos!",
    color: "#4285F4",
    icon: "◆",
    buildUrl: (ctx) =>
      `https://gemini.google.com/app?q=${encodeURIComponent(ctx)}`,
  },
  {
    id: "perplexity",
    label: "Perplexity",
    phrase: "Pesquisar",
    color: "#8B5CF6",
    icon: "◎",
    buildUrl: (ctx) =>
      `https://www.perplexity.ai/search?q=${encodeURIComponent(ctx)}`,
  },
];

type Props = { epicContext: string };

export function AIActionButtons({ epicContext }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground">Abrir com IA:</span>
      {AI_TOOLS.map((tool) => (
        <a
          className={cn(
            "inline-flex h-9 items-center justify-center gap-1.5 rounded-full border border-border transition-all duration-200",
            hoveredId === tool.id ? "px-3" : "w-9",
            "overflow-hidden whitespace-nowrap"
          )}
          href={tool.buildUrl(epicContext)}
          key={tool.id}
          onMouseEnter={() => setHoveredId(tool.id)}
          onMouseLeave={() => setHoveredId(null)}
          rel="noopener noreferrer"
          style={{ color: tool.color, borderColor: `${tool.color}40` }}
          target="_blank"
          title={`${tool.label}: ${tool.phrase}`}
        >
          <span className="text-sm">{tool.icon}</span>
          {hoveredId === tool.id && (
            <span className="font-medium text-[10px]">{tool.phrase}</span>
          )}
        </a>
      ))}
    </div>
  );
}
