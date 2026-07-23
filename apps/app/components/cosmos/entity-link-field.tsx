"use client";

// entity-link-field.tsx — search+create-hook primitive (RF-94). Debounced
// search over searchEntities, dropdown results, and a trailing "+ Criar
// novo" row. The "stacked modal, auto-select on create" behavior belongs to
// the caller: onCreateNew is only the hook point, this component does not
// manage any modal stack.
import { useEffect, useRef, useState } from "react";
import {
  type EntityKind,
  type EntityOption,
  searchEntities,
} from "@/app/(cosmos)/actions/entity-search";
import { Icon } from "./icons";

type EntityLinkFieldProps = {
  kind: EntityKind;
  value: EntityOption | null;
  onChange: (v: EntityOption) => void;
  onCreateNew?: () => void;
  label: string;
};

const DEBOUNCE_MS = 300;

export function EntityLinkField({
  kind,
  value,
  onChange,
  onCreateNew,
  label,
}: EntityLinkFieldProps) {
  const [query, setQuery] = useState(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<EntityOption[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // keep the input in sync when the caller swaps the selected value
  useEffect(() => {
    setQuery(value?.label ?? "");
  }, [value]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true);
      searchEntities(kind, query)
        .then((r) => {
          setResults(r.ok ? r.data : []);
        })
        .finally(() => setLoading(false));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, open, kind]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onMouseDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const select = (opt: EntityOption) => {
    onChange(opt);
    setQuery(opt.label);
    setOpen(false);
  };

  const handleCreateNew = () => {
    setOpen(false);
    onCreateNew?.();
  };

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <label
        style={{
          display: "block",
          fontSize: 11.5,
          fontWeight: 700,
          letterSpacing: ".04em",
          textTransform: "uppercase",
          color: "var(--ink-faint)",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <div style={{ position: "relative" }}>
        <span
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--ink-faint)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <Icon name="search" size={14} />
        </span>
        <input
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar..."
          style={{
            width: "100%",
            padding: "10px 12px 10px 34px",
            fontSize: 14,
            borderRadius: 10,
            border: "1px solid var(--hairline-strong)",
            background: "var(--surface)",
            color: "var(--ink)",
            fontFamily: "inherit",
            outline: "none",
          }}
          value={query}
        />
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 20,
            maxHeight: 240,
            overflowY: "auto",
            background: "var(--surface-2)",
            border: "1px solid var(--hairline-strong)",
            borderRadius: 10,
            boxShadow: "0 24px 48px -16px rgba(0,0,0,.5)",
          }}
        >
          {loading && (
            <div
              style={{
                padding: "10px 12px",
                fontSize: 13,
                color: "var(--ink-faint)",
              }}
            >
              Buscando...
            </div>
          )}
          {!loading && results.length === 0 && (
            <div
              style={{
                padding: "10px 12px",
                fontSize: 13,
                color: "var(--ink-faint)",
              }}
            >
              Nenhum resultado.
            </div>
          )}
          {!loading &&
            results.map((opt) => (
              <button
                className="btn navitem"
                key={opt.id}
                onClick={() => select(opt)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  fontSize: 14,
                  color: "var(--ink)",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
                type="button"
              >
                {opt.label}
              </button>
            ))}
          {onCreateNew && (
            <button
              className="btn navitem"
              onClick={handleCreateNew}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                fontSize: 14,
                fontWeight: 600,
                color: "var(--accent-text)",
                background: "transparent",
                border: "none",
                borderTop: "1px solid var(--hairline)",
                cursor: "pointer",
              }}
              type="button"
            >
              <Icon name="plus" size={14} />
              Criar novo
            </button>
          )}
        </div>
      )}
    </div>
  );
}
