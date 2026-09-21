/** @vitest-environment jsdom */
// clientes-detalhe-somente-leitura.test.tsx — [P1] MEMBER via botões vivos no
// detalhe do cliente: `page.tsx` só passava `canWrite` ao `DetalheDoTenant`,
// e `ModuleForm`, `CharterBootstrap` e `MeridianBootstrap` nem tinham a prop.
// O servidor recusava, mas a tela prometia. Por item: com `canWrite=false`
// nenhum botão de escrita fica habilitado e o motivo está escrito; o sucesso
// nasce junto da linha e nomeia módulo, cliente e status.
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CharterBootstrap } from "@/app/(staff)/clientes/[slug]/charter-bootstrap";
import { MeridianBootstrap } from "@/app/(staff)/clientes/[slug]/meridian-bootstrap";
import { ModuleForm } from "@/app/(staff)/clientes/[slug]/module-form";
import { MOTIVO_SOMENTE_LEITURA } from "@/components/write-button";

const mocks = vi.hoisted(() => ({
  bootstrapCharterAction: vi.fn(),
  bootstrapMeridianAction: vi.fn(),
  contractModuleAction: vi.fn(),
}));

vi.mock("@/app/actions/provisioning", () => ({
  bootstrapCharterAction: mocks.bootstrapCharterAction,
  bootstrapMeridianAction: mocks.bootstrapMeridianAction,
  contractModuleAction: mocks.contractModuleAction,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// `WriteButton` bloqueado fica no Tab com `aria-disabled` (o motivo é
// anunciado); botões comuns seguem com `disabled`. Os dois contam como
// desabilitados aqui.
function estaDesabilitado(b: HTMLElement) {
  return (
    (b as HTMLButtonElement).disabled ||
    b.getAttribute("aria-disabled") === "true"
  );
}

function botoesHabilitados() {
  return screen.getAllByRole("button").filter((b) => !estaDesabilitado(b));
}

describe("ModuleForm — somente leitura", () => {
  it("com canWrite=false nenhum botão de escrita fica habilitado e o motivo está escrito", () => {
    render(
      <ModuleForm
        canWrite={false}
        modules={[{ expiresAt: null, module: "COSMOS", status: "ACTIVE" }]}
        modulos={["COSMOS"]}
        slug="acme"
      />
    );

    expect(botoesHabilitados()).toHaveLength(0);
    expect(screen.getByText(MOTIVO_SOMENTE_LEITURA)).toBeTruthy();
  });

  it("com canWrite=true os botões de troca ficam vivos e o motivo não aparece", () => {
    render(
      <ModuleForm
        canWrite
        modules={[{ expiresAt: null, module: "COSMOS", status: "ACTIVE" }]}
        modulos={["COSMOS"]}
        slug="acme"
      />
    );

    expect(botoesHabilitados().length).toBeGreaterThan(0);
    expect(screen.queryByText(MOTIVO_SOMENTE_LEITURA)).toBeNull();
  });
});

describe("ModuleForm — Cancelado só quando faz sentido", () => {
  it("não contratado: sem botão Cancelado", () => {
    render(
      <ModuleForm canWrite modules={[]} modulos={["COSMOS"]} slug="acme" />
    );

    expect(screen.queryByRole("button", { name: "Cancelado" })).toBeNull();
    expect(screen.getByRole("button", { name: /Ativo/ })).toBeTruthy();
  });

  it("já cancelado: sem botão Cancelado", () => {
    render(
      <ModuleForm
        canWrite
        modules={[{ expiresAt: null, module: "COSMOS", status: "CANCELED" }]}
        modulos={["COSMOS"]}
        slug="acme"
      />
    );

    expect(screen.queryByRole("button", { name: "Cancelado" })).toBeNull();
  });

  it("ativo: Cancelado aparece", () => {
    render(
      <ModuleForm
        canWrite
        modules={[{ expiresAt: null, module: "COSMOS", status: "ACTIVE" }]}
        modulos={["COSMOS"]}
        slug="acme"
      />
    );

    expect(screen.getByRole("button", { name: "Cancelado" })).toBeTruthy();
  });
});

describe("ModuleForm — sucesso nomeado junto da linha", () => {
  it("após Trial, a linha diz 'COSMOS de acme agora está Trial'", async () => {
    mocks.contractModuleAction.mockResolvedValue({ data: {}, ok: true });
    render(
      <ModuleForm
        canWrite
        modules={[{ expiresAt: null, module: "COSMOS", status: "ACTIVE" }]}
        modulos={["COSMOS"]}
        slug="acme"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Trial/ }));

    const status = await screen.findByRole("status");
    expect(status.textContent).toBe("COSMOS de acme agora está Trial");
  });

  it("após Suspenso confirmado, a linha diz 'COSMOS de acme agora está Suspenso'", async () => {
    mocks.contractModuleAction.mockResolvedValue({ data: {}, ok: true });
    render(
      <ModuleForm
        canWrite
        modules={[{ expiresAt: null, module: "COSMOS", status: "ACTIVE" }]}
        modulos={["COSMOS"]}
        slug="acme"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Suspenso" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(mocks.contractModuleAction).toHaveBeenCalledWith({
        module: "COSMOS",
        slug: "acme",
        status: "SUSPENDED",
      })
    );
    const status = await screen.findByRole("status");
    expect(status.textContent).toBe("COSMOS de acme agora está Suspenso");
  });
});

describe("Bootstraps — somente leitura e sucesso", () => {
  it("CharterBootstrap com canWrite=false: Preparar desabilitado e motivo escrito", () => {
    render(<CharterBootstrap canWrite={false} slug="acme" />);

    expect(
      estaDesabilitado(
        screen.getByRole("button", { name: "Preparar o Charter deste cliente" })
      )
    ).toBe(true);
    expect(screen.getByText(MOTIVO_SOMENTE_LEITURA)).toBeTruthy();
    expect(
      (
        screen.getByLabelText(
          "E-mail do responsável pelo Compliance"
        ) as HTMLInputElement
      ).disabled
    ).toBe(true);
  });

  it("MeridianBootstrap com canWrite=false: Preparar desabilitado e motivo escrito", () => {
    render(<MeridianBootstrap canWrite={false} slug="acme" />);

    expect(
      estaDesabilitado(
        screen.getByRole("button", {
          name: "Preparar o Meridian deste cliente",
        })
      )
    ).toBe(true);
    expect(screen.getByText(MOTIVO_SOMENTE_LEITURA)).toBeTruthy();
  });

  it("CharterBootstrap: sucesso é um status vivo (Confirmacao)", async () => {
    mocks.bootstrapCharterAction.mockResolvedValue({
      data: { created: true },
      ok: true,
    });
    render(<CharterBootstrap canWrite slug="acme" />);

    fireEvent.change(
      screen.getByLabelText("E-mail do responsável pelo Compliance"),
      { target: { value: "c@acme.com" } }
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Preparar o Charter deste cliente" })
    );

    const status = await screen.findByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toMatch(/Política criada/);
  });

  it("MeridianBootstrap: sucesso é um status vivo (Confirmacao)", async () => {
    mocks.bootstrapMeridianAction.mockResolvedValue({
      data: { created: false },
      ok: true,
    });
    render(<MeridianBootstrap canWrite slug="acme" />);

    fireEvent.change(
      screen.getByLabelText("E-mail do consultor de diagnóstico"),
      { target: { value: "c@acme.com" } }
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Preparar o Meridian deste cliente" })
    );

    const status = await screen.findByRole("status");
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toMatch(/Template já existia/);
  });
});
