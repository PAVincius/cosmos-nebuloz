import { requireTenantSession } from "@repo/auth/server";
import { Badge } from "@repo/design-system/components/ui/badge";
import {
  BoxIcon,
  CalendarClockIcon,
  CompassIcon,
  LayersIcon,
  ShieldCheckIcon,
  SignalIcon,
  UsersIcon,
} from "lucide-react";
import { headers } from "next/headers";
import Link from "next/link";
import type { ElementType } from "react";
import {
  type EstadoDoProduto,
  listarProdutos,
  type ProdutoNoPainel,
} from "@/app/actions/produtos";
import { appDesign } from "@/lib/app-design";
import { isTenantInterno } from "../_lib/resolve-post-login-destination";
import { PageHeader } from "../components/page-header";

export const metadata = {
  title: "Produtos | Nebuloz",
  description: "O que seu workspace contratou, e onde entrar",
};

/** A tela é a verdade do contrato — nunca cache dela. Quem contrata um módulo
 *  no back-office precisa vê-lo aqui na visita seguinte. */
export const dynamic = "force-dynamic";

const ICONES: Record<ProdutoNoPainel["modulo"], ElementType> = {
  COSMOS: BoxIcon,
  CHARTER: ShieldCheckIcon,
  SIGNAL: SignalIcon,
  MERIDIAN: CompassIcon,
  SCAFFOLD: LayersIcon,
};

/** Tom por estado. */
const BADGE: Record<
  EstadoDoProduto,
  {
    rotulo: string;
    variante: "default" | "secondary" | "outline" | "destructive";
  }
> = {
  DISPONIVEL: { rotulo: "Ativo", variante: "default" },
  SEM_CONTRATO: { rotulo: "Não contratado", variante: "outline" },
  SUSPENSO: { rotulo: "Suspenso", variante: "destructive" },
  CANCELADO: { rotulo: "Cancelado", variante: "destructive" },
  EXPIRADO: { rotulo: "Vencido", variante: "destructive" },
};

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function CartaoDeProduto({
  produto,
  catalogoPosLogin,
}: {
  produto: ProdutoNoPainel;
  /** Landing pós-login do tenant interno: "não disponível" lê como "em
   *  breve", não como o motivo real de contrato (não faz sentido falar de
   *  "fale com o comercial" para quem já está dentro da própria suíte). */
  catalogoPosLogin: boolean;
}) {
  const Icone = ICONES[produto.modulo];
  const emBreve = catalogoPosLogin && produto.estado !== "DISPONIVEL";
  const badge = emBreve
    ? { rotulo: "Em breve", variante: "outline" as const }
    : BADGE[produto.estado];
  const clicavel = produto.href !== null;

  const corpo = (
    <div
      className={`${appDesign.section} flex h-full flex-col gap-4 p-5 ${
        clicavel
          ? "hover:-translate-y-0.5 transition-all hover:border-primary/40 hover:shadow-[var(--hover-shadow)]"
          : "opacity-80"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <Icone className="size-5" />
        </div>
        <Badge variant={badge.variante}>
          {produto.emTrial && produto.estado === "DISPONIVEL"
            ? "Trial"
            : badge.rotulo}
        </Badge>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-base">{produto.nome}</h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {produto.resumo}
        </p>
        <p className="text-muted-foreground text-xs">
          Perfis: {produto.perfis.join(", ")}
        </p>
      </div>

      {/* href e motivo são mutuamente exclusivos por contrato da action:
          quem abre não carrega justificativa, quem não abre não carrega link. */}
      {emBreve ? (
        <p className="mt-auto text-muted-foreground text-xs leading-relaxed">
          Em breve.
        </p>
      ) : produto.motivo ? (
        <p className="mt-auto text-muted-foreground text-xs leading-relaxed">
          {produto.motivo}
        </p>
      ) : (
        <div className="mt-auto flex items-center gap-4 text-muted-foreground text-xs">
          {produto.expiraEm ? (
            <span className="flex items-center gap-1">
              <CalendarClockIcon className="size-3.5" />
              {produto.emTrial ? "Trial até" : "Vigente até"}{" "}
              {formatarData(produto.expiraEm)}
            </span>
          ) : null}
          {produto.assentos ? (
            <span className="flex items-center gap-1">
              <UsersIcon className="size-3.5" />
              {produto.assentos} assentos
            </span>
          ) : null}
        </div>
      )}
    </div>
  );

  if (!clicavel) {
    return corpo;
  }
  return (
    // biome-ignore lint/style/noNonNullAssertion: clicavel === (href !== null)
    <Link className="block h-full" href={produto.href!}>
      {corpo}
    </Link>
  );
}

export default async function ProdutoPage() {
  const { tenantId } = await requireTenantSession(await headers());
  const [resultado, catalogoPosLogin] = await Promise.all([
    listarProdutos(),
    isTenantInterno(tenantId),
  ]);

  return (
    <div className={appDesign.shell}>
      <PageHeader
        subtitle={
          catalogoPosLogin
            ? "Catálogo de produtos da suíte Nebuloz"
            : "O que este workspace contratou, e onde entrar"
        }
        title="Produtos"
      />
      <div className={appDesign.bodyScroll}>
        {resultado.ok ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {resultado.data.map((produto) => (
              <CartaoDeProduto
                catalogoPosLogin={catalogoPosLogin}
                key={produto.modulo}
                produto={produto}
              />
            ))}
          </div>
        ) : (
          // Erro real de leitura — nunca desenhar como "nenhum produto":
          // afirmar carteira vazia sobre uma consulta que falhou é mentira
          // com cara de estado vazio.
          <div className={`${appDesign.section} p-6 text-center`}>
            <p className="font-medium text-sm">
              Não foi possível carregar seus produtos.
            </p>
            <p className="mt-1 text-muted-foreground text-xs">
              {resultado.error} — recarregue a página; se persistir, fale com o
              suporte.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
