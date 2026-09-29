// Habilitação de benchmark por tenant (specs/012-benchmark-travado-tenant).
// Sem linha = desligado: tenant novo nasce travado. Quem liga é só a Nebuloz,
// pelo back-office (`setMeridianBenchmarkEnablement`, em @repo/provisioning).
//
// `db` entra como `unknown` de propósito: o model `MeridianBenchmarkEnablement`
// ainda não está no client gerado (a migration é do Alicerce, branch
// feat/meridian-benchmark-schema). Quando o schema entrar, tipar `db` como o
// client transacional e apagar o cast.
type EnablementReader = {
  meridianBenchmarkEnablement: {
    findUnique(args: unknown): Promise<{ enabled: boolean } | null>;
  };
};

export async function isBenchmarkEnabled(
  db: unknown,
  tenantId: string
): Promise<boolean> {
  const row = await (
    db as EnablementReader
  ).meridianBenchmarkEnablement.findUnique({
    where: { tenantId },
    select: { enabled: true },
  });
  return row?.enabled === true;
}
