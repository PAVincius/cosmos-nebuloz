"use client";

import { useCallback, useRef, useState } from "react";
import type { ChatMessage, ToolInvocation } from "./copilot-types";

export type { ChatMessage };

type UseCopilotChatOptions = {
  api: string;
  body: Record<string, unknown>;
  initialMessages?: ChatMessage[];
};

function nanoid(): string {
  return Math.random().toString(36).slice(2, 11);
}

type StreamState = {
  text: string;
  toolInvocations: Map<string, ToolInvocation>;
};

type UIMessageChunk =
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; delta: string }
  | { type: "text-end"; id: string }
  | { type: "tool-input-start"; toolCallId: string; toolName: string }
  | {
      type: "tool-input-available";
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
  | { type: "tool-output-available"; toolCallId: string; output: unknown }
  | { type: "error"; errorText: string }
  | { type: string };

function applyChunk(
  chunk: UIMessageChunk,
  state: StreamState,
  emit: () => void
): void {
  switch (chunk.type) {
    case "text-delta": {
      const c = chunk as { type: "text-delta"; delta: string };
      state.text += c.delta;
      emit();
      break;
    }
    case "tool-input-start": {
      const c = chunk as {
        type: "tool-input-start";
        toolCallId: string;
        toolName: string;
      };
      state.toolInvocations.set(c.toolCallId, {
        toolCallId: c.toolCallId,
        toolName: c.toolName,
        args: {},
        state: "partial-call",
      });
      emit();
      break;
    }
    case "tool-input-available": {
      const c = chunk as {
        type: "tool-input-available";
        toolCallId: string;
        toolName: string;
        input: unknown;
      };
      state.toolInvocations.set(c.toolCallId, {
        toolCallId: c.toolCallId,
        toolName: c.toolName,
        args: (c.input as Record<string, unknown>) ?? {},
        state: "call",
      });
      emit();
      break;
    }
    case "tool-output-available": {
      const c = chunk as {
        type: "tool-output-available";
        toolCallId: string;
        output: unknown;
      };
      const existing = state.toolInvocations.get(c.toolCallId);
      if (existing) {
        state.toolInvocations.set(c.toolCallId, {
          ...existing,
          state: "result",
          result: c.output,
        });
        emit();
      }
      break;
    }
    case "error": {
      const c = chunk as { type: "error"; errorText: string };
      throw new Error(c.errorText);
    }
    default: {
      break;
    }
  }
}

function processLines(
  lines: string[],
  state: StreamState,
  emit: () => void
): void {
  for (const line of lines) {
    if (!line.trim() || line.startsWith(":")) {
      continue;
    }
    const raw = line.startsWith("data: ") ? line.slice(6) : line;
    if (raw === "[DONE]") {
      continue;
    }
    try {
      applyChunk(JSON.parse(raw) as UIMessageChunk, state, emit);
    } catch (e) {
      if (e instanceof Error && !e.message.startsWith("Unexpected token")) {
        throw e;
      }
    }
  }
}

async function readDataStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onUpdate: (state: { text: string; toolInvocations: ToolInvocation[] }) => void
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";
  const state: StreamState = { text: "", toolInvocations: new Map() };
  const emit = () =>
    onUpdate({
      text: state.text,
      toolInvocations: Array.from(state.toolInvocations.values()),
    });

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    processLines(lines, state, emit);
  }
}

type FetchStreamOptions = {
  api: string;
  history: ChatMessage[];
  userMsg: ChatMessage;
  body: Record<string, unknown>;
  signal: AbortSignal;
  onUpdate: (state: {
    text: string;
    toolInvocations: ToolInvocation[];
  }) => void;
};

async function fetchStream(opts: FetchStreamOptions): Promise<void> {
  const { api, history, userMsg, body, signal, onUpdate } = opts;
  const response = await fetch(api, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      messages: [...history, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      })),
      ...body,
    }),
  });

  if (!response.ok) {
    const err = await response
      .json()
      .catch(() => ({ error: `HTTP ${response.status}` }));
    throw new Error(
      (err as { error?: string }).error ?? `HTTP ${response.status}`
    );
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  await readDataStream(reader, onUpdate);
}

export function useCopilotChat({
  api,
  body,
  initialMessages,
}: UseCopilotChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>(
    initialMessages ?? []
  );
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const handleSubmitText = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) {
        return;
      }

      const userMsg: ChatMessage = {
        id: nanoid(),
        role: "user",
        content: trimmed,
      };
      const assistantId = nanoid();

      setMessages((prev) => [
        ...prev,
        userMsg,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          toolInvocations: [],
        },
      ]);
      setInput("");
      setIsLoading(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        await fetchStream({
          api,
          history: messages,
          userMsg,
          body,
          signal: controller.signal,
          onUpdate: ({ text: content, toolInvocations }) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content, toolInvocations } : m
              )
            );
          },
        });
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") {
          return;
        }
        const errMsg = err instanceof Error ? err.message : "Erro desconhecido";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: `Erro: ${errMsg}` } : m
          )
        );
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [api, body, isLoading, messages]
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      await handleSubmitText(input);
    },
    [handleSubmitText, input]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setInput("");
  }, []);

  return {
    messages,
    setMessages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    handleSubmitText,
    isLoading,
    stop,
    reset,
  };
}
