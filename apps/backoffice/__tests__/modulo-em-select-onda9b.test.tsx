/** @vitest-environment jsdom */
// modulo-em-select-onda9b.test.tsx — crítica R6: o contrato de módulo era um
// `ConfirmarAcao` por status — até 4 gatilhos × 5 módulos, rótulo em
// substantivo ("Suspenso"), sem o módulo no nome acessível e com o enum cru
// ("COSMOS") no alvo. Agora é um `<select>` por módulo que abre a barreira já
// aberta, como a troca de papel em `abas/usuarios.tsx`. O provisionamento
// dizia nada quando o submit ficava cinza.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModuleForm } from "@/app/(staff)/clientes/[slug]/module-form";
import { NewClientForm } from "@/app/(staff)/clientes/novo/form";
import { ConfirmarAcao } from "@/components/confirmar-acao";

const mocks = vi.hoisted(() => ({
  contractModuleAction: vi.fn(),
  provisionTenantAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/clientes/novo",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/app/actions/provisioning", () => ({
  contractModuleAction: mocks.contractModuleAction,
  provisionTenantAction: mocks.provisionTenantAction,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

function montarModulos(canWrite = true) {
  return render(
    <ModuleForm
      canWrite={canWrite}
      modules={[{ expiresAt: null, module: "COSMOS", status: "ACTIVE" }]}
      modulos={["COSMOS", "CHARTER"]}
      slug="vanta-saude"
    />
  );
}

function selectDe(modulo: string) {
  return screen.getByRole("combobox", {
    name: new RegExp(modulo),
  }) as HTMLSelectElement;
}

describe("ModuleForm — um select por módulo", () => {
  it("um combobox por módulo, com o nome do módulo no nome acessível, e nenhum botão de status", () => {
    montarModulos();

    const combos = screen.getAllByRole("combobox");
    expect(combos).toHaveLength(2);
    expect(selectDe("Cosmos").value).toBe("ACTIVE");
    expect(selectDe("Charter").value).toBe("");
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    // O rótulo é visível, não só para leitor de tela.
    expect(screen.getByText("Cosmos").tagName).toBe("LABEL");
    expect(screen.queryByText("COSMOS")).toBeNull();
  });

  it("mudar o status abre a barreira com verbo, módulo e cliente — sem chamar a action", () => {
    montarModulos();
    fireEvent.change(selectDe("Cosmos"), { target: { value: "SUSPENDED" } });

    const grupo = screen.getByRole("group", { name: "Suspender Cosmos" });
    expect(grupo.textContent).toContain("vanta-saude");
    expect(grupo.textContent).not.toContain("COSMOS");
    expect(grupo.textContent).toMatch(/perde acesso/);
    expect(mocks.contractModuleAction).not.toHaveBeenCalled();
  });

  it("Voltar restaura o valor do select e fecha a barreira", () => {
    montarModulos();
    fireEvent.change(selectDe("Cosmos"), { target: { value: "TRIAL" } });
    expect(selectDe("Cosmos").value).toBe("TRIAL");

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));

    expect(selectDe("Cosmos").value).toBe("ACTIVE");
    expect(screen.queryByRole("group")).toBeNull();
  });

  it("uma barreira por vez: escolher em outro módulo troca a pergunta e restaura o primeiro", () => {
    montarModulos();
    fireEvent.change(selectDe("Cosmos"), { target: { value: "SUSPENDED" } });
    fireEvent.change(selectDe("Charter"), { target: { value: "TRIAL" } });

    expect(screen.getAllByRole("group")).toHaveLength(1);
    expect(screen.getByRole("group", { name: /Charter/ })).toBeTruthy();
    expect(selectDe("Cosmos").value).toBe("ACTIVE");
  });

  it("Confirmar grava e a linha nomeia módulo e cliente por extenso", async () => {
    mocks.contractModuleAction.mockResolvedValue({ data: {}, ok: true });
    montarModulos();
    fireEvent.change(selectDe("Cosmos"), { target: { value: "SUSPENDED" } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(mocks.contractModuleAction).toHaveBeenCalledWith({
        module: "COSMOS",
        slug: "vanta-saude",
        status: "SUSPENDED",
      })
    );
    const status = await screen.findByRole("status");
    expect(status.textContent).toBe(
      "Cosmos de vanta-saude agora está Suspenso"
    );
  });

  it("não contratado: 'Não contratado' é o valor e não há opção Cancelado", () => {
    montarModulos();
    const opcoes = Array.from(selectDe("Charter").options).map((o) => o.text);
    expect(opcoes).toContain("Não contratado");
    expect(opcoes).not.toContain("Cancelado");
    expect(Array.from(selectDe("Cosmos").options).map((o) => o.text)).toContain(
      "Cancelado"
    );
  });

  it("somente leitura: selects desabilitados, com o motivo ligado", () => {
    montarModulos(false);
    for (const combo of screen.getAllByRole("combobox")) {
      expect((combo as HTMLSelectElement).disabled).toBe(true);
      expect(combo.getAttribute("aria-describedby")).toBeTruthy();
    }
  });
});

describe("ConfirmarAcao — nome acessível do gatilho", () => {
  const base = {
    alvo: "acme",
    consequencia: "Some.",
    onConfirmar: vi.fn(),
    rotulo: "Excluir",
  };

  it("sem a prop, o nome é o rótulo (os usos de hoje não mudam)", () => {
    render(<ConfirmarAcao {...base} />);
    expect(screen.getByRole("button", { name: "Excluir" })).toBeTruthy();
  });

  it("com `nomeDoGatilho`, o botão leva o nome completo", () => {
    render(
      <ConfirmarAcao {...base} nomeDoGatilho="Excluir lançamento Aluguel" />
    );
    expect(
      screen.getByRole("button", { name: "Excluir lançamento Aluguel" })
    ).toBeTruthy();
  });
});

describe("Provisionar — o que falta, dito", () => {
  it("vazio: diz que falta o nome; os módulos têm rótulo", () => {
    render(<NewClientForm canWrite modulos={["COSMOS", "CHARTER"]} />);

    expect(
      screen.getByText("Para provisionar: nome com 2+ letras.")
    ).toBeTruthy();
    expect(
      screen.getByRole("radiogroup", { name: "Status inicial de Cosmos" })
    ).toBeTruthy();
    expect(screen.getByText("Charter")).toBeTruthy();
    expect(screen.queryByText("COSMOS")).toBeNull();
  });

  it("sem módulo e sem nome: lista os dois; completo: some", () => {
    render(<NewClientForm canWrite modulos={["COSMOS"]} />);
    const grupo = screen.getByRole("radiogroup", {
      name: "Status inicial de Cosmos",
    });
    fireEvent.click(
      Array.from(grupo.querySelectorAll("input")).find(
        (i) => i.value === ""
      ) as HTMLInputElement
    );
    expect(
      screen.getByText(
        "Para provisionar: nome com 2+ letras e ao menos um módulo."
      )
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Nome da organização"), {
      target: { value: "Atlas" },
    });
    fireEvent.click(
      Array.from(grupo.querySelectorAll("input")).find(
        (i) => i.value === "ACTIVE"
      ) as HTMLInputElement
    );
    expect(screen.queryByText(/Para provisionar:/)).toBeNull();
  });
});
