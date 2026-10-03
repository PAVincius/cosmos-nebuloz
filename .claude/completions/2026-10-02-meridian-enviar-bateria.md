# Meridian: "Enviar respostas" que não completa depois de anexar (atrito A5)

Branch `fix/meridian-enviar-bateria`, a partir de github/main. Dogfood de produção (QA, 02/10, AS-002): em 2 baterias (fundadores de Governance e de Infrastructure) o Enviar não completou, sem erro visível; o respondente ficou "Convidado, 0 de 3" e só completou na 2ª ou 3ª tentativa, reanexando a evidência a cada vez.

## Causa
Hipótese forte, sustentada pelos logs de produção; **não reproduzida em navegador real**, só em teste.
- O formulário tinha um `busy` único. Durante o upload do anexo, "Enviar respostas" e "Salvar" ficavam `disabled`. Clicar em Enviar logo depois de anexar caía num botão morto, sem mensagem.
- Logs da Vercel (projeto cosmos-nebuloz-app, 02/10 23:02–23:08Z): nos ciclos que falharam (tokens 11aa26…, c4121f…, 6fc15c…) há um único POST depois do GET da página (o anexo) e nenhum `saveDraft`/`submitBattery`. Os ciclos que completaram têm 2 a 3 POSTs. Sem erro de runtime nessa rota no período, então não foi exceção do servidor.
- Sem estado persistente de resultado: sucesso e falha só apareciam num toast de poucos segundos. Sem saber se tinha enviado, o QA refez o fluxo inteiro; a evidência foi anexada de novo e o `submitBattery` repetido não era idempotente.
- Agravante: server action que lança (rede, deploy trocado) deixava o toast de "loading" na tela para sempre e a chamada rejeitava sem tratamento.

## Correção
- `respondent-form.tsx`: `saving`/`uploading` separados. O envio **espera** os anexos em andamento em vez de perder o clique, e a tela diz "Anexando evidência — o envio segue assim que o anexo terminar". Recusa e falha (salvar, anexar, enviar) aparecem num aviso `role="alert"` ao lado do botão. Pergunta em branco: aviso permanente e as perguntas sem resposta ficam marcadas em vermelho. Concluída: faixa "Bateria concluída" que permanece, some o botão de enviar, e quem volta ao link depois de concluir vê o mesmo estado.
- Anexo repetido: o mesmo nome de arquivo na mesma pergunta não anexa de novo; avisa na tela.
- `use-action-toast.ts`: ação que lança vira toast de erro (no mesmo id) e `Result` de falha, em vez de loading eterno.
- `submitBattery`: bateria já concluída devolve concluído sem gravar nem auditar de novo (idempotente).

## Verificação
- Testes novos vermelhos antes, verdes depois: `__tests__/screens/meridian-respondent-envio.test.tsx` (9, incluindo o clique em Enviar durante o upload), 1 em `use-action-toast.test.ts`, 1 em `respondent.test.ts`.
- `vitest` de `__tests__/meridian`, `screens`, `components` e `lib`: 1104 passando; biome limpo; `tsc` sem erro nos arquivos tocados.

## Não verificado
- Reprodução em navegador real e em produção. Vale o QA refazer o fluxo (anexar e clicar em Enviar logo em seguida) depois do deploy.
- Evidência já duplicada em produção (Governance 2x, Infrastructure 3x) continua lá; apagar é escrita em produção e fica com o dono.
