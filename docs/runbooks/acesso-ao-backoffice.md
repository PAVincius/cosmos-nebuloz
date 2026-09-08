# Runbook: dar (e tirar) acesso ao back-office

## Leia isto primeiro

**Cada pessoa tem a própria conta.** Não existe "a conta admin" para dividir, e
dividir uma seria pior do que parece:

- **A auditoria mente.** Todo evento do painel grava o ator. Duas pessoas no
  mesmo login viram um ator só, e a trilha deixa de responder quem fez o quê —
  que é a única pergunta para a qual ela existe.
- **O segundo fator trava.** O painel exige autenticador, e ele fica no celular
  de uma pessoa. A segunda passa a depender da primeira para cada login.
- **Não dá para revogar.** Tirar o acesso de alguém vira trocar a senha de
  todos.

O que se compartilha é o **papel**, não a credencial. Duas contas, ambas ADMIN,
enxergam e fazem exatamente a mesma coisa.

## O modelo

Ser da equipe da Nebuloz é ter uma linha em `TenantMember` com
`tenantId = 'system'`. O papel decide o alcance:

| papel | no painel |
|---|---|
| `ADMIN` | lê e escreve |
| `MEMBER` | somente leitura — o selo na topbar avisa e os botões vêm desabilitados |

Isso é separado do acesso ao produto: ser staff **não** dá acesso a nenhum
tenant de cliente, e ser membro de um cliente não dá acesso ao painel.

## Conceder

1. **A pessoa cria a própria conta** em `/sign-up` do app do ambiente
   (produção: `app.nebuloz.ai`). Ela escolhe a própria senha — quem concede o
   acesso nunca vê nem digita essa senha.

2. **Rode o script** `packages/database/scripts/grant-staff-admin.sql`,
   trocando e-mail e papel no bloco de parâmetros, no SQL editor do banco do
   ambiente certo. Ele é idempotente e não apaga nada; se a conta não existir,
   para com erro em vez de criar uma.

3. **A pessoa cadastra o autenticador** em `backoffice.nebuloz.ai/seguranca`.
   O painel exige segundo fator — sem ele o portão barra, com um botão que leva
   direto ao cadastro.

O script termina listando quem tem acesso, com a coluna `twoFactorEnabled`:
quem aparecer com `false` ainda não completou o passo 3.

## Revogar

O `DELETE` está comentado no fim do mesmo script.

**Revogar não derruba a sessão aberta na hora.** O cache de sessão do
better-auth vale 60 segundos, então o acesso cai no minuto seguinte. Para
desligamento comum isso basta. Para **conta comprometida**, apague também as
linhas de `Session` da pessoa: aí o problema não é a permissão, é o cookie na
mão de outra pessoa.

## Dívidas conhecidas

- **Não há tela para isso.** Conceder acesso é SQL em editor, e quem opera
  precisa de credencial de banco. Uma tela de equipe no próprio painel
  resolveria — e deixaria a concessão auditada, que hoje ela não é.
- **`grant-admin-vinicius-dev.sql` tem uma senha em texto puro** num comentário
  versionado, junto do hash. É de ambiente de dev, mas a senha vaza igual e
  provavelmente se repete em outro lugar. Trocar essa senha e limpar o arquivo
  é trabalho separado, e vale fazer.
