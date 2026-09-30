# Aditivo provisório de tratamento de dados pessoais

> **Rascunho pendente de revisão jurídica; para uso só se o DPA revisado
> ([`dpa-modelo.md`](dpa-modelo.md) v1.2) não estiver pronto para o primeiro
> contrato.** Não constitui aconselhamento jurídico. Recomendo, no mínimo, que um
> advogado leia este texto antes de ele ir a um cliente: são poucas cláusulas,
> e a leitura é curta. Itens `[[...]]` são fatos ou decisões que só a Nebuloz
> pode preencher. O mecanismo é o que o Sócio pediu em
> `docs/socio/2026-09-29-lancamento-meridian.md` (R2): o contrato diz por
> escrito que o DPA revisado entra depois, com data, em vez de esconder que ele
> não existe.

**Aditivo ao contrato de prestação de serviços** celebrado entre
[[DADO NECESSÁRIO: razão social da Nebuloz]], CNPJ [[DADO NECESSÁRIO]] ("**Nebuloz**"), e o cliente identificado no contrato principal ("**Cliente**"), em [[DATA DA ASSINATURA]].

## 1. Natureza provisória e datas

1.1. Este aditivo regula o tratamento de dados pessoais até a entrada em vigor do Acordo de Tratamento de Dados Pessoais completo ("**DPA**"), que a Nebuloz se obriga a entregar ao Cliente **até [[DATA: sugestão 2026-11-13, 30 dias depois da primeira assinatura prevista, 2026-10-13; decisão do CEO]]**, revisado por advogado.

1.2. Este aditivo vigora até o **primeiro** destes eventos: (a) assinatura do DPA; (b) **[[DATA: sugestão 2026-11-30]]**. Chegada a data (b) sem DPA assinado, qualquer das partes pode rescindir o contrato quanto ao serviço afetado, sem multa, mediante aviso escrito de 15 dias.

1.3. O DPA, ao entrar em vigor, substitui este aditivo. Nada nele reduz o que este aditivo assegura ao Cliente.

## 2. Papéis

2.1. O Cliente é controlador dos dados pessoais tratados nos produtos contratados, e a Nebuloz é operadora, nos termos do art. 5º, VI e VII, da Lei 13.709/2018.

2.2. O Cliente é controlador também quanto aos dados pessoais de pessoas que não possuem conta na plataforma e cujos dados são coletados por iniciativa dele, em especial os respondentes convidados por link no Meridian. A Nebuloz os trata exclusivamente como operadora e não estabelece relação direta com esses titulares.

2.3. Nos tratamentos em que a Nebuloz decide a finalidade por conta própria (registro de acesso e trilha de auditoria da plataforma, para segurança; operação comercial; dados de seus colaboradores), a Nebuloz é controladora independente e este aditivo não se aplica.

## 3. Instruções

3.1. Constituem instruções documentadas do Cliente, para os fins do art. 39 da Lei 13.709/2018: o contrato principal, este aditivo, e a configuração que o Cliente realiza no produto. A Nebuloz não trata os dados fora dessas instruções e informará o Cliente antes de executar a que entenda violar a lei.

3.2. A Nebuloz não usa dados pessoais do Cliente para treinar modelos de inteligência artificial nem para finalidade própria. [[DADO NECESSÁRIO: só afirmar depois de confirmar com cada provedor de modelo de linguagem, `dpa-modelo.md` §2 e §5]]

3.3. **Benchmark do Meridian desligado.** A função de benchmark do Meridian (`benchmarkOptIn`), que faz respostas comporem um conjunto comparativo entre organizações, **permanece desligada** para o Cliente, e a Nebuloz não contribui nem consulta dados do Cliente para esse conjunto. Ativá-la depende de aditivo próprio, com finalidade, base legal e aviso ao titular específicos, em que a Nebuloz é controladora daquele tratamento.

## 4. Titulares sem conta e prazos

4.1. A Nebuloz mantém canal público para pedidos de titulares, em privacy@nebuloz.com, divulgado em sua Política de Privacidade. Pedido que diga respeito a dados tratados em nome do Cliente é **encaminhado ao Cliente em até 5 (cinco) dias úteis** do recebimento, e o titular é informado do encaminhamento e de a quem foi, na forma do art. 18, § 4º, I. A Nebuloz não decide o mérito.

4.2. A Nebuloz presta ao Cliente a assistência técnica necessária para responder no prazo legal (localização de registros, eliminação ou anonimização, export de portabilidade), mediante instrução escrita dele.

4.3. **Como os prazos são cumpridos.** Os prazos desta cláusula e da cláusula 5 são cumpridos por **procedimento manual, com responsável nomeado**, e valem desde a assinatura. Mecanismos automáticos que a plataforma possua (eliminação programada da evidência 90 dias após o fechamento do diagnóstico; execução automática de pedido de eliminação de titular) **não são compromisso da Nebuloz** até que ela comunique ao Cliente, por escrito, que foram verificados em produção; até lá, a Nebuloz entrega o mesmo resultado por procedimento manual, nos mesmos prazos.

4.4. [[Adotada como provisória em 2026-09-30, **a confirmar pelo CEO**; sem a confirmação, apagar. A Nebuloz avisa o Cliente no encaminhamento e de novo no 8º dia útil, antes de executar.]] O Cliente instrui a Nebuloz a executar o pedido de eliminação de titular sem conta que lhe tenha sido encaminhado, se o Cliente não se manifestar em 10 (dez) dias úteis do encaminhamento, salvo dado que o Cliente informe, no mesmo prazo, ter de reter por obrigação legal ou exercício regular de direitos.

## 5. Encerramento

5.1. Encerrado o contrato, a Nebuloz cessa o tratamento e, em até **30 (trinta) dias**, elimina ou devolve os dados pessoais do Cliente, conforme instrução escrita dele, salvo o que a lei exigir reter. A eliminação alcança os dados de titulares sem conta tratados em nome do Cliente, e a Nebuloz fornece ao final declaração escrita do que foi eliminado, devolvido e retido, com a base de cada retenção.

5.2. Cópias de segurança automáticas da infraestrutura de banco de dados da Nebuloz persistem pela janela de retenção do provedor e não são apagáveis antes dela. A declaração de 5.1 informa a data até a qual isso pode ocorrer. [[DADO NECESSÁRIO: a janela; ver `2026-09-29-roteiro-fechamento-backup-reset-meridian.md`, passo 1]]

## 6. Subprocessadores

6.1. A Nebuloz pode subcontratar o tratamento aos subprocessadores relacionados no DPA quando entregue, e, até lá, na lista que enviar ao Cliente por escrito junto com este aditivo [[DADO NECESSÁRIO: lista atual, com a linha do banco de dados corrigida para Supabase; `dpa-modelo.md` §5]], mediante contrato que lhes imponha obrigações não menos protetivas que as aqui assumidas, e permanece integralmente responsável perante o Cliente pelos atos e omissões deles.

6.2. A inclusão ou substituição de subprocessador é comunicada com **30 (trinta) dias** de antecedência, e o Cliente pode opor-se por motivo fundamentado nesse prazo; mantida a oposição, qualquer das partes pode rescindir o contrato quanto ao serviço afetado, sem multa.

## 7. Incidentes

7.1. A Nebuloz notifica o Cliente sobre incidente de segurança que afete seus dados pessoais em até **72 horas** após tomar conhecimento, com o que souber até então, e complementa conforme apurar. [[DADO NECESSÁRIO: canal e pessoa de contato, dos dois lados]]

7.2. A Nebuloz coopera com o Cliente na apuração e na resposta, fornecendo, no que estiver ao seu alcance, os registros de auditoria pertinentes, a identificação dos titulares afetados (inclusive os sem conta) e as medidas técnicas adotadas. A comunicação à ANPD e aos titulares é decisão e ato do Cliente, como controlador, salvo instrução escrita.

## 8. Segurança e lei aplicável

8.1. A Nebuloz adota as medidas descritas em sua Política de Classificação e Retenção de Dados ([`soc2/policies/05-data-classification-policy.md`](soc2/policies/05-data-classification-policy.md)), e declara a limitação do `dpa-modelo.md` §7 (isolamento entre organizações aplicado pela aplicação; política de banco não é a barreira ativa hoje, ADR-0012).

8.2. Este aditivo é regido pela lei brasileira, em particular pela Lei 13.709/2018. Foro: [[DADO NECESSÁRIO: foro eleito]].

---

## Notas para quem vai assinar (não fazem parte do texto)

| Ponto | Por que está assim |
|---|---|
| Datas 1.1 e 1.2 | A data de entrega do DPA é promessa; se a Nebuloz não a cumprir, o Cliente sai sem multa. O CEO só assina a data que consegue cumprir; o advogado é o gargalo real |
| 3.3 e 4.3 | Vieram das contestações do Sócio (R2). O benchmark ligado faz da Nebuloz controladora; a eliminação automática só é promessa quando existir |
| 4.4 | Só com decisão do CEO |
| Não estão aqui | Auditoria presencial (`dpa-modelo.md` §11), transferência internacional (§6) e a lista de salvaguardas por subprocessador: dependem de confirmação contratual que ainda não existe. **A cláusula de transferência internacional é a que um advogado do cliente vai pedir primeiro**; se o Cliente for corporativo, espere pedido dela |
| Ainda falta antes de assinar | Razão social, CNPJ, canal do titular, canal de incidente, foro, lista de subprocessadores, janela do Supabase |

## Decisões

Aguardando o CEO: datas 1.1 e 1.2, cláusula 4.4, e se o aditivo será usado ou se o DPA revisado chega a tempo.
