"use client";

import { authClient } from "@repo/auth/client";
import { useState, useTransition } from "react";
import { createOnboardingWorkspace } from "../../actions/onboarding";

type Step = "welcome" | "workspace" | "security" | "done";

function extractTotpSecret(uri: string): string | null {
  try {
    return new URL(uri).searchParams.get("secret");
  } catch {
    return null;
  }
}

type Props = {
  fromInvite: boolean;
  workspaceName: string | null;
  userName: string;
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors";

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: wizard has inherent step-based complexity
export function OnboardingWizard({
  fromInvite,
  workspaceName,
  userName,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>(fromInvite ? "security" : "welcome");
  const [wsName, setWsName] = useState("");
  const [wsError, setWsError] = useState<string | null>(null);
  const [totpUri, setTotpUri] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [totpCode, setTotpCode] = useState("");
  const [twoFaPassword, setTwoFaPassword] = useState("");
  const [showManualKey, setShowManualKey] = useState(false);
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [skip2fa, setSkip2fa] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const STEPS: Step[] = fromInvite
    ? ["security", "done"]
    : ["welcome", "workspace", "security", "done"];

  const stepIndex = STEPS.indexOf(step);
  const totalSteps = STEPS.length;

  function handleCreateWorkspace() {
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
        setWsError(
          err instanceof Error ? err.message : "Erro ao criar workspace."
        );
      }
    });
  }

  async function handleEnable2FA() {
    setTwoFaLoading(true);
    setTwoFaError(null);
    try {
      const result = await authClient.twoFactor.enable({
        password: twoFaPassword,
      });
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
    setNavigating(true);
    // Hard navigation forces full session re-read, preventing cached
    // session from triggering the onboarding redirect loop.
    window.location.href = "/portfolio";
  }

  const totpSecret = totpUri ? extractTotpSecret(totpUri) : null;
  const showWorkspaceBadge = fromInvite && workspaceName !== null;
  const showManualKeySection = showManualKey && totpSecret !== null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="space-y-2 text-center">
          <span className="font-bold text-2xl tracking-tight">
            <span className="text-primary">◆</span> Cosmos
          </span>
          {/* Progress */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {STEPS.filter((s) => s !== "done").map((s, i) => (
              <div
                className="h-1.5 rounded-full transition-all duration-300"
                key={s}
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
          <p className="text-muted-foreground text-xs">
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
              <h1 className="font-bold text-2xl">
                Olá{userName ? `, ${userName.split(" ")[0]}` : ""}!
              </h1>
              <p className="mt-2 text-muted-foreground text-sm">
                Bem-vindo ao Cosmos — sua plataforma de PI Planning SAFe. Vamos
                configurar tudo em menos de 2 minutos.
              </p>
            </div>
            <button
              className="w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90"
              onClick={() => setStep("workspace")}
              type="button"
            >
              Começar →
            </button>
          </div>
        )}

        {/* ── WORKSPACE ── */}
        {step === "workspace" && (
          <div className="space-y-6">
            <div>
              <h1 className="font-bold text-2xl">Crie seu workspace</h1>
              <p className="mt-1 text-muted-foreground text-sm">
                O workspace é onde seu time organiza ARTs, épicos e PI Planning.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="font-medium text-sm" htmlFor="ws-name">
                  Nome do workspace
                </label>
                <input
                  autoFocus
                  className={inputClass}
                  id="ws-name"
                  onChange={(e) => setWsName(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleCreateWorkspace()
                  }
                  placeholder="Ex: Nexus ART, Squad Phoenix"
                  type="text"
                  value={wsName}
                />
                {wsError !== null && (
                  <p className="text-destructive text-xs">{wsError}</p>
                )}
              </div>
              <button
                className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={wsName.trim().length < 2 || isPending}
                onClick={handleCreateWorkspace}
                type="button"
              >
                {isPending ? "Criando…" : "Criar workspace →"}
              </button>
            </div>
          </div>
        )}

        {/* ── SECURITY / 2FA ── */}
        {step === "security" && (
          <div className="space-y-6">
            {showWorkspaceBadge ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-center">
                <p className="font-semibold text-primary text-xs uppercase tracking-widest">
                  Você entrou em
                </p>
                <p className="mt-0.5 font-bold text-base">{workspaceName}</p>
              </div>
            ) : null}

            <div>
              <h1 className="font-bold text-2xl">Segurança da conta</h1>
              <p className="mt-1 text-muted-foreground text-sm">
                Autenticação de dois fatores (2FA) adiciona uma camada extra de
                proteção.
              </p>
            </div>

            {!(totpUri || skip2fa) && (
              <div className="space-y-4">
                <div className="space-y-3 rounded-xl border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">🔐</span>
                    <div>
                      <p className="font-semibold text-sm">
                        Ativar autenticação 2FA
                      </p>
                      <p className="mt-0.5 text-muted-foreground text-xs">
                        Use Google Authenticator, Authy ou similar para gerar
                        códigos de 6 dígitos.
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <input
                      className={inputClass}
                      onChange={(e) => setTwoFaPassword(e.target.value)}
                      placeholder="Confirme sua senha para ativar"
                      type="password"
                      value={twoFaPassword}
                    />
                    {twoFaError !== null && (
                      <p className="text-destructive text-xs">{twoFaError}</p>
                    )}
                    <button
                      className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={twoFaPassword.length < 12 || twoFaLoading}
                      onClick={handleEnable2FA}
                      type="button"
                    >
                      {twoFaLoading ? "Ativando…" : "Ativar 2FA"}
                    </button>
                  </div>
                </div>

                <button
                  className="w-full text-muted-foreground text-sm transition-colors hover:text-foreground"
                  onClick={() => {
                    setSkip2fa(true);
                    setStep("done");
                  }}
                  type="button"
                >
                  Pular por agora →
                </button>
              </div>
            )}

            {totpUri !== null && (
              <div className="space-y-4">
                <div className="space-y-4 rounded-xl border bg-card p-4">
                  <div className="space-y-3">
                    <p className="font-semibold text-sm">
                      1. Escaneie o QR Code
                    </p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {/* biome-ignore lint/performance/noImgElement: external QR code service, no next/image domain configured */}
                    <img
                      alt="QR Code 2FA"
                      className="mx-auto rounded-lg border"
                      height={180}
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(totpUri)}`}
                      width={180}
                    />
                    <button
                      className="w-full text-muted-foreground text-xs underline underline-offset-2 transition-colors hover:text-foreground"
                      onClick={() => setShowManualKey((v) => !v)}
                      type="button"
                    >
                      {showManualKey
                        ? "Ocultar chave manual"
                        : "Não consigo escanear — mostrar chave"}
                    </button>
                    {showManualKeySection ? (
                      <div className="space-y-1">
                        <p className="text-muted-foreground text-xs">
                          Digite esta chave no seu app autenticador:
                        </p>
                        <code className="block w-full select-all break-all rounded-lg border bg-muted px-3 py-2 text-center font-mono text-sm tracking-widest">
                          {(totpSecret as string).match(/.{1,4}/g)?.join(" ") ??
                            totpSecret}
                        </code>
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <p className="font-semibold text-sm">
                      2. Insira o código gerado
                    </p>
                    <input
                      className={`${inputClass} text-center font-mono text-xl tracking-[0.5em]`}
                      inputMode="numeric"
                      maxLength={6}
                      onChange={(e) =>
                        setTotpCode(e.target.value.replace(/\D/g, ""))
                      }
                      pattern="[0-9]{6}"
                      placeholder="000000"
                      type="text"
                      value={totpCode}
                    />
                    {twoFaError !== null && (
                      <p className="text-destructive text-xs">{twoFaError}</p>
                    )}
                    <button
                      className="w-full rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={totpCode.length !== 6 || twoFaLoading}
                      onClick={handleVerify2FA}
                      type="button"
                    >
                      {twoFaLoading ? "Verificando…" : "Confirmar e ativar"}
                    </button>
                  </div>

                  {backupCodes.length > 0 && (
                    <div className="space-y-1">
                      <p className="font-semibold text-muted-foreground text-xs">
                        Códigos de backup (guarde em local seguro):
                      </p>
                      <div className="grid grid-cols-2 gap-1">
                        {backupCodes.map((code) => (
                          <code
                            className="rounded bg-muted px-2 py-1 font-mono text-xs"
                            key={code}
                          >
                            {code}
                          </code>
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
              <h1 className="font-bold text-2xl">Tudo pronto!</h1>
              <p className="mt-2 text-muted-foreground text-sm">
                {fromInvite
                  ? `Você já faz parte do workspace ${workspaceName ?? ""}. Bora planejar!`
                  : "Seu workspace está configurado. Comece seu primeiro PI Planning agora."}
              </p>
            </div>
            <button
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={navigating}
              onClick={goToPortfolio}
              type="button"
            >
              {navigating ? (
                <>
                  <svg
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <title>Carregando</title>
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      fill="currentColor"
                    />
                  </svg>
                  Carregando...
                </>
              ) : (
                "Entrar no Cosmos →"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
