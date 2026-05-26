"use client";
type Props = { epicId: string };
export function EpicDrawerDependencies({ epicId }: Props) {
  return (
    <div className="p-6">
      <p className="text-muted-foreground text-sm">
        Dependências para épico {epicId}.
      </p>
    </div>
  );
}
