"use client";

import { createContext, useContext } from "react";

export type Palette = [string, string, string];

export const PaletteCtx = createContext<Palette>([
  "#7c6cff",
  "#5b8cff",
  "#3cc3ff",
]);
export const usePalette = () => useContext(PaletteCtx);

export interface WGLConfig {
  curlSpeed: number;
  curlStrength: number;
  bloom: number;
  godRays: boolean;
  rings: boolean;
  glitch: boolean;
  dof: boolean;
  dofFocus: number;
  dofBokeh: number;
  fxaa: boolean;
  noise: boolean;
  noiseOpacity: number;
  hueSat: boolean;
  hue: number;
  saturation: number;
  brightness: boolean;
  bright: number;
  contrast: number;
  toneMap: boolean;
  toneMappingMode: string;
  pixelate: boolean;
  pixelGranularity: number;
}

export const WGL_DEFAULT: WGLConfig = {
  /* curl simulation */
  curlSpeed: 1.0,
  curlStrength: 2.4,
  /* core effects */
  bloom: 1.75,
  godRays: true,
  rings: true,
  glitch: true,
  /* depth of field — focus on sphere, blur far particles */
  dof: true,
  dofFocus: 0.1,
  dofBokeh: 0.5,
  /* anti-aliasing */
  fxaa: true,
  /* film grain */
  noise: false,
  noiseOpacity: 0.25,
  /* hue / saturation */
  hueSat: true,
  hue: 0,
  saturation: 0.2,
  /* brightness / contrast */
  brightness: true,
  bright: 0.0,
  contrast: 0.5,
  /* tone mapping — disabled per spec */
  toneMap: false,
  toneMappingMode: "LINEAR",
  /* pixelation */
  pixelate: false,
  pixelGranularity: 5,
};

export const WebGLCtx = createContext<WGLConfig>(WGL_DEFAULT);
