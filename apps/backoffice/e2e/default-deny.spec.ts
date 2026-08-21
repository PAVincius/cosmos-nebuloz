import { expect, test } from "@playwright/test";

/**
 * O guard fecha em toda rota do grupo `(staff)`.
 *
 * Este é o spec que dá para escrever hoje sem fixture de sessão, e não é o
 * consolo: é o caminho que mais importa. `requirePlatformStaff` é o único ponto
 * por onde página e RPC passam, e o modo de falhar que ninguém percebe é ele
 * abrir — uma rota nova nascendo fora do grupo `(staff)`, um layout movido, um
 * `redirectToSignIn` que para de lançar. Nada disso quebra teste de unidade,
 * porque cada peça continua correta sozinha.
 *
 * Sessão ausente vira redirect, não mensagem — é o que `resolveStaffAccess`
 * documenta: "ela não vira mensagem, vira redirect".
 */

/**
 * Uma entrada por `page.tsx` do grupo `(staff)`. Lista literal de propósito:
 * rota nova tem que ser acrescentada aqui à mão, e é esse atrito que faz o
 * teste valer. Varrer o diretório em runtime passaria a aprovar sozinha
 * qualquer rota nova, que é exatamente o que se quer impedir.
 *
 * `/clientes` e `/ferramentas` NÃO entram: são diretórios de segmento sem
 * `page.tsx`, então respondem 404 e 404 não redireciona. Acrescentá-los "para
 * completar" deixa o teste vermelho sem nada de errado no guard.
 */
const ROTAS_STAFF = [
  "/",
  "/home",
  "/aprovacoes",
  "/atividade",
  "/audit",
  "/benchmark",
  "/capacidade",
  "/clientes/novo",
  // Rota dinâmica: o slug é inventado de propósito. O guard roda ANTES da busca
  // do tenant, então quem não entrou não descobre quais slugs existem — a
  // resposta é a mesma para cliente real e para cliente que não existe.
  "/clientes/nao-existe-de-proposito",
  "/contas",
  "/delivery",
  "/ferramentas/bpmn",
  "/ferramentas/diagramas",
  "/ip",
  "/observabilidade",
  "/propostas",
  "/servicos",
];

test.describe("sem sessão, o back-office não abre", () => {
  for (const rota of ROTAS_STAFF) {
    test(`${rota} manda para o sign-in`, async ({ page }) => {
      await page.goto(rota);

      // O destino importa mais que o código de status: o que não pode acontecer
      // é a tela renderizar. Um `waitForURL` falha com a URL real na mensagem,
      // que é o que se quer ler quando uma rota escapa do guard.
      await page.waitForURL(/\/sign-in/);
      await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    });
  }

  test("/seguranca também exige sessão, mesmo estando fora do grupo (staff)", async ({
    page,
  }) => {
    // `/seguranca` usa `requirePlatformStaffSemSegundoFator` — a versão sem a
    // checagem de 2FA, que existe porque a tela onde se cadastra o 2FA fica
    // dentro do painel. "Sem a checagem de 2FA" não é "sem guard": sessão e
    // membership continuam obrigatórios, e este teste é o que falha no dia em
    // que alguém confundir as duas coisas.
    await page.goto("/seguranca");
    await page.waitForURL(/\/sign-in/);
  });

  test("o sign-in não redireciona para si mesmo", async ({ page }) => {
    // O grupo `(staff)` existe justamente para deixar `/sign-in` fora do guard.
    // Se alguém mover o guard para o layout raiz, esta página entra em laço —
    // e o laço é invisível nos outros testes, porque todos terminam justamente
    // aqui.
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});
