import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  readonly children: ReactNode;
};

const AuthLayout = ({ children }: AuthLayoutProps) => (
  <div className="grid h-dvh grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
    {/* Painel de marca — escuro nos dois temas, por decisão. */}
    <aside className="relative hidden flex-col justify-between overflow-hidden border-white/8 border-r bg-[#0b0e17] p-12 lg:flex xl:p-16">
      {/* Grade de fundo no mesmo ritmo das iterações do rail. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.045) 0 1px, transparent 1px 96px)",
        }}
      />

      <div className="relative z-10 flex items-center gap-2.5">
        <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-[#5e6ad2]" />
        <span className="font-mono text-[#e7e9f5] text-[13px] uppercase tracking-[0.32em]">
          Nebuloz
        </span>
      </div>

      <h2 className="relative z-10 font-display font-semibold text-[#f2f3fa] text-[2.1rem] leading-[1.08] tracking-[-0.03em] xl:text-[2.5rem] 2xl:text-[3rem]">
        Uma suíte.
        <br />
        <span className="text-[#8b95f0]">Um só login.</span>
      </h2>

      <div className="relative z-10">
        <p className="font-mono text-[#454b5c] text-[10px] uppercase tracking-[0.2em]">
          Nebuloz · {new Date().getFullYear()}
        </p>
      </div>
    </aside>

    {/* Coluna do formulário */}
    <main className="relative flex items-center justify-center px-6 py-12 sm:px-10">
      <div className="absolute top-5 right-5">
        <ModeToggle />
      </div>

      <div className="flex w-full max-w-[380px] flex-col">
        <div className="mb-10 flex items-center gap-2.5 lg:hidden">
          <span className="h-2.5 w-2.5 rotate-45 rounded-[2px] bg-[#5e6ad2]" />
          <span className="font-mono text-[13px] uppercase tracking-[0.32em]">
            Nebuloz
          </span>
        </div>
        {children}
      </div>
    </main>
  </div>
);

export default AuthLayout;
