"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useImperativeHandle, useRef } from "react";

export type CopilotTipTapEditorHandle = {
  clear: () => void;
};

type Props = {
  ref?: React.Ref<CopilotTipTapEditorHandle>;
  onChange: (text: string) => void;
  onSubmit: (text: string) => void;
  disabled?: boolean;
};

export function CopilotTipTapEditor({
  ref,
  onChange,
  onSubmit,
  disabled,
}: Props) {
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: "Pergunte sobre seus dados..." }),
    ],
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-label": "Mensagem para o Copilot",
        "aria-multiline": "true",
      },
      handleKeyDown: (_view, event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          if (editor) {
            const text = editor.getText().trim();
            if (text) {
              onSubmitRef.current(text);
              editor.commands.clearContent(true);
            }
          }
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      onChangeRef.current(e.getText());
    },
    immediatelyRender: false,
  });

  useImperativeHandle(
    ref,
    () => ({
      clear: () => {
        editor?.commands.clearContent(true);
      },
    }),
    [editor]
  );

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  return (
    <div className="copilot-tiptap px-3 py-2">
      <EditorContent editor={editor} />
    </div>
  );
}
