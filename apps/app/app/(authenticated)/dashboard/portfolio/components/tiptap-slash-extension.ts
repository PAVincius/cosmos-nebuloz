import type { Editor } from "@tiptap/core";
import { Extension } from "@tiptap/core";
import type {
  SuggestionKeyDownProps,
  SuggestionProps,
} from "@tiptap/suggestion";
import Suggestion from "@tiptap/suggestion";

export type SlashItem = {
  title: string;
  description: string;
  command: (editor: Editor) => void;
};

const SLASH_ITEMS: SlashItem[] = [
  {
    title: "Parágrafo",
    description: "Texto comum",
    command: (editor) => {
      editor.chain().focus().setParagraph().run();
    },
  },
  {
    title: "Título 1",
    description: "Seção principal",
    command: (editor) => {
      editor.chain().focus().toggleHeading({ level: 1 }).run();
    },
  },
  {
    title: "Título 2",
    description: "Subseção",
    command: (editor) => {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
    },
  },
  {
    title: "Título 3",
    description: "Subitem",
    command: (editor) => {
      editor.chain().focus().toggleHeading({ level: 3 }).run();
    },
  },
  {
    title: "Lista com marcadores",
    description: "Lista não ordenada",
    command: (editor) => {
      editor.chain().focus().toggleBulletList().run();
    },
  },
  {
    title: "Checkbox",
    description: "Lista de tarefas",
    command: (editor) => {
      editor.chain().focus().toggleTaskList().run();
    },
  },
  {
    title: "Citação",
    description: "Bloco de citação",
    command: (editor) => {
      editor.chain().focus().toggleBlockquote().run();
    },
  },
  {
    title: "Código",
    description: "Bloco de código",
    command: (editor) => {
      editor.chain().focus().toggleCodeBlock().run();
    },
  },
  {
    title: "Divisor",
    description: "Linha horizontal",
    command: (editor) => {
      editor.chain().focus().setHorizontalRule().run();
    },
  },
];

export function filterSlashItems(query: string): SlashItem[] {
  return SLASH_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      item.description.toLowerCase().includes(query.toLowerCase())
  );
}

type SlashCommandsOptions = {
  onStart?: () => void;
  onUpdate?: (query: string) => void;
  onExit?: () => void;
};

export const SlashCommands = Extension.create<SlashCommandsOptions>({
  name: "slashCommands",

  addOptions() {
    return {
      onStart: undefined,
      onUpdate: undefined,
      onExit: undefined,
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: { from: number; to: number };
          props: SlashItem;
        }) => {
          props.command(editor);
          editor.commands.deleteRange(range);
        },
        items: ({ query }: { query: string }) => filterSlashItems(query),
        render: () => ({
          onStart: (props: SuggestionProps) => {
            this.options.onStart?.();
            this.options.onUpdate?.(props.query);
          },
          onUpdate: (props: SuggestionProps) => {
            this.options.onUpdate?.(props.query);
          },
          onKeyDown: (_props: SuggestionKeyDownProps) => false,
          onExit: () => {
            this.options.onExit?.();
          },
        }),
      }),
    ];
  },
});
