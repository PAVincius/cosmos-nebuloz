// transporte.test.ts — qual caminho o email toma.
//
// O que se prova aqui é uma coisa só, e ela vale mais que as outras juntas:
// **em dev, com o catcher ligado, nada sai para a internet**. Sem isso, um
// teste de convite manda email de verdade para o endereço que alguém digitou
// enquanto experimentava — e o custo não é a cota do Resend, é o domínio da
// Nebuloz ganhando reputação de spam por causa de dado de brincadeira.
//
// O resto do arquivo protege as bordas: produção continua exigindo credencial,
// e a falta das duas configurações falha com instrução, não com stack trace.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendMail: vi.fn(),
  createTransport: vi.fn(),
  resendSend: vi.fn(),
  Resend: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: mocks.createTransport },
  createTransport: mocks.createTransport,
}));
vi.mock("resend", () => ({
  Resend: mocks.Resend,
}));

import { escolherTransporte } from "../transporte";

function resetar() {
  for (const m of Object.values(mocks)) {
    m.mockReset();
  }
  mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
  mocks.sendMail.mockResolvedValue({ messageId: "<local@mailpit>" });
  // Função comum, não arrow: o código faz `new Resend(token)`, e arrow não é
  // construtor.
  mocks.Resend.mockImplementation(function (this: Record<string, unknown>) {
    this.emails = { send: mocks.resendSend };
  });
  mocks.resendSend.mockResolvedValue({ data: { id: "re_123" } });
}

const CARTA = {
  from: "nebuloz@exemplo.com",
  to: "alguem@cliente.com",
  subject: "Convite",
  html: "<p>oi</p>",
};

describe("escolherTransporte", () => {
  beforeEach(resetar);

  describe("com catcher configurado", () => {
    it("não constrói o cliente do Resend", async () => {
      const t = escolherTransporte({ catcher: "smtp://localhost:1025" });
      await t.send(CARTA);

      // A garantia inteira: com o catcher ligado, o Resend nem é instanciado.
      // Nenhuma credencial é lida, nenhuma conexão é aberta para fora.
      expect(mocks.Resend).not.toHaveBeenCalled();
      expect(mocks.resendSend).not.toHaveBeenCalled();
    });

    it("entrega no SMTP local", async () => {
      const t = escolherTransporte({ catcher: "smtp://localhost:1025" });
      await t.send(CARTA);

      expect(mocks.createTransport).toHaveBeenCalled();
      expect(mocks.sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: "alguem@cliente.com" })
      );
    });

    it("o catcher ganha da credencial quando as duas existem", async () => {
      // Ordem deliberada: máquina de dev costuma ter as duas, por causa de um
      // `.env` copiado. Se a credencial vencesse, ligar o catcher não
      // protegeria ninguém — e a pessoa só descobriria pelo email que chegou.
      const t = escolherTransporte({
        catcher: "smtp://localhost:1025",
        token: "re_token_real",
      });
      await t.send(CARTA);

      expect(mocks.Resend).not.toHaveBeenCalled();
    });

    it("diz onde o email parou", async () => {
      const t = escolherTransporte({ catcher: "smtp://localhost:1025" });

      expect(t.destino).toMatch(/localhost:1025/);
    });
  });

  describe("sem catcher", () => {
    it("usa o Resend com a credencial", async () => {
      const t = escolherTransporte({ token: "re_token_real" });
      await t.send(CARTA);

      expect(mocks.Resend).toHaveBeenCalledWith("re_token_real");
      expect(mocks.resendSend).toHaveBeenCalled();
      expect(mocks.createTransport).not.toHaveBeenCalled();
    });
  });

  describe("sem nenhum dos dois", () => {
    it("falha com instrução, não com stack de biblioteca", () => {
      // "Cannot read properties of undefined" manda a pessoa ler o código da
      // dependência. A mensagem tem que dizer as duas saídas possíveis.
      expect(() => escolherTransporte({})).toThrow(
        /MAIL_CATCHER_SMTP|RESEND_TOKEN/
      );
    });

    it("a mensagem cita as duas saídas, não só uma", () => {
      let msg = "";
      try {
        escolherTransporte({});
      } catch (e) {
        msg = e instanceof Error ? e.message : String(e);
      }

      expect(msg).toMatch(/MAIL_CATCHER_SMTP/);
      expect(msg).toMatch(/RESEND_TOKEN/);
    });
  });
});
