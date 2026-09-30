import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// Dois achados do axe/QA em Meridian (fora do A3):
//  (a) o modal é portado para <body>, fora de `.meridian-root`, onde vivem
//      `--accent` e o resto dos tokens. O Badge "Promovido" (fg: var(--accent))
//      caía na cor herdada: 1,1:1 de contraste. O modal do Meridian precisa
//      carregar o escopo do módulo — sem cobrir a tela com o canvas dele.
//  (b) em Coleta, a lista de evidências entra ao lado do anel de progresso e o
//      espreme em 1280px: o anel não pode encolher.

vi.mock("@/app/(meridian)/actions/report", () => ({
  listAssessmentEvidence: () =>
    Promise.resolve({ ok: true, data: { total: 0, items: [] } }),
  requestEvidenceUrl: vi.fn(),
}));
vi.mock("@/app/(meridian)/actions/collection", () => ({
  assignRespondent: vi.fn(),
  closeCollection: vi.fn(),
  sendReminder: vi.fn(),
  revokeRespondent: vi.fn(),
  reissueRespondentLink: vi.fn(),
  reissuePendingLinks: vi.fn(),
}));

import {
  ModalProvider as CharterModalProvider,
  ModalShell as CharterModalShell,
  useModal as useCharterModal,
} from "@/components/charter/modal";
import {
  ModalProvider,
  ModalShell,
  useModal,
} from "@/components/meridian/base";
import ColetaTab from "@/components/meridian/screens/tab-coleta";

afterEach(cleanup);

function Abre({
  Shell,
  use,
}: {
  Shell: typeof ModalShell;
  use: typeof useModal;
}) {
  const modal = use();
  return (
    <button
      onClick={() =>
        modal.open(
          <Shell onClose={modal.close} title="Detalhe">
            <p>corpo</p>
          </Shell>
        )
      }
      type="button"
    >
      abrir
    </button>
  );
}

describe("modal do Meridian — escopo de tokens", () => {
  it("o diálogo fica dentro de .meridian-root, sem pintar o canvas por cima da tela", () => {
    render(
      <ModalProvider>
        <Abre Shell={ModalShell} use={useModal} />
      </ModalProvider>
    );
    fireEvent.click(screen.getByText("abrir"));
    const escopo = screen
      .getByRole("dialog")
      .closest(".meridian-root") as HTMLElement | null;
    expect(escopo).not.toBeNull();
    // `.meridian-root` traz `background: var(--canvas)` e `height: 100dvh`;
    // no wrapper fixo do modal o fundo tem de ser transparente.
    expect(escopo?.style.background).toBe("transparent");
    expect(escopo?.style.position).toBe("fixed");
  });

  it("o modal do Charter não muda: sem classe de escopo do Meridian", () => {
    render(
      <CharterModalProvider>
        <Abre
          Shell={CharterModalShell as typeof ModalShell}
          use={useCharterModal as typeof useModal}
        />
      </CharterModalProvider>
    );
    fireEvent.click(screen.getByText("abrir"));
    expect(screen.getByRole("dialog").closest(".meridian-root")).toBeNull();
  });
});

describe("ColetaTab — anel de progresso", () => {
  const A = {
    id: "a1",
    code: "AS-104",
    status: "COLLECTING",
    responses: { done: 3, total: 10 },
    evidence: 4,
    respondents: [],
    overrides: [],
    planItems: [],
    scores: null,
  } as never;

  it("o anel não encolhe e o texto ao lado pode quebrar linha", async () => {
    render(
      <ModalProvider>
        <ColetaTab a={A} onChanged={() => {}} />
      </ModalProvider>
    );
    const anel = screen.getByRole("img", { name: /Progresso/ });
    expect(anel.getAttribute("style")).toMatch(/flex-shrink:\s*0/);
    const texto = screen.getByText(/de 10 respostas/).closest("div")
      ?.parentElement as HTMLElement;
    expect(Number.parseInt(texto.style.minWidth, 10)).toBe(0);
  });
});
