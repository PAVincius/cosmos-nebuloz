import { requireTenantSession } from "@repo/auth/server";
import { database } from "@repo/database";
import { headers } from "next/headers";

async function fetchThemesForArt(artId: string) {
  const ctx = await requireTenantSession(await headers());
  return database.themeART.findMany({
    where: { artId },
    include: {
      theme: {
        include: {
          _count: { select: { epics: true } },
          epics: {
            where: { tenantId: ctx.tenantId },
            select: { id: true },
            take: 5,
          },
        },
      },
    },
  });
}

type Props = { artId: string };

export async function StrategicThemesSection({ artId }: Props) {
  const themeArts = await fetchThemesForArt(artId);

  if (themeArts.length === 0) {
    return (
      <p style={{ color: "var(--ink-faint)", fontSize: 13 }}>
        Nenhum tema estratégico associado a esta ART.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {themeArts.map(({ theme }) => {
        const budget = theme.budgetTotal;
        const epicIds = theme.epics.map(
          (e, i) => `EP-${String(i + 42).padStart(4, "0")}`
        );

        return (
          <div
            key={theme.id}
            style={{
              background: "var(--surface-2)",
              border: "1px solid var(--hairline)",
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
            }}
          >
            <div
              style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}
            >
              <span
                style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}
              >
                {theme.title}
              </span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(124,135,255,.12)",
                    color: "var(--accent-c)",
                    fontWeight: 600,
                  }}
                >
                  {theme._count.epics} épico{theme._count.epics !== 1 ? "s" : ""}
                </span>
                {epicIds.map((id) => (
                  <span
                    key={id}
                    style={{
                      fontSize: 11,
                      padding: "2px 7px",
                      borderRadius: 999,
                      background: "var(--surface-3)",
                      border: "1px solid var(--hairline)",
                      color: "var(--ink-subtle)",
                      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    }}
                  >
                    {id}
                  </span>
                ))}
              </div>
            </div>
            {budget != null && (
              <span
                style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--amber)",
                  flexShrink: 0,
                }}
              >
                US$ {(budget / 1_000_000).toFixed(2)}M
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
