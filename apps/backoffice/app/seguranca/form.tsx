"use client";

import { authClient } from "@repo/auth/client";
import { useTwoFactorEnrollment } from "@repo/auth/two-factor-enrollment";
import { QrCode } from "@repo/design-system/cosmos/qr-code";
import type { FormEvent } from "react";
import { useState } from "react";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";
import { encerrarTodasAsSessoes } from "./actions";

const TOTP_LENGTH = 6;
const LADO_DO_QR = 168;

/**
 * Encerra as sessões antigas antes da saída — reforço, não pré-requisito.
 *
 * Falhar aqui não pode prender a pessoa numa tela cujo único botão não anda:
 * sair com uma sessão a mais é melhor do que não sair.
 */
async function varrerSessoes(): Promise<void> {
  try {
    await encerrarTodasAsSessoes();
  } catch {
    // Silencioso de propósito: ver acima.
  }
}

/**
 * Cadastro do autenticador, no painel.
 *
 * Uma tela só, com os três pedaços visíveis desde o início: onde o QR vai
 * aparecer, a senha, e o campo do código. Em duas telas a senha parecia um
 * pedágio surpresa — a pessoa clicava em "cadastrar" e era parada por algo que
 * não sabia que vinha. Vendo a forma inteira do trabalho de cara, a senha vira
 * o primeiro passo de três, que é o que ela é.
 *
 * A senha não sai, e não é atrito esquecido: `enable({ password })` exige
 * reautenticação porque cadastrar 2FA vincula um autenticador à conta. Sem
 * ela, quem tiver a sessão — cookie roubado, máquina aberta — cadastra o
 * autenticador dele na conta alheia, e roubo de sessão vira tomada permanente.
 *
 * A ordem das chamadas e a retenção dos códigos de recuperação vêm de
 * `@repo/auth/two-factor-enrollment`, compartilhado com o perfil do Cosmos e o
 * onboarding. Aqui mora só a pele.
 */
export function CadastroDe2FA() {
  const cadastro = useTwoFactorEnrollment();
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [verChaveManual, setVerChaveManual] = useState(false);
  const [saindo, setSaindo] = useState(false);

  const temSegredo = cadastro.totpURI !== null;

  // Um `<form>` só: o Enter faz a coisa certa em cada etapa, sem a pessoa
  // precisar saber que mudou de estado.
  const aoEnviar = async (event: FormEvent) => {
    event.preventDefault();
    if (temSegredo) {
      await cadastro.confirmar(codigo);
      return;
    }
    if (cadastro.passo === "ocioso") {
      cadastro.iniciar();
    }
    await cadastro.gerarSegredo(senha);
  };

  /**
   * Encerra as sessões antes de mandar para o login.
   *
   * `signOut` sozinho derruba só este navegador. As sessões abertas antes do
   * cadastro — em outra máquina, em outro navegador — seguiriam valendo sem
   * nunca ter passado pelo autenticador, que é exatamente o que o segundo
   * fator existe para impedir. Por isso a varredura no servidor primeiro, e o
   * `signOut` depois só para limpar o cookie daqui.
   *
   * Falha da varredura não impede a saída: melhor sair com sessões a mais do
   * que prender a pessoa numa tela sem botão que funcione.
   */
  const sairEEntrar = async () => {
    setSaindo(true);
    try {
      await varrerSessoes();
      await authClient.signOut();
    } finally {
      // Navegação dura: o cookie acabou de ser invalidado e quem precisa reler
      // é o servidor, no guard.
      window.location.assign("/sign-in");
    }
  };

  // ── Terminal: os códigos de recuperação, uma vez ──────────────────────────
  if (cadastro.backupCodes) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ margin: 0, fontSize: "var(--fs-base)", lineHeight: 1.6 }}>
          Autenticador cadastrado. Guarde os códigos de recuperação — eles não
          aparecem de novo.
        </p>
        <div
          className="mono"
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            padding: 12,
            borderRadius: "var(--r-md)",
            border: "1px dashed var(--hairline-strong)",
            fontSize: "var(--fs-base)",
          }}
        >
          {cadastro.backupCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-nota)",
            lineHeight: 1.55,
            color: "var(--ink-faint)",
          }}
        >
          Entrar de novo é obrigatório: a sessão atual foi aberta antes do 2FA
          existir, e só o login novo passa pelo autenticador.
        </p>

        <BotaoPrimario disabled={saindo} onClick={sairEEntrar} type="button">
          {saindo ? "Saindo" : "Guardei — sair e entrar no painel"}
        </BotaoPrimario>
      </div>
    );
  }

  return (
    <form
      onSubmit={aoEnviar}
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {/* 1 — O QR. O espaço é reservado desde o início: aparecer do nada
          empurraria os campos para baixo no exato momento em que a pessoa está
          prestes a clicar neles. */}
      <div
        style={{
          margin: "0 auto",
          width: LADO_DO_QR + 24,
          height: LADO_DO_QR + 24,
          display: "grid",
          placeItems: "center",
          padding: 12,
          borderRadius: "var(--r-md)",
          background: temSegredo ? "#fff" : "transparent",
          border: temSegredo ? "none" : "1px dashed var(--hairline-strong)",
        }}
      >
        {cadastro.totpURI ? (
          <QrCode
            size={LADO_DO_QR}
            title="QR code para o aplicativo autenticador"
            value={cadastro.totpURI}
          />
        ) : (
          <p
            style={{
              margin: 0,
              maxWidth: 150,
              textAlign: "center",
              fontSize: "var(--fs-nota)",
              lineHeight: 1.55,
              color: "var(--ink-faint)",
              fontWeight: 500,
            }}
          >
            O QR aparece aqui quando você confirmar a senha.
          </p>
        )}
      </div>

      {temSegredo ? (
        <div style={{ textAlign: "center" }}>
          <button
            onClick={() => setVerChaveManual((v) => !v)}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: "var(--fs-nota)",
              color: "var(--ink-faint)",
              textDecoration: "underline",
              cursor: "pointer",
            }}
            type="button"
          >
            {verChaveManual ? "Ocultar chave" : "Não consigo escanear"}
          </button>
          {verChaveManual && cadastro.chaveManual ? (
            <code
              className="mono"
              style={{
                display: "block",
                marginTop: 8,
                userSelect: "all",
                wordBreak: "break-all",
                padding: "8px 10px",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--hairline)",
                fontSize: "var(--fs-base)",
                letterSpacing: ".08em",
              }}
            >
              {cadastro.chaveManual.match(/.{1,4}/g)?.join(" ") ??
                cadastro.chaveManual}
            </code>
          ) : null}
        </div>
      ) : null}

      {/* 2 — A senha. Some depois de aceita: mantê-la editável convidaria a
          redigitar algo que já valeu, e o campo não faz mais nada. */}
      {temSegredo ? (
        <p
          style={{
            margin: 0,
            fontSize: "var(--fs-base)",
            color: "var(--ink-faint)",
            fontWeight: 600,
          }}
        >
          Senha confirmada.
        </p>
      ) : (
        <Campo htmlFor="senha" label="Sua senha">
          <input
            // biome-ignore lint/a11y/noAutofocus: primeiro campo acionável de
            // uma tela cujo propósito único é este formulário.
            autoComplete="current-password"
            autoFocus
            id="senha"
            onChange={(e) => setSenha(e.target.value)}
            style={INPUT}
            type="password"
            value={senha}
          />
        </Campo>
      )}

      {/* 3 — O código. Visível desde o início para a pessoa saber que ainda vem,
          desabilitado até existir um segredo contra o qual verificar. */}
      <Campo htmlFor="totp" label="Código do autenticador">
        <input
          autoComplete="one-time-code"
          className="mono"
          disabled={!temSegredo}
          id="totp"
          inputMode="numeric"
          maxLength={TOTP_LENGTH}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          placeholder={temSegredo ? "" : "depois de escanear"}
          style={{
            ...INPUT,
            letterSpacing: temSegredo ? ".3em" : "normal",
            textAlign: temSegredo ? "center" : "left",
            opacity: temSegredo ? 1 : 0.5,
          }}
          value={codigo}
        />
      </Campo>

      {cadastro.erro ? <Erro>{cadastro.erro}</Erro> : null}

      <BotaoPrimario
        disabled={
          cadastro.pendente ||
          (temSegredo ? codigo.length !== TOTP_LENGTH : senha.length === 0)
        }
      >
        {rotuloDoBotao(cadastro.pendente, temSegredo)}
      </BotaoPrimario>
    </form>
  );
}

function rotuloDoBotao(pendente: boolean, temSegredo: boolean): string {
  if (pendente) {
    return temSegredo ? "Verificando" : "Gerando";
  }
  return temSegredo ? "Confirmar e ativar" : "Gerar QR code";
}
