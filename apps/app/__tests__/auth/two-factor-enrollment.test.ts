import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  enable: vi.fn(),
  verifyTotp: vi.fn(),
}));

vi.mock("@repo/auth/client", () => ({
  authClient: { twoFactor: { enable: h.enable, verifyTotp: h.verifyTotp } },
}));

import {
  extrairChaveManual,
  useTwoFactorEnrollment,
} from "@repo/auth/two-factor-enrollment";

const URI =
  "otpauth://totp/Cosmos:ana@nebuloz.ai?secret=JBSWY3DPEHPK3PXP&issuer=Cosmos&digits=6";
const CODIGOS = ["aaaa-1111", "bbbb-2222"];

const ok = { error: null, data: { totpURI: URI, backupCodes: CODIGOS } };

/** Leva o hook até o passo de escanear, que é o pré-requisito de confirmar. */
async function ateEscanear() {
  const { result } = renderHook(() => useTwoFactorEnrollment());
  act(() => result.current.iniciar());
  await act(async () => {
    await result.current.gerarSegredo("senha-de-doze-ou-mais");
  });
  return result;
}

beforeEach(() => {
  h.enable.mockReset();
  h.verifyTotp.mockReset();
  h.enable.mockResolvedValue(ok);
  h.verifyTotp.mockResolvedValue({ error: null, data: {} });
});

describe("extrairChaveManual", () => {
  it("tira a chave base32 da otpauth", () => {
    expect(extrairChaveManual(URI)).toBe("JBSWY3DPEHPK3PXP");
  });

  it("devolve null quando não há query", () => {
    expect(extrairChaveManual("otpauth://totp/Cosmos")).toBeNull();
  });
});

describe("useTwoFactorEnrollment", () => {
  it("começa ocioso e sem segredo", () => {
    const { result } = renderHook(() => useTwoFactorEnrollment());

    expect(result.current.passo).toBe("ocioso");
    expect(result.current.totpURI).toBeNull();
    expect(result.current.backupCodes).toBeNull();
  });

  it("iniciar leva ao passo de senha", () => {
    const { result } = renderHook(() => useTwoFactorEnrollment());
    act(() => result.current.iniciar());

    expect(result.current.passo).toBe("senha");
  });

  describe("gerarSegredo", () => {
    it("entrega URI e chave manual, e avança para escanear", async () => {
      const result = await ateEscanear();

      expect(result.current.passo).toBe("escaneando");
      expect(result.current.totpURI).toBe(URI);
      expect(result.current.chaveManual).toBe("JBSWY3DPEHPK3PXP");
    });

    it("NÃO revela os códigos de backup antes da confirmação", async () => {
      const result = await ateEscanear();

      // O `enable()` já devolveu os códigos — mas 2FA ainda não está ativo.
      // Mostrar aqui entrega um papel que a pessoa guarda achando que vale.
      expect(h.enable).toHaveBeenCalled();
      expect(result.current.backupCodes).toBeNull();
    });

    it("falha desconhecida NÃO vira 'senha incorreta' — repassa o servidor", async () => {
      // O defeito que isto trava: dizer "confira sua senha" para quem digitou
      // a senha certa esconde a causa real e manda a pessoa para o lugar
      // errado. Foi o que aconteceu em produção no primeiro teste.
      h.enable.mockResolvedValue({
        error: { status: 500, message: "Invalid origin", code: "ORIGIN" },
        data: null,
      });
      const { result } = renderHook(() => useTwoFactorEnrollment());
      act(() => result.current.iniciar());

      await act(async () => {
        await result.current.gerarSegredo("senha-certa-de-doze");
      });

      expect(result.current.erro).not.toBe("Senha incorreta.");
      expect(result.current.erro).toContain("Invalid origin");
    });

    it("sucesso sem segredo tem mensagem própria", async () => {
      h.enable.mockResolvedValue({ error: null, data: {} });
      const { result } = renderHook(() => useTwoFactorEnrollment());
      act(() => result.current.iniciar());

      await act(async () => {
        await result.current.gerarSegredo("senha-de-doze-ou-mais");
      });

      expect(result.current.erro).toContain("não devolveu o segredo");
    });

    it("senha errada vira mensagem de senha, sem avançar", async () => {
      h.enable.mockResolvedValue({ error: { status: 401 }, data: null });
      const { result } = renderHook(() => useTwoFactorEnrollment());
      act(() => result.current.iniciar());

      await act(async () => {
        await result.current.gerarSegredo("errada");
      });

      expect(result.current.erro).toBe("Senha incorreta.");
      expect(result.current.passo).toBe("senha");
    });

    it("conta bloqueada tem mensagem própria, não 'senha incorreta'", async () => {
      h.enable.mockResolvedValue({ error: { status: 429 }, data: null });
      const { result } = renderHook(() => useTwoFactorEnrollment());
      act(() => result.current.iniciar());

      await act(async () => {
        await result.current.gerarSegredo("qualquer");
      });

      expect(result.current.erro).toContain("bloqueada");
    });
  });

  describe("confirmar", () => {
    it("revela os códigos só depois de o código passar", async () => {
      const result = await ateEscanear();
      expect(result.current.backupCodes).toBeNull();

      await act(async () => {
        await result.current.confirmar("123456");
      });

      expect(result.current.passo).toBe("codigos");
      expect(result.current.backupCodes).toEqual(CODIGOS);
    });

    it("não confia no dispositivo ao cadastrar", async () => {
      const result = await ateEscanear();
      await act(async () => {
        await result.current.confirmar("123456");
      });

      // O padrão da lib é `true`. Cadastrar não é decidir sobre a sessão.
      expect(h.verifyTotp).toHaveBeenCalledWith({
        code: "123456",
        trustDevice: false,
      });
    });

    it("código errado NÃO avança e NÃO revela os códigos", async () => {
      // A regressão que o wizard tinha: `verifyTotp` devolve `{ error }` em vez
      // de lançar, então um `try/catch` sem checar o retorno dava o passo por
      // concluído com um código inválido.
      h.verifyTotp.mockResolvedValue({ error: { status: 400 }, data: null });
      const result = await ateEscanear();

      await act(async () => {
        await result.current.confirmar("000000");
      });

      expect(result.current.passo).toBe("escaneando");
      expect(result.current.backupCodes).toBeNull();
      expect(result.current.erro).toContain("Código inválido");
    });

    it("falha de rede não é lida como código errado", async () => {
      h.verifyTotp.mockRejectedValue(new Error("offline"));
      const result = await ateEscanear();

      await act(async () => {
        await result.current.confirmar("123456");
      });

      expect(result.current.erro).toContain("servidor");
      expect(result.current.passo).toBe("escaneando");
    });
  });

  it("cancelar apaga o segredo da memória", async () => {
    const result = await ateEscanear();
    expect(result.current.totpURI).not.toBeNull();

    act(() => result.current.cancelar());

    await waitFor(() => {
      expect(result.current.passo).toBe("ocioso");
    });
    expect(result.current.totpURI).toBeNull();
    expect(result.current.chaveManual).toBeNull();
    expect(result.current.backupCodes).toBeNull();
  });
});
