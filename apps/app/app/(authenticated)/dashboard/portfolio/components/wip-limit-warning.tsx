"use client";

type Props = { count: number; limit: number };

export function WipLimitWarning({ count, limit }: Props) {
  if (count <= limit) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700 dark:bg-red-950 dark:text-red-400">
      <span>⚠ WIP</span>
      <span>{count}/{limit}</span>
    </span>
  );
}
