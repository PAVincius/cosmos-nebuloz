"use client";

// copilot.tsx — chat surface over the existing streaming backend
// (api/copilot/chat/route.ts) and session layer (app/actions/safe-copilot).
// No new chat pipeline, session model, or AI integration here — this is UI
// only. Consumes the route's toUIMessageStreamResponse() with the `ai`
// package's own framework-agnostic parseJsonEventStream + readUIMessageStream
// (already a dependency; no @ai-sdk/react needed), rendering tokens as they
// arrive.
import {
  parseJsonEventStream,
  readUIMessageStream,
  type UIMessageChunk,
  uiMessageChunkSchema,
} from "ai";
import { useEffect, useRef, useState } from "react";
import { getCopilotBootstrap } from "@/app/(cosmos)/actions/copilot";
import {
  buildContextWindow,
  createCopilotSession,
  listCopilotSessions,
  loadCopilotSession,
  type SessionPreview,
  type StoredMessage,
} from "@/app/actions/safe-copilot/sessions";
import { Icon } from "../icons";
import { Badge, Button, ErrorState, PageHeader } from "../kit";
import { MessagePartsView, type RenderablePart } from "./copilot-parts";
import { CopilotSessionRail } from "./copilot-sessions";

type ChatTurn = {
  id: string;
  role: "user" | "assistant";
  content: string;
  parts?: RenderablePart[];
};

type ParsedChunkResult =
  | { success: true; value: UIMessageChunk }
  | { success: false; error: unknown };

export default function CopilotScreen() {
  const [role, setRole] = useState<string | null>(null);
  const [chips, setChips] = useState<{ label: string; prompt: string }[]>([]);
  const [askedPrompts, setAskedPrompts] = useState<Set<string>>(new Set());

  const [sessions, setSessions] = useState<SessionPreview[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [quotaError, setQuotaError] = useState<string | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only bootstrap load; refreshSessions is a stable module-scope-equivalent helper
  useEffect(() => {
    getCopilotBootstrap().then((res) => {
      if (res.ok) {
        setRole(res.data.role);
        setChips(res.data.chips);
      }
    });
    refreshSessions();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: turns/streaming are scroll-to-bottom triggers, not read in the effect body
  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [turns, streaming]);

  function refreshSessions() {
    listCopilotSessions().then(setSessions);
  }

  async function selectSession(id: string) {
    setSessionId(id);
    setQuotaError(null);
    setStreamError(null);
    const stored = await loadCopilotSession(id);
    setTurns(
      stored.map((m) => ({ id: m.id, role: m.role, content: m.content }))
    );
  }

  function newChat() {
    setSessionId(null);
    setTurns([]);
    setQuotaError(null);
    setStreamError(null);
  }

  async function send(rawText: string) {
    const text = rawText.trim();
    if (!text || streaming) {
      return;
    }
    setQuotaError(null);
    setStreamError(null);
    setAskedPrompts((prev) => new Set(prev).add(rawText));

    let activeSessionId = sessionId;
    if (!activeSessionId) {
      const created = await createCopilotSession("global", "global");
      activeSessionId = created.id;
      setSessionId(activeSessionId);
    }

    const userTurn: ChatTurn = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    const historyForRequest: StoredMessage[] = [...turns, userTurn].map(
      (t) => ({ id: t.id, role: t.role, content: t.content })
    );
    const assistantId = crypto.randomUUID();
    setTurns((prev) => [
      ...prev,
      userTurn,
      { id: assistantId, role: "assistant", content: "", parts: [] },
    ]);
    setInput("");
    setStreaming(true);

    try {
      const windowed = await buildContextWindow(historyForRequest);

      const response = await fetch("/api/copilot/chat", {
        body: JSON.stringify({
          contextRef: {},
          messages: windowed.map((m) => ({ role: m.role, content: m.content })),
          mode: "global",
          sessionId: activeSessionId,
          surface: "global",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        const body = await response
          .json()
          .catch(() => ({}) as { error?: unknown });
        const message =
          typeof body.error === "string"
            ? body.error
            : "Não foi possível continuar a conversa.";
        setTurns((prev) => prev.filter((t) => t.id !== assistantId));
        if (response.status === 429) {
          setQuotaError(message);
        } else {
          setStreamError(message);
        }
        return;
      }

      if (!response.body) {
        throw new Error("A resposta não trouxe um stream.");
      }

      const parsed = parseJsonEventStream({
        schema: uiMessageChunkSchema,
        stream: response.body,
      });
      const chunkStream: ReadableStream<UIMessageChunk> = parsed.pipeThrough(
        new TransformStream<ParsedChunkResult, UIMessageChunk>({
          transform(result, controller) {
            if (result.success) {
              controller.enqueue(result.value);
            }
          },
        })
      );

      let midStreamError: string | null = null;
      for await (const message of readUIMessageStream({
        onError: (e) => {
          midStreamError =
            e instanceof Error ? e.message : "Erro no streaming.";
        },
        stream: chunkStream,
      })) {
        const parts = message.parts as unknown as RenderablePart[];
        const text = parts
          .filter((p): p is { type: "text"; text: string } => p.type === "text")
          .map((p) => p.text)
          .join("");
        setTurns((prev) =>
          prev.map((t) =>
            t.id === assistantId ? { ...t, content: text, parts } : t
          )
        );
      }
      if (midStreamError) {
        setStreamError(midStreamError);
      }
    } catch (e) {
      setStreamError(
        e instanceof Error
          ? e.message
          : "A resposta foi interrompida antes de terminar."
      );
    } finally {
      setStreaming(false);
      refreshSessions();
    }
  }

  return (
    <div
      className="fade-in"
      style={{ display: "flex", gap: 20, height: "calc(100vh - 128px)" }}
    >
      <CopilotSessionRail
        activeId={sessionId}
        onChanged={refreshSessions}
        onNew={newChat}
        onSelect={selectSession}
        sessions={sessions}
      />

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <PageHeader
          eyebrow="COSMOS"
          meta={
            <>
              <Badge icon="bot" tone="accent">
                {role ? `Perfil: ${role}` : "Copilot"}
              </Badge>
              <Badge dot tone="green">
                Conectado
              </Badge>
            </>
          }
          subtitle="Pergunte sobre saúde do portfólio, riscos, custos e priorização — respostas fundamentadas nos dados reais do tenant."
          title="Copilot"
        >
          <Button
            icon="refresh"
            onClick={newChat}
            size="md"
            variant="secondary"
          >
            Nova conversa
          </Button>
        </PageHeader>

        <div
          className="scroll"
          ref={scrollRef}
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 18,
            paddingRight: 4,
          }}
        >
          {turns.length === 0 && (
            <div
              style={{
                margin: "auto",
                textAlign: "center",
                color: "var(--ink-faint)",
                fontSize: 13,
              }}
            >
              Escolha um tópico sugerido abaixo ou pergunte algo ao Copilot.
            </div>
          )}
          {turns.map((t) =>
            t.role === "user" ? (
              <div
                key={t.id}
                style={{ display: "flex", justifyContent: "flex-end" }}
              >
                <div
                  style={{
                    maxWidth: "76%",
                    background: "var(--accent)",
                    color: "var(--accent-fg)",
                    padding: "12px 16px",
                    borderRadius: "16px 16px 4px 16px",
                    fontSize: 14,
                    fontWeight: 500,
                    lineHeight: 1.45,
                  }}
                >
                  {t.content}
                </div>
              </div>
            ) : (
              <div
                key={t.id}
                style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
              >
                <span
                  style={{
                    display: "grid",
                    placeItems: "center",
                    width: 36,
                    height: 36,
                    borderRadius: "var(--r-md)",
                    flexShrink: 0,
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                    border: "1px solid rgba(var(--accent-rgb),.25)",
                  }}
                >
                  <Icon name="bot" size={19} strokeWidth={1.9} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {t.content || (t.parts?.length ?? 0) > 0 ? (
                    <MessagePartsView
                      parts={t.parts ?? [{ type: "text", text: t.content }]}
                      sessionId={sessionId}
                    />
                  ) : (
                    <span
                      className="pulse-dot"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 13,
                        color: "var(--ink-faint)",
                        padding: "10px 14px",
                        border: "1px solid var(--hairline)",
                        borderRadius: "var(--r-md)",
                        background: "var(--surface)",
                      }}
                    >
                      Pensando…
                    </span>
                  )}
                </div>
              </div>
            )
          )}
          {quotaError && (
            <ErrorState message={`Limite atingido: ${quotaError}`} />
          )}
          {streamError && <ErrorState message={streamError} />}
        </div>

        <div style={{ paddingTop: 16, flexShrink: 0 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            {chips.map((c) => (
              <button
                className="btn"
                disabled={streaming}
                key={c.label}
                onClick={() => send(c.prompt)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  fontSize: 12.5,
                  fontWeight: 500,
                  color: askedPrompts.has(c.prompt)
                    ? "var(--ink-faint)"
                    : "var(--ink-muted)",
                  background: "var(--surface-2)",
                  border: "1px solid var(--hairline)",
                  borderRadius: "var(--r-pill)",
                  padding: "7px 13px",
                  fontFamily: "inherit",
                  cursor: streaming ? "default" : "pointer",
                  opacity: askedPrompts.has(c.prompt) ? 0.55 : 1,
                }}
                type="button"
              >
                {c.label}
              </button>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: "var(--surface)",
              border: "1px solid var(--hairline-strong)",
              borderRadius: "var(--r-lg)",
              padding: "10px 10px 10px 18px",
            }}
          >
            <Icon
              name="message"
              size={18}
              style={{ color: "var(--ink-subtle)", flexShrink: 0 }}
            />
            <input
              disabled={streaming}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  send(input);
                }
              }}
              placeholder="Pergunte ao Copilot sobre o portfólio…"
              style={{
                flex: 1,
                fontSize: 14,
                color: "var(--ink)",
                background: "transparent",
                border: "none",
                outline: "none",
                fontFamily: "inherit",
              }}
              value={input}
            />
            <button
              className="btn"
              disabled={streaming || !input.trim()}
              onClick={() => send(input)}
              style={{
                display: "grid",
                placeItems: "center",
                width: 38,
                height: 38,
                borderRadius: "var(--r-md)",
                border: "none",
                background: "var(--accent)",
                color: "var(--accent-fg)",
                cursor: streaming ? "default" : "pointer",
                opacity: streaming || !input.trim() ? 0.6 : 1,
              }}
              type="button"
            >
              <Icon name="send" size={17} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
