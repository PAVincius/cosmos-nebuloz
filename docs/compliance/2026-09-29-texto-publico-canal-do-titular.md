# Texto público do canal do titular — pronto para publicar

- **Data:** 2026-09-29
- **Onde vai:** `/legal/privacy` (rota estática em `apps/web/app/[locale]/legal/privacy/page.tsx`; o texto vem do dicionário `web.legal.privacy` em `packages/internationalization/dictionaries/`). Quem publica é quem mexe no site (Norte decide, Bussola ou o dono do site implementa); código não é da minha mesa.
- **Origem:** `operadora-controladora.md` §4, com duas correções desta versão: (1) o prazo e o repasse passam a citar o que o DPA v1.2 promete, e (2) não prometo eliminação automática.
- **Falta só:** `{{E-MAIL DO CANAL}}` e `{{NOME DO ENCARREGADO}}`. Decisão do CEO (memo `2026-09-29-memo-ceo-operadora-controladora-meridian.md` §4, itens 2 e 3). Hoje a política interna cita `privacy@nebuloz.com`, mas não conferi que a caixa existe e é lida; **não publique o endereço antes de alguém confirmar que ele recebe e que há dono para lê-lo.**
- **Enquadramento:** o texto pressupõe a opção A do memo (Nebuloz operadora). Se o CEO escolher B, este texto muda inteiro.

---

## Texto (português)

### Se seus dados chegaram até nós por uma organização

Você pode ter respondido a um diagnóstico por um link que recebeu, ou participado de uma reunião gravada e transcrita numa organização que usa os produtos da Nebuloz. Nesses casos, quem decidiu coletar seus dados, para quê e por quanto tempo foi **essa organização**, não a Nebuloz. Ela é a controladora; nós tratamos os dados em nome dela, como operadora, nos termos da Lei 13.709/2018 (LGPD).

**Como pedir.** Para pedir confirmação de que tratamos seus dados, acesso, correção, eliminação, portabilidade ou revogação de consentimento, procure a organização que convidou você ou que conduziu a reunião. É ela quem decide o pedido.

**Se preferir escrever para nós.** Escreva para **{{E-MAIL DO CANAL}}**. Em até **5 dias úteis** encaminhamos o seu pedido à organização responsável e avisamos você de que o encaminhamos e para quem. Não decidimos o mérito do pedido, porque essa decisão não é nossa. Para agilizar, informe o seu nome, o e-mail com que foi convidado ou participou, e o nome da organização.

**O que fazemos por instrução da organização.** Quando a organização decide atender o pedido, executamos a eliminação ou a anonimização dos seus dados na plataforma, e podemos gerar uma cópia para portabilidade. Cópias de segurança automáticas da nossa infraestrutura são sobrescritas conforme o ciclo de retenção do provedor, e por isso podem existir por um período depois da eliminação; se o seu pedido for atendido, informaremos a data até a qual isso pode ocorrer.

**Quando a Nebuloz é a controladora.** Há tratamentos em que nós decidimos a finalidade: a operação do nosso site, os registros de segurança da plataforma e o nosso contato comercial. Para esses, o pedido vem direto para nós e nós respondemos, pelo mesmo endereço.

**Encarregado pelo tratamento de dados pessoais:** {{NOME DO ENCARREGADO}}, {{E-MAIL DO CANAL}}.

Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).

---

## O que conferir antes de publicar

| Item | Por quê | Quem |
|---|---|---|
| A caixa `{{E-MAIL DO CANAL}}` existe, recebe e tem dono para ler em 1 dia útil | O texto promete 5 dias úteis; caixa sem dono é promessa falsa (art. 9º da LGPD) | Ordem (dono do SLA, se aceitar; ver memo §5 c) |
| O playbook `2026-09-29-playbook-pedido-do-titular.md` está no ar antes do texto | Publicar o canal antes do procedimento cria o primeiro pedido sem caminho | Lacre |
| Nenhuma frase do texto promete prazo de 90 dias ou eliminação automática | O job de retenção só é compromisso depois de verificado em produção (DPA §10.2) | Lacre |
| O endereço bate com o DPA §9.1 e com o aviso na tela do respondente | Três lugares dizendo o mesmo | Bussola |
| A data de "última atualização" da página muda | Auditor pergunta | Quem publica |

## Decisões

- 2026-09-29 — Compliance/DPO: o texto público não cita 90 dias nem eliminação automática, porque o mecanismo não está verificado em produção. Quando a condição 2 do relatório de prontidão fechar, o texto pode ganhar a frase de retenção.
