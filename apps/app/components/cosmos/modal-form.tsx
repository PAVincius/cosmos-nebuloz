"use client";

// modal-form.tsx — primitivas de formulário dos modais, portadas do design
// de referência (Claude Design, cosmos-modal.jsx).
//
// Existiam como `const inputStyle` copiado em 15 telas, cada cópia com raio,
// padding e borda um pouco diferentes, nenhuma com foco visível nem validação.
// Aqui a aparência e o comportamento vivem num lugar só, com as medidas do
// design: 9px 11px de padding, 13.5px de corpo, `--r-md` no raio.
//
// O que o design não trazia e foi mantido daqui: foco visível, `aria-invalid`
// e erro anunciado por `role="alert"` — teclado e leitor de tela são parte da
// qualidade que estes modais precisavam ter.
import { Icon } from "@repo/design-system/cosmos/icons";
import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useState,
} from "react";

/** Sinaliza "a pessoa já digitou" para o modal confirmar antes de descartar. */
const DirtyCtx = createContext<{ markDirty: () => void }>({
  markDirty: () => {
    // Fora de um modal, digitar não precisa avisar ninguém.
  },
});
export const DirtyProvider = DirtyCtx.Provider;
export const useDirty = () => useContext(DirtyCtx);

const campoBase: CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--hairline-strong)",
  borderRadius: "var(--r-md)",
  color: "var(--ink)",
  fontFamily: "inherit",
  fontSize: 13.5,
  outline: "none",
  padding: "9px 11px",
  width: "100%",
};

const estiloErro: CSSProperties = {
  borderColor: "var(--red-text)",
  boxShadow: "0 0 0 2px rgba(var(--red-rgb),.15)",
};

function anelDeFoco(el: HTMLElement, erro: boolean) {
  el.style.borderColor = erro
    ? "var(--red-text)"
    : "rgba(var(--accent-rgb),.7)";
  el.style.boxShadow = `0 0 0 3px rgba(var(--${erro ? "red" : "accent"}-rgb),.18)`;
}

function limpaAnel(el: HTMLElement, erro: boolean) {
  el.style.borderColor = erro ? "var(--red-text)" : "var(--hairline-strong)";
  el.style.boxShadow = erro ? (estiloErro.boxShadow ?? "none") : "none";
}

function MensagemErro({ id, texto }: { id: string; texto: string }) {
  return (
    <span
      id={id}
      role="alert"
      style={{
        alignItems: "center",
        color: "var(--red-text)",
        display: "flex",
        fontSize: 11,
        fontWeight: 600,
        gap: 4,
        marginTop: -2,
      }}
    >
      <Icon name="alert" size={11} strokeWidth={2.4} />
      {texto}
    </span>
  );
}

export function FormField({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    // O label envolve o controle: dispensa casar id com htmlFor em cada uso,
    // que é de onde vinham os campos sem rótulo associado.
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{ color: "var(--ink-subtle)", fontSize: 12.5, fontWeight: 700 }}
      >
        {label}
        {required && <span style={{ color: "var(--red-text)" }}> *</span>}
      </span>
      {children}
      {hint && (
        <span
          style={{
            color: "var(--ink-faint)",
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          {hint}
        </span>
      )}
    </label>
  );
}

type CampoTextoProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  type?: "text" | "number" | "password" | "email" | "date";
  style?: CSSProperties;
};

export function TextInput({
  value,
  onChange,
  placeholder,
  required,
  disabled,
  type = "text",
  style,
}: CampoTextoProps) {
  const { markDirty } = useDirty();
  const [erro, setErro] = useState("");
  const erroId = useId();
  return (
    <>
      <input
        aria-describedby={erro ? erroId : undefined}
        aria-invalid={erro ? true : undefined}
        disabled={disabled}
        onBlur={(e) => {
          const vazio = required && !e.target.value.trim();
          setErro(vazio ? "Campo obrigatório" : "");
          limpaAnel(e.currentTarget, Boolean(vazio));
        }}
        onChange={(e) => {
          markDirty();
          setErro("");
          onChange(e.target.value);
        }}
        onFocus={(e) => anelDeFoco(e.currentTarget, Boolean(erro))}
        placeholder={placeholder}
        style={{
          ...campoBase,
          ...(erro ? estiloErro : {}),
          ...(disabled ? { cursor: "not-allowed", opacity: 0.6 } : {}),
          ...style,
        }}
        type={type}
        value={value}
      />
      {erro && <MensagemErro id={erroId} texto={erro} />}
    </>
  );
}

export function TextArea({
  value,
  onChange,
  placeholder,
  required,
  rows = 3,
  maxLength,
}: CampoTextoProps & { rows?: number; maxLength?: number }) {
  const { markDirty } = useDirty();
  const [erro, setErro] = useState("");
  const erroId = useId();
  return (
    <>
      <textarea
        aria-describedby={erro ? erroId : undefined}
        aria-invalid={erro ? true : undefined}
        maxLength={maxLength}
        onBlur={(e) => {
          const vazio = required && !e.target.value.trim();
          setErro(vazio ? "Campo obrigatório" : "");
          limpaAnel(e.currentTarget, Boolean(vazio));
        }}
        onChange={(e) => {
          markDirty();
          setErro("");
          onChange(e.target.value);
        }}
        onFocus={(e) => anelDeFoco(e.currentTarget, Boolean(erro))}
        placeholder={placeholder}
        rows={rows}
        style={{
          ...campoBase,
          lineHeight: 1.5,
          resize: "vertical",
          ...(erro ? estiloErro : {}),
        }}
        value={value}
      />
      {erro && <MensagemErro id={erroId} texto={erro} />}
    </>
  );
}

export function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const { markDirty } = useDirty();
  return (
    <select
      onBlur={(e) => limpaAnel(e.currentTarget, false)}
      onChange={(e) => {
        markDirty();
        onChange(e.target.value);
      }}
      onFocus={(e) => anelDeFoco(e.currentTarget, false)}
      style={campoBase}
      value={value}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Enum curto — Size (S/M/L/XL), story points, horizonte. */
export function Segmented({
  options,
  value,
  onChange,
  tone = "accent",
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  tone?: string;
}) {
  const { markDirty } = useDirty();
  return (
    <fieldset
      style={{ border: "none", display: "flex", gap: 6, margin: 0, padding: 0 }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            aria-pressed={on}
            className="btn"
            key={o.value}
            onClick={() => {
              markDirty();
              onChange(o.value);
            }}
            style={{
              background: on ? `var(--${tone}-soft)` : "var(--surface)",
              border: `1px solid ${on ? `rgba(var(--${tone}-rgb),.4)` : "var(--hairline-strong)"}`,
              borderRadius: "var(--r-md)",
              color: on ? `var(--${tone}-text)` : "var(--ink-muted)",
              flex: 1,
              fontSize: 12.5,
              fontWeight: 700,
              padding: "8px 6px",
            }}
            type="button"
          >
            {o.label}
          </button>
        );
      })}
    </fieldset>
  );
}

/** Dimensão de WSJF — valor à direita do rótulo, como no design. */
export function MiniSlider({
  label,
  value,
  onChange,
  min = 1,
  max = 20,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const { markDirty } = useDirty();
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span
        style={{
          color: "var(--ink-subtle)",
          display: "flex",
          fontSize: 11.5,
          fontWeight: 600,
          justifyContent: "space-between",
        }}
      >
        <span>{label}</span>
        <span className="mono" style={{ color: "var(--ink)", fontWeight: 700 }}>
          {value}
        </span>
      </span>
      <input
        max={max}
        min={min}
        onChange={(e) => {
          markDirty();
          onChange(Number(e.target.value));
        }}
        style={{ accentColor: "var(--accent)", width: "100%" }}
        type="range"
        value={value}
      />
    </label>
  );
}

const TONES = ["accent", "blue", "purple", "green", "amber", "red"] as const;

/** Cor/tone da entidade — os seis do design, com estado selecionado visível. */
export function TonePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const { markDirty } = useDirty();
  return (
    <fieldset
      style={{ border: "none", display: "flex", gap: 8, margin: 0, padding: 0 }}
    >
      {TONES.map((t) => {
        const on = t === value;
        return (
          <button
            aria-label={`Cor ${t}`}
            aria-pressed={on}
            key={t}
            onClick={() => {
              markDirty();
              onChange(t);
            }}
            style={{
              background: `var(--${t})`,
              border: on ? "2px solid var(--ink)" : "2px solid transparent",
              borderRadius: "50%",
              cursor: "pointer",
              height: 26,
              outline: on ? "1px solid var(--hairline-strong)" : "none",
              outlineOffset: 2,
              width: 26,
            }}
            type="button"
          />
        );
      })}
    </fieldset>
  );
}

// ─── EntityLinkField ─────────────────────────────────────────────────────────

export type LinkItem = { id: string; label: string; sub?: string };

/**
 * Vincula o formulário a entidades que já existem — budget, épicos, temas.
 *
 * É o campo que faz o SAFe fechar: um Tema Estratégico sem budget real e sem
 * épicos reais é uma caixa de texto com nome bonito. Busca por digitação,
 * mostra o que já foi escolhido como chips removíveis e nunca oferece o que
 * já está selecionado.
 *
 * O dropdown é irmão do campo, não filho de um portal: dentro de um modal que
 * já prende o foco, um portal no body sairia do ciclo de Tab e o teclado
 * perderia a lista logo depois de abri-la.
 */
export function EntityLinkField({
  label,
  hint,
  items,
  value,
  onChange,
  multi = false,
  placeholder = "Buscar...",
  tone = "accent",
  onSearch,
}: {
  label: string;
  hint?: string;
  /** Opções já carregadas. Com `onSearch`, serve de estado inicial e de
   *  cache dos rótulos já escolhidos. */
  items: LinkItem[];
  /** id (single) ou lista de ids (multi). */
  value: string | string[] | null;
  onChange: (v: string | string[] | null) => void;
  multi?: boolean;
  placeholder?: string;
  tone?: string;
  /** Busca no servidor a cada digitação. Sem isto o campo filtra localmente
   *  a lista recebida — e uma lista truncada pela origem (searchEntities
   *  devolve 10) faz o campo dizer "nenhum resultado" para entidade que
   *  existe. Aqui a pergunta vai para quem tem a tabela inteira. */
  onSearch?: (q: string) => Promise<LinkItem[]>;
}) {
  const { markDirty } = useDirty();
  const [query, setQuery] = useState("");
  const [aberto, setAberto] = useState(false);
  const [remotos, setRemotos] = useState<LinkItem[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const listaId = useId();

  // Debounce: uma ida ao servidor por tecla transformaria a digitação em
  // rajada de requisições, e as respostas voltariam fora de ordem.
  useEffect(() => {
    if (!(onSearch && aberto)) {
      return;
    }
    let cancelado = false;
    setBuscando(true);
    const t = setTimeout(async () => {
      const achados = await onSearch(query);
      if (!cancelado) {
        setRemotos(achados);
        setBuscando(false);
      }
    }, 220);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
  }, [query, aberto, onSearch]);

  const escolhidos = multi
    ? ((value as string[] | null) ?? [])
    : value
      ? [value as string]
      : [];

  // Com busca remota o servidor já filtrou; sem ela, filtra o que veio.
  const fonte = onSearch ? (remotos ?? items) : items;
  const filtrados = onSearch
    ? fonte.filter((it) => !escolhidos.includes(it.id))
    : fonte.filter(
        (it) =>
          !escolhidos.includes(it.id) &&
          it.label.toLowerCase().includes(query.toLowerCase())
      );

  function escolher(id: string) {
    markDirty();
    onChange(multi ? [...escolhidos, id] : id);
    setQuery("");
    setAberto(false);
  }

  function remover(id: string) {
    markDirty();
    onChange(multi ? escolhidos.filter((x) => x !== id) : null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{ color: "var(--ink-subtle)", fontSize: 12.5, fontWeight: 700 }}
      >
        {label}
      </span>

      {escolhidos.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {escolhidos.map((id) => {
            // Procura nos dois: o escolhido pode ter saído da página atual
            // da busca remota, e o chip não pode virar um id cru na tela.
            const it =
              items.find((x) => x.id === id) ??
              remotos?.find((x) => x.id === id);
            return (
              <span
                key={id}
                style={{
                  alignItems: "center",
                  background: `var(--${tone}-soft)`,
                  border: `1px solid rgba(var(--${tone}-rgb),.3)`,
                  borderRadius: "var(--r-sm)",
                  color: `var(--${tone}-text)`,
                  display: "inline-flex",
                  fontSize: 12,
                  fontWeight: 600,
                  gap: 6,
                  padding: "5px 8px",
                }}
              >
                {it?.label ?? id}
                <button
                  aria-label={`Remover ${it?.label ?? id}`}
                  onClick={() => remover(id)}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "inherit",
                    cursor: "pointer",
                    fontSize: 14,
                    lineHeight: 1,
                    padding: 0,
                  }}
                  type="button"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {(multi || escolhidos.length === 0) && (
        <div style={{ position: "relative" }}>
          <input
            aria-controls={aberto ? listaId : undefined}
            aria-expanded={aberto}
            onBlur={(e) => {
              limpaAnel(e.currentTarget, false);
              // Fecha depois do clique na opção: fechar no blur imediato
              // cancelaria a escolha antes de ela acontecer.
              setTimeout(() => setAberto(false), 120);
            }}
            onChange={(e) => {
              setQuery(e.target.value);
              setAberto(true);
            }}
            onFocus={(e) => {
              anelDeFoco(e.currentTarget, false);
              setAberto(true);
            }}
            placeholder={placeholder}
            role="combobox"
            style={campoBase}
            value={query}
          />
          {aberto && (
            <div
              id={listaId}
              role="listbox"
              style={{
                background: "var(--surface-3)",
                border: "1px solid var(--hairline-strong)",
                borderRadius: "var(--r-md)",
                boxShadow: "0 16px 32px -12px rgba(0,0,0,.5)",
                left: 0,
                maxHeight: 220,
                overflowY: "auto",
                padding: 5,
                position: "absolute",
                right: 0,
                top: "calc(100% + 4px)",
                zIndex: 10,
              }}
            >
              {filtrados.length === 0 ? (
                <div
                  style={{
                    color: "var(--ink-faint)",
                    fontSize: 12,
                    padding: "10px 9px",
                  }}
                >
                  {buscando ? "Buscando..." : "Nenhum resultado"}
                </div>
              ) : (
                filtrados.slice(0, 6).map((it) => (
                  <button
                    className="btn navitem"
                    key={it.id}
                    onClick={() => escolher(it.id)}
                    role="option"
                    style={{
                      alignItems: "flex-start",
                      background: "transparent",
                      border: "none",
                      borderRadius: "var(--r-sm)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                      padding: "7px 9px",
                      textAlign: "left",
                      width: "100%",
                    }}
                    type="button"
                  >
                    <span
                      style={{
                        color: "var(--ink)",
                        fontSize: 12.5,
                        fontWeight: 600,
                      }}
                    >
                      {it.label}
                    </span>
                    {it.sub && (
                      <span style={{ color: "var(--ink-faint)", fontSize: 11 }}>
                        {it.sub}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {hint && (
        <span
          style={{ color: "var(--ink-faint)", fontSize: 11, fontWeight: 500 }}
        >
          {hint}
        </span>
      )}
    </div>
  );
}
