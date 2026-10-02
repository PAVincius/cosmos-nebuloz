# Parecer prévio — guia conversacional com modo de voz nas trilhas do Scaffold

- **Data:** 2026-09-30
- **Autor:** Compliance / DPO
- **Solicitante:** Morgana, a pedido do CEO
- **Objeto:** briefing `.maestri/briefings/2026-09-30-scaffold-triagem-guiada.md` (pedido do CEO de 2026-09-30): um agente conversacional que conduz quem aplica a trilha pelas etapas e pela triagem, em texto e em voz, com provedor de voz a escolher (OpenAI Realtime ou alternativa).
- **Método:** li o briefing, `dpa-modelo.md`, `dpa-fornecedores.md` (V-02), `lgpd-ropa-e-lacunas.md`, `consentimento-de-gravacao.md` e as decisões registradas de 29 e 30/09. A Resolução CD/ANPD nº 19/2024 eu li no site da ANPD, em 2026-09-30. As regras de retenção da OpenAI vieram de busca na web que aponta para a página oficial de controles de dados da OpenAI; não consegui abrir a página e cito o que a busca devolveu. **Não li código do Scaffold e não vi o provedor "Abinit"** (o briefing diz que o nome chegou assim e está a confirmar). Não é aconselhamento jurídico.

## Veredito

**OK com condições, em três degraus.** Cada degrau tem a sua lista de condições na §9.

| Degrau | O que é | Veredito |
|---|---|---|
| **0** | Guia só em texto, opções fechadas, sem gravação nem modo de voz | **OK.** É o que o Copiloto já faz (RoPA, finalidade 8); não pede novo parecer se cumprir §9.0 |
| **1** | Voz, em teste interno com a equipe da Nebuloz no tenant da Nebuloz | **OK com condições** (§9.1) |
| **2** | Voz com pessoa de fora da equipe, ou qualquer cliente | **Bloqueia** até as condições do §9.2, em especial o mecanismo de transferência internacional e a retenção do provedor |

## Respostas curtas às perguntas

| Pergunta | Resposta |
|---|---|
| Base legal | Do **cliente** (controlador): execução do contrato ou legítimo interesse de aplicar a trilha. Nebuloz **operadora**. Nos testes com a própria equipe, a Nebuloz é controladora: legítimo interesse com aviso e direito de recusar; para pessoa de fora, **consentimento específico** (§3) |
| Aviso | Sim, **antes do primeiro uso de voz** e em texto na tela do guia. Diz que é uma IA, que a fala é processada por provedor nos EUA, o que fica guardado e por quanto tempo, e como trocar para texto (§4) |
| Gravar áudio é necessário? | **Não.** O áudio não deve ser persistido. A transcrição também não, por padrão. O necessário é a **resposta estruturada** (a opção escolhida), que é o "porquê" da trilha (§5) |
| Retenção | Áudio: não guardamos. Transcrição: não guardamos por padrão; se for guardada, 30 dias. Resposta estruturada: duração do contrato mais 30 dias. **O provedor pode reter até 30 dias**, a não ser que obtenhamos retenção zero (§6) |
| Operador externo e DPA | OpenAI já é subprocessadora (V-02), com DPA por aceite; **retenção zero ainda não está contratada**. Provedor alternativo entra pelo mesmo checklist (§7) |
| Transferência internacional | Envio aos EUA depende de hipótese legal mais mecanismo válido (Res. CD/ANPD 19/2024, art. 9º). **O mecanismo não está demonstrado hoje para nenhum fornecedor de IA**, e a voz amplia o volume (§8) |

## 1. O que o guia trata

| Dado | Origem | Observação |
|---|---|---|
| Fala do aplicante (áudio) | Microfone, enviado em fluxo ao provedor | A voz identifica a pessoa; capta ruído e terceiros no ambiente |
| Transcrição | Gerada pelo provedor | Pode conter o que o aplicante disser além das opções: nomes de colegas, de clientes, de sistemas |
| Resposta estruturada | Opção escolhida no grafo de triagem | É o que alimenta a trilha e o "porquê" |
| Estado da trilha | Fase, passos, entregáveis | Lido pelo agente como contexto |
| Metadados | Usuário, tenant, horário, sessão | Dado pessoal do usuário logado |

**Quem é o titular:** o **aplicante**, usuário do cliente com conta e sessão. É diferente do respondente externo do Meridian: o aplicante **tem** caminho de pedido pela aplicação, que exige `User.id` e `processErasureRequest` (`lib/jobs/lgpd-erasure.ts`). A lacuna de canal do respondente externo não se repete aqui. A do **terceiro citado na conversa** (um colega, um contato do cliente) sim: essa pessoa não sabe que foi mencionada. Por isso a transcrição bruta não deve ser guardada (§5).

**Voz não é dado sensível por si só.** O art. 5º, II da LGPD trata como sensível o dado biométrico quando vinculado a pessoa natural. Fala transcrita em texto não é. Passa a ser se o sistema **identificar ou autenticar** a pessoa pela voz, ou inferir emoção ou saúde. A condição é proibir isso (§9).

## 2. Papéis

- **Com cliente:** Nebuloz operadora, cliente controlador, como o DPA §1 já descreve para os produtos contratados (a tabela do §2 lista o Scaffold). **Atenção:** a decisão do CEO de 2026-09-29 foi "operadora **só no Meridian**, por ora". Para o Scaffold adoto a mesma premissa por coerência com o DPA, **a confirmar pelo CEO**. Sem ela, o degrau 2 fica sem enquadramento.
- **Nos testes internos:** a Nebuloz, no tenant dela, é controladora. Quem decide a finalidade é ela.
- **A Nebuloz vira controladora** se usar fala, transcrição ou respostas para melhorar o guia, avaliar modelo ou demonstrar. Isso é proibido pela decisão do CEO de 2026-09-29 (conteúdo de cliente não serve a demonstração, ajuste de prompt nem avaliação de modelo) e deve valer também para o guia.

## 3. Base legal

**A escolha está em duas camadas.**

**Camada 1: a triagem em si** (texto ou voz), a resposta estruturada e o estado da trilha. É parte de prestar o Scaffold: execução de contrato (art. 7º, V) ou legítimo interesse do cliente (art. 7º, IX) de aplicar a trilha com quem o contratou. Base do controlador, não da Nebuloz.

**Camada 2: o modo de voz.** O meio (voz em vez de texto) não muda a finalidade, mas muda o risco: a voz identifica, o ambiente pode ter outras pessoas e o áudio vai a um terceiro. Recomendo:
- **Opt-in por sessão ou por usuário**, com registro (quem, quando, versão do aviso). Serve de aviso e de escolha, e garante que o texto continua disponível sem perda.
- **Nos testes com a própria equipe:** legítimo interesse (art. 7º, IX) com aviso e direito de recusar sem consequência. **Não uso consentimento como base para colaborador**: o desequilíbrio de poder enfraquece o consentimento do empregado (hipótese minha, sem consulta de fonte).
- **Com pessoa de fora da equipe em teste:** consentimento específico (art. 7º, I), porque a Nebuloz é controladora e não há contrato nem relação de trabalho.
- **Com cliente:** a base é a do cliente; o opt-in por usuário continua sendo a garantia de transparência.

**Dado sensível incidental:** se o aplicante disser, sem ser perguntado, algo sobre saúde, religião ou orientação política, o tratamento de sensível não tem base prevista. A resposta é de desenho: o agente **não pergunta** dado pessoal (as perguntas do briefing são sobre banco, tipo de dado e centralização), e a transcrição **não é persistida**. Sem persistir, o dado incidental sai do alcance do tratamento da Nebuloz, embora o provedor o veja em trânsito (§7).

## 4. Aviso

Elementos que o aviso precisa ter (LGPD, art. 9º):

1. **Que a conversa é com uma IA**, não com uma pessoa.
2. **Quem trata:** a organização do usuário é a controladora; a Nebuloz é operadora. (Nos testes internos: a Nebuloz é a controladora.)
3. **Para quê:** conduzir a triagem da trilha e registrar a resposta escolhida.
4. **Em voz:** que a fala é enviada a um provedor de IA, **nos Estados Unidos**, e o nome dele; que **o áudio não é gravado pela Nebuloz**; se a transcrição é guardada ou não; **que o provedor pode reter até 30 dias**, enquanto a retenção zero não estiver contratada.
5. **Como trocar para texto** a qualquer momento, sem perder o progresso.
6. **Pedir aos participantes que não digam dado pessoal de terceiros**, e que usem ambiente sem outras pessoas ou fone.
7. **Canal:** `privacy@nebuloz.com`.

**Momento:** em texto, antes da primeira vez em que o microfone é ativado, com um ato de aceite que fica no `AuditLog` (usuário, hora, versão do aviso). Durante a fala, indicador visível de microfone ativo. O aviso em texto na tela do guia diz apenas os itens 1 a 3 e 5.

**Texto proposto (modo de voz, primeira ativação):**

> Você vai conversar com uma IA, por voz. O que você falar é enviado ao [provedor], nos Estados Unidos, que transcreve e gera a resposta. A [organização] decide para que isso é usado; a Nebuloz opera a plataforma por conta dela. **Não gravamos o seu áudio** e [não guardamos / guardamos por 30 dias] a transcrição; guardamos apenas a opção que você escolher, no registro da trilha. O provedor pode manter o conteúdo por até [30 dias] para segurança. Não cite nome nem dado de outras pessoas. Você pode voltar ao texto a qualquer momento. Dúvidas ou pedidos: privacy@nebuloz.com. [Usar voz] [Continuar em texto]

## 5. Gravar o áudio é necessário?

**Não.** A recomendação, em ordem de preferência por minimização (art. 6º, III):

1. **Áudio: não persistir.** O áudio segue em fluxo para o provedor e não é gravado pelo nosso lado (nenhum armazenamento no bucket, nenhum upload de gravação do navegador).
2. **Transcrição: não persistir por padrão.** O grafo usa opções fechadas; a resposta estruturada basta para o "porquê" da trilha (briefing, "Respostas ficam registradas na trilha do cliente").
3. **Transcrição, se um dia precisar** (depuração, qualidade do guia no piloto): **opt-in separado**, retenção de 30 dias, sem nome do usuário na linha, cobertura na eliminação de titular (§6) e **sem envio do conteúdo à observabilidade** (Langfuse com captura de conteúdo desligada, como o DPA §3 exige).
4. **O guia não decide por si:** a resposta de triagem não aprova entregável (invariante do briefing). Isso também reduz o risco de decisão automatizada sobre o titular (art. 20).

**Consequência honesta:** "não gravamos o áudio" só é verdade para o **nosso lado**. O provedor, por padrão, guarda registros de monitoramento de abuso (ver §7). O aviso precisa dizer isso, sem prometer retenção zero que não foi contratada (a mesma lição do erro da policy anterior, `lgpd-ropa-e-lacunas.md` §2.4).

## 6. Retenção

| Dado | Retenção proposta | Base da proposta |
|---|---|---|
| Áudio | **Não persiste** | §5 |
| Transcrição | **Não persiste por padrão**; se persistir, 30 dias | §5 |
| Resposta estruturada (opção escolhida) | Duração do contrato + 30 dias, como a execução de portfólio (RoPA, finalidade 4) | É dado do cliente na trilha dele |
| Registro de aceite do modo de voz | Como o `AuditLog` (trilha imutável, 12 meses na finalidade 3 do RoPA) | Prova do aviso |
| Logs técnicos (observabilidade, erros) | Sem conteúdo de conversa | DPA §3 |
| No provedor | Até 30 dias por padrão; zero se a retenção zero for aprovada | §7 |

**Eliminação de titular:** o aplicante usa o fluxo existente. Qualquer **tabela nova** de transcrição ou de sessão do guia precisa entrar em `processErasureRequest` (`apps/app/lib/jobs/lgpd-erasure.ts`) antes de existir dado real. A resposta estruturada não é apagada junto com o titular: é dado do cliente na trilha, e a eliminação só anonimiza o nome (mesma regra da resposta do respondente no Meridian, `lgpd-ropa-e-lacunas.md` §5).

**Linha proposta para o RoPA** (entra quando o degrau 1 for ao ar):

| # | Finalidade | Dado pessoal | Titular | Base legal | Retenção |
|---|---|---|---|---|---|
| 11 | Guia conversacional do Scaffold (texto e voz) | resposta estruturada; transcrição apenas se opt-in; aceite do modo de voz; metadados de sessão; **áudio não persiste** | Usuário do cliente (aplicante) | Base do cliente (execução de contrato ou legítimo interesse), Nebuloz operadora; no tenant da Nebuloz, legítimo interesse, e consentimento para pessoa de fora | Resposta: contrato + 30 dias; transcrição (se houver): 30 dias; áudio: não persiste |

## 7. Operador externo e DPA

### 7.1 OpenAI (Realtime)

- **Já é subprocessadora**: V-02 de `dpa-fornecedores.md` (DPA versão 010126, por aceite de uso) e linha no DPA modelo §5 (rota secundária de modelo de linguagem), ainda com a coluna de salvaguarda em aberto. O DPA cobre a API; **o tratamento de áudio é uma categoria nova**, que precisa entrar no inventário e no texto do DPA §2.
- **Treino:** dado enviado à API não é usado para treinar modelos por padrão (V-02, citando a OpenAI).
- **Retenção:** por padrão, registros de monitoramento de abuso são guardados **até 30 dias**; retenção zero e monitoramento modificado existem, **sob aprovação prévia da OpenAI** (V-02). Segundo a busca de hoje, o Realtime é **elegível** a retenção zero e, no padrão, guarda 30 dias para monitoramento de abuso e nenhum estado de aplicação; **confirme na página oficial** (`developers.openai.com/api/docs/guides/your-data`), porque a busca é fonte secundária. Há região de dados na Europa; não sei de região no Brasil.
- **O que exigir do lado da OpenAI antes do degrau 2:**
  1. Projeto dedicado à voz (separa o fluxo e permite configurar região e retenção só nele).
  2. Pedir **retenção zero** (ou monitoramento modificado). Se negada, o aviso declara os 30 dias e o degrau 2 só prossegue com a aceitação do jurídico.
  3. Sem armazenamento de conversa do lado do provedor, sem recurso de "memória" e sem compartilhamento de dado para melhorar modelos.
  4. Conferir a lista de subprocessadores da OpenAI (V-02, coluna "lista").
  5. **Nenhuma** identificação por voz, clonagem de voz ou inferência de emoção.

### 7.2 Provedor alternativo (o nome "Abinit" e o ElevenLabs citado)

**Não consigo avaliar o que não identifiquei.** Não recomendo nem veto: aplico o mesmo checklist a qualquer provedor que o CEO escolher com a pesquisa do Radar. Por desenho, pipeline **encadeado** (transcrição, modelo de linguagem e síntese de voz em provedores diferentes) **multiplica os subprocessadores** e os pontos de retenção; o Realtime concentra num provedor já listado. Isso pesa a favor do Realtime do ponto de vista de minimização; o custo é decisão do CEO.

**Checklist para qualquer provedor de voz** (vira linha nova em `dpa-fornecedores.md`):
1. DPA assinado ou aceito, com texto lido.
2. Sem uso de áudio, transcrição ou voz para treino ou melhoria de produto.
3. Retenção de áudio e de transcrição, e retenção zero disponível e contratada.
4. Localização do processamento e região.
5. Subprocessadores do provedor.
6. Mecanismo de transferência internacional (§8).
7. Recursos de biometria de voz, clonagem ou identificação do falante: desligados e vedados por contrato.
8. Em qual lista de subprocessadores da Nebuloz entra, e o **aviso de 30 dias ao cliente** antes do primeiro uso com dado dele (DPA §5.1).

## 8. Transferência internacional

Provedores de voz e de modelo de linguagem processam nos EUA. Pelo **art. 9º da Resolução CD/ANPD nº 19/2024** (texto lido no site da ANPD), a transferência internacional "somente poderá ser realizada para atender a propósitos legítimos, específicos, explícitos e informados ao titular" e "desde que amparada em" **(I)** uma hipótese legal dos arts. 7º ou 11 da LGPD **e (II)** um dos mecanismos: decisão de adequação da ANPD; cláusulas-padrão contratuais, normas corporativas globais ou cláusulas contratuais específicas; ou as hipóteses dos incisos II, "d", e III a IX do art. 33 da LGPD (entre elas, o consentimento específico e em destaque). O parágrafo único exige limitar a transferência "ao mínimo necessário".

- **Cláusulas-padrão da ANPD (art. 15 e art. 16):** o art. 16 condiciona a validade à "adoção integral e sem alteração do texto disponibilizado no Anexo II". Cláusulas de outra origem, como as do fornecedor, não atendem por si.
- **A situação hoje:** `dpa-fornecedores.md` anota "SCCs" na coluna de transferência dos fornecedores, aceitas por aceite do DPA do próprio fornecedor. São as cláusulas dele, que em geral seguem modelos da União Europeia e do Reino Unido; **não vi demonstração** de que a Nebuloz adotou o Anexo II da ANPD com nenhum fornecedor. O DPA modelo §6 já deixa o mecanismo como `[[DADO NECESSÁRIO]]`. O jurídico confirma se o aceite do fornecedor basta ou se exige aditivo com o Anexo II.
- **Não conheço decisão de adequação da ANPD para os EUA.** Conferir; se não existir, a via é cláusulas-padrão ou o art. 33.
- **Consentimento específico como mecanismo** (art. 33, VIII) existe, mas **não recomendo como via principal**: o consentimento do empregado é frágil, e a operadora não deve apoiar a transferência de dado do cliente em consentimento que ela colheu. Serve como reforço, no opt-in do §3.
- **A voz não cria o problema; amplia.** O mesmo gap vale para o modelo de linguagem hoje. O que a voz muda é o volume e a natureza do dado (áudio), e o fato de o titular ser pessoa natural que fala.
- **Prazo de adequação dos contratos existentes à Resolução 19/2024:** não verifiquei o texto transitório nesta sessão; o jurídico confere.

## 9. Condições

**9.0 Degrau 0 (só texto).** Sem gravação; opções fechadas; resposta estruturada no registro da trilha; conteúdo não vai à observabilidade; o agente não pergunta dado pessoal; o guia não aprova entregável.

**9.1 Degrau 1 (voz, equipe da Nebuloz, tenant da Nebuloz).**
1. Aviso do §4 e aceite registrado no `AuditLog`; botão para voltar ao texto; indicador de microfone ativo.
2. Áudio e transcrição **não persistem**. Sem upload de gravação do navegador.
3. Projeto OpenAI dedicado; retenção zero **solicitada**. Se não aprovada, o aviso declara "até 30 dias" e o degrau 1 segue.
4. Sem identificação por voz, clonagem ou inferência de emoção.
5. Conteúdo da conversa fora da observabilidade (Langfuse com captura desligada).
6. Linha 11 no RoPA (§6) antes de subir.
7. Participantes cientes por escrito de que estão em teste; recusa sem consequência.

**9.2 Degrau 2 (pessoa de fora da equipe ou cliente).** Tudo do 9.1 mais:
1. **Mecanismo de transferência internacional resolvido** com o jurídico (§8).
2. Retenção zero **aprovada**, ou aceitação do jurídico por escrito da retenção de 30 dias do provedor, refletida no aviso ao cliente.
3. DPA do provedor lido e registrado em `dpa-fornecedores.md` (checklist do §7.2), incluindo o **provedor escolhido pelo CEO** se não for a OpenAI.
4. **Aviso de 30 dias ao cliente** antes do primeiro uso com dado dele (DPA §5.1), com a inclusão de áudio na tabela do §2 do DPA.
5. Decisão do CEO confirmando a operadora também para o Scaffold (§2).
6. Cobertura da eliminação de titular para qualquer tabela nova (§6).
7. Consentimento específico por escrito, por pessoa de fora da equipe, no teste em que a Nebuloz é controladora.
8. Novo parecer meu antes de subir, curto, sobre o desenho implementado.

## 10. O que este parecer não cobre

- O grafo de triagem e o conteúdo das recomendações: não tratam dado pessoal.
- O custo e a escolha do provedor: do CEO, com o Radar.
- A implementação: não li código. Os requisitos de desenho acima são condições, não revisão de código.
- Fatos que só o fornecedor confirma: retenção zero aprovada, região e lista de subprocessadores. Marquei como condição, não como fato.

## Decisões

- 2026-09-30 — Compliance/DPO: parecer **OK com condições**, em três degraus (texto, voz interna, voz com pessoa de fora ou cliente). O degrau 2 **bloqueia** até o mecanismo de transferência internacional, a retenção do provedor e o aviso de 30 dias estarem resolvidos.
- 2026-09-30 — Compliance/DPO: **áudio não persiste; transcrição não persiste por padrão.** O registro do "porquê" da trilha é a resposta estruturada.
