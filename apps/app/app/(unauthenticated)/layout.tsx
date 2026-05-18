import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import type { ReactNode } from "react";

type AuthLayoutProps = {
  readonly children: ReactNode;
};

const AuthLayout = ({ children }: AuthLayoutProps) => (
  <div className="container relative grid h-dvh flex-col items-center justify-center lg:max-w-none lg:grid-cols-2 lg:px-0">
    {/* Sidebar */}
    <div className="relative hidden h-full flex-col bg-[#0f1011] p-10 text-white lg:flex">
      <div className="absolute inset-0 bg-[#0f1011]" />
      {/* Accent bar */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: "linear-gradient(90deg, #5e6ad2 0%, #828fff 60%, #5e6ad2 100%)" }}
      />

      {/* Logo */}
      <div className="relative z-20 flex items-center gap-2">
        <span className="text-[#5e6ad2] text-xl">◆</span>
        <span className="font-bold text-lg tracking-tight text-white">Cosmos</span>
        <span className="ml-2 rounded-full border border-[#34343a] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[#62666d]">
          Beta
        </span>
      </div>

      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>

      {/* Middle content */}
      <div className="relative z-20 mt-auto space-y-8">
        {/* Feature list */}
        <div className="space-y-3">
          {[
            { icon: "🗺️", label: "PI Planning SAFe", desc: "Planeje incrementos com ARTs e times" },
            { icon: "🔗", label: "Dependências visuais", desc: "Mapeie e resolva bloqueios em tempo real" },
            { icon: "📊", label: "OKRs + Lean Budget", desc: "Alinhe estratégia e investimento" },
            { icon: "🤖", label: "IA para riscos", desc: "Detecção preditiva de impedimentos" },
          ].map(({ icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3">
              <span className="mt-0.5 text-base">{icon}</span>
              <div>
                <p className="text-sm font-semibold text-[#f7f8f8]">{label}</p>
                <p className="text-xs text-[#62666d]">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quote */}
        <blockquote className="border-l-2 border-[#5e6ad2] pl-4">
          <p className="text-sm text-[#8a8f98] leading-relaxed">
            "Transformamos PI Planning de uma cerimônia anual em inteligência contínua."
          </p>
          <footer className="mt-1 text-xs text-[#62666d]">— Equipe Nebuloz</footer>
        </blockquote>
      </div>

      {/* Footer */}
      <div className="relative z-20 mt-6 flex items-center gap-3">
        <p className="text-xs text-[#3e3e44]">© {new Date().getFullYear()} Nebuloz · nebuloz.com</p>
      </div>
    </div>

    {/* Form area */}
    <div className="lg:p-8">
      <div className="mx-auto flex w-full max-w-[400px] flex-col justify-center space-y-6">
        {children}
      </div>
    </div>
  </div>
);

export default AuthLayout;
