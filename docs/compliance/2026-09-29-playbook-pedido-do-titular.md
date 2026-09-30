# Playbook — pedido de titular sem conta (uma página)

**Vale para:** respondente do Meridian que escreve para a Nebuloz. Enquadramento: Nebuloz operadora, cliente controlador (**decisão do CEO, 2026-09-29, só para o Meridian**; memo `2026-09-29-memo-ceo-operadora-controladora-meridian.md`). **Pedido de participante de reunião gravada não segue este playbook:** o enquadramento de reunião está em decisão separada; enquanto não sair, o pedido vai ao CEO no mesmo dia, sem repasse nem resposta de mérito.
**Prazos:** repasse ao cliente em **5 dias úteis** do recebimento (DPA §9.2). Titular recebe resposta ao cliente dentro de **15 dias úteis** (prazo da policy 05). Estes prazos valem por procedimento manual (DPA §10.2).
**Papéis (decisão do CEO, 2026-09-29):** *Dono do SLA* = **Ordem**. *Redige* = Lacre. *Envia* = Ordem, **depois** da delegação escrita do CEO (ainda a escrever; sem ela, quem envia é o CEO). *Audita o prazo* = Lacre. *Executa a eliminação técnica* = Pilar, com "vai" do CEO por operação em produção. *Executa a eliminação técnica* = Pilar, com "vai" do CEO por operação em produção.

| # | Passo | Quem | Quando |
|---|---|---|---|
| 1 | Pedido chega em `privacy@nebuloz.com`. Abrir registro (planilha ou nota em `docs/compliance/`, sem colar o conteúdo do dado pessoal, só nome, e-mail, data, tipo, organização) e **marcar a data de recebimento**: o relógio corre de aqui | Lacre | dia 0 |
| 2 | Classificar: (a) dado tratado em nome de cliente → segue; (b) dado em que a Nebuloz é controladora (site, segurança, comercial) → Nebuloz responde, sair deste playbook; (c) não achei o titular ou a organização → pedir esclarecimento **sem confirmar nem negar** que os dados existem | Lacre | até dia 1 |
| 3 | Identificar a organização: por e-mail do titular em `MeridianRespondent` / `MeetingParticipant`, ou pelo nome que ele informou. Quem tem leitura em produção consulta; sem credencial, Lacre pede a quem tem. **Nunca deduzir a organização.** | Lacre → Pilar | até dia 1 |
| 4 | Redigir dois textos: **repasse ao cliente** (quem pediu, o quê, prazo legal, a instrução que se pede, o que a Nebuloz pode executar, DPA §9.2) e **aviso ao titular** ("encaminhamos seu pedido à [organização] em [data]; ela decide o pedido"). Nenhum dos dois decide o mérito | Lacre | até dia 2 |
| 5 | **Enviar** os dois. Registrar data e hora | quem o CEO delegou | até dia 5 (ideal: dia 2) |
| 6 | Cliente responde com instrução: executar eliminação/anonimização, gerar export, ou negar. **Sem instrução escrita, a Nebuloz não executa** (DPA §3.1). Se o DPA tiver §9.3 (provisória, a confirmar pelo CEO) e passaram 10 dias úteis sem resposta, executa conforme a §9.3, **depois de avisar o Cliente de novo no 8º dia útil** (o primeiro aviso é o repasse do passo 5) | Cliente → Ordem | conforme resposta |
| 7 | Execução técnica de eliminação (respondente ou participante externo): hoje **não há gatilho fora de sessão** (`lgpd-ropa-e-lacunas.md` §4 e §5). Pilar executa SQL manual sobre `MeridianRespondent` / `MeetingParticipant` (anonimiza nome, e-mail e cargo; invalida o token; apaga objeto do bucket) e, se o backup do reset ainda existir, aplica também `2026-09-29-roteiro-fechamento-backup-reset-meridian.md` passo 4 | Pilar, com "vai" do CEO | até 5 dias úteis da instrução |
| 8 | Confirmar ao titular por escrito o que foi feito, **com a data efetiva de eliminação total** quando houver cópia de plataforma (janela do Supabase, roteiro do backup, passo 1). Nunca "eliminado de todos os lugares" antes dessa data | Lacre redige; quem o CEO delegou envia | após o passo 7 |
| 9 | Fechar o registro: datas de cada passo, quem decidiu, o que foi executado. Registrar a execução na trilha só com identificador, sem nome do titular (o parecer de 2026-09-29 sobre o reset mostrou que o `AuditLog` já retém nomes em `actorName` e `target`) | Lacre | dia da confirmação |

## Regras que não mudam

1. **A Nebuloz não decide o mérito** de pedido sobre dado tratado em nome do cliente. Encaminha e executa sob instrução.
2. **Não confirmar nem negar** ao titular que uma pessoa é respondente antes de identificar a organização e o pedido ser repassado (evita servir de oráculo).
3. **Só afirmar estado de produção depois de ver** no lugar (banco, painel). Sem credencial, pedir a quem tem.
4. **Nada de dado pessoal do titular** em canal de chat ou e-mail interno: só identificador e data.
5. **Estourou o prazo de 5 dias úteis?** Avisar o CEO no mesmo dia. Atraso é registrado no passo 9, não escondido.

## Para o RACI do playbook de vendas (§4, coluna Meridian)

`docs/comercial/playbook-de-vendas.md` não é da minha mesa (Compliance escreve em `docs/compliance/`), então **não editei o RACI**. Linha pronta para quem for o dono daquele arquivo colar, conforme a decisão do CEO de 2026-09-29:

| Papel | Meridian |
|---|---|
| **Dono do SLA** | **Ordem** (prazo de 5 dias úteis do repasse de pedido de titular; envio por delegação escrita do CEO). Os demais itens do SLA do Meridian seguem em branco |

A regra 1 do §4 (Dono do SLA ≠ quem entrega) fica preenchida enquanto Ordem não entregar o Meridian.

## O que este playbook não resolve

- Enquanto o Inngest de produção não estiver verificado, `processErasureRequest` não roda: o passo 7 é sempre manual (condição 2 do relatório de prontidão do Meridian).
- O canal para o respondente pedir dentro do produto (sem depender de e-mail) é a condição 11: `2026-09-29-requisito-canal-eliminacao-respondente-externo.md`.
- O e-mail do canal e o encarregado ainda não foram decididos (memo §4, itens 2 e 3).
