// Atrito A5 do dogfood (QA, 02/10, AS-002): depois de anexar evidência, o
// "Enviar respostas" não completou em 2 baterias, sem erro visível. Nos logs de
// produção, as tentativas que falharam têm um POST só (o anexo) e nenhum
// saveDraft/submitBattery: o clique em Enviar caiu num botão `disabled` enquanto
// o upload rodava e foi ignorado, sem aviso. O respondente ficou "Convidado, 0
// de 3", e o QA refez o fluxo inteiro, reanexando a evidência a cada tentativa.
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Battery } from "../../app/(meridian)/actions/respondent";

const h = vi.hoisted(() => ({
  attachEvidence: vi.fn(),
  saveDraft: vi.fn(),
  submitBattery: vi.fn(),
}));

vi.mock("@/app/(meridian)/actions/respondent", () => ({
  attachEvidence: h.attachEvidence,
  saveDraft: h.saveDraft,
  submitBattery: h.submitBattery,
}));

import { RespondentForm } from "@/components/meridian/respondent-form";

const battery = (
  over: Partial<Battery["context"]> = {},
  evidence = []
): Battery => ({
  context: {
    respondentId: "r1",
    tenantId: "t1",
    assessmentId: "a1",
    assessmentCode: "AS-002",
    orgName: "Vanta Saúde",
    axis: "GOVERNANCE",
    axisLabel: "Governance",
    name: "Jonas Reis",
    deadline: "2026-12-01T00:00:00.000Z",
    status: "PENDING",
    ...over,
  },
  questions: [
    {
      id: "q1",
      code: "Q-G01",
      type: "LIKERT",
      text: "Há política de IA aprovada?",
      scaleLabels: [],
      answer: null,
      evidence,
    },
  ],
});

const file = (name = "politica.pdf") =>
  new File(["conteudo"], name, { type: "application/pdf" });

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

const answer = () =>
  fireEvent.click(screen.getByRole("button", { name: "Concordo" }));
const attach = (f: File) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error("sem input de arquivo");
  }
  fireEvent.change(input, { target: { files: [f] } });
};
const send = () =>
  fireEvent.click(
    screen.getByRole("button", { name: /Enviar respostas|Enviando/ })
  );

beforeEach(() => {
  vi.clearAllMocks();
  h.saveDraft.mockResolvedValue({ ok: true, data: undefined });
  h.submitBattery.mockResolvedValue({ ok: true, data: { missing: 0 } });
  h.attachEvidence.mockResolvedValue({
    ok: true,
    data: { id: "e1", fileName: "politica.pdf" },
  });
});

describe("Enviar logo depois de anexar", () => {
  it("o clique em Enviar durante o upload não se perde: o envio segue quando o anexo termina", async () => {
    const upload = deferred<{
      ok: true;
      data: { id: string; fileName: string };
    }>();
    h.attachEvidence.mockReturnValue(upload.promise);
    render(<RespondentForm battery={battery()} />);
    answer();
    attach(file());
    send();

    // o upload ainda roda: nada foi enviado, e a tela diz por quê
    expect(h.submitBattery).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toMatch(/anexo/i);

    await act(async () => {
      upload.resolve({
        ok: true,
        data: { id: "e1", fileName: "politica.pdf" },
      });
    });

    await waitFor(() => expect(h.submitBattery).toHaveBeenCalledTimes(1));
    expect(h.saveDraft).toHaveBeenCalledTimes(1);
    expect(h.saveDraft.mock.invocationCallOrder[0]).toBeLessThan(
      h.submitBattery.mock.invocationCallOrder[0] as number
    );
  });
});

describe("falha que antes sumia", () => {
  it("anexo que lança (rede, deploy) não trava o formulário: erro na tela e botões de volta", async () => {
    h.attachEvidence.mockRejectedValue(new Error("Failed to fetch"));
    render(<RespondentForm battery={battery()} />);
    attach(file());

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/anexo|evidência/i);
    const enviar = screen.getByRole("button", {
      name: "Enviar respostas",
    }) as HTMLButtonElement;
    expect(enviar.disabled).toBe(false);
  });

  it("envio que lança mostra erro na tela e permite tentar de novo", async () => {
    h.submitBattery.mockRejectedValueOnce(new Error("Failed to fetch"));
    render(<RespondentForm battery={battery()} />);
    answer();
    send();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/tente de novo/i);

    send();
    await waitFor(() => expect(h.submitBattery).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Bateria concluída/)).toBeDefined();
  });

  it("saveDraft recusado não deixa o respondente sem saber: erro na tela, nada enviado", async () => {
    h.saveDraft.mockResolvedValue({
      ok: false,
      error: "A coleta foi encerrada.",
    });
    render(<RespondentForm battery={battery()} />);
    answer();
    send();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/coleta foi encerrada/);
    expect(h.submitBattery).not.toHaveBeenCalled();
  });
});

describe("resultado do envio fica na tela", () => {
  it("pergunta em branco: aviso permanente e a bateria NÃO aparece como concluída", async () => {
    h.submitBattery.mockResolvedValue({ ok: true, data: { missing: 1 } });
    render(<RespondentForm battery={battery()} />);
    send();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/1 pergunta sem resposta/);
    expect(screen.queryByText(/Bateria concluída/)).toBeNull();
  });

  it("concluída: o estado permanece e o envio não se repete", async () => {
    render(<RespondentForm battery={battery()} />);
    answer();
    send();

    expect(await screen.findByText(/Bateria concluída/)).toBeDefined();
    expect(
      screen.queryByRole("button", { name: "Enviar respostas" })
    ).toBeNull();
    expect(h.submitBattery).toHaveBeenCalledTimes(1);
  });

  it("quem volta ao link depois de concluir vê que já concluiu", () => {
    render(<RespondentForm battery={battery({ status: "DONE" })} />);
    expect(screen.getByText(/Bateria concluída/)).toBeDefined();
    expect(
      screen.queryByRole("button", { name: "Enviar respostas" })
    ).toBeNull();
  });
});

describe("anexo repetido", () => {
  it("o mesmo arquivo na mesma pergunta não anexa de novo: avisa e não chama o servidor", async () => {
    render(
      <RespondentForm
        battery={battery({}, [{ id: "e0", fileName: "politica.pdf" }] as never)}
      />
    );
    attach(file("politica.pdf"));

    const notice = await screen.findByRole("alert");
    expect(notice.textContent).toMatch(/politica\.pdf.*já está anexado/);
    expect(h.attachEvidence).not.toHaveBeenCalled();
  });

  it("arquivo com outro nome anexa normalmente", async () => {
    render(<RespondentForm battery={battery()} />);
    attach(file("ata.pdf"));
    await waitFor(() => expect(h.attachEvidence).toHaveBeenCalledTimes(1));
  });
});
