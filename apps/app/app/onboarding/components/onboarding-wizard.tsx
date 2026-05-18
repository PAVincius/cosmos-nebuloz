"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@repo/auth/client";
import { createOnboardingWorkspace } from "../../actions/onboarding";

type Step = "welcome" | "workspace" | "security" | "done";

type Props = {
  fromInvite: boolean;
  workspaceName: string | null;
  userName: string;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors";

export function OnboardingWizard({ fromInvite, workspaceName, userName }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(fromInvite ? "security" : "welcome");
  const [wsName, setWsName] = useState("");
  const [wsError, setWsError] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [totpCode, setTotpCode] = useState("");
  const [twoFaPassword, setTwoFaPassword] = useState("");
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [skip2fa, setSkip2fa] = useState(false);

  const STEPS: Step[] = fromInvite
    ? ["security", "done"]
    : ["welcome", "workspace", "security", "done"];

  const stepIndex = STEPS.indexOf(step);
  const totalSteps = STEPS.length;

  async function handleCreateWorkspace() {
    if (wsName.trim().length < 2) {
      setWsError("Nome deve ter ao menos 2 caracteres.");
      return;
    }
    setWsError(null);
    startTransition(async () => {
      try {
        await createOnboardingWorkspace(wsName);
        setStep("security");
      } catch (err: unknown) {
        setWsError(err instanceof Error ? err.message : "Erro ao criar workspace.");
      }
    });
  }

  async function handleEnable2FA() {
    setTwoFaLoading(true);
    setTwoFaError(null);
    try {
      const result = await authClient.twoFactor.enable({ password: twoFaPassword });
      if (result?.data?.totpURI) {
        setTotpUri(result.data.totpURI);
        setBackupCodes(result.data.backupCodes ?? []);
      } else {
        setTwoFaError("Erro ao ativar 2FA. Verifique sua senha.");
      }
    } catch {
      setTwoFaError("Erro ao ativar 2FA. Tente novamente.");
    } finally {
      setTwoFaLoading(false);
    }
  }

  async function handleVerify2FA() {
    setTwoFaLoading(true);
    setTwoFaError(null);
    try {
      await authClient.twoFactor.verifyTotp({ code: totpCode });
      setStep("done");
    } catch {
      setTwoFaError("Código inválido. Verifique seu aplicativo autenticador.");
    } finally {
      setTwoFaLoading(false);
    }
  }

  function goToPortfolio() {
    router.push("/portfolio");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <span className="text-2xl font-bold tracking-tight">
            <span className="text-primary">◆</span> Cosmos
          </span>
          {/* Progress */}
          <div className="flex items-center gap-1.5 justify-center mt-4">
            {STEPS.filter(s => s !== "done").map((s, i) => (
              <div
                key={s}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: 32,
                  backgroundColor:
                    i <= stepIndex
                      ? "hsl(var(--primary))"
                      : "hsl(var(--border))",
                }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {step !== "done"
              ? `Passo ${Math.min(stepIndex + 1, totalSteps - 1)} de ${totalSteps - 1}`
              : "Concluído!"}
          </p>
        </div>

        {/* ── WELCOME ── */}
        {step === "welcome" && (
          <div className="space-y-6 text-center">
            <div className="text-5xl">👋</div>
            <div>
              <h1 className="text-2xl font-bold">Olá{userName ? `, ${userName.split(" ")[0]}` : ""}!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Bem-vindo ao Cosmos — sua plataforma de PI Planning SAFe.
                Vamos configurar tudo em menos de 2 minutos.
              </p>
            </div>
            <button
              onClick={() => setStep("workspace")}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Começar →
            </button>
          </div>
        )}

        {/* ── WORKSPACE ── */}
        {step === "workspace" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Crie seu workspace</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                O workspace é onde seu time organiza ARTs, épicos e PI Planning.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="ws-name">
                  Nome do workspace
                </label>
                <input
                  id="ws-name"
                  type="text"
                  placeholder="Ex: Nexus ART, Squad Phoenix"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  className={inputClass}
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
                />
                {wsError && <p className="text-xs text-destructive">{wsError}</p>}
              </div>
              <button
                onClick={handleCreateWorkspace}
                disabled={wsName.trim().length < 2 || isPending}
                className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? "Criando…" : "Criar workspace →"}
              </button>
            </div>
          </div>
        )}

        {/* ── SECURITY / 2FA ── */}
        {step === "security" && (
          <div className="space-y-6">
            {fromInvite && workspaceName && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-center">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary">Você entrou em</p>
                <p className="mt-0.5 text-base font-bold">{workspaceName}</p>
              </div>
            )}

            <div>
              <h1 className="text-2xl font-bold">Segurança da conta</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Autenticação de dois fatores (2FA) adiciona uma camada extra de proteção.
              </p>
            </div>

            {!totpUri && !skip2fa && (
              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">🔐</span>
                    <div>
                      <p className="text-sm font-semibold">Ativar autenticação 2FA</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Use Google Authenticator, Authy ou similar para gerar códigos de 6 dígitos.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <input
                      type="password"
                      placeholder="Confirme sua senha para ativar"
                      value={twoFaPassword}
                      onChange={(e) => setTwoFaPassword(e.target.value)}
                      className={inputClass}
                    />
                    {twoFaError && <p className="text-xs text-destructive">{twoFaError}</p>}
                    <button
                      onClick={handleEnable2FA}
                      disabled={twoFaPassword.length < 8 || twoFaLoading}
                      className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {twoFaLoading ? "Ativando…" : "Ativar 2FA"}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => { setSkip2fa(true); setStep("done"); }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Pular por agora →
                </button>
              </div>
            )}

            {totpUri && (
              <div className="space-y-4">
                <div className="rounded-xl border bg-card p-4 space-y-4">
                  <div>
                    <p className="text-sm font-semibold mb-2">1. Escaneie o QR Code</p>
                    {/* QR Code via Google Charts API */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpUri)}`}
                      alt="QR Code 2FA"
                      width={180}
                      height={180}
                      className="mx-auto rounded-lg border"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-semibold">2. Insira o código gerado</p>
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      placeholder="000000"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                      className={`${inputClass} text-center text-xl tracking-[0.5em] font-mono`}
                    />
                    {twoFaError && <p className="text-xs text-destructive">{twoFaError}</p>}
                    <button
                      onClick={handleVerify2FA}
                      disabled={totpCode.length !== 6 || twoFaLoading}
                      className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {twoFaLoading ? "Verificando…" : "Confirmar e ativar"}
                    </button>
                  </div>

                  {backupCodes.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground">Códigos de backup (guarde em local seguro):</p>
                      <div className="grid grid-cols-2 gap-1">
                        {backupCodes.map((code) => (
                          <code key={code} className="rounded bg-muted px-2 py-1 text-xs font-mono">{code}</code>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DONE ── */}
        {step === "done" && (
          <div className="space-y-6 text-center">
            <div className="text-5xl">🚀</div>
            <div>
              <h1 className="text-2xl font-bold">Tudo pronto!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {fromInvite
                  ? `Você já faz parte do workspace ${workspaceName ?? ""}. Bora planejar!`
                  : "Seu workspace está configurado. Comece seu primeiro PI Planning agora."}
              </p>
            </div>
            <button
              onClick={goToPortfolio}
              className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Entrar no Cosmos →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
