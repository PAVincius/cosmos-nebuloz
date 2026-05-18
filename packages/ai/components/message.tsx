import type { ComponentProps } from "react";
import { Streamdown } from "streamdown";
import { twMerge } from "tailwind-merge";

/** Payload simples (texto + papel) usado por este componente legado. */
export type LegacyChatMessage = {
  role: "user" | "assistant" | string;
  content: string;
};

type MessageProps = {
  data: LegacyChatMessage;
  markdown?: ComponentProps<typeof Streamdown>;
};

export const Message = ({ data, markdown }: MessageProps) => (
  <div
    className={twMerge(
      "flex max-w-[80%] flex-col gap-2 rounded-xl px-4 py-2",
      data.role === "user"
        ? "self-end bg-foreground text-background"
        : "self-start bg-muted"
    )}
  >
    <Streamdown {...markdown}>{data.content}</Streamdown>
  </div>
);
