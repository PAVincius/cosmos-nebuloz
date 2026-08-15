"use client";

import { useTwoFactorEnrollment } from "@repo/auth/two-factor-enrollment";
import { QrCode } from "@repo/design-system/cosmos/qr-code";
import type { FormEvent } from "react";
import { useState } from "react";
import { BotaoPrimario, Campo, Erro, INPUT } from "@/components/campo";

const TOTP_LENGTH = 6;
const SENHA_MINIMA = 12;

/**
 * Cadastro do autenticador, no painel.
 *
 * A ordem das chamadas e a retenção dos códigos de recuperação vêm de
 * `@repo/auth/two-factor-enrollment` — o mesmo fluxo que o perfil do Cosmos e o
 * wizard de onboarding usam. Aqui só mora a pele: as primitivas do painel, que
 * não são as do app.
 */
export function CadastroDe2FA() {
  const cadastro = useTwoFactorEnrollment();
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [verChaveManual, setVerChaveManual] = useState(false);

  const pedirSegredo = async (event: FormEvent) => {
    event.preventDefault();
    if (cadastro.passo === "ocioso") {
      cadastro.iniciar();
    }
    await cadastro.gerarSegredo(senha);
  };

  const confirmar = async (event: FormEvent) => {
    event.preventDefault();
    await cadastro.confirmar(codigo);
  };

  // ── Pronto: os códigos de recuperação, uma vez ────────────────────────────
  if (cadastro.backupCodes) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6 }}>
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
            fontSize: 12,
          }}
        >
          {cadastro.backupCodes.map((c) => (
            <span key={c}>{c}</span>
          ))}
        </div>
        <a
          href="/sign-in"
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            color: "var(--accent-text)",
          }}
        >
          Guardei — entrar no painel
        </a>
      </div>
    );
  }

  // ── Escanear e confirmar ──────────────────────────────────────────────────
  if (cadastro.totpURI) {
    return (
      <form
        onSubmit={confirmar}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        <div
          style={{
            margin: "0 auto",
            padding: 12,
            background: "#fff",
            borderRadius: "var(--r-md)",
          }}
        >
          <QrCode
            size={168}
            title="QR code para o aplicativo autenticador"
            value={cadastro.totpURI}
          />
        </div>

        <button
          onClick={() => setVerChaveManual((v) => !v)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            fontSize: 11.5,
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
              userSelect: "all",
              wordBreak: "break-all",
              padding: "8px 10px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--hairline)",
              fontSize: 12.5,
              textAlign: "center",
              letterSpacing: ".08em",
            }}
          >
            {cadastro.chaveManual.match(/.{1,4}/g)?.join(" ") ??
              cadastro.chaveManual}
          </code>
        ) : null}

        <Campo htmlFor="totp" label="Código do autenticador">
          <input
            autoComplete="one-time-code"
            className="mono"
            id="totp"
            inputMode="numeric"
            maxLength={TOTP_LENGTH}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            style={{ ...INPUT, letterSpacing: ".3em", textAlign: "center" }}
            value={codigo}
          />
        </Campo>

        {cadastro.erro ? <Erro>{cadastro.erro}</Erro> : null}

        <BotaoPrimario
          disabled={cadastro.pendente || codigo.length !== TOTP_LENGTH}
        >
          {cadastro.pendente ? "Verificando" : "Confirmar e ativar"}
        </BotaoPrimario>
      </form>
    );
  }

  // ── Senha ─────────────────────────────────────────────────────────────────
  return (
    <form
      onSubmit={pedirSegredo}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <p
        style={{
          margin: 0,
          fontSize: 12.5,
          color: "var(--ink-muted)",
          lineHeight: 1.6,
        }}
      >
        Use Google Authenticator, Authy ou similar. Confirme sua senha para
        gerar o segredo.
      </p>

      <Campo htmlFor="senha" label="Sua senha">
        <input
          autoComplete="current-password"
          id="senha"
          onChange={(e) => setSenha(e.target.value)}
          style={INPUT}
          type="password"
          value={senha}
        />
      </Campo>

      {cadastro.erro ? <Erro>{cadastro.erro}</Erro> : null}

      <BotaoPrimario
        disabled={cadastro.pendente || senha.length < SENHA_MINIMA}
      >
        {cadastro.pendente ? "Gerando" : "Gerar QR code"}
      </BotaoPrimario>
    </form>
  );
}
