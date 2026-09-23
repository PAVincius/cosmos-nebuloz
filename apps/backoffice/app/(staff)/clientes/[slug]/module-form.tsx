"use client";

import type { ProductModule } from "@repo/database";
import { useState, useTransition } from "react";
import { contractModuleAction } from "@/app/actions/provisioning";
import { Erro, INPUT } from "@/components/campo";
import { Confirmacao } from "@/components/confirmacao";
import { ConfirmarAcao } from "@/components/confirmar-acao";
import { MOTIVO_SOMENTE_LEITURA } from "@/components/write-button";
import { rotuloDoModulo } from "@/lib/rotulo-do-modulo";

const STATUSES = ["ACTIVE", "TRIAL", "SUSPENDED", "CANCELED"] as const;
type Status = (typeof STATUSES)[number];

const ehStatus = (v: string): v is Status =>
  (STATUSES as readonly string[]).includes(v);

const ID_MOTIVO_LEITURA = "modulos-somente-leitura";

/** O enum vai para a action; a pessoa lê o rótulo — o mesmo de `abas/resumo.tsx`. */
const ROTULO_STATUS: Record<Status, string> = {
  ACTIVE: "Ativo",
  TRIAL: "Trial",
  SUSPENDED: "Suspenso",
  CANCELED: "Cancelado",
};

/** A pergunta da barreira em verbo — "Suspender Cosmos", não "Suspenso": o
 *  substantivo diz onde se chega, o verbo diz o que se está fazendo. */
function perguntaDe(status: Status, modulo: string): string {
  const nome = rotuloDoModulo(modulo);
  return {
    ACTIVE: `Ativar ${nome}`,
    TRIAL: `Liberar ${nome} em trial`,
    SUSPENDED: `Suspender ${nome}`,
    CANCELED: `Cancelar ${nome}`,
  }[status];
}

/** Cortar acesso chega ao cliente em segundos e não tem desfazer — tom
 *  vermelho. Liberar é reversível, mas também chega ao cliente em segundos e
 *  vai para a auditoria com o nome de quem clicou: decisão do dono, passa pela
 *  mesma barreira, em tom accent. */
const CORTAM_O_CLIENTE = new Set(["SUSPENDED", "CANCELED"]);

/** O que `contractModule` faz de verdade (packages/provisioning): grava o
 *  status, invalida o cache do gate (o acesso muda na próxima requisição) e
 *  registra na auditoria. Não há cobrança automática nem prazo: `expiresAt`
 *  fica nulo, então um trial não expira sozinho. */
const CONSEQUENCIA: Record<Status, string> = {
  ACTIVE:
    "O cliente ganha acesso ao módulo na próxima requisição, sem cobrança automática; fica na auditoria com o seu nome.",
  TRIAL:
    "O cliente ganha acesso ao módulo na próxima requisição. O trial não expira sozinho: encerrá-lo é outra troca aqui.",
  SUSPENDED:
    "O cliente perde acesso ao módulo agora. Quem estiver usando é interrompido na próxima requisição.",
  CANCELED:
    "O cliente perde acesso ao módulo e o contrato passa a constar como encerrado.",
};

const CELULA: React.CSSProperties = {
  padding: "10px 0",
  borderBottom: "1px solid var(--hairline)",
  fontSize: "var(--fs-base)",
};

type ModuleRow = { module: string; status: string; expiresAt: string | null };

export function ModuleForm({
  slug,
  modules,
  modulos,
  canWrite,
}: {
  slug: string;
  modules: ModuleRow[];
  modulos: ProductModule[];
  /** SRD FR-0.4 — MEMBER vê a tabela e não troca nada. A action recusa de
   *  novo no servidor; aqui o select desabilita **com o motivo escrito**. */
  canWrite: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // O `<select>` só muda isto; gravar é o "Confirmar" da barreira — o padrão
  // da troca de papel (`abas/usuarios.tsx`). Um estado só para a tela toda:
  // escolher em outro módulo troca a pergunta e devolve o primeiro select ao
  // valor vigente, em vez de empilhar barreiras.
  const [escolha, setEscolha] = useState<{
    module: ProductModule;
    status: Status;
  } | null>(null);
  // A última troca gravada, em prosa — só na linha que agiu. Sem isto a troca
  // mudava o select e mais nada: quem não viu a célula mudar não sabia se deu
  // certo.
  const [confirmada, setConfirmada] = useState<{
    module: string;
    texto: string;
  } | null>(null);

  const escolher = (module: ProductModule, valor: string) => {
    if (!ehStatus(valor)) {
      return;
    }
    setError(null);
    setConfirmada(null);
    setEscolha({ module, status: valor });
  };

  const apply = (module: ProductModule, status: Status) =>
    startTransition(async () => {
      setError(null);
      setConfirmada(null);
      const result = await contractModuleAction({ slug, module, status });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEscolha(null);
      setConfirmada({
        module,
        texto: `${rotuloDoModulo(module)} de ${slug} agora está ${ROTULO_STATUS[status]}`,
      });
    });

  const descricaoDoBloqueio = canWrite ? undefined : ID_MOTIVO_LEITURA;
  // Função, e não ternário no JSX: o lint lê o `undefined` inline como valor
  // vazando para o render.
  const escolhidoEm = (module: ProductModule): Status | undefined =>
    escolha?.module === module ? escolha.status : undefined;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Motivo do bloqueio em texto, uma vez, ligado a cada select por
          `aria-describedby` — um controle desabilitado nem recebe foco, então
          `title` não chegaria a ninguém. */}
      {canWrite ? null : (
        <p
          id={ID_MOTIVO_LEITURA}
          style={{
            margin: 0,
            fontSize: "var(--fs-nota)",
            color: "var(--ink-muted)",
          }}
        >
          {MOTIVO_SOMENTE_LEITURA}
        </p>
      )}
      {error ? <Erro>{error}</Erro> : null}

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {modulos.map((module) => (
            <LinhaDoModulo
              atual={modules.find((m) => m.module === module)?.status}
              canWrite={canWrite}
              confirmada={
                confirmada?.module === module ? confirmada.texto : null
              }
              descricaoDoBloqueio={descricaoDoBloqueio}
              escolhido={escolhidoEm(module)}
              key={module}
              module={module}
              onConfirmar={(status) => apply(module, status)}
              onEscolher={(valor) => escolher(module, valor)}
              onVoltar={() => setEscolha(null)}
              pending={pending}
              slug={slug}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LinhaDoModulo({
  module,
  atual,
  escolhido,
  slug,
  canWrite,
  pending,
  confirmada,
  descricaoDoBloqueio,
  onEscolher,
  onConfirmar,
  onVoltar,
}: {
  module: ProductModule;
  /** O status gravado; `undefined` = não contratado. */
  atual: string | undefined;
  /** O status escolhido no select e ainda não confirmado. */
  escolhido: Status | undefined;
  slug: string;
  canWrite: boolean;
  pending: boolean;
  confirmada: string | null;
  descricaoDoBloqueio: string | undefined;
  onEscolher: (valor: string) => void;
  onConfirmar: (status: Status) => void;
  onVoltar: () => void;
}) {
  const id = `status-do-modulo-${module}`;
  // Cancelar o que não está contratado não faz nada — e uma opção que não faz
  // nada só assusta. Já cancelado continua na lista: é o valor vigente.
  const opcoes = STATUSES.filter(
    (s) => s !== "CANCELED" || atual !== undefined
  );
  // Escolher o status vigente não é pergunta: nada muda.
  const pergunta = escolhido === atual ? undefined : escolhido;
  return (
    <tr>
      <td style={{ ...CELULA, fontWeight: 700 }}>
        {/* Rótulo visível: o nome do módulo é o que a pessoa varre na lista.
            O "status" escondido completa o nome acessível do select. */}
        <label htmlFor={id}>
          {rotuloDoModulo(module)}
          <span className="sr-only"> — status</span>
        </label>
      </td>
      <td style={{ ...CELULA, textAlign: "right" }}>
        <select
          aria-describedby={descricaoDoBloqueio}
          disabled={!canWrite || pending}
          id={id}
          onChange={(e) => onEscolher(e.target.value)}
          style={{
            ...INPUT,
            width: "auto",
            padding: "6px 9px",
            opacity: canWrite ? 1 : 0.5,
            cursor: canWrite ? "pointer" : "not-allowed",
          }}
          value={escolhido ?? atual ?? ""}
        >
          {atual === undefined ? (
            <option disabled value="">
              Não contratado
            </option>
          ) : null}
          {opcoes.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS[s]}
            </option>
          ))}
        </select>
        {pergunta ? (
          <div style={{ marginTop: 8, textAlign: "left" }}>
            {/* `aberto`: o select já foi o gatilho. "Voltar" devolve o
                select ao status vigente. */}
            <ConfirmarAcao
              aberto
              alvo={slug}
              consequencia={CONSEQUENCIA[pergunta]}
              executando={pending}
              onConfirmar={() => onConfirmar(pergunta)}
              onVoltar={onVoltar}
              rotulo={perguntaDe(pergunta, module)}
              tom={CORTAM_O_CLIENTE.has(pergunta) ? "red" : "accent"}
            />
          </div>
        ) : null}
        {/* O sucesso nasce onde a ação foi feita. */}
        {confirmada ? (
          <div style={{ marginTop: 8 }}>
            <Confirmacao>{confirmada}</Confirmacao>
          </div>
        ) : null}
      </td>
    </tr>
  );
}
