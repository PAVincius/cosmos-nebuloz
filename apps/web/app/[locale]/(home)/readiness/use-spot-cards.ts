"use client";

import type { RefObject } from "react";
import { useEffect } from "react";

/** How far, in px, a card's border reacts to the cursor. */
const REACH = 150;

/**
 * Reactive hairlines: every `.spot-card` inside `rootRef` lights its border in
 * proportion to how close the cursor is, tying the flat surfaces to the
 * sphere's light vocabulary. Pairs with `.spot-card::after` in styles.css.
 *
 * This has to be a single proximity pass, not per-element pointer handlers:
 * `.spot-card` sits on *containers* (the gap grid, both method grids, the proof
 * accordion, the position table, the Cosmos row, the products panel and its
 * footnote), and the border must ignite while the cursor is still outside the
 * element — a hover handler never fires for that.
 *
 * Cost is bounded: one passive listener, one rAF per frame of movement, and
 * ~8 elements scoped to this page rather than a document-wide query.
 */
export function useSpotCards(rootRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    let pointerX = -10_000;
    let pointerY = -10_000;
    let raf = 0;

    const tick = () => {
      raf = 0;
      const root = rootRef.current;
      if (!root) {
        return;
      }
      const cards = root.querySelectorAll<HTMLElement>(".spot-card");
      for (const card of cards) {
        const rect = card.getBoundingClientRect();
        // Off-screen cards keep their last value — cheaper than resetting, and
        // invisible either way.
        if (rect.bottom < -REACH || rect.top > window.innerHeight + REACH) {
          continue;
        }
        const nearestX = Math.max(rect.left, Math.min(pointerX, rect.right));
        const nearestY = Math.max(rect.top, Math.min(pointerY, rect.bottom));
        const distance = Math.hypot(pointerX - nearestX, pointerY - nearestY);
        if (distance > REACH) {
          card.style.setProperty("--spot", "0");
          continue;
        }
        card.style.setProperty("--spot", (1 - distance / REACH).toFixed(3));
        card.style.setProperty(
          "--mx",
          `${(((pointerX - rect.left) / rect.width) * 100).toFixed(2)}%`
        );
        card.style.setProperty(
          "--my",
          `${(((pointerY - rect.top) / rect.height) * 100).toFixed(2)}%`
        );
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!raf) {
        raf = requestAnimationFrame(tick);
      }
    };

    /* Mouse-only. On a touchscreen every pointermove during a scroll scheduled
       a rAF that read getBoundingClientRect off each visible .spot-card and
       wrote three custom properties back — layout reads interleaved with style
       writes, on the frames where the device can least afford it, to drive a
       hover effect the user cannot see. This also switches it off on hybrids
       whose primary pointer is touch or a pen, which is the intent. */
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [rootRef]);
}
