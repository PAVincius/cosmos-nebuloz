"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { WGL_DEFAULT, type WGLConfig } from "./contexts";

const PALETTES: Record<string, [string, string, string]> = {
  cobalt: ["#7c6cff", "#5b8cff", "#3cc3ff"],
  amber: ["#ff7e3d", "#ffb13d", "#ffd06b"],
  jade: ["#22d39a", "#1ec6b8", "#a8f0d0"],
  obsidian: ["#ffffff", "#b4c0d8", "#7d8aa8"],
  signal: ["#ff5c8a", "#a974ff", "#5b8cff"],
  himmel: ["#5CB4E4", "#89CFF0", "#F6F2C3"],
};

export type { WGLConfig };
export { WGL_DEFAULT };

export interface TweaksState {
  palette: [string, string, string];
  paletteName: string;
  setPaletteName: (name: string) => void;
  density: string;
  setDensity: (d: string) => void;
  diagramMode: string;
  setDiagramMode: (m: string) => void;
  wgl: WGLConfig;
  setWgl: (k: keyof WGLConfig, v: WGLConfig[keyof WGLConfig]) => void;
}

export function useTweaks(): TweaksState {
  const [paletteName, setPaletteName] = useState("himmel");
  const [density, setDensity] = useState("default");
  const [diagramMode, setDiagramMode] = useState("graph");
  const [wgl, setWglState] = useState<WGLConfig>(WGL_DEFAULT);

  const setWgl = (k: keyof WGLConfig, v: WGLConfig[keyof WGLConfig]) =>
    setWglState((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    (window as unknown as Record<string, unknown>).__wgl = wgl;
  }, [wgl]);

  return {
    palette: PALETTES[paletteName] ?? PALETTES.himmel,
    paletteName,
    setPaletteName,
    density,
    setDensity,
    diagramMode,
    setDiagramMode,
    wgl,
    setWgl,
  };
}

/* ── Helper components ───────────────────────────── */
interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}
function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: SliderRowProps) {
  return (
    <div>
      <div
        className="mono text-[10px] text-muted"
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span>{label}</span>
        <span style={{ color: "#f5f7fb" }}>{display}</span>
      </div>
      <input
        max={max}
        min={min}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        step={step}
        style={{
          width: "100%",
          accentColor: "var(--c-violet)",
          cursor: "pointer",
        }}
        type="range"
        value={value}
      />
    </div>
  );
}

function Toggle({
  on,
  onClick,
  label,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "3px 10px",
        borderRadius: 6,
        fontSize: 11,
        cursor: "pointer",
        fontFamily: "JetBrains Mono, monospace",
        letterSpacing: "0.04em",
        border: `1px solid ${on ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)"}`,
        background: on ? "rgba(255,255,255,0.10)" : "transparent",
        color: on ? "#f5f7fb" : "#6b748a",
        transition: "all .15s",
      }}
    >
      {label}
    </button>
  );
}

function EffectBlock({
  label,
  enabled,
  onToggle,
  children,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="row">
      <div className="mb-1.5 flex items-center justify-between">
        <label>{label}</label>
        <Toggle
          label={enabled ? "On" : "Off"}
          on={enabled}
          onClick={onToggle}
        />
      </div>
      {enabled && children}
    </div>
  );
}

/* ── Main panel ──────────────────────────────────── */
export function TweaksPanel({ tw }: { tw: TweaksState }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        className="mono fixed right-5 bottom-5 z-[100] flex items-center gap-2 rounded-full border border-hairline-strong bg-canvas/85 px-3.5 py-2.5 text-[12px] text-body backdrop-blur-xl transition-all hover:border-white/30 hover:text-ink"
        onClick={() => setOpen(true)}
        style={{ boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
      >
        <span className="dot dot-violet" />
        <span>Tweaks</span>
      </button>
    );
  }

  const { wgl, setWgl } = tw;

  return (
    <div
      className="tweaks"
      style={{ maxHeight: "94vh", overflowY: "auto", scrollbarWidth: "none" }}
    >
      <header>
        <div className="flex items-center gap-2">
          <span className="dot dot-violet" />
          <span className="label text-ink">TWEAKS</span>
        </div>
        <button
          className="text-muted text-sm hover:text-ink"
          onClick={() => setOpen(false)}
        >
          ×
        </button>
      </header>

      {/* ── Palette ── */}
      <div className="row">
        <label>Accent palette</label>
        <div className="flex items-center gap-2">
          {Object.entries(PALETTES).map(([name, colors]) => (
            <button
              className={`swatch ${tw.paletteName === name ? "active" : ""}`}
              key={name}
              onClick={() => tw.setPaletteName(name)}
              style={{
                background: `linear-gradient(135deg, ${colors[0]}, ${colors[1]} 50%, ${colors[2]})`,
              }}
              title={name}
            />
          ))}
        </div>
        <div className="mono text-[10px] text-muted capitalize">
          {tw.paletteName}
        </div>
      </div>

      {/* ── Layout ── */}
      <div className="row">
        <label>Density</label>
        <div className="seg">
          {["default", "dense"].map((d) => (
            <button
              className={tw.density === d ? "active" : ""}
              key={d}
              onClick={() => tw.setDensity(d)}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <label>System view</label>
        <div className="seg">
          {[
            ["graph", "Graph"],
            ["grid", "Matrix"],
          ].map(([k, l]) => (
            <button
              className={tw.diagramMode === k ? "active" : ""}
              key={k}
              onClick={() => tw.setDiagramMode(k)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* ── WebGL section header ── */}
      <div
        className="row"
        style={{
          background: "rgba(60,195,255,0.04)",
          borderBottom: "1px solid rgba(60,195,255,0.08)",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="dot dot-cyan" />
          <label style={{ color: "#9ee8ff" }}>WEBGL</label>
        </div>
      </div>

      {/* Curl */}
      <div className="row">
        <label>Curl speed</label>
        <div className="seg">
          {(
            [
              ["Slow", 0.4],
              ["Normal", 1],
              ["Fast", 2.2],
            ] as [string, number][]
          ).map(([l, v]) => (
            <button
              className={wgl.curlSpeed === v ? "active" : ""}
              key={l}
              onClick={() => setWgl("curlSpeed", v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>
      <div className="row">
        <label>Curl strength</label>
        <div className="seg">
          {(
            [
              ["Gentle", 1.2],
              ["Normal", 2.4],
              ["Wild", 4.5],
            ] as [string, number][]
          ).map(([l, v]) => (
            <button
              className={wgl.curlStrength === v ? "active" : ""}
              key={l}
              onClick={() => setWgl("curlStrength", v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Bloom */}
      <div className="row">
        <label>Bloom</label>
        <div className="seg">
          {(
            [
              ["Low", 0.8],
              ["Mid", 1.75],
              ["High", 2.8],
            ] as [string, number][]
          ).map(([l, v]) => (
            <button
              className={wgl.bloom === v ? "active" : ""}
              key={l}
              onClick={() => setWgl("bloom", v)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Core effect toggles */}
      <div className="row">
        <label>Scene effects</label>
        <div className="flex flex-wrap gap-1.5">
          {(["godRays", "rings", "glitch", "fxaa"] as (keyof WGLConfig)[]).map(
            (k) => {
              const labels: Record<string, string> = {
                godRays: "GodRays",
                rings: "Rings",
                glitch: "Glitch",
                fxaa: "FXAA",
              };
              return (
                <Toggle
                  key={k}
                  label={labels[k] ?? String(k)}
                  on={!!wgl[k]}
                  onClick={() => setWgl(k, !wgl[k])}
                />
              );
            }
          )}
        </div>
      </div>

      {/* DOF */}
      <EffectBlock
        enabled={wgl.dof}
        label="Depth of field"
        onToggle={() => setWgl("dof", !wgl.dof)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SliderRow
            display={wgl.dofFocus.toFixed(3)}
            label="Focus"
            max={0.1}
            min={0}
            onChange={(v) => setWgl("dofFocus", v)}
            step={0.002}
            value={wgl.dofFocus}
          />
          <SliderRow
            display={wgl.dofBokeh.toFixed(1)}
            label="Bokeh"
            max={7}
            min={0.5}
            onChange={(v) => setWgl("dofBokeh", v)}
            step={0.1}
            value={wgl.dofBokeh}
          />
        </div>
      </EffectBlock>

      {/* Film grain */}
      <EffectBlock
        enabled={wgl.noise}
        label="Film grain"
        onToggle={() => setWgl("noise", !wgl.noise)}
      >
        <SliderRow
          display={wgl.noiseOpacity.toFixed(2)}
          label="Opacity"
          max={0.8}
          min={0.02}
          onChange={(v) => setWgl("noiseOpacity", v)}
          step={0.01}
          value={wgl.noiseOpacity}
        />
      </EffectBlock>

      {/* Color grade (hue + saturation) */}
      <EffectBlock
        enabled={wgl.hueSat}
        label="Hue / saturation"
        onToggle={() => setWgl("hueSat", !wgl.hueSat)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SliderRow
            display={`${wgl.hue}°`}
            label="Hue shift"
            max={180}
            min={-180}
            onChange={(v) => setWgl("hue", v)}
            step={1}
            value={wgl.hue}
          />
          <SliderRow
            display={wgl.saturation.toFixed(2)}
            label="Saturation"
            max={1}
            min={-1}
            onChange={(v) => setWgl("saturation", v)}
            step={0.02}
            value={wgl.saturation}
          />
        </div>
      </EffectBlock>

      {/* Brightness / contrast */}
      <EffectBlock
        enabled={wgl.brightness}
        label="Brightness / contrast"
        onToggle={() => setWgl("brightness", !wgl.brightness)}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <SliderRow
            display={wgl.bright.toFixed(2)}
            label="Brightness"
            max={0.5}
            min={-0.5}
            onChange={(v) => setWgl("bright", v)}
            step={0.01}
            value={wgl.bright}
          />
          <SliderRow
            display={wgl.contrast.toFixed(2)}
            label="Contrast"
            max={0.5}
            min={-0.5}
            onChange={(v) => setWgl("contrast", v)}
            step={0.01}
            value={wgl.contrast}
          />
        </div>
      </EffectBlock>

      {/* Pixelation */}
      <EffectBlock
        enabled={wgl.pixelate}
        label="Pixelation"
        onToggle={() => setWgl("pixelate", !wgl.pixelate)}
      >
        <SliderRow
          display={`${Math.round(wgl.pixelGranularity)}px`}
          label="Granularity"
          max={20}
          min={2}
          onChange={(v) => setWgl("pixelGranularity", v)}
          step={1}
          value={wgl.pixelGranularity}
        />
      </EffectBlock>

      <div className="row">
        <div className="mono text-[10px] text-muted leading-relaxed">
          Todos os efeitos acumulam no mesmo EffectComposer.
        </div>
      </div>
    </div>
  );
}
