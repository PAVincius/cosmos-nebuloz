# ADR-0004 — Seletor de persona do protótipo não vai para produção

**Status**: Accepted · **lacuna de spec**
**Data**: 2026-07-28
**Contexto de origem**: `charter-shell.jsx` (`PersonaSwitcher`) vs `SRD-Charter.md` §Personas

## Contexto

O protótipo tem um seletor no topbar que troca a persona ativa entre Marina
(Compliance), Diego (CISO), Ana (People Ops) e Rafael (AI Program Lead). O
`SRD-Charter.md` descreve o comportamento com ênfase:

> O seletor de persona no topbar troca a matriz de permissões aplicada — não é
> filtro de dado, é *default deny* de verdade: ação sem grant fica desabilitada
> com motivo no tooltip.

**A lacuna**: o SRD descreve o dispositivo como se fosse requisito de produto,
mas em produção o papel vem da sessão autenticada. Um controle que deixa o
usuário escolher a própria matriz de permissões é escalada de privilégio — o
oposto do que o parágrafo diz querer.

Nenhum documento marca o seletor como artefato de demonstração. Fica ambíguo se
o requisito é "trocar de papel" ou "ver o efeito de um papel".

## Decisão

**O seletor não existe em produção.** O papel vem de `CharterMembership` via
sessão (ADR-0002) e não é escolhível pelo usuário.

O que sobrevive da ideia é o **efeito**, que é o que o SRD de fato pede:

- O papel de governança fica **sempre visível** no rodapé da sidebar, ao lado do
  nome — é o que explica por que um botão está desabilitado.
- Ação sem grant renderiza `disabled` **com o motivo no `title`**, via
  `GatedButton` + `denialReason()`: "Requer papel Compliance ou Segurança —
  Decidir caso de uso".
- O servidor recusa com `403` independentemente do que a UI mostre.

Trocar o papel de alguém é ação de Configurações → Membros, exige papel
`COMPLIANCE`, e grava auditoria.

## Alternativas consideradas

**Portar o seletor como está.** Rejeitada: escalada de privilégio.

**Seletor como "modo pré-visualização" — vê a UI como outro papel, mas o
servidor continua recusando.** Tem valor real de treinamento e de demonstração
comercial. Rejeitada para o V1 por dois motivos: duplica o cálculo de permissão
(um efetivo, um simulado), e num produto de auditoria a diferença entre "estou
vendo como Auditor" e "sou Auditor" precisa ser inequívoca na tela — desenho que
não cabe no escopo atual.

**Manter o seletor apenas em ambiente de demonstração, atrás de flag.**
Rejeitada: código de bypass de permissão vivendo no mesmo bundle da checagem de
permissão, ligado por variável de ambiente. É a categoria de coisa que vaza.

## Consequências

- A demo comercial não consegue alternar papéis com um clique. Para mostrar as
  quatro personas é preciso quatro usuários semeados — o que o seed faz
  (Marina/COMPLIANCE, Diego/SECURITY, Ana/HR, Rafael/REQUESTER).
- O comportamento de "default deny visível" fica testável de verdade: entra na
  matriz, não num estado de UI.
- Se a pré-visualização por papel voltar como requisito, este ADR é substituído,
  não editado.
