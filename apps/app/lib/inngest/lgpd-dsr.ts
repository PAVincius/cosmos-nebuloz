import { database } from "@repo/database";

// ─── Portability export (LGPD Art. 18.IV — right to data portability) ────────

export type PortabilityPayload = {
  schemaVersion: string;
  exportedAt: string;
  subject: {
    id: string;
    name: string | null;
    email: string;
    createdAt: Date;
  } | null;
  standupEntries: Array<{
    id: string;
    date: Date;
    yesterday: string | null;
    today: string | null;
    blockers: string | null;
  }>;
  copilotSessions: Array<{
    id: string;
    mode: string;
    createdAt: Date;
    messageCount: number;
  }>;
  // Passo 8 do §7: participação em reunião é dado do titular. Vazio quando
  // o usuário não tem e-mail conhecido (subject null) — mesma correspondência
  // por e-mail usada em processErasureRequest, acima.
  meetingParticipations: Array<{
    transcriptId: string;
    meetingId: string;
    title: string | null;
    isOrganizer: boolean;
    isExternal: boolean;
    createdAt: Date;
  }>;
};

export async function buildPortabilityExport(
  subjectId: string,
  tenantId: string,
  exportedAt: string
): Promise<PortabilityPayload> {
  const [profile, standupEntries, copilotSessions] = await Promise.all([
    database.user.findUnique({
      where: { id: subjectId },
      select: { id: true, name: true, email: true, createdAt: true },
    }),
    database.standupEntry.findMany({
      where: { userId: subjectId, tenantId },
      select: {
        id: true,
        date: true,
        yesterday: true,
        today: true,
        blockers: true,
      },
      orderBy: { date: "asc" },
    }),
    database.copilotSession.findMany({
      where: { userId: subjectId, tenantId },
      select: { id: true, mode: true, createdAt: true, messageCount: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const participantRows = profile?.email
    ? await database.meetingParticipant.findMany({
        where: { tenantId, email: profile.email },
        select: {
          isOrganizer: true,
          isExternal: true,
          transcript: {
            select: {
              id: true,
              meetingId: true,
              title: true,
              createdAt: true,
            },
          },
        },
      })
    : [];

  return {
    schemaVersion: "1.0",
    exportedAt,
    subject: profile,
    standupEntries,
    copilotSessions,
    meetingParticipations: participantRows.map((p) => ({
      transcriptId: p.transcript.id,
      meetingId: p.transcript.meetingId,
      title: p.transcript.title,
      isOrganizer: p.isOrganizer,
      isExternal: p.isExternal,
      createdAt: p.transcript.createdAt,
    })),
  };
}
