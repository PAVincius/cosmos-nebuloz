"use client";

import { Badge } from "@repo/design-system/cosmos/kit";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useState,
  useTransition,
} from "react";
import type { PessoaCapacidade } from "@/app/actions/capacity";
import type { EngagementRow } from "@/app/actions/engagements";
import {
  getIpAsset,
  type IpAssetDetail,
  type IpAssetRow,
  listIpAssets,
  registrarReusoAction,
  updateIpAssetAction,
} from "@/app/actions/ip-library";
import type { ServiceRow } from "@/app/actions/services";
import {
  BotaoPrimario,
  BotaoSecundario,
  Erro,
  INPUT,
  rotuloSalvar,
} from "@/components/campo";
import { Confirmacao } from "@/components/confirmacao";
import { BotaoMostrarMais, usePaginas } from "@/components/mostrar-mais";
import { PerguntaDescartar } from "@/components/pergunta-descartar";
import { Secao } from "@/components/secao";
import { SeletorDeAcervo } from "@/components/seletor-de-acervo";
import { Vazio } from "@/components/vazio";
import { formatarDataHora } from "@/lib/data";
import { anexar, TETO_DA_LISTA } from "@/lib/paginacao";
import { useGuardaDeRascunho } from "@/lib/rascunho-sujo";
import { useParamState } from "@/lib/url-state";
import {
  RegistrarAtivo,
  ROTULO_LICENCA,
  ROTULO_MATURIDADE,
  ROTULO_PROCEDENCIA,
} from "./registrar";
import { KpisDoAcervo, LacunasDeIp } from "./resumo";

/** O que a action `registrarReusoAction` devolve — os três campos já vêm
 *  prontos do servidor, nenhum é somado aqui. */
type PatchDeReuso = {
  reusos: number;
  horasPoupadas: number;
  maturidade: "RASCUNHO" | "COMPROVADO";
};

/** `ROTULO_*` são `Record<Procedencia|Licenca, string>`, mas o campo na linha
 *  é `string` — o valor cru aparece se algum dia o enum crescer sem o rótulo
 *  acompanhar, em vez de sumir da tela. */
function rotuloOuBruto<T extends string>(
  mapa: Record<T, string>,
  chave: string
): string {
  return (mapa as Record<string, string>)[chave] ?? chave;
}

function BadgesDoAtivo({ ativo }: { ativo: IpAssetRow }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      <Badge tone={ativo.maturidade === "COMPROVADO" ? "green" : "neutral"}>
        {ROTULO_MATURIDADE[ativo.maturidade]}
      </Badge>
      {ativo.procedencia === "INTERNO" ? null : (
        <Badge tone="blue">
          {rotuloOuBruto(ROTULO_PROCEDENCIA, ativo.procedencia)}
        </Badge>
      )}
      {ativo.licenca === "NENHUMA" ? null : (
        <Badge tone="amber">
          {rotuloOuBruto(ROTULO_LICENCA, ativo.licenca)}
        </Badge>
      )}
    </div>
  );
}

/** Bloco de registrar reuso, isolado num componente próprio: cada `ExtraDoAtivo`
 *  monta o seu, e o `SeletorDeAcervo` já isola essa subárvore por
 *  `key={item.id}` no `.map` dos itens — então trocar de ativo nunca
 *  reaproveita o estado do formulário de outro, o mesmo problema que o
 *  `Painel` do mapa de processos resolve com `key={processo.id}`. */
function BlocoDeReuso({
  ativoId,
  engajamentos,
  onCancelar,
  onRegistrado,
}: {
  ativoId: string;
  engajamentos: EngagementRow[];
  onCancelar: () => void;
  onRegistrado: (patch: PatchDeReuso) => void;
}) {
  const idEngajamento = useId();
  const [engagementId, setEngagementId] = useState(engajamentos[0]?.id ?? "");
  const [horas, setHoras] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const confirmar = useCallback(async () => {
    if (!engagementId) {
      setErro("Escolha um engajamento.");
      return;
    }
    const horasNum = Number(horas || 0);
    if (!Number.isInteger(horasNum) || horasNum < 0) {
      setErro("Horas poupadas precisa ser um número inteiro, 0 ou mais.");
      return;
    }
    setErro(null);
    setEnviando(true);
    const res = await registrarReusoAction({
      assetId: ativoId,
      engagementId,
      horasPoupadas: horasNum,
      nota: nota.trim() || undefined,
    });
    setEnviando(false);
    if (!res.ok) {
      setErro(res.error);
      return;
    }
    onRegistrado({
      horasPoupadas: res.data.horasPoupadas,
      maturidade: res.data.maturidade,
      reusos: res.data.reusos,
    });
  }, [ativoId, engagementId, horas, nota, onRegistrado]);

  if (engajamentos.length === 0) {
    return (
      <p
        style={{
          color: "var(--ink-muted)",
          fontSize: "var(--fs-nota)",
          margin: 0,
        }}
      >
        Nenhum engajamento cadastrado para registrar reuso.
      </p>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "8px 0 2px",
      }}
    >
      {erro ? <Erro>{erro}</Erro> : null}
      <select
        aria-label="Engajamento onde o ativo foi reusado"
        id={idEngajamento}
        onChange={(e) => setEngagementId(e.target.value)}
        style={INPUT}
        value={engagementId}
      >
        {engajamentos.map((e) => (
          <option key={e.id} value={e.id}>
            {e.codigo} · {e.nome}
          </option>
        ))}
      </select>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <input
          aria-label="Horas poupadas"
          min={0}
          onChange={(e) => setHoras(e.target.value)}
          placeholder="Horas poupadas"
          style={{ ...INPUT, width: 140 }}
          type="number"
          value={horas}
        />
        <input
          aria-label="Nota (opcional)"
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota (opcional)"
          style={{ ...INPUT, flex: 1, minWidth: 160 }}
          value={nota}
        />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <BotaoPrimario
          disabled={enviando}
          full={false}
          onClick={confirmar}
          type="button"
        >
          {enviando ? "Registrando…" : "Confirmar"}
        </BotaoPrimario>
        <BotaoSecundario disabled={enviando} onClick={onCancelar}>
          Cancelar
        </BotaoSecundario>
      </div>
    </div>
  );
}

/** Conteúdo por item do `SeletorDeAcervo`: badges, dono, serviços, link e a
 *  ação de registrar reuso — o nome do ativo já é o título do próprio botão
 *  do seletor, então não se repete aqui. */
function ExtraDoAtivo({
  ativo,
  engajamentos,
  podeEscrever,
  onReusoRegistrado,
}: {
  ativo: IpAssetRow;
  engajamentos: EngagementRow[];
  podeEscrever: boolean;
  onReusoRegistrado: (assetId: string, patch: PatchDeReuso) => void;
}) {
  const [registrando, setRegistrando] = useState(false);

  let acaoDeReuso: ReactNode = null;
  if (podeEscrever && registrando) {
    acaoDeReuso = (
      <BlocoDeReuso
        ativoId={ativo.id}
        engajamentos={engajamentos}
        onCancelar={() => setRegistrando(false)}
        onRegistrado={(patch) => {
          onReusoRegistrado(ativo.id, patch);
          setRegistrando(false);
        }}
      />
    );
  } else if (podeEscrever) {
    acaoDeReuso = (
      <BotaoSecundario onClick={() => setRegistrando(true)}>
        Registrar reuso
      </BotaoSecundario>
    );
  }

  return (
    <div
      style={{
        borderTop: "1px solid var(--hairline)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "8px 2px 2px",
      }}
    >
      <BadgesDoAtivo ativo={ativo} />
      <div
        style={{
          color: "var(--ink-muted)",
          display: "flex",
          flexWrap: "wrap",
          fontSize: "var(--fs-nota)",
          gap: 12,
        }}
      >
        <span>{ativo.dono ?? "sem dono"}</span>
        <span className="mono">
          {ativo.servicos.map((s) => s.codigo).join(", ") || "sem serviço"}
        </span>
        {ativo.link ? (
          <a
            className="mono"
            href={ativo.link}
            rel="noreferrer"
            style={{ color: "var(--accent-text)" }}
            target="_blank"
          >
            {ativo.link}
          </a>
        ) : (
          <span>vive aqui</span>
        )}
      </div>
      {acaoDeReuso}
    </div>
  );
}

export function Biblioteca({
  iniciais,
  engajamentos,
  servicos,
  pessoas,
  podeEscrever,
}: {
  iniciais: IpAssetRow[];
  engajamentos: EngagementRow[];
  servicos: ServiceRow[];
  pessoas: PessoaCapacidade[];
  podeEscrever: boolean;
}) {
  const [lista, setLista] = useState(iniciais);
  // O acervo chega até o teto e cresce daqui, uma página por "Mostrar mais".
  const ler = useCallback((pagina: number) => listIpAssets({ pagina }), []);
  const paginacao = usePaginas(ler, iniciais.length >= TETO_DA_LISTA);
  const mostrarMais = useCallback(async () => {
    const mais = await paginacao.proxima();
    if (mais) {
      setLista((atual) => anexar(atual, mais));
    }
  }, [paginacao.proxima]);
  // O ativo aberto mora em `?ativo=<id>`: F5 reabre o mesmo e o link cola num
  // ticket. A URL é a fonte — clicar na lista escreve o param, e é o param
  // que dispara a leitura. Id fora da lista cai no estado vazio, sem erro.
  const [ativoId, setAtivoId] = useParamState("ativo");
  const [aberto, setAberto] = useState<IpAssetDetail | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [nota, setNota] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacao, setConfirmacao] = useState<string | null>(null);
  // O `pendente` trava o botão no mesmo render em que o envio começa — o
  // segundo clique não cria uma segunda revisão.
  const [salvando, iniciarSalvar] = useTransition();

  const abertoId = aberto?.id ?? null;
  useEffect(() => {
    if (!(ativoId && lista.some((a) => a.id === ativoId))) {
      setAberto(null);
      return;
    }
    if (abertoId === ativoId) {
      return;
    }
    let vivo = true;
    setErro(null);
    getIpAsset(ativoId).then((res) => {
      if (!vivo) {
        return;
      }
      if (res.ok) {
        setAberto(res.data);
        setRascunho(res.data.conteudo);
        setNota("");
      } else {
        setErro(res.error);
      }
    });
    return () => {
      vivo = false;
    };
  }, [ativoId, lista, abertoId]);

  const abrirDeFato = useCallback(
    (id: string) => {
      setErro(null);
      setAtivoId(id);
    },
    [setAtivoId]
  );

  const sujo = Boolean(aberto) && rascunho !== aberto?.conteudo;

  // Trocar de ativo com edição pendente pergunta antes — e enquanto está
  // sujo, fechar a aba passa pelo aviso do navegador.
  const guarda = useGuardaDeRascunho({
    abertoId: aberto?.id,
    abrirDeFato,
    sujo,
  });

  // A linha nova vem inteira da action: montá-la aqui daria uma segunda fonte
  // para `reusos` e `maturidade`, que são derivados e não campos. Criar leva
  // direto ao editor, como antes — pela URL, e o efeito acima busca o
  // `IpAssetDetail` que a lista sozinha não tem.
  const aoCriar = useCallback(
    (novo: IpAssetRow) => {
      setErro(null);
      setLista((atual) => [novo, ...atual]);
      setCriando(false);
      setAtivoId(novo.id);
    },
    [setAtivoId]
  );

  const salvar = useCallback(() => {
    if (!aberto) {
      return;
    }
    setErro(null);
    setConfirmacao(null);
    iniciarSalvar(async () => {
      const res = await updateIpAssetAction({
        id: aberto.id,
        conteudo: rascunho,
        nota: nota || undefined,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      const det = await getIpAsset(aberto.id);
      if (det.ok) {
        setAberto(det.data);
        setNota("");
      }
      // A action devolve `versao: null` quando o conteúdo é idêntico — não
      // virou revisão, e dizer "salvo" aí seria mentir sobre o histórico.
      setConfirmacao(
        res.data.versao === null
          ? "Nada mudou — nenhuma revisão criada."
          : `Revisão v${res.data.versao} salva.`
      );
    });
  }, [aberto, rascunho, nota]);

  // `reusos`, `horasPoupadas` e `maturidade` vêm literalmente da action —
  // nunca um contador incrementado ou uma soma feita aqui.
  const aoRegistrarReuso = useCallback(
    (assetId: string, patch: PatchDeReuso) => {
      setLista((atual) =>
        atual.map((a) =>
          a.id === assetId
            ? {
                ...a,
                horasPoupadas: patch.horasPoupadas,
                maturidade: patch.maturidade,
                reusos: patch.reusos,
              }
            : a
        )
      );
    },
    []
  );

  // Slot do `SeletorDeAcervo`: uma lista só na tela, com badges/reuso
  // anexados a cada item em vez de uma segunda lista compacta ao lado.
  const renderExtraDoAtivo = useCallback(
    (id: string) => {
      const ativo = lista.find((a) => a.id === id);
      if (!ativo) {
        return null;
      }
      return (
        <ExtraDoAtivo
          ativo={ativo}
          engajamentos={engajamentos}
          onReusoRegistrado={aoRegistrarReuso}
          podeEscrever={podeEscrever}
        />
      );
    },
    [lista, engajamentos, podeEscrever, aoRegistrarReuso]
  );

  const podeSalvar = podeEscrever && sujo && !salvando;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {erro ? <Erro>{erro}</Erro> : null}

      <KpisDoAcervo lista={lista} />

      <LacunasDeIp lista={lista} servicos={servicos} />

      <SeletorDeAcervo
        acao={
          podeEscrever ? (
            <BotaoPrimario
              full={false}
              onClick={() => setCriando((v) => !v)}
              type="button"
            >
              {criando ? "Fechar" : "Novo"}
            </BotaoPrimario>
          ) : null
        }
        formulario={
          criando ? (
            <RegistrarAtivo
              engajamentos={engajamentos}
              onCriado={aoCriar}
              onErro={setErro}
              pessoas={pessoas}
              servicos={servicos}
            />
          ) : null
        }
        icone="book"
        itens={lista.map((a) => ({
          id: a.id,
          titulo: a.nome,
          detalhe: `${a.tipo} · v${a.versoes}${a.origem ? ` · ${a.origem}` : ""}`,
        }))}
        onSelecionar={guarda.abrir}
        renderExtra={renderExtraDoAtivo}
        rodape={
          <BotaoMostrarMais
            carregando={paginacao.carregando}
            erro={paginacao.erro}
            onClick={mostrarMais}
            temMais={paginacao.temMais}
          />
        }
        selecionadoId={aberto?.id ?? null}
        titulo="Acervo"
        vazio="Acervo vazio. É aqui que fica o que dá para reusar no próximo cliente em vez de refazer."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {aberto ? (
          <>
            {guarda.pendente ? (
              <PerguntaDescartar
                nome={aberto.nome}
                onDescartar={guarda.descartar}
                onVoltar={guarda.voltar}
              />
            ) : null}
            <Secao
              icon="book"
              subtitle={`${aberto.slug} · versão atual v${aberto.versoes}`}
              title={aberto.nome}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    aria-label="O que mudou nesta revisão"
                    disabled={!podeEscrever}
                    onChange={(e) => setNota(e.target.value)}
                    placeholder="O que mudou nesta revisão"
                    style={{ ...INPUT, flex: 1, minWidth: 200 }}
                    value={nota}
                  />
                  <BotaoPrimario
                    disabled={!podeSalvar}
                    full={false}
                    onClick={salvar}
                    type="button"
                  >
                    {rotuloSalvar(salvando, sujo)}
                  </BotaoPrimario>
                </div>
                {/* Junto do botão que agiu, não no topo da página: quem clicou
                    "Salvar revisão" está olhando para cá. */}
                {confirmacao ? <Confirmacao>{confirmacao}</Confirmacao> : null}

                <textarea
                  className="mono scroll"
                  disabled={!podeEscrever}
                  onChange={(e) => setRascunho(e.target.value)}
                  spellCheck={false}
                  style={{
                    minHeight: 380,
                    resize: "vertical",
                    background: "var(--surface-2)",
                    border: "1px solid var(--hairline)",
                    borderRadius: "var(--r-md)",
                    padding: 13,
                    fontSize: "var(--fs-base)",
                    lineHeight: 1.65,
                    color: "var(--ink)",
                  }}
                  value={rascunho}
                />
              </div>
            </Secao>

            <Secao
              icon="history"
              subtitle="append-only — editar cria revisão, nunca sobrescreve"
              title="Histórico"
            >
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {aberto.historico.map((h, i) => (
                  <li
                    key={h.versao}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 2px",
                      borderTop: i === 0 ? "none" : "1px solid var(--hairline)",
                    }}
                  >
                    <Badge tone={i === 0 ? "green" : "neutral"}>
                      v{h.versao}
                    </Badge>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: "var(--fs-base)",
                      }}
                    >
                      {h.nota ?? (
                        <span style={{ color: "var(--ink-faint)" }}>
                          sem nota
                        </span>
                      )}
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: "var(--fs-nota)",
                        color: "var(--ink-faint)",
                      }}
                    >
                      {h.autorNome ?? "—"} · {formatarDataHora(h.criadoEm)}
                    </span>
                  </li>
                ))}
              </ul>
            </Secao>
          </>
        ) : (
          <Secao title="Nenhum ativo aberto">
            <Vazio>Escolha um ativo na lista para ver e editar.</Vazio>
          </Secao>
        )}
      </div>
    </div>
  );
}
