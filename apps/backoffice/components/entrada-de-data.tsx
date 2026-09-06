"use client";

import {
  type ChangeEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { INPUT } from "@/components/campo";

/**
 * Entrada de data em três campos — dia/mês/ano — porte do `DateInput` de
 * date-range-picker-for-shadcn (johnpolacek) para PT-BR e a paleta do
 * back-office.
 *
 * Estado local em texto, não em `Date`: enquanto a pessoa digita, um campo
 * pode estar momentaneamente vazio ou fora de faixa (ano com 2 dígitos, "31"
 * num mês de 30 dias) sem que isso derrube o componente. `onChange` só
 * dispara quando os três campos formam uma data real, em ISO — inválido não
 * propaga, só fica visível até o blur desfazer.
 */

type Partes = { dia: string; mes: string; ano: string };
type Campo = keyof Partes;

const LIMITE: Record<Campo, number> = { dia: 2, mes: 2, ano: 4 };

function paraPartes(valorIso: string): Partes {
  const [ano, mes, dia] = valorIso.split("-");
  return { ano: ano ?? "", dia: dia ?? "", mes: mes ?? "" };
}

function paraIso(p: Partes): string {
  return `${p.ano.padStart(4, "0")}-${p.mes.padStart(2, "0")}-${p.dia.padStart(2, "0")}`;
}

/** A tripla forma uma data que existe de verdade (rejeita 31/02, por exemplo). */
function dataReal(p: Partes): boolean {
  if (p.dia === "" || p.mes === "" || p.ano === "") {
    return false;
  }
  const dia = Number(p.dia);
  const mes = Number(p.mes);
  const ano = Number(p.ano);
  const d = new Date(ano, mes - 1, dia);
  return (
    d.getFullYear() === ano && d.getMonth() + 1 === mes && d.getDate() === dia
  );
}

/** Faixa do campo (1–31, 1–12, 1000–9999) e, com isso, se a tripla é real. */
function validarCampo(atual: Partes, campo: Campo, bruto: string): boolean {
  if (bruto === "") {
    return false;
  }
  const n = Number(bruto);
  if (campo === "dia" && (n < 1 || n > 31)) {
    return false;
  }
  if (campo === "mes" && (n < 1 || n > 12)) {
    return false;
  }
  if (campo === "ano" && (n < 1000 || n > 9999)) {
    return false;
  }
  return dataReal({ ...atual, [campo]: bruto });
}

function diasNoMes(ano: number, mes: number): number {
  // new Date(ano, mes, 0) usa o "dia 0" do mês seguinte (0-indexado), que é
  // o último dia do mês `mes` (1-indexado) — o mesmo truque do original.
  return new Date(ano, mes, 0).getDate();
}

function incrementarAno(atual: Partes, delta: 1 | -1): Partes {
  const ano = (Number(atual.ano) || 1000) + delta;
  const mes = Number(atual.mes) || 1;
  // Clampa o dia (29 fev de ano bissexto vira 28 num ano comum) — sem isso o
  // resultado pode não existir (dataReal rejeitaria e a subida ficaria presa).
  const dia = Math.min(Number(atual.dia) || 1, diasNoMes(ano, mes));
  return { ano: String(ano), dia: String(dia), mes: atual.mes };
}

function incrementarMes(atual: Partes, delta: 1 | -1): Partes {
  const anoAtual = Number(atual.ano) || 1000;
  let mes = (Number(atual.mes) || 1) + delta;
  let ano = anoAtual;
  if (mes > 12) {
    mes = 1;
    ano += 1;
  } else if (mes < 1) {
    mes = 12;
    ano -= 1;
  }
  // Mesmo clamp: 31/01 subindo o mês vira 28 (ou 29) /02, não 31/02.
  const dia = Math.min(Number(atual.dia) || 1, diasNoMes(ano, mes));
  return { ano: String(ano), dia: String(dia), mes: String(mes) };
}

function incrementarDia(atual: Partes, delta: 1 | -1): Partes {
  const diaAtual = Number(atual.dia) || 1;
  const mesAtual = Number(atual.mes) || 1;
  const anoAtual = Number(atual.ano) || 1000;

  if (delta > 0 && diaAtual >= diasNoMes(anoAtual, mesAtual)) {
    const mes = mesAtual === 12 ? 1 : mesAtual + 1;
    const ano = mesAtual === 12 ? anoAtual + 1 : anoAtual;
    return { ano: String(ano), dia: "1", mes: String(mes) };
  }
  if (delta < 0 && diaAtual <= 1) {
    const mes = mesAtual === 1 ? 12 : mesAtual - 1;
    const ano = mesAtual === 1 ? anoAtual - 1 : anoAtual;
    return {
      ano: String(ano),
      dia: String(diasNoMes(ano, mes)),
      mes: String(mes),
    };
  }
  return { ...atual, dia: String(diaAtual + delta) };
}

/** ArrowUp/Down — como o original, com rollover para o campo vizinho nas pontas. */
function incrementarPartes(atual: Partes, campo: Campo, delta: 1 | -1): Partes {
  if (campo === "ano") {
    return incrementarAno(atual, delta);
  }
  if (campo === "mes") {
    return incrementarMes(atual, delta);
  }
  return incrementarDia(atual, delta);
}

function fimDoCampo(alvo: HTMLInputElement): boolean {
  return (
    alvo.selectionStart === alvo.value.length ||
    (alvo.selectionStart === 0 && alvo.selectionEnd === alvo.value.length)
  );
}

function inicioDoCampo(alvo: HTMLInputElement): boolean {
  return (
    alvo.selectionStart === 0 &&
    (alvo.selectionEnd === 0 || alvo.selectionEnd === alvo.value.length)
  );
}

const PROXIMO: Record<Campo, Campo | null> = {
  ano: null,
  dia: "mes",
  mes: "ano",
};
const ANTERIOR: Record<Campo, Campo | null> = {
  ano: "mes",
  dia: null,
  mes: "dia",
};
const TECLAS_PERMITIDAS = ["Tab", "Delete", "Backspace", "Enter"];
const APENAS_DIGITO = /^[0-9]$/;

export function EntradaDeData({
  valor,
  onChange,
  rotulo,
}: {
  valor: string;
  onChange: (iso: string) => void;
  rotulo: string;
}) {
  const [partes, setPartes] = useState<Partes>(() => paraPartes(valor));
  const ultimoValido = useRef<Partes>(paraPartes(valor));
  const diaRef = useRef<HTMLInputElement>(null);
  const mesRef = useRef<HTMLInputElement>(null);
  const anoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const novas = paraPartes(valor);
    setPartes(novas);
    ultimoValido.current = novas;
  }, [valor]);

  const aoMudar = (campo: Campo) => (e: ChangeEvent<HTMLInputElement>) => {
    const bruto = e.target.value.replace(/\D/g, "").slice(0, LIMITE[campo]);
    const novasPartes = { ...partes, [campo]: bruto };
    setPartes(novasPartes);
    if (validarCampo(partes, campo, bruto)) {
      ultimoValido.current = novasPartes;
      onChange(paraIso(novasPartes));
    }
  };

  const aoDesfocar = () => {
    if (!dataReal(partes)) {
      setPartes(ultimoValido.current);
    }
  };

  const refs: Record<Campo, typeof diaRef> = {
    ano: anoRef,
    dia: diaRef,
    mes: mesRef,
  };
  const focar = (campo: Campo | null) => {
    if (campo) {
      refs[campo].current?.focus();
    }
  };

  const aplicarIncremento = (campo: Campo, delta: 1 | -1) => {
    const novasPartes = incrementarPartes(partes, campo, delta);
    setPartes(novasPartes);
    // O incremento em mês/ano já clampa o dia para um mês existente, mas só
    // propaga (e só vira o "último válido" para o blur restaurar) se a
    // tripla resultante for mesmo uma data real.
    if (dataReal(novasPartes)) {
      ultimoValido.current = novasPartes;
      onChange(paraIso(novasPartes));
    }
  };

  const navegar = (
    campo: Campo,
    e: KeyboardEvent<HTMLInputElement>
  ): boolean => {
    if (e.key === "ArrowRight" && fimDoCampo(e.currentTarget)) {
      e.preventDefault();
      focar(PROXIMO[campo]);
      return true;
    }
    if (e.key === "ArrowLeft" && inicioDoCampo(e.currentTarget)) {
      e.preventDefault();
      focar(ANTERIOR[campo]);
      return true;
    }
    return false;
  };

  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>, campo: Campo) => {
    if (e.metaKey || e.ctrlKey) {
      return;
    }
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      aplicarIncremento(campo, e.key === "ArrowUp" ? 1 : -1);
      return;
    }
    if (navegar(campo, e)) {
      return;
    }
    if (!(APENAS_DIGITO.test(e.key) || TECLAS_PERMITIDAS.includes(e.key))) {
      e.preventDefault();
    }
  };

  const estilo = {
    ...INPUT,
    padding: "6px 4px",
    textAlign: "center",
  } as const;

  return (
    <div style={{ alignItems: "center", display: "inline-flex", gap: 2 }}>
      <input
        aria-label={`${rotulo} — dia`}
        inputMode="numeric"
        maxLength={2}
        onBlur={aoDesfocar}
        onChange={aoMudar("dia")}
        onKeyDown={(e) => aoTeclar(e, "dia")}
        ref={diaRef}
        style={{ ...estilo, width: "2ch" }}
        value={partes.dia}
      />
      <span style={{ color: "var(--ink-faint)" }}>/</span>
      <input
        aria-label={`${rotulo} — mês`}
        inputMode="numeric"
        maxLength={2}
        onBlur={aoDesfocar}
        onChange={aoMudar("mes")}
        onKeyDown={(e) => aoTeclar(e, "mes")}
        ref={mesRef}
        style={{ ...estilo, width: "2ch" }}
        value={partes.mes}
      />
      <span style={{ color: "var(--ink-faint)" }}>/</span>
      <input
        aria-label={`${rotulo} — ano`}
        inputMode="numeric"
        maxLength={4}
        onBlur={aoDesfocar}
        onChange={aoMudar("ano")}
        onKeyDown={(e) => aoTeclar(e, "ano")}
        ref={anoRef}
        style={{ ...estilo, width: "4ch" }}
        value={partes.ano}
      />
    </div>
  );
}
