"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = { content: string; isStreaming?: boolean };

export function CopilotMarkdown({ content, isStreaming }: Props) {
  return (
    <>
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-2 text-foreground text-sm leading-relaxed last:mb-0">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">
              {children}
            </strong>
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
              <code className="font-mono text-foreground text-xs">
                {children}
              </code>
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
            <table className="mb-2 w-full border-collapse text-sm">
              {children}
            </table>
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
        }}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
      {!!isStreaming && (
        <span className="ml-0.5 inline-block animate-pulse text-cyan-400">
          ▍
        </span>
      )}
    </>
  );
}
