import { PageHeader } from "@repo/design-system/cosmos/kit";
import { lerConsentimento } from "@/app/actions/empresa/consentimento";
import { secaoDaRota } from "@/components/nav";
import { requirePlatformStaff } from "@/lib/guard";
import { Painel } from "./painel";

export const dynamic = "force-dynamic";

export default async function ConsentimentoPage() {
  const [staff, res] = await Promise.all([
    requirePlatformStaff(),
    lerConsentimento(),
  ]);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <PageHeader
        eyebrow={`${secaoDaRota("/empresa/consentimento")} · gravação de reuniões`}
        subtitle="O produto garante que alguém afirmou ter consentimento. Isto aqui é o que faz o consentimento existir: o aviso lido na abertura, a cláusula permanente e a base legal que o advogado ainda não escolheu."
        title="Consentimento de gravação"
      />
      {res.ok ? (
        <Painel inicial={res.data} podeEscrever={staff.canWrite} />
      ) : (
        <p style={{ color: "var(--red-text)", fontSize: "var(--fs-base)" }}>
          {res.error}
        </p>
      )}
    </div>
  );
}
