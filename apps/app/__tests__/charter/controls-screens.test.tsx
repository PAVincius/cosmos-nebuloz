import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Telas do plano de controles (CH-DEV-04): aba Controles, modal do controle,
// adicionar e Perfis. O que protege: o progresso e o que bloqueia ditos por
// extenso, a ação que o papel não faz desabilitada COM o motivo na tela, o
// aviso de evidência vencida, comentário/prazo obrigatórios, e o envio de
// arquivo que falha alto em vez de gravar chave inexistente.

const h = vi.hoisted(() => ({
  acceptControl: vi.fn(),
  submitControl: vi.fn(),
  attachControlEvidence: vi.fn(),
  dispenseControl: vi.fn(),
  requestControlAdjustment: vi.fn(),
  reopenControl: vi.fn(),
  editControl: vi.fn(),
  addExtraControl: vi.fn(),
  listControlProfiles: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/app/(charter)/actions/case-controls", () => ({
  acceptControl: h.acceptControl,
  submitControl: h.submitControl,
  attachControlEvidence: h.attachControlEvidence,
  dispenseControl: h.dispenseControl,
  requestControlAdjustment: h.requestControlAdjustment,
  reopenControl: h.reopenControl,
  editControl: h.editControl,
  addExtraControl: h.addExtraControl,
}));
vi.mock("@/app/(charter)/actions/controls-read", () => ({
  listControlProfiles: h.listControlProfiles,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: h.push }) }));

import { ControlsTab } from "@/components/charter/controls-tab";
import { ModalProvider } from "@/components/charter/modal";
import ControlProfilesScreen from "@/components/charter/screens/control-profiles";

const ctl = (
  code: string,
  state: string,
  over: Record<string, unknown> = {}
) => ({
  code,
  name: `Controle ${code}`,
  category: "PRIVACY",
  categoryLabel: "Privacidade",
  evidence: `Evidência que conta de ${code}`,
  acceptanceCriteria: "Sem achado crítico",
  role: "LEGAL",
  roleLabel: "Jurídico",
  cadence: "QUARTERLY",
  cadenceLabel: "Trimestral",
  minClass: "INTERNAL",
  minClassLabel: "Interno",
  dispensable: true,
  state,
  isExtra: false,
  ownerId: null,
  ownerName: "Ana",
  summary: null,
  fileName: null,
  evidenceProducedAt: null,
  acceptedAt: null,
  expiresAt: null,
  dispensedUntil: null,
  dispensedReason: null,
  mitigation: null,
  blocksDecision: false,
  events: [
    {
      id: `e-${code}`,
      action: "START",
      actor: "Sistema",
      fromState: null,
      toState: "NO_EVIDENCE",
      comment: null,
      at: new Date("2026-09-20T12:00:00Z"),
    },
  ],
  ...over,
});

const view = (over: Record<string, unknown> = {}) => ({
  caseCode: "UC-118",
  caseTitle: "Triagem de autorizações prévias",
  dataClass: "INTERNAL",
  dataClassLabel: "Interno",
  profile: { name: "Triagem", versionLabel: "v1" },
  controls: [
    ctl("TR-1", "ACCEPTED", {
      acceptedAt: new Date("2026-09-01T00:00:00Z"),
      expiresAt: new Date("2026-12-01T00:00:00Z"),
    }),
    ctl("TR-2", "NO_EVIDENCE", { blocksDecision: true }),
    ctl("TR-3", "IN_REVIEW"),
  ],
  progress: { accepted: 1, total: 3, dispensed: 0 },
  blockers: [
    {
      code: "TR-2",
      name: "Controle TR-2",
      reason: "TR-2 · Controle TR-2: sem evidência",
    },
  ],
  notApplicable: {
    codes: ["TR-9"],
    label: "1 controle não se aplica à classe Interno",
  },
  can: { submit: true, decide: true },
  addable: [],
  process: { scaffold: "TR-104", signal: "IN-014", meridian: null },
  ...over,
});

const mount = (data = view()) =>
  render(
    <ModalProvider>
      <ControlsTab data={data as never} onChanged={vi.fn()} />
    </ModalProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
});

describe("aba Controles", () => {
  it("diz o progresso, o que bloqueia e o que não se aplica à classe", () => {
    mount();
    expect(screen.getByText("1/3 com evidência aceita")).toBeDefined();
    expect(screen.getByText(/1 controle\(s\) bloqueiam aprovar/)).toBeDefined();
    expect(
      screen.getByText(/1 controle não se aplica à classe Interno/)
    ).toBeDefined();
  });

  it("estado com rótulo e o que bloqueia escrito na linha", () => {
    mount();
    expect(screen.getAllByText("Sem evidência").length).toBeGreaterThan(1);
    expect(screen.getByText("bloqueia a decisão")).toBeDefined();
  });

  it("filtro 'Bloqueiam a decisão' esconde os resolvidos", () => {
    mount();
    fireEvent.click(
      screen.getByRole("button", { name: /Bloqueiam a decisão/ })
    );
    expect(screen.queryByText("Controle TR-1")).toBeNull();
    expect(screen.getByText("Controle TR-2")).toBeDefined();
  });

  it("card mesmo processo lista trilha, iniciativa e '—' para o que não existe", () => {
    mount();
    expect(screen.getByText("TR-104")).toBeDefined();
    expect(screen.getByText("IN-014")).toBeDefined();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("sem plano, não inventa zero: diz que não há plano", () => {
    mount(
      view({
        controls: [],
        progress: { accepted: 0, total: 0, dispensed: 0 },
        blockers: [],
      })
    );
    expect(screen.getByText(/ainda não tem plano de controles/)).toBeDefined();
  });

  it("adicionar controle desabilitado para quem não submete", () => {
    mount(view({ can: { submit: false, decide: false } }));
    const btn = screen.getByRole("button", {
      name: /Adicionar controle/,
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});

describe("modal do controle", () => {
  const open = (code: string) =>
    fireEvent.click(
      screen.getByRole("button", { name: new RegExp(`Abrir ${code}`) })
    );

  it("mostra a evidência que conta, o critério e o histórico", async () => {
    mount();
    open("TR-2");
    expect(
      await screen.findByText("Evidência que conta de TR-2")
    ).toBeDefined();
    expect(screen.getByText("Sem achado crítico")).toBeDefined();
    expect(screen.getByText(/Plano gerado/)).toBeDefined();
  });

  it("evidência vencida avisa e manda anexar de novo", async () => {
    mount(
      view({
        controls: [
          ctl("TR-1", "EXPIRED", {
            expiresAt: new Date("2026-08-01T00:00:00Z"),
            blocksDecision: true,
          }),
        ],
      })
    );
    open("TR-1");
    expect(await screen.findByText(/A evidência venceu/)).toBeDefined();
  });

  it("quem só submete vê Aceitar desabilitado com o motivo escrito", async () => {
    mount(view({ can: { submit: true, decide: false } }));
    open("TR-3");
    const accept = (await screen.findByRole("button", {
      name: "Aceitar",
    })) as HTMLButtonElement;
    expect(accept.disabled).toBe(true);
    expect(screen.getAllByText(/Só quem decide o caso/).length).toBeGreaterThan(
      0
    );
  });

  it("quem decide aceita", async () => {
    h.acceptControl.mockResolvedValue({
      ok: true,
      data: { state: "ACCEPTED" },
    });
    mount();
    open("TR-3");
    fireEvent.click(await screen.findByRole("button", { name: "Aceitar" }));
    await waitFor(() =>
      expect(h.acceptControl).toHaveBeenCalledWith({
        code: "UC-118",
        controlCode: "TR-3",
      })
    );
  });

  it("dispensar exige comentário e prazo", async () => {
    h.dispenseControl.mockResolvedValue({
      ok: true,
      data: { state: "DISPENSED" },
    });
    mount();
    open("TR-2");
    fireEvent.click(await screen.findByRole("button", { name: "Dispensar" }));
    const confirm = screen.getByRole("button", {
      name: "Confirmar",
    }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Comentário/), {
      target: { value: "Risco aceito pela diretoria." },
    });
    expect(confirm.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Dispensado até/), {
      target: { value: "2026-12-15" },
    });
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(h.dispenseControl).toHaveBeenCalledWith({
        code: "UC-118",
        controlCode: "TR-2",
        comment: "Risco aceito pela diretoria.",
        dispensedUntil: "2026-12-15",
      })
    );
  });

  it("controle não dispensável recusa dispensar, com o motivo", async () => {
    mount(
      view({
        controls: [
          ctl("TR-2", "NO_EVIDENCE", {
            dispensable: false,
            blocksDecision: true,
          }),
        ],
      })
    );
    open("TR-2");
    const btn = (await screen.findByRole("button", {
      name: "Dispensar",
    })) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(
      screen.getAllByText(/não pode ser dispensado/).length
    ).toBeGreaterThan(0);
  });

  it("anexar sem envio de arquivo habilitado falha alto e não grava chave", async () => {
    mount();
    open("TR-2");
    fireEvent.click(
      await screen.findByRole("button", { name: "Anexar evidência" })
    );
    const input = screen.getByLabelText(
      /Arquivo da evidência/
    ) as HTMLInputElement;
    fireEvent.change(input, {
      target: {
        files: [new File(["x"], "laudo.pdf", { type: "application/pdf" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(
      await screen.findByText(
        /envio de arquivo de evidência ainda não está habilitado/
      )
    ).toBeDefined();
    expect(h.attachControlEvidence).not.toHaveBeenCalled();
  });
});

describe("adicionar controle", () => {
  it("avisa que entra sem evidência e bloqueia a decisão", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar controle/ }));
    expect(
      (await screen.findAllByText(/sem evidência/i)).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/bloquear\s+a\s+decisão/).length
    ).toBeGreaterThan(0);
  });

  it("controle próprio chama addExtraControl com o caso", async () => {
    h.addExtraControl.mockResolvedValue({ ok: true, data: {} });
    mount();
    fireEvent.click(screen.getByRole("button", { name: /Adicionar controle/ }));
    fireEvent.change(await screen.findByLabelText(/^Nome/), {
      target: { value: "Auditoria de viés" },
    });
    fireEvent.change(screen.getByLabelText(/Evidência que conta/), {
      target: { value: "Relatório assinado" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar ao caso" }));
    await waitFor(() =>
      expect(h.addExtraControl).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "UC-118",
          name: "Auditoria de viés",
          evidence: "Relatório assinado",
        })
      )
    );
  });
});

describe("Perfis de controle", () => {
  const profile = (over: Record<string, unknown> = {}) => ({
    workForm: "TRIAGE",
    name: "Triagem",
    versionLabel: "v1",
    dominantRisks: [{ id: "PRIVACY", label: "Privacidade" }],
    decisionRoleLabel: "Segurança",
    note: null,
    signed: true,
    controls: [ctl("TR-1", "X")],
    casesInUse: [{ code: "UC-118", title: "Triagem de autorizações prévias" }],
    ...over,
  });

  it("mostra riscos dominantes, quem decide, controles e casos em uso", async () => {
    h.listControlProfiles.mockResolvedValue({ ok: true, data: [profile()] });
    render(<ControlProfilesScreen />);
    expect(await screen.findByText("Riscos dominantes")).toBeDefined();
    expect(screen.getByText("Privacidade")).toBeDefined();
    expect(screen.getByText("Segurança")).toBeDefined();
    expect(screen.getByText("Evidência que conta de TR-1")).toBeDefined();
    expect(screen.getByText(/Casos em uso \(1\)/)).toBeDefined();
  });

  it("perfil sem as duas assinaturas se declara rascunho", async () => {
    h.listControlProfiles.mockResolvedValue({
      ok: true,
      data: [profile({ signed: false })],
    });
    render(<ControlProfilesScreen />);
    expect(
      await screen.findByText(
        /Rascunho: este perfil ainda não tem a assinatura/
      )
    ).toBeDefined();
  });

  it("erro vira mensagem, não tela em branco", async () => {
    h.listControlProfiles.mockResolvedValue({ ok: false, error: "Sem acesso" });
    render(<ControlProfilesScreen />);
    expect(await screen.findByText(/Sem acesso/)).toBeDefined();
  });
});
