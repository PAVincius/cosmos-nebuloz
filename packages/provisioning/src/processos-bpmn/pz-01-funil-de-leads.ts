import type { ProcessoBpmnEntrada } from "@repo/bpmn";

const MAPA = "docs/comercial/mapa-de-processo.md";
const PLAYBOOK = "docs/comercial/playbook-de-vendas.md";

export const PZ_01: ProcessoBpmnEntrada = {
  codigo: "PZ-01",
  nome: "Funil de leads",
  fonte: [
    {
      arquivo: MAPA,
      secao: "§1 Identificação de ICP; §2 Qualificação; §8 Diagrama de estados",
    },
    {
      arquivo: PLAYBOOK,
      secao: "§1 O roteiro de discovery; Sinal de desqualificação",
    },
  ],
  lacunas: [
    "Não há critério escrito de quando um lead passa de DISCOVERY para EVALUATION — a passagem é julgamento de quem toca o lead (mapa §2). O gateway 'Segue para avaliação?' desenha esse julgamento, não uma regra.",
    "Critérios de saída de cada estágio vivem em EstagioDoFunil, editáveis na tela; a fonte escrita não os reproduz, então o diagrama não os detalha (mapa §2).",
    "proximaAcao/proximaAcaoEm marca atraso na tela mas não dispara lembrete (mapa §2) — sem evento de tempo no diagrama.",
    "Mapa §1 diz que a origem do lead é texto livre e que não há captura automática do site; todo lead entra por cadastro manual. O schema já tem canal de lead (funil v2), e o mapa não foi atualizado — conferir.",
    "O mapa não diz o que acontece com o prospect que não bate com o ICP além de não ser registrado.",
  ],
  pool: "Nebuloz — funil comercial",
  raias: [
    { id: "Raia_cadastro", nome: "Comercial ou RevOps" },
    { id: "Raia_dono", nome: "Dono do lead" },
  ],
  nos: [
    {
      id: "Inicio",
      tipo: "inicio",
      nome: "Prospect identificado (evento, indicação, site)",
      raia: "Raia_cadastro",
      origem: "mapa §1 Entrada",
    },
    {
      id: "ConferirIcp",
      tipo: "tarefaUsuario",
      nome: "Conferir recorte do ICP",
      raia: "Raia_cadastro",
      origem: "mapa §1; icp-e-precificacao.md",
    },
    {
      id: "BateIcp",
      tipo: "gatewayExclusivo",
      nome: "Bate com o ICP?",
      raia: "Raia_cadastro",
      origem: "mapa §1",
    },
    {
      id: "ForaDoIcp",
      tipo: "fim",
      nome: "Prospect não registrado",
      raia: "Raia_cadastro",
    },
    {
      id: "CriarLead",
      tipo: "tarefaUsuario",
      nome: "Cadastrar lead com origem e dono (criarLead)",
      raia: "Raia_cadastro",
      origem: "mapa §1 Saída; actions/leads.ts",
    },
    {
      id: "Discovery",
      tipo: "tarefaUsuario",
      nome: "Discovery com as cinco perguntas do diagnóstico",
      raia: "Raia_dono",
      origem: "playbook §1; mapa §2",
    },
    {
      id: "Desqualifica",
      tipo: "gatewayExclusivo",
      nome: "Sinal de desqualificação?",
      raia: "Raia_dono",
      origem: "playbook §1 Sinal de desqualificação",
    },
    {
      id: "Avaliacao",
      tipo: "tarefaUsuario",
      nome: "Avaliação (estágio EVALUATION)",
      raia: "Raia_dono",
      origem: "mapa §2",
    },
    {
      id: "SegueProposta",
      tipo: "gatewayExclusivo",
      nome: "Segue para proposta?",
      raia: "Raia_dono",
      origem: "mapa §2 (lead continua perdível até o fechamento)",
    },
    {
      id: "Converter",
      tipo: "tarefaUsuario",
      nome: "Converter em proposta (converterEmProposta)",
      raia: "Raia_dono",
      origem: "mapa §2, estágio PROPOSAL",
    },
    {
      id: "Convertido",
      tipo: "fim",
      nome: "Lead convertido — segue em PZ-02",
      raia: "Raia_dono",
      origem: "mapa §2 Saída (propostaId)",
    },
    { id: "JuntaPerda", tipo: "gatewayExclusivo", nome: "", raia: "Raia_dono" },
    {
      id: "RegistrarPerda",
      tipo: "tarefaUsuario",
      nome: "Registrar perda (perdidoEm + motivoPerda)",
      raia: "Raia_dono",
      origem: "mapa §2 Saída",
    },
    { id: "Perdido", tipo: "fim", nome: "Lead perdido", raia: "Raia_dono" },
  ],
  fluxos: [
    { de: "Inicio", para: "ConferirIcp" },
    { de: "ConferirIcp", para: "BateIcp" },
    { de: "BateIcp", para: "CriarLead", condicao: "sim" },
    { de: "BateIcp", para: "ForaDoIcp", condicao: "não" },
    { de: "CriarLead", para: "Discovery" },
    { de: "Discovery", para: "Desqualifica" },
    { de: "Desqualifica", para: "Avaliacao", condicao: "não" },
    {
      de: "Desqualifica",
      para: "JuntaPerda",
      condicao: "sim: <50 pessoas, sem engenharia ou Big Four",
    },
    { de: "Avaliacao", para: "SegueProposta" },
    { de: "SegueProposta", para: "Converter", condicao: "sim" },
    { de: "SegueProposta", para: "JuntaPerda", condicao: "não" },
    { de: "Converter", para: "Convertido" },
    { de: "JuntaPerda", para: "RegistrarPerda" },
    { de: "RegistrarPerda", para: "Perdido" },
  ],
};
