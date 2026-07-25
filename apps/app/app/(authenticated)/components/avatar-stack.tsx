"use client";

import { useOthers, useSelf } from "@repo/collaboration/hooks";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@repo/design-system/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/design-system/components/ui/tooltip";
import { AnimatePresence, motion } from "framer-motion";

type PresenceAvatarProps = {
  info?: Liveblocks["UserMeta"]["info"];
};

const PresenceAvatar = ({ info }: PresenceAvatarProps) => (
  <Tooltip delayDuration={0}>
    <TooltipTrigger>
      <Avatar className="h-7 w-7 bg-secondary ring-1 ring-background">
        <AvatarImage alt={info?.name} src={info?.avatar} />
        <AvatarFallback className="text-xs">
          {info?.name?.slice(0, 2)}
        </AvatarFallback>
      </Avatar>
    </TooltipTrigger>
    <TooltipContent collisionPadding={4}>
      <p>{info?.name ?? "Unknown"}</p>
    </TooltipContent>
  </Tooltip>
);

export const AvatarStack = () => {
  const others = useOthers();
  const self = useSelf();
  const hasMoreUsers = others.length > 3;

  return (
    <div className="-space-x-1 flex items-center px-4">
      <AnimatePresence>
        {others.slice(0, 3).map(({ connectionId, info }) => (
          <motion.div
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.7, x: -6 }}
            initial={{ opacity: 0, scale: 0.7, x: -6 }}
            key={connectionId}
            layout
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <PresenceAvatar info={info} />
          </motion.div>
        ))}

        {hasMoreUsers ? (
          <motion.div
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            initial={{ opacity: 0, scale: 0.7 }}
            key="overflow"
            layout
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <PresenceAvatar
              info={{
                name: `+${others.length - 3}`,
                color: "var(--color-muted-foreground)",
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {self ? (
        <motion.div
          animate={{ opacity: 1, scale: 1 }}
          initial={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          <PresenceAvatar info={self.info} />
        </motion.div>
      ) : null}
    </div>
  );
};
