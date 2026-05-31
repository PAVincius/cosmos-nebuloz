"use client";

import type React from "react";
import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = { content: string; isStreaming?: boolean };

// Unicode ranges for emoji — strips all emoji characters
const EMOJI_REGEX =
  /[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA9F}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2702}\u{2705}\u{2708}-\u{270D}\u{270F}\u{2712}\u{2714}\u{2716}\u{271D}\u{2721}\u{2728}\u{2733}-\u{2734}\u{2744}\u{2747}\u{274C}\u{274E}\u{2753}-\u{2755}\u{2757}\u{2763}-\u{2764}\u{2795}-\u{2797}\u{27A1}\u{27B0}\u{27BF}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu;

function stripEmojis(text: string): string {
  // only collapse horizontal whitespace — never newlines (they carry markdown structure)
  return text.replace(EMOJI_REGEX, "").replace(/[^\S\n]{2,}/g, " ");
}

// LLMs often emit `** text**` or `** text:**` (space after opening **).
// Both are invalid markdown — normalize to `**text**` / `**text:**`.
function normalizeMarkdown(text: string): string {
  return text
    .replace(/\*\* ([^*]+)\*\*/g, "**$1**") // ** text** → **text**
    .replace(/\*\* ([^*]+):\*\*/g, "**$1:**"); // ** text:** → **text:**
}

const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>["components"] =
  {
    p: ({ children }) => (
      <p className="mb-2 text-foreground text-sm leading-relaxed last:mb-0">
        {children}
      </p>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="text-muted-foreground italic">{children}</em>
    ),
    pre: ({ children }) => (
      <pre className="my-2 overflow-x-auto rounded-lg bg-muted/60 p-3 text-xs [scrollbar-width:thin]">
        {children}
      </pre>
    ),
    code: ({ className, children }) =>
      className ? (
        <code className="font-mono text-foreground text-xs">{children}</code>
      ) : (
        <code className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[11px] text-cyan-500 dark:text-cyan-400">
          {children}
        </code>
      ),
    ul: ({ children }) => (
      <ul className="mb-2 ml-4 list-disc space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-2 ml-4 list-decimal space-y-1">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="text-foreground text-sm">{children}</li>
    ),
    h1: ({ children }) => (
      <h1 className="mt-3 mb-1.5 font-bold text-base text-foreground">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-3 mb-1 font-semibold text-foreground text-sm">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="mt-2 mb-1 font-medium text-foreground text-sm">
        {children}
      </h3>
    ),
    hr: () => <hr className="my-3 border-border/40" />,
    blockquote: ({ children }) => (
      <blockquote className="border-cyan-400/50 border-l-2 pl-3 text-muted-foreground text-sm italic">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <table className="mb-2 w-full border-collapse text-sm">{children}</table>
    ),
    th: ({ children }) => (
      <th className="border border-border/40 bg-muted/40 px-3 py-1.5 text-left font-semibold text-xs">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-border/40 px-3 py-1.5 text-xs">
        {children}
      </td>
    ),
  };

// Completed paragraphs — memoized, never re-parses when stable part doesn't change.
const StableMarkdown = memo(
  ({ content }: { content: string }) => (
    <ReactMarkdown components={MD_COMPONENTS} remarkPlugins={[remarkGfm]}>
      {content}
    </ReactMarkdown>
  ),
  (prev, next) => prev.content === next.content
);

export function CopilotMarkdown({ content, isStreaming }: Props) {
  const clean = useMemo(
    () => normalizeMarkdown(stripEmojis(content)),
    [content]
  );

  if (!isStreaming) {
    return (
      <div>
        <StableMarkdown content={clean} />
      </div>
    );
  }

  // Split at last completed paragraph boundary (\n\n).
  // Stable part → StableMarkdown (memoized, zero re-parse cost per token).
  // Live tail   → ReactMarkdown with cursor appended (re-parses only the tail each token).
  const lastBreak = clean.lastIndexOf("\n\n");

  if (lastBreak === -1) {
    return (
      <ReactMarkdown components={MD_COMPONENTS} remarkPlugins={[remarkGfm]}>
        {`${clean}▍`}
      </ReactMarkdown>
    );
  }

  const stable = clean.slice(0, lastBreak + 2);
  const live = clean.slice(lastBreak + 2);

  return (
    <div>
      <StableMarkdown content={stable} />
      <ReactMarkdown components={MD_COMPONENTS} remarkPlugins={[remarkGfm]}>
        {`${live}▍`}
      </ReactMarkdown>
    </div>
  );
}
