import Link from "next/link";
import type { ReactNode } from "react";
import { BO_NAV, FORA_DO_PAINEL } from "./nav";

/**
 * Shell do Big Bang: topbar + sidebar. Server Component — a navegação é toda
 * `<Link>`, sem estado de cliente.
 *
 * O badge de papel na topbar não é enfeite: o operador precisa saber, antes de
 * clicar, se a sessão dele escreve. `MEMBER` vendo botão apagado sem contexto
 * acha que a tela quebrou (SRD FR-0.4).
 */
export function Shell({
  staff,
  children,
}: {
  staff: { name: string | null; email: string; canWrite: boolean };
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen grid-cols-[232px_1fr] grid-rows-[56px_1fr]">
      <header className="col-span-2 flex items-center gap-4 border-b px-5">
        <span className="font-bold text-sm tracking-[.1em]">NEBULOZ</span>
        <span className="rounded-full border px-2 py-0.5 font-bold font-mono text-[10px] text-muted-foreground tracking-[.12em]">
          BIG BANG
        </span>
        <div className="flex-1" />
        <span
          className={`rounded-full border px-2.5 py-1 font-semibold text-xs ${
            staff.canWrite
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          }`}
        >
          {staff.canWrite
            ? "ADMIN · leitura e escrita"
            : "MEMBER · somente leitura"}
        </span>
        <span className="text-muted-foreground text-xs">{staff.email}</span>
      </header>

      <nav className="flex flex-col gap-5 overflow-y-auto border-r p-3">
        {BO_NAV.map((grupo) => (
          <div className="flex flex-col gap-0.5" key={grupo.section}>
            <div className="px-2.5 pb-1.5 font-bold text-[10px] text-muted-foreground uppercase tracking-[.08em]">
              {grupo.section}
            </div>
            {grupo.items.map((item) => (
              <Link
                className="flex items-center justify-between rounded-md px-2.5 py-2 text-sm hover:bg-muted"
                href={item.href}
                key={item.href}
              >
                <span className={item.pendente ? "text-muted-foreground" : ""}>
                  {item.label}
                </span>
                {item.pendente ? (
                  <span
                    className="rounded border px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground"
                    title={item.pendente}
                  >
                    pendente
                  </span>
                ) : null}
              </Link>
            ))}
          </div>
        ))}

        <div className="flex-1" />
        <div className="mx-1 rounded-md border border-dashed p-3">
          <div className="font-bold text-[10px] text-amber-600 uppercase tracking-[.08em] dark:text-amber-400">
            Fora deste painel
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground leading-relaxed">
            {FORA_DO_PAINEL}
          </p>
        </div>
      </nav>

      <main className="overflow-y-auto p-7">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}

/**
 * Tela que ainda não existe, dizendo **por que** — nunca "em breve".
 *
 * "Em breve" foi exatamente o padrão que tivemos de arrancar do Cosmos: promete
 * sem informar e não ajuda ninguém a decidir. Nomear a entidade que falta
 * transforma a ausência em roadmap legível dentro do produto.
 */
export function Pendente({
  titulo,
  motivo,
}: {
  titulo: string;
  motivo: string;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-lg border border-dashed p-8 text-center">
      <h1 className="font-semibold text-lg">{titulo}</h1>
      <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
        {motivo}
      </p>
      <Link className="mt-5 inline-block text-sm underline" href="/">
        Voltar para Tenants
      </Link>
    </div>
  );
}
