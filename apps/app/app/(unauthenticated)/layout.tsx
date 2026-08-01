import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  readonly children: ReactNode;
};

/** A cadência de um PI: cinco iterações de execução e a janela de IP que fecha
 *  o incremento. É a estrutura que o Cosmos organiza — desenhá-la diz mais
 *  sobre o produto do que ilustrar o "cosmos" do nome. */
const CADENCE = [
  { id: "I1", ip: false },
  { id: "I2", ip: false },
  { id: "I3", ip: false },
  { id: "I4", ip: false },
  { id: "I5", ip: false },
  { id: "IP", ip: true },
] as const;

const CadenceRail = () => (
  <div aria-hidden="true" className="select-none">
    <div className="h-px w-full bg-white/15" />
    <ol className="flex items-stretch">
      {CADENCE.map((segment, index) => (
        <li
          className={`motion-safe:fade-in motion-safe:slide-in-from-top-1 relative flex-1 pt-3 pb-2 motion-safe:animate-in motion-safe:fill-mode-backwards motion-safe:duration-500 ${
            segment.ip ? "bg-[#5e6ad2]/12" : ""
          }`}
          key={segment.id}
          style={{ animationDelay: `${180 + index * 70}ms` }}
        >
          <span
            className={`absolute top-0 left-0 w-px ${
              segment.ip ? "h-3 bg-[#8b95f0]" : "h-2 bg-white/30"
            }`}
          />
          <span
            className={`pl-2 font-mono text-[11px] tracking-[0.12em] ${
              segment.ip ? "text-[#a5aef7]" : "text-[#6f7689]"
            }`}
          >
            {segment.id}
          </span>
        </li>
      ))}
      <li className="relative w-px">
        <span className="absolute top-0 left-0 h-2 w-px bg-white/30" />
      </li>
    </ol>
    <div className="mt-1 flex justify-between font-mono text-[#565c6d] text-[10px] uppercase tracking-[0.18em]">
      <span>Execução</span>
      <span>Inovação e planejamento</span>
    </div>
  </div>
);

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
          Cosmos
        </span>
      </div>

      <h2 className="relative z-10 font-display font-semibold text-[#f2f3fa] text-[2.1rem] leading-[1.08] tracking-[-0.03em] xl:text-[2.5rem] 2xl:text-[3rem]">
        Cinco iterações.
        <br />
        Uma janela de IP.
        <br />
        <span className="text-[#8b95f0]">Nenhuma decisão perdida.</span>
      </h2>

      <div className="relative z-10 space-y-10">
        <CadenceRail />
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
            Cosmos
          </span>
        </div>
        {children}
      </div>
    </main>
  </div>
);

export default AuthLayout;
