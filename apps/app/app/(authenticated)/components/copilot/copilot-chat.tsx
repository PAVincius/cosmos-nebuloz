"use client";

import { Bot, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CopilotReport, parseReports, stripReportTags } from "./copilot-report";
import { CopilotSuggestions } from "./copilot-suggestions";
import type { ChatMessage } from "./use-copilot-chat";

const THINKING_PHRASES = [
  "Analisando o workspace...",
  "Consultando dados do PI...",
  "Processando informações...",
  "Verificando dependências...",
  "Avaliando riscos e métricas...",
  "Preparando resposta...",
];

function stripSuggestionTags(content: string): string {
  return stripReportTags(
    content.replace(/<suggestion[\s\S]*?<\/suggestion>/g, "")
  ).trim();
}

function ThinkingIndicator() {
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setFading(true);
      setTimeout(() => {
        setPhraseIndex((i) => (i + 1) % THINKING_PHRASES.length);
        setFading(false);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-cyan-500 dark:bg-zinc-800 dark:text-cyan-400">
        <Bot className="h-4 w-4" />
      </div>
      <div className="flex items-center rounded-2xl bg-gray-100 px-3 py-2 dark:bg-zinc-800">
        <span
          className="text-gray-500 text-sm transition-opacity duration-300 dark:text-zinc-400"
          style={{ opacity: fading ? 0 : 1 }}
        >
          {THINKING_PHRASES[phraseIndex]}
        </span>
      </div>
    </div>
  );
}

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-1.5 text-sm leading-relaxed last:mb-0">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-gray-900 dark:text-white">
      {children}
    </strong>
  ),
  em: ({ children }) => (
    <em className="text-gray-600 italic dark:text-zinc-300">{children}</em>
  ),
  pre: ({ children }) => (
    <pre className="mt-2 overflow-x-auto rounded-lg bg-gray-100/80 p-3 [scrollbar-width:thin] dark:bg-zinc-900/80">
      {children}
    </pre>
  ),
  code: ({ children, className }) =>
    className ? (
      <code className="font-mono text-gray-700 text-xs dark:text-zinc-200">
        {children}
      </code>
    ) : (
      <code className="rounded bg-gray-100/80 px-1.5 py-0.5 font-mono text-cyan-500 text-xs dark:bg-zinc-900/80 dark:text-cyan-400">
        {children}
      </code>
    ),
  ul: ({ children }) => (
    <ul className="mb-2 ml-4 list-disc space-y-1 text-sm">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 ml-4 list-decimal space-y-1 text-sm">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="text-gray-700 text-sm dark:text-zinc-200">{children}</li>
  ),
  h1: ({ children }) => (
    <h1 className="mt-2 mb-1.5 font-bold text-gray-900 text-sm dark:text-white">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-2 mb-1.5 font-semibold text-gray-900 text-sm dark:text-white">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-2 mb-1 font-semibold text-gray-800 text-sm dark:text-zinc-100">
      {children}
    </h3>
  ),
  hr: () => <hr className="my-2 border-black/10 dark:border-white/10" />,
  blockquote: ({ children }) => (
    <blockquote className="border-cyan-400/50 border-l-2 pl-3 text-gray-500 text-sm italic dark:text-zinc-400">
      {children}
    </blockquote>
  ),
};

type MessageBubbleProps = {
  message: ChatMessage;
  isCurrentStreaming: boolean;
  sessionId?: string;
};

function MessageBubble({
  message,
  isCurrentStreaming,
  sessionId,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const displayContent = stripSuggestionTags(message.content);

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          isUser
            ? "bg-violet-600 text-white"
            : "bg-gray-200 text-cyan-500 dark:bg-zinc-800 dark:text-cyan-400"
        }`}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col`}
      >
        <div
          className={`rounded-2xl px-3 py-2 ${
            isUser
              ? "bg-violet-600 text-white"
              : "bg-gray-100 text-gray-800 dark:bg-zinc-800 dark:text-zinc-200"
          }`}
        >
          {isUser ? (
            <p className="text-sm">{displayContent}</p>
          ) : (
            <>
              {displayContent ? (
                <ReactMarkdown
                  components={markdownComponents}
                  remarkPlugins={[remarkGfm]}
                >
                  {displayContent}
                </ReactMarkdown>
              ) : null}
              {isCurrentStreaming ? (
                <span className="ml-0.5 animate-pulse text-cyan-400">▍</span>
              ) : null}
            </>
          )}
        </div>

        {!isUser && message.content && !isCurrentStreaming ? (
          <>
            {parseReports(message.content).map((report) => (
              <CopilotReport key={report.title} report={report} />
            ))}
            {sessionId ? (
              <CopilotSuggestions
                content={message.content}
                sessionId={sessionId}
              />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}

type CopilotChatProps = {
  messages: ChatMessage[];
  isLoading: boolean;
  sessionId?: string;
};

export function CopilotChat({
  messages,
  isLoading,
  sessionId,
}: CopilotChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageId = messages.at(-1)?.id;

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll triggers on new message or loading state
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lastMessageId, isLoading]);

  const lastMessage = messages.at(-1);
  const isStreaming =
    isLoading &&
    lastMessage?.role === "assistant" &&
    lastMessage.content.length > 0;
  const isThinking =
    isLoading &&
    (!lastMessage ||
      lastMessage.role !== "assistant" ||
      lastMessage.content.length === 0);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #7c6cff 0%, #00D4FF 100%)",
          }}
        >
          <Bot className="h-5 w-5 text-white" />
        </div>
        <div className="space-y-1">
          <p className="font-semibold text-gray-900 text-sm dark:text-white">
            SAFe AI Copilot
          </p>
          <p className="max-w-[220px] text-gray-500 text-xs leading-relaxed dark:text-zinc-500">
            Faça uma pergunta ou use os atalhos abaixo para começar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 [scrollbar-color:rgba(0,0,0,0.08)_transparent] [scrollbar-width:thin] dark:[scrollbar-color:rgba(255,255,255,0.08)_transparent]">
      <div className="space-y-4">
        {messages.map((message) => (
          <MessageBubble
            isCurrentStreaming={
              isStreaming ? message.id === lastMessage?.id : false
            }
            key={message.id}
            message={message}
            sessionId={sessionId}
          />
        ))}

        {isThinking ? <ThinkingIndicator /> : null}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
