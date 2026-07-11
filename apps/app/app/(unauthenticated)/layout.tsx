import { ModeToggle } from "@repo/design-system/components/mode-toggle";
import { Link2, Map, ShieldAlert, TrendingUp } from "lucide-react";
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
        className="absolute top-0 right-0 left-0 h-[3px]"
        style={{
          background:
            "linear-gradient(90deg, #5e6ad2 0%, #828fff 60%, #5e6ad2 100%)",
        }}
      />

      {/* Logo */}
      <div className="relative z-20 flex items-center gap-2">
        <span className="text-[#818cf8] text-xl">◆</span>
        <span className="font-bold text-lg text-white tracking-tight">
          Cosmos
        </span>
        <span className="ml-2 rounded-full border border-[#818cf8]/40 px-2 py-0.5 font-semibold text-[#818cf8] text-[10px] uppercase tracking-widest">
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
            {
              icon: Map,
              label: "PI Planning SAFe",
              desc: "Planeje incrementos com ARTs e times",
            },
            {
              icon: Link2,
              label: "Dependências visuais",
              desc: "Mapeie e resolva bloqueios em tempo real",
            },
            {
              icon: TrendingUp,
              label: "OKRs + Lean Budget",
              desc: "Alinhe estratégia e investimento",
            },
            {
              icon: ShieldAlert,
              label: "IA para riscos",
              desc: "Detecção preditiva de impedimentos",
            },
          ].map(({ icon: Icon, label, desc }) => (
            <div className="flex items-start gap-3" key={label}>
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#5e6ad2]" />
              <div>
                <p className="font-semibold text-[#f7f8f8] text-sm">{label}</p>
                <p className="text-[#62666d] text-xs">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Quote */}
        <blockquote className="border-[#5e6ad2] border-l-2 pl-4">
          <p className="text-[#8a8f98] text-sm leading-relaxed">
            "Transformamos PI Planning de uma cerimônia anual em inteligência
            contínua."
          </p>
          <footer className="mt-1 text-[#62666d] text-xs">
            — Equipe Nebuloz
          </footer>
        </blockquote>
      </div>

      {/* Footer */}
      <div className="relative z-20 mt-6 flex items-center gap-3">
        <p className="text-[#3e3e44] text-xs">
          © {new Date().getFullYear()} Nebuloz · nebuloz.com
        </p>
      </div>
    </div>

    {/* Form area */}
    <div className="relative flex h-full items-center justify-center lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-[#5e6ad2]/[0.06]" />
      <div className="relative mx-auto flex w-full max-w-[400px] flex-col space-y-6">
        {children}
      </div>
    </div>
  </div>
);

export default AuthLayout;
