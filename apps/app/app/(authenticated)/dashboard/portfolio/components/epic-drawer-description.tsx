"use client";

import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";
import { updateEpic } from "@/app/actions/epics/update-epic";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

type Props = { epic: AggregatedPortfolioEpic };

// Fix #1 [CRITICAL]: escape HTML special chars before interpolating capture groups
function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markdownToHtml(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      const h3 = line.match(/^### (.+)/);
      if (h3) return `<h3>${escapeHtml(h3[1])}</h3>`;
      const h2 = line.match(/^## (.+)/);
      if (h2) return `<h2>${escapeHtml(h2[1])}</h2>`;
      const h1 = line.match(/^# (.+)/);
      if (h1) return `<h1>${escapeHtml(h1[1])}</h1>`;
      return line ? `<p>${escapeHtml(line)}</p>` : "";
    })
    .filter(Boolean)
    .join("");
}

function loadContent(md: string | null): string {
  if (!md) return "";
  // Already HTML (saved by a prior edit) — use directly to avoid roundtrip corruption
  if (md.trimStart().startsWith("<")) return md;
  // Legacy plain markdown — convert to HTML for TipTap
  return markdownToHtml(md);
}

export function EpicDrawerDescription({ epic }: Props) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fix #3 [HIGH]: use a ref so the debounce callback always reads the current epic
  const epicRef = useRef(epic);
  useEffect(() => {
    epicRef.current = epic;
  }, [epic]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Descreva este épico…" }),
    ],
    content: loadContent(epic.descriptionMd),
    editorProps: {
      attributes: {
        // Fix #5 [LOW]: remove unnecessary cn() wrapper
        class: "prose prose-sm dark:prose-invert max-w-none min-h-[200px] p-6 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => {
      // Fix #2 [HIGH]: use getHTML() to preserve formatting
      const content = editor.getHTML();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // Fix #4 [HIGH]: wrap save in try/catch with toast on failure
      saveTimerRef.current = setTimeout(async () => {
        try {
          const result = await updateEpic({
            epicId: epicRef.current.id,
            descriptionMd: content,
          });
          if (!result.ok) throw new Error("Save failed");
        } catch {
          toast.error("Erro ao salvar descrição");
        }
      }, 1500);
    },
  });

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  return (
    <div className="h-full">
      <EditorContent editor={editor} />
    </div>
  );
}
