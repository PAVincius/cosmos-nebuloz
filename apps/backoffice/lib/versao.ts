/**
 * Versão implantada e estado do schema.
 *
 * A pergunta que esta tela responde é uma só: **o banco deste ambiente está no
 * ponto que este código espera?** Ela existe porque a resposta já custou caro
 * duas vezes — produção passou dias com 85 de 93 migrations aplicadas sem
 * ninguém notar, e um `22P02` (o enum `ProductModule` sem `SCAFFOLD`) levou uma
 * investigação inteira para revelar a mesma causa por outro sintoma.
 *
 * Desde então `scripts/deploy-migrations.mts` roda `migrate deploy` em todo
 * build da Vercel, então o buraco está tapado. Esta tela não substitui isso:
 * ela **verifica**. Automação que ninguém consegue conferir é automação em que
 * se acredita, e a diferença aparece justamente no dia em que ela falha.
 *
 * Mora em `lib/` porque módulo `"use server"` só exporta função async, e a
 * comparação aqui é pura — o que a torna testável sem banco.
 */

export type EstadoDoSchema =
  | "EM_DIA"
  | "BANCO_ATRAS"
  | "BANCO_ADIANTE"
  | "COM_FALHA";

export type MigrationAplicada = {
  nome: string;
  /** `false` enquanto a migration não terminou, ou se foi revertida. */
  concluida: boolean;
  aplicadaEm: string | null;
};

export type ComparacaoDeSchema = {
  estado: EstadoDoSchema;
  /** No código e não no banco. É o caso perigoso: código à frente do schema. */
  faltando: string[];
  /** No banco e não no código. Deploy antigo, ou migration removida do repo. */
  excedentes: string[];
  /** Começaram e não terminaram, ou foram revertidas. Travam a cadeia inteira. */
  comFalha: string[];
  totalDoCodigo: number;
  totalAplicadas: number;
};

export const ROTULO_ESTADO: Record<EstadoDoSchema, string> = {
  EM_DIA: "Em dia",
  BANCO_ATRAS: "Banco atrás do código",
  BANCO_ADIANTE: "Banco à frente do código",
  COM_FALHA: "Migration com falha",
};

export const TOM_ESTADO: Record<EstadoDoSchema, "green" | "amber" | "red"> = {
  EM_DIA: "green",
  BANCO_ATRAS: "red",
  BANCO_ADIANTE: "amber",
  COM_FALHA: "red",
};

/** O que cada veredito significa para quem está de plantão. */
export const EXPLICACAO_ESTADO: Record<EstadoDoSchema, string> = {
  EM_DIA:
    "Toda migration que este código conhece está aplicada e concluída neste banco.",
  BANCO_ATRAS:
    "Este código espera tabela, coluna ou valor de enum que o banco ainda não tem. É a causa de P2022 e 22P02 — e ela chega ao usuário como formulário que recusa sem motivo.",
  BANCO_ADIANTE:
    "O banco tem migration que este deploy não conhece. Normal logo depois de um rollback de código; se persistir, o deploy está velho.",
  COM_FALHA:
    "Uma migration começou e não terminou. O Prisma trava a cadeia inteira nesse ponto: nenhuma migration posterior é aplicada até isto ser resolvido.",
};

/**
 * Compara o que o código traz com o que o banco registrou.
 *
 * A precedência do veredito não é arbitrária: falha vence porque bloqueia todo
 * o resto, e "atrás" vence "à frente" porque só um dos dois quebra em runtime.
 * Banco à frente é desconforto; banco atrás é incidente.
 */
export function compararSchema({
  doCodigo,
  aplicadas,
}: {
  doCodigo: readonly string[];
  aplicadas: readonly MigrationAplicada[];
}): ComparacaoDeSchema {
  const comFalha = aplicadas.filter((m) => !m.concluida).map((m) => m.nome);
  // Só migration concluída conta como presente. Uma que travou no meio deixou
  // o schema num estado que ninguém consegue nomear — tratá-la como aplicada
  // esconderia exatamente o problema.
  const concluidas = new Set(
    aplicadas.filter((m) => m.concluida).map((m) => m.nome)
  );
  const noCodigo = new Set(doCodigo);

  const faltando = doCodigo.filter((n) => !concluidas.has(n));
  const excedentes = [...concluidas].filter((n) => !noCodigo.has(n)).sort();

  let estado: EstadoDoSchema = "EM_DIA";
  if (comFalha.length > 0) {
    estado = "COM_FALHA";
  } else if (faltando.length > 0) {
    estado = "BANCO_ATRAS";
  } else if (excedentes.length > 0) {
    estado = "BANCO_ADIANTE";
  }

  return {
    estado,
    faltando,
    excedentes,
    comFalha,
    totalDoCodigo: doCodigo.length,
    totalAplicadas: concluidas.size,
  };
}

export type VersaoDoCodigo = {
  /** SHA curto do commit implantado, ou null fora da Vercel. */
  commit: string | null;
  commitCompleto: string | null;
  branch: string | null;
  /** `production`, `preview` ou `development`. */
  ambiente: string;
  /** Primeira linha da mensagem do commit — o resto é ruído nesta tela. */
  assunto: string | null;
  /** URL do deploy, útil para distinguir dois previews abertos ao mesmo tempo. */
  url: string | null;
};

const TAMANHO_DO_SHA_CURTO = 7;
const TAMANHO_DO_ASSUNTO = 100;

/**
 * O que a Vercel injeta no build.
 *
 * Só metadado de build entra aqui — nada de varredura de `process.env`. Esta
 * tela é do staff, mas "staff" não é motivo para expor env: basta uma captura
 * de tela num chat para o segredo sair do perímetro.
 *
 * Fora da Vercel os campos vêm nulos em vez de inventados. Um painel local
 * dizendo "commit desconhecido" é honesto; um dizendo "dev" parece informação.
 */
export function versaoDoCodigo(
  env: Record<string, string | undefined> = process.env
): VersaoDoCodigo {
  const sha = env.VERCEL_GIT_COMMIT_SHA ?? null;
  const mensagem = env.VERCEL_GIT_COMMIT_MESSAGE ?? null;
  return {
    commit: sha ? sha.slice(0, TAMANHO_DO_SHA_CURTO) : null,
    commitCompleto: sha,
    branch: env.VERCEL_GIT_COMMIT_REF ?? null,
    ambiente: env.VERCEL_ENV ?? "development",
    assunto: mensagem
      ? mensagem.split("\n")[0].slice(0, TAMANHO_DO_ASSUNTO)
      : null,
    url: env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null,
  };
}
