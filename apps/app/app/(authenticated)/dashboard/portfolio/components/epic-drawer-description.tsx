"use client";

import type { AggregatedPortfolioEpic } from "@/lib/portfolio-aggregate";
import { updateEpic } from "@/app/actions/epics/update-epic";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef } from "react";
import { cn } from "@repo/design-system/lib/utils";

type Props = { epic: AggregatedPortfolioEpic };

function markdownToHtml(md: string): string {
  return md
    .split("\n")
    .map((line) => {
      const h3 = line.match(/^### (.+)/);
      if (h3) return `<h3>${h3[1]}</h3>`;
      const h2 = line.match(/^## (.+)/);
      if (h2) return `<h2>${h2[1]}</h2>`;
      const h1 = line.match(/^# (.+)/);
      if (h1) return `<h1>${h1[1]}</h1>`;
      return line ? `<p>${line}</p>` : "";
    })
    .filter(Boolean)
    .join("");
}

export function EpicDrawerDescription({ epic }: Props) {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Descreva este épico…" }),
    ],
    content: epic.descriptionMd ? markdownToHtml(epic.descriptionMd) : "",
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none min-h-[200px] p-6 focus:outline-none"
        ),
      },
    },
    onUpdate: ({ editor }) => {
      const md = editor.getText();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        await updateEpic({ epicId: epic.id, descriptionMd: md });
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
