import { expect, type Page, test } from "@playwright/test";

/**
 * Foco de teclado da gaveta do shell, abaixo de 1024px.
 *
 * Dois defeitos moram aqui, e os dois são silenciosos: `focus()` em elemento
 * que ainda não pode receber foco não lança nada, só não faz nada.
 *
 * 1. Ao abrir, a gaveta fechada é `visibility: hidden` (media query em
 *    cosmos.css). Focar antes do estilo do `data-open` recalcular é um no-op
 *    e o teclado nunca entra na gaveta.
 * 2. Ao fechar por Escape, o botão de menu vive dentro do `inert={navOpen}`.
 *    Focar antes do commit tirar o `inert` também é um no-op, e o foco cai no
 *    `<body>` quando a gaveta some.
 *
 * O caso 1 só falha com movimento normal — com `prefers-reduced-motion` a
 * transição some e o recálculo chega a tempo. Por isso os dois modos rodam.
 */

const GAVETA = "#cosmos-drawer";
const BOTAO = 'button[aria-label="Abrir navegação"]';

/** Estado da gaveta fechada: invisível e fora da ordem de tabulação. */
async function medirFechada(page: Page) {
  return await page.evaluate(() => {
    const gaveta = document.getElementById("cosmos-drawer") as HTMLElement;
    // Prova de ordem de tabulação sem depender de Tab: `visibility: hidden`
    // faz o navegador recusar o foco nos descendentes.
    const primeiro = gaveta.querySelector("button, a[href]") as HTMLElement;
    primeiro?.focus();
    return {
      estreito: window.matchMedia("(max-width: 1023px)").matches,
      dataOpen: gaveta.getAttribute("data-open"),
      visibility: getComputedStyle(gaveta).visibility,
      focaveisDentro: gaveta.querySelectorAll(
        "a[href],button,input,select,textarea,[tabindex]"
      ).length,
      focoInternoAceito: document.activeElement === primeiro,
      rotuloAtivo: document.activeElement?.getAttribute("aria-label") ?? null,
    };
  });
}

/**
 * Onde o foco parou depois de abrir. Amostra por quadro em vez de esperar um
 * tempo fixo: o número de quadros até a gaveta aceitar foco depende do
 * recálculo de estilo, e é justamente isso que a correção não pode chutar.
 */
async function esperarFocoNaGaveta(page: Page) {
  return await page.evaluate(
    () =>
      new Promise<{ ativo: string; visibility: string }>((resolve) => {
        const gaveta = document.getElementById("cosmos-drawer") as HTMLElement;
        let quadros = 0;
        const olhar = () => {
          quadros++;
          const ativo = document.activeElement;
          if (ativo === gaveta || quadros >= 60) {
            resolve({
              ativo: `${ativo?.tagName}#${(ativo as HTMLElement)?.id ?? ""}`,
              visibility: getComputedStyle(gaveta).visibility,
            });
            return;
          }
          requestAnimationFrame(olhar);
        };
        requestAnimationFrame(olhar);
      })
  );
}

async function provaDeFoco(page: Page) {
  await page.goto("/cosmos/dashboard");
  await page.waitForSelector(GAVETA, { state: "attached" });

  const fechada = await medirFechada(page);
  expect(fechada.estreito).toBe(true);
  expect(fechada.dataOpen).toBe("false");
  expect(fechada.visibility).toBe("hidden");
  expect(fechada.focaveisDentro).toBeGreaterThan(0);
  expect(fechada.focoInternoAceito).toBe(false);

  // Abre pelo teclado, como quem só tem teclado abriria.
  await page.locator(BOTAO).focus();
  await page.keyboard.press("Enter");

  const aberta = await esperarFocoNaGaveta(page);
  expect(aberta.visibility).toBe("visible");
  expect(aberta.ativo).toBe("ASIDE#cosmos-drawer");

  // Escape fecha e devolve o foco ao gatilho.
  await page.keyboard.press("Escape");
  await expect(page.locator(GAVETA)).toHaveAttribute("data-open", "false");
  const depois = await medirFechada(page);
  expect(depois.rotuloAtivo).toBe("Abrir navegação");
  expect(depois.visibility).toBe("hidden");
  expect(depois.focoInternoAceito).toBe(false);
}

test.describe("a11y — gaveta do shell, movimento normal @auth", () => {
  test.use({
    storageState: "./e2e/fixtures/auth-session.json",
    viewport: { width: 800, height: 900 },
  });

  test("o foco entra na gaveta ao abrir e volta ao gatilho no Escape", async ({
    page,
  }) => {
    await provaDeFoco(page);
  });
});

test.describe("a11y — gaveta do shell, movimento reduzido @auth", () => {
  test.use({
    storageState: "./e2e/fixtures/auth-session.json",
    viewport: { width: 800, height: 900 },
    contextOptions: { reducedMotion: "reduce" },
  });

  test("o foco entra na gaveta ao abrir e volta ao gatilho no Escape", async ({
    page,
  }) => {
    await provaDeFoco(page);
  });
});
