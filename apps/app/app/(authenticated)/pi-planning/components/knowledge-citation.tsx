import Link from "next/link";

type Props = { type: string; id: string };

export function KnowledgeCitation({ type, id }: Props) {
  const href =
    type === "epic"
      ? `/portfolio/epics/${id}`
      : type === "feature"
        ? `/features/${id}`
        : type === "risk"
          ? `/risks/${id}`
          : "#";
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1 rounded bg-muted px-1 py-0.5 text-xs text-blue-600 underline hover:text-blue-800"
    >
      {type}:{id.slice(0, 8)}
    </Link>
  );
}
