"use client";

import { cn } from "@repo/design-system/lib/utils";
import Placeholder from "@tiptap/extension-placeholder";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { generateAC } from "@/app/actions/epics/generate-ac";
import { improveDescription } from "@/app/actions/epics/improve-description";
import { updateEpic } from "@/app/actions/epics/update-epic";
import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";
import {
  filterSlashItems,
  SlashCommands,
  type SlashItem,
} from "./tiptap-slash-extension";

type Props = { epic: AggregatedPortfolioEpic };

const RE_H3 = /^### (.+)/;
const RE_H2 = /^## (.+)/;
const RE_H1 = /^# (.+)/;

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
      const h3 = line.match(RE_H3);
      if (h3) {
        return `<h3>${escapeHtml(h3[1])}</h3>`;
      }
      const h2 = line.match(RE_H2);
      if (h2) {
        return `<h2>${escapeHtml(h2[1])}</h2>`;
      }
      const h1 = line.match(RE_H1);
      if (h1) {
        return `<h1>${escapeHtml(h1[1])}</h1>`;
      }
      return line ? `<p>${escapeHtml(line)}</p>` : "";
    })
    .filter(Boolean)
    .join("");
}

function loadContent(md: string | null): string {
  if (!md) {
    return "";
  }
  // Already HTML (saved by a prior edit) — use directly to avoid roundtrip corruption
  if (md.trimStart().startsWith("<")) {
    return md;
  }
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

  const [slashVisible, setSlashVisible] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [isPendingImprove, startImproveTransition] = useTransition();
  const [isPendingAC, startACTransition] = useTransition();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Descreva este épico…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      SlashCommands.configure({
        onStart: () => {
          setSlashVisible(true);
        },
        onUpdate: (query: string) => {
          setSlashQuery(query);
        },
        onExit: () => {
          setSlashVisible(false);
          setSlashQuery("");
        },
      }),
    ],
    content: loadContent(epic.descriptionMd),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none min-h-[200px] p-6 focus:outline-none",
      },
    },
    onUpdate: ({ editor: ed }) => {
      // Fix #2 [HIGH]: use getHTML() to preserve formatting
      const content = ed.getHTML();
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      // Fix #4 [HIGH]: wrap save in try/catch with toast on failure
      saveTimerRef.current = setTimeout(async () => {
        try {
          const result = await updateEpic({
            epicId: epicRef.current.id,
            descriptionMd: content,
          });
          if (!result.ok) {
            throw new Error("Save failed");
          }
        } catch {
          toast.error("Erro ao salvar descrição");
        }
      }, 1500);
    },
  });

  useEffect(
    () => () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    },
    []
  );

  const handleImprove = () => {
    if (!editor) {
      return;
    }
    startImproveTransition(async () => {
      const result = await improveDescription({
        title: epicRef.current.title,
        descriptionMd: editor.getHTML(),
      });
      if (result.ok && result.data) {
        editor.commands.setContent(markdownToHtml(result.data));
        toast.success("Descrição melhorada");
      } else {
        toast.error("Erro ao melhorar descrição");
      }
    });
  };

  const handleGenerateAC = () => {
    if (!editor) {
      return;
    }
    startACTransition(async () => {
      const result = await generateAC({
        title: epicRef.current.title,
        descriptionMd: editor.getHTML(),
      });
      if (result.ok && result.data) {
        editor.commands.insertContent(
          markdownToHtml(`\n\n## Critérios de Aceite\n${result.data}`)
        );
        toast.success("Critérios de aceite gerados");
      } else {
        toast.error("Erro ao gerar critérios");
      }
    });
  };

  const slashItems = filterSlashItems(slashQuery);
  const showSlashMenu = slashVisible ? slashItems.length > 0 : false;

  return (
    <div className="flex h-full flex-col">
      {/* AI toolbar */}
      <div className="flex gap-1.5 border-b px-4 py-2">
        <button
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] text-indigo-500 transition-colors hover:bg-muted disabled:opacity-40"
          )}
          disabled={isPendingImprove}
          onClick={handleImprove}
          type="button"
        >
          <span>✦</span>
          {isPendingImprove ? "Melhorando…" : "Melhorar com IA"}
        </button>
        <button
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[10px] text-indigo-500 transition-colors hover:bg-muted disabled:opacity-40"
          )}
          disabled={isPendingAC}
          onClick={handleGenerateAC}
          type="button"
        >
          <span>✦</span>
          {isPendingAC ? "Gerando…" : "Gerar Critérios de Aceite"}
        </button>
      </div>

      {/* Editor + slash menu */}
      <div className="relative flex-1 overflow-y-auto">
        <EditorContent editor={editor} />
        {showSlashMenu ? (
          <div className="absolute top-4 left-8 z-50 w-56 overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
            {slashItems.map((item: SlashItem) => (
              <button
                className="flex w-full flex-col px-3 py-2 text-left transition-colors hover:bg-muted"
                key={item.title}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (editor) {
                    item.command(editor);
                  }
                  setSlashVisible(false);
                }}
                type="button"
              >
                <span className="font-medium text-sm">{item.title}</span>
                <span className="text-[10px] text-muted-foreground">
                  {item.description}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
