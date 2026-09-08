/**
 * Aviso de gravação e cláusula de consentimento permanente
 * (docs/compliance/aviso-de-gravacao.md §1–§2), em código.
 *
 * Os marcadores `[ferramenta]`, `[prazo]` e `[contato]` são preenchidos pela
 * DecisaoDeConsentimento; `[organização]` muda por tenant e fica sempre.
 * Marcador sem valor permanece visível: a tela destaca, e "Copiar" copia com o
 * marcador — o prazo "não se lê em voz alta vazio".
 */

export type PecaDoAviso =
  | "INTERNA_PT"
  | "EXTERNA_PT"
  | "EXTERNA_EN"
  | "CLAUSULA_PT";

export const AVISOS: Record<
  PecaDoAviso,
  { titulo: string; nota: string; texto: string }
> = {
  INTERNA_PT: {
    titulo: "Reunião só interna · PT",
    nota: "Por reunião · ~20 s de fala",
    texto:
      "Esta reunião está sendo gravada e transcrita pelo [ferramenta], e o resumo é processado por um modelo de IA de terceiro. O acesso fica com quem tem papel ADMIN, STE ou RTE nesta organização, e o conteúdo é retido por [prazo]. Quem não quiser ser gravado diz agora. Depois, pedindo a revogação, o resumo e os itens derivados são apagados.",
  },
  EXTERNA_PT: {
    titulo: "Com participante externo · PT",
    nota: "A versão que importa",
    texto:
      "Esta reunião está sendo gravada e transcrita pelo [ferramenta], e o conteúdo é processado por um modelo de IA de terceiro para gerar resumo e itens de ação. Quem responde por esses dados é a [organização], que os retém por [prazo]. Se alguém não concordar, diga agora e a gravação não é processada. Pedidos de acesso ou exclusão vão para [contato].",
  },
  EXTERNA_EN: {
    titulo: "With external participant · EN",
    nota: "",
    texto:
      "This meeting is being recorded and transcribed by [ferramenta], and the content is processed by a third-party AI model to produce a summary and action items. [organização] is responsible for this data and keeps it for [prazo]. If anyone objects, say so now and the recording will not be processed. Requests for access or deletion go to [contato].",
  },
  CLAUSULA_PT: {
    titulo: "Consentimento permanente · cláusula",
    nota: "STANDING só habilitável com referência versionada e datada",
    texto:
      "Gravação e transcrição de cerimônias. As cerimônias conduzidas por esta organização podem ser gravadas e transcritas por ferramenta de terceiro, e o conteúdo resultante processado por modelo de inteligência artificial com a finalidade determinada de gerar resumo, riscos, impedimentos e itens de ação registrados na plataforma de gestão. Quem conduz a cerimônia deve anunciar a gravação na abertura, antes de ela começar, e interrompê-la caso qualquer participante se oponha. O acesso é restrito a quem tem papel de governança na organização; a retenção é de [prazo]. O consentimento pode ser revogado a qualquer momento, por procedimento gratuito, junto a [contato], hipótese em que o resumo e os itens derivados daquela cerimônia são eliminados. Esta cláusula não autoriza gravação para finalidade diversa da aqui descrita.",
  },
};

export type Marcadores = {
  ferramenta: string | null;
  prazoRetencao: string | null;
  contatoTitular: string | null;
};

const MARCADORES: { marcador: string; campo: keyof Marcadores }[] = [
  { marcador: "[ferramenta]", campo: "ferramenta" },
  { marcador: "[prazo]", campo: "prazoRetencao" },
  { marcador: "[contato]", campo: "contatoTitular" },
];

function valor(m: Marcadores, campo: keyof Marcadores): string | null {
  const v = m[campo]?.trim();
  return v ? v : null;
}

export function camposEmAberto(m: Marcadores): string[] {
  return MARCADORES.filter((x) => valor(m, x.campo) === null).map(
    (x) => x.marcador
  );
}

export function renderAviso(
  peca: PecaDoAviso,
  m: Marcadores
): { texto: string; abertos: string[] } {
  let texto = AVISOS[peca].texto;
  const abertos: string[] = [];
  for (const x of MARCADORES) {
    if (!texto.includes(x.marcador)) {
      continue;
    }
    const v = valor(m, x.campo);
    if (v === null) {
      abertos.push(x.marcador);
    } else {
      texto = texto.replaceAll(x.marcador, v);
    }
  }
  return { texto, abertos };
}
