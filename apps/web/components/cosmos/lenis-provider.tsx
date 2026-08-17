"use client";

import Lenis from "lenis";
import { useEffect } from "react";

export function LenisProvider() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.5,
      // Lenis intercepts in-page anchor clicks; without an offset it scrolls the
      // target under the fixed h-16 header. CSS scroll-margin-top does not apply
      // to Lenis's programmatic scrollTo.
      anchors: { offset: -88 },
    });

    let raf: number;

    function onRaf(time: number) {
      lenis.raf(time);
      raf = requestAnimationFrame(onRaf);
    }

    raf = requestAnimationFrame(onRaf);

    return () => {
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);

  return null;
}
