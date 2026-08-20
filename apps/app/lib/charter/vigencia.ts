/**
 * Vigência de norma — derivada, nunca gravada.
 *
 * O mapa de conformidade responde a um comprador, e a pergunta que ele faz não
 * é "vocês atendem?", é "vocês atendem **ao que já obriga**?". Sem separar as
 * duas, LGPD e um projeto de lei entram na mesma coluna e o mapa afirma
 * obrigação onde existe intenção legislativa.
 *
 * Dois cenários, e a recusa de escolher entre eles é deliberada:
 *
 * - `EM_VIGOR` — o texto publicado, com o prazo que ele traz. É o cenário
 *   conservador: se a alteração em trâmite não passar, é este que vale.
 * - `SE_APROVADA` — o mesmo conjunto com o prazo que a alteração proporia.
 *
 * O caso que motivou tudo isto: o AI Act tem Art. 50 obrigando desde
 * 2 ago 2026, marcação do Art. 50(2) com carência até 2 dez 2026, e alto risco
 * do Anexo III proposto para 2 dez 2027 por alteração ainda em trílogo. Um
 * status por conjunto não expressa isso, e escolher um dos prazos é apostar no
 * resultado de uma negociação legislativa em nome de quem lê o mapa.
 *
 * Puro de propósito: sem `server-only`, sem banco, sem relógio implícito. A
 * data de referência entra por parâmetro porque "hoje" dentro da função torna
 * o teste dependente do dia em que roda.
 */

export type NormaStatus = "VIGENTE" | "PROPOSTO" | "ADIADO" | "REVOGADO";

/** Qual dos dois prazos a leitura quer enxergar. */
export type Cenario = "EM_VIGOR" | "SE_APROVADA";

/** O que conjunto e exigência carregam sobre vigência. Mesma forma nos dois —
 *  é o que permite a exigência sobrepor o conjunto campo a campo. */
export type FonteDeVigencia = {
  normaStatus: NormaStatus | null;
  vigenciaEm: Date | null;
  vigenciaPropostaEm: Date | null;
  notaVigencia: string | null;
};

export type Vigencia = {
  status: NormaStatus;
  /** A data que vale no cenário pedido. Nula = sem prazo declarado. */
  em: Date | null;
  /** Se obriga na data de referência, dentro do cenário pedido. */
  obriga: boolean;
  /** Por que não obriga. Nulo quando obriga — quem obriga não precisa de
   *  justificativa, e frase de sucesso é ruído no mapa. */
  motivo: string | null;
  nota: string | null;
  /** Se a exigência não disse nada e herdou o conjunto inteiro. Serve à tela:
   *  linha que fala por si merece destaque, linha herdada não. */
  herdada: boolean;
};

const SEM_PRAZO_DECLARADO = null;

/**
 * Herança campo a campo, não tudo-ou-nada.
 *
 * A alternativa — a exigência que declara qualquer campo passa a declarar
 * todos — obrigaria a repetir `normaStatus: VIGENTE` só para adiar uma data em
 * quatro meses, que é exatamente o caso do Art. 50(2). Repetição de valor
 * herdado é a forma mais comum de os dois divergirem depois.
 */
function herdar(
  conjunto: FonteDeVigencia,
  exigencia: FonteDeVigencia
): FonteDeVigencia {
  return {
    normaStatus: exigencia.normaStatus ?? conjunto.normaStatus,
    vigenciaEm: exigencia.vigenciaEm ?? conjunto.vigenciaEm,
    vigenciaPropostaEm:
      exigencia.vigenciaPropostaEm ?? conjunto.vigenciaPropostaEm,
    notaVigencia: exigencia.notaVigencia ?? conjunto.notaVigencia,
  };
}

function formatarData(data: Date): string {
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * A frase muda com o cenário, e isso não é cosmético.
 *
 * "Obriga a partir de 2 dez 2027" afirma um fato. No cenário `SE_APROVADA` o
 * fato não existe ainda — depende de uma alteração em trílogo — e a mesma frase
 * viraria a falsa precisão que este módulo veio remover.
 */
function prazoFuturo(data: Date, cenario: Cenario): string {
  return cenario === "SE_APROVADA"
    ? `Se aprovada, obriga a partir de ${formatarData(data)}.`
    : `Obriga a partir de ${formatarData(data)}.`;
}

/**
 * A data que vale num cenário.
 *
 * `ADIADO` em `EM_VIGOR` devolve o prazo **original**, não o proposto — é o
 * ponto do estado: a norma foi publicada com uma data, e a alteração que a move
 * ainda não passou. Devolver o prazo novo aqui seria dar por aprovada uma
 * alteração em trâmite.
 */
function dataDoCenario(fonte: FonteDeVigencia, cenario: Cenario): Date | null {
  if (cenario === "EM_VIGOR") {
    return fonte.vigenciaEm;
  }
  return fonte.vigenciaPropostaEm ?? fonte.vigenciaEm;
}

export function resolverVigencia(
  conjunto: FonteDeVigencia,
  exigencia: FonteDeVigencia,
  referencia: { em: Date; cenario: Cenario }
): Vigencia {
  const fonte = herdar(conjunto, exigencia);
  const status = fonte.normaStatus ?? "VIGENTE";
  const herdada =
    exigencia.normaStatus === null &&
    exigencia.vigenciaEm === null &&
    exigencia.vigenciaPropostaEm === null;

  const base = { status, nota: fonte.notaVigencia, herdada };

  if (status === "REVOGADO") {
    return {
      ...base,
      em: SEM_PRAZO_DECLARADO,
      obriga: false,
      motivo: "Revogada. Fica no registro porque cobertura antiga aponta aqui.",
    };
  }

  if (status === "PROPOSTO") {
    // Projeto não obriga pelo texto em vigor — é o ponto inteiro do estado.
    if (referencia.cenario === "EM_VIGOR") {
      return {
        ...base,
        em: SEM_PRAZO_DECLARADO,
        obriga: false,
        motivo: "Ainda é projeto. Não obriga pelo texto em vigor.",
      };
    }
    const proposta = fonte.vigenciaPropostaEm;
    if (!proposta) {
      return {
        ...base,
        em: SEM_PRAZO_DECLARADO,
        obriga: false,
        motivo: "Projeto sem prazo definido — não há data para simular.",
      };
    }
    return {
      ...base,
      em: proposta,
      obriga: referencia.em >= proposta,
      motivo:
        referencia.em >= proposta
          ? null
          : prazoFuturo(proposta, referencia.cenario),
    };
  }

  // VIGENTE e ADIADO seguem a mesma regra: o que muda entre eles é qual data
  // `dataDoCenario` devolve.
  const data = dataDoCenario(fonte, referencia.cenario);

  // Sem data declarada obriga desde já, e isso é o caso comum e correto: RFP de
  // cliente é obrigação contratual no instante em que chega. Quem tem prazo é
  // regulação, e regulação é importada com prazo.
  if (!data) {
    return { ...base, em: SEM_PRAZO_DECLARADO, obriga: true, motivo: null };
  }

  if (referencia.em >= data) {
    return { ...base, em: data, obriga: true, motivo: null };
  }

  return {
    ...base,
    em: data,
    obriga: false,
    motivo: prazoFuturo(data, referencia.cenario),
  };
}

/**
 * Se os dois cenários divergem para esta linha — o que a tela precisa saber
 * para marcar a exigência como "depende do trâmite".
 *
 * Divergência não é defeito nem pendência: é a informação. Uma linha que obriga
 * num cenário e não no outro é exatamente a que muda de resposta conforme o
 * trílogo termine, e esconder isso devolveria o mapa à falsa precisão que ele
 * veio remover.
 */
export function cenariosDivergem(
  conjunto: FonteDeVigencia,
  exigencia: FonteDeVigencia,
  em: Date
): boolean {
  const agora = resolverVigencia(conjunto, exigencia, {
    em,
    cenario: "EM_VIGOR",
  });
  const depois = resolverVigencia(conjunto, exigencia, {
    em,
    cenario: "SE_APROVADA",
  });
  return agora.obriga !== depois.obriga;
}
