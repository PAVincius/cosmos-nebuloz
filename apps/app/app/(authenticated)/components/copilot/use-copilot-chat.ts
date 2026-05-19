"use client";

import { useCallback, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type UseCopilotChatOptions = {
  api: string;
  body: Record<string, unknown>;
};

function nanoid(): string {
  return Math.random().toString(36).slice(2, 11);
}

async function readStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (accumulated: string) => void
): Promise<void> {
  const decoder = new TextDecoder();
  let accumulated = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    accumulated += decoder.decode(value, { stream: true });
    onChunk(accumulated);
  }
}

type FetchStreamOptions = {
  api: string;
  history: ChatMessage[];
  userMsg: ChatMessage;
  body: Record<string, unknown>;
  signal: AbortSignal;
  onChunk: (accumulated: string) => void;
};

async function fetchStream(opts: FetchStreamOptions): Promise<void> {
  const { api, history, userMsg, body, signal, onChunk } = opts;
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

  await readStream(reader, onChunk);
}

export function useCopilotChat({ api, body }: UseCopilotChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setInput(e.target.value);
    },
    []
  );

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = input.trim();
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
        { id: assistantId, role: "assistant", content: "" },
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
          onChunk: (accumulated) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: accumulated } : m
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
    [api, body, input, isLoading, messages]
  );

  const reset = useCallback(() => {
    setMessages([]);
    setInput("");
  }, []);

  return {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    reset,
  };
}
