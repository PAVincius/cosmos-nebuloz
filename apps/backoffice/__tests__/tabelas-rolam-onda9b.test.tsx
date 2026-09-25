/** @vitest-environment jsdom */
// tabelas-rolam-onda9b.test.tsx — crítica R6, decisão do dono: mobile é
// cortesia, então a tabela não vira cartão — ela rola. `Tabela` era
// `table-layout: fixed` a 100% sem contêiner: a 375px as colunas espremiam
// até o texto quebrar letra a letra. Um contêiner só, dentro do componente,
// cobre os onze usos. As três grades fixas que não empilhavam (BPMN, Mermaid,
// registrar IP) viram classes `.bo-*` com a media query do tema.
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Celula, Tabela, TableHead, TableRow } from "@/components/tabela";

const RAIZ = path.join(__dirname, "..");
const ler = (rel: string) => readFileSync(path.join(RAIZ, rel), "utf8");

describe("Tabela rola em vez de espremer", () => {
  it("a tabela mora num contêiner com rolagem horizontal e tem largura mínima", () => {
    render(
      <Tabela
        larguras={[
          { id: "a", largura: "50%" },
          { id: "b", largura: "50%" },
        ]}
      >
        <TableHead labels={["A", "B"]} />
        <tbody>
          <TableRow>
            <Celula>1</Celula>
            <Celula>2</Celula>
          </TableRow>
        </tbody>
      </Tabela>
    );

    const tabela = screen.getByRole("table");
    const conteiner = tabela.parentElement as HTMLElement;
    expect(conteiner.tagName).toBe("DIV");
    expect(conteiner.style.overflowX).toBe("auto");
    expect(tabela.style.minWidth).not.toBe("");
  });
});

describe("grades fixas empilham no estreito", () => {
  it.each([
    ["components/bpmn-modeler.tsx", "bo-com-painel", "1fr 300px"],
    [
      "components/mermaid-editor.tsx",
      "bo-editor-e-previa",
      "minmax(0,1fr) minmax(0,1.2fr)",
    ],
    [
      "app/(staff)/ip/registrar.tsx",
      "bo-form-e-lateral",
      "minmax(0,1.7fr) minmax(0,1fr)",
    ],
  ])("%s usa .%s em vez da grade inline", (arquivo, classe, gradeInline) => {
    const fonte = ler(arquivo);
    expect(fonte).toContain(`className="${classe}"`);
    expect(fonte).not.toContain(`gridTemplateColumns: "${gradeInline}"`);

    const tema = ler("app/backoffice-theme.css");
    const media = tema.slice(tema.lastIndexOf("@media (max-width: 1023px)"));
    expect(tema).toContain(`.${classe} {`);
    expect(media).toContain(`.${classe}`);
  });
});
