"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Logo } from "./logo";
import { EASE_OUT } from "./magic";
import type { NavCopy } from "./types";

type ReadinessNavProps = {
  copy: NavCopy;
  logoLabel: string;
};

/**
 * Nav links follow the ladder; the CTA is always the assessment.
 *
 * The prototype also drew a 1px scroll-progress hairline along the nav's bottom
 * edge. Dropped here: the root layout already mounts a global <ScrollProgress />
 * at the top of the viewport, and two indicators reads as a bug.
 */
export function ReadinessNav({ copy, logoLabel }: ReadinessNavProps) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) {
        setOpen(false);
      }
    };
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* An open sheet has to hold the page still and answer Escape. Neither was
     true: with the menu open the page scrolled behind it, and Escape did
     nothing. The scroll container is <html>, not <body> — styles.css sets
     `overflow-x: hidden` there, which makes it the scrolling box — so locking
     body would have looked correct and done nothing. */
  useEffect(() => {
    if (!open) {
      return;
    }
    const root = document.documentElement;
    const previous = root.style.overflowY;
    root.style.overflowY = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      root.style.overflowY = previous;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <motion.header
        animate={{ opacity: 1, y: 0 }}
        className={`fixed top-0 right-0 left-0 z-50 transition-all duration-300 ${scrolled ? "border-hairline border-b bg-canvas/70 backdrop-blur-xl" : ""}`}
        initial={{ opacity: 0, y: -20 }}
        role="banner"
        transition={{ duration: 0.7, ease: EASE_OUT }}
      >
        {/* 1280, matching every section container and the footer. It was 1320,
            which put the logo's left edge at 79px while the h1 directly beneath
            it — and every heading, eyebrow and paragraph on the page — sat at
            99px. A 20px offset between the wordmark and the headline under it is
            the most visible misalignment a page can have, because those two are
            read together. */}
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-6">
          <a className="rounded-md" href="#top">
            <Logo label={logoLabel} />
          </a>

          <nav
            aria-label={copy.primary}
            className="hidden items-center gap-1 rounded-full border border-hairline bg-white/[0.025] px-1 py-1 md:flex"
          >
            {copy.links.map((link) => (
              <a
                className="flex min-h-[36px] items-center rounded-full px-3.5 py-2 text-[13px] text-body transition-colors hover:bg-white/[0.05] hover:text-ink"
                href={link.href}
                key={link.label}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <a
              className="btn-primary !h-[44px] !px-4 !text-[13px] whitespace-nowrap"
              href="#start"
            >
              <span>{copy.cta}</span>
            </a>
            <button
              aria-expanded={open}
              aria-label={open ? copy.closeMenu : copy.openMenu}
              className="flex h-11 w-11 items-center justify-center rounded-lg border border-hairline text-body md:hidden"
              onClick={() => setOpen(!open)}
              type="button"
            >
              <svg
                aria-hidden="true"
                focusable="false"
                height="16"
                viewBox="0 0 16 16"
                width="16"
              >
                <path
                  d={open ? "M3 3l10 10M13 3L3 13" : "M2 5h12M2 11h12"}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeWidth="1.5"
                />
              </svg>
            </button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {open ? (
          <>
            {/* Tapping away closes it. Sits under the sheet (z-30 vs z-40) and
                starts below the bar so the toggle stays hittable. */}
            <button
              aria-label={copy.closeMenu}
              className="fixed inset-0 top-16 z-30 cursor-default md:hidden"
              onClick={() => setOpen(false)}
              tabIndex={-1}
              type="button"
            />
            <motion.div
              animate={{ opacity: 1, y: 0 }}
              /* Capped and scrollable: in landscape the sheet cleared the
                 window by 7px with no overflow of its own, so one more link
                 would have been unreachable. */
              className="fixed top-16 right-0 left-0 z-40 max-h-[calc(100svh-4rem)] overflow-y-auto overscroll-contain border-hairline border-b bg-canvas/95 backdrop-blur-xl md:hidden"
              exit={{ opacity: 0, y: -8 }}
              initial={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <nav aria-label={copy.mobile} className="flex flex-col px-6 py-4">
                {copy.links.map((link) => (
                  <a
                    className="flex min-h-11 items-center border-hairline border-b text-[15px] text-body transition-colors last:border-0 hover:text-ink"
                    href={link.href}
                    key={link.label}
                    onClick={() => setOpen(false)}
                  >
                    {link.label}
                  </a>
                ))}
              </nav>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  );
}
