"use client";

import { BlendFunction, Effect } from "postprocessing";
import { useMemo } from "react";
import { Uniform } from "three";

/* ════════════════════════════════════════════════════════════
   SHARPEN
   ─────────────────────────────────────────────────────────────
   Unsharp mask over the composited frame, weighted toward the
   right of the viewport.

   Bloom is a blur, and a scene that leans on it loses its fine
   detail — the dial ticks and the dust grain go soft. Recovering
   them with a mask after bloom keeps the glow while putting the
   edges back. The right-hand weighting is compositional: the
   sphere sits right of centre, so that is where crispness is
   worth spending contrast on, and it leaves the left side (which
   carries the headline) untouched.
   ════════════════════════════════════════════════════════════ */

const fragment = /* glsl */ `
  uniform float uStrength;
  uniform float uRightBias;

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    vec2 texel = 1.0 / resolution;

    /* 4-tap cross blur — the "unsharp" half of the mask. */
    vec3 blur = texture2D(inputBuffer, uv + vec2( texel.x, 0.0)).rgb
              + texture2D(inputBuffer, uv + vec2(-texel.x, 0.0)).rgb
              + texture2D(inputBuffer, uv + vec2(0.0,  texel.y)).rgb
              + texture2D(inputBuffer, uv + vec2(0.0, -texel.y)).rgb;
    blur *= 0.25;

    /* Ramp the effect toward the right of the frame, where the sphere sits. */
    float weight = mix(1.0 - uRightBias, 1.0, smoothstep(0.28, 0.92, uv.x));
    float amount = uStrength * weight;

    vec3 sharpened = inputColor.rgb + (inputColor.rgb - blur) * amount;

    /* Clamp to the local range in BOTH directions. The ceiling stops the mask
       manufacturing highlights that bloom would re-amplify next frame; the
       floor stops the undershoot, which on a dark scene digs black halos
       around every bright edge and reads as angular banding. */
    vec3 lo = min(inputColor.rgb, blur) * 0.94;
    vec3 hi = max(inputColor.rgb, blur) * 1.18;
    sharpened = clamp(sharpened, lo, hi);

    outputColor = vec4(max(sharpened, 0.0), inputColor.a);
  }`;

class SharpenEffect extends Effect {
  constructor({ strength = 0.5, rightBias = 0.6 } = {}) {
    super("SharpenEffect", fragment, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform<number>>([
        ["uStrength", new Uniform(strength)],
        ["uRightBias", new Uniform(rightBias)],
      ]),
    });
  }
}

type SharpenProps = {
  /** How much weaker the left edge is than the right. */
  rightBias?: number;
  /** 0 = off. Above ~0.9 the dust starts to crawl. */
  strength?: number;
};

export function Sharpen({ rightBias = 0.6, strength = 0.5 }: SharpenProps) {
  const effect = useMemo(
    () => new SharpenEffect({ rightBias, strength }),
    [rightBias, strength]
  );
  return <primitive object={effect} />;
}
