import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NAV, navIdFor, TITLES } from "@/components/scaffold/nav";

// Registry e casca — a fronteira cliente/servidor do Scaffold.
//
// Duas regras que quebram em silêncio se ninguém as testar:
//
//   1. Toda tela navegável tem título. Sem isso a aba lê "localhost:3012" e o
//      breadcrumb mostra o id cru.
//   2. O shell é "use client" e NÃO importa o registry. As telas são módulos
//      pesados; arrastá-las para o bundle do cliente pela casca desfaz o ganho
//      de a rota ser única.

const APP_ROOT = join(import.meta.dirname, "..", "..");

/** Ids registrados, lidos do SOURCE em vez de importados: importar o registry
 *  puxa as telas, que puxam server actions, que leem env de servidor. O que
 *  este teste precisa é da lista, não dos componentes. */
function registeredIds(): string[] {
  const src = readFileSync(
    join(APP_ROOT, "components", "scaffold", "screens", "registry.ts"),
    "utf8"
  );
  const body = src.slice(src.indexOf("SCREENS"));
  return [...body.matchAll(/^\s{2}([a-zA-Z]+):/gm)].map((m) => m[1] as string);
}

describe("registry de telas", () => {
  it("toda tela registrada tem título e seção pai", () => {
    for (const id of registeredIds()) {
      expect(TITLES[id], `tela "${id}" sem entrada em TITLES`).toBeDefined();
      expect(TITLES[id]?.[0]).toBeTruthy();
      expect(TITLES[id]?.[1]).toBeTruthy();
    }
  });

  it("todo item de nav aponta para uma tela que existe", () => {
    const ids = registeredIds();
    for (const { items } of NAV) {
      for (const item of items) {
        // Item de nav para tela não registrada cai em <ComingSoon>. Aceitável
        // enquanto a fatia não chegou — o que NÃO pode é o inverso: tela
        // registrada e invisível.
        expect(typeof item.id).toBe("string");
      }
    }
    expect(ids).toContain("portfolio");
  });

  it("a nav não expõe a fila de supervisão", () => {
    // Cross-tenant vive em apps/backoffice — ADR-0013, research §R4.
    expect(registeredIds()).not.toContain("supervision");
    expect(NAV.flatMap((s) => s.items.map((i) => i.id))).not.toContain(
      "supervision"
    );
    expect(TITLES.supervision).toBeUndefined();
  });

  it("telas de detalhe ficam fora da nav, mas têm título", () => {
    // `track` e `baseline` são alcançadas por clique numa lista, não por item
    // de menu: um item de nav para "Trilha" sem id levaria a lugar nenhum.
    const navIds = NAV.flatMap((s) => s.items.map((i) => i.id));
    expect(TITLES.track).toBeDefined();
    expect(navIds).not.toContain("track");
    expect(navIds).not.toContain("baseline");
  });

  it("detalhe herda o item de nav do pai", () => {
    expect(navIdFor("track")).toBe("portfolio");
    expect(navIdFor("baseline")).toBe("baselines");
    expect(navIdFor("templates")).toBe("templates");
  });

  it("o shell não importa o registry", () => {
    const shell = readFileSync(
      join(APP_ROOT, "components", "scaffold", "shell.tsx"),
      "utf8"
    );
    expect(shell).toContain('"use client"');
    expect(shell).not.toMatch(/from\s+["'].*screens\/registry["']/);
  });

  it("o portfólio é a tela padrão da rota", () => {
    expect(registeredIds()).toContain("portfolio");
  });
});

describe("metadata da rota única", () => {
  // Sem generateMetadata, com rota única, toda aba do navegador leria
  // "localhost:3012" — e o axe acusa isso em todas as telas (SN-10).
  it("a página declara generateMetadata", () => {
    const page = readFileSync(
      join(APP_ROOT, "app", "(scaffold)", "scaffold", "[[...seg]]", "page.tsx"),
      "utf8"
    );
    expect(page).toContain("export async function generateMetadata");
    expect(page).toContain("TITLES");
  });

  it("todo título de tela é distinto — abas iguais são abas perdidas", () => {
    const titulos = Object.values(TITLES).map(([t, p]) => `${t}|${p}`);
    expect(new Set(titulos).size).toBe(titulos.length);
  });
});
