"use client";

import {
  motion,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import type { KeyboardEvent, MouseEvent } from "react";
import { useCallback, useRef, useState } from "react";
import { BorderBeam, TONE, type Tone } from "./magic";
import type { ContactChannel, ContactCopy } from "./types";

/* ════════════════════════════════════════════════════════════
   CONTACT COMPASS — four channels, one per cardinal direction.

   The direction is the whole interaction: arrow keys steer, the
   needle points, and the card for that heading comes forward out of
   the stage. Highlighting is cheap and follows the pointer; picking
   is a click, and picking is what opens the form.

   Desktop only. The list below md is a replacement, not a shrunken
   compass: a directional metaphor needs a pointer and a keyboard to
   mean anything, and on a phone it would be four cards you tap —
   which is a list wearing a costume.
   ════════════════════════════════════════════════════════════ */

const DIRS = ["up", "right", "down", "left"] as const;
type Dir = (typeof DIRS)[number];

/** Grid cell per heading — a 3×3 with the hub in the middle. Placing by grid
 *  rather than absolute offsets keeps the stage responsive without a second set
 *  of breakpoint maths. */
const CELL: Record<Dir, string> = {
  up: "col-start-2 row-start-1",
  right: "col-start-3 row-start-2",
  down: "col-start-2 row-start-3",
  left: "col-start-1 row-start-2",
};

/** Resting pose: each card leans away from the viewer, hinged on the edge
 *  nearest the hub, so the four of them read as walls of a shallow box. */
const REST: Record<Dir, { rotateX: number; rotateY: number }> = {
  up: { rotateX: -20, rotateY: 0 },
  right: { rotateX: 0, rotateY: -20 },
  down: { rotateX: 20, rotateY: 0 },
  left: { rotateX: 0, rotateY: 20 },
};

/** Needle heading in degrees, clockwise from north. */
const HEADING: Record<Dir, number> = {
  up: 0,
  right: 90,
  down: 180,
  left: 270,
};

const ARROW_KEY: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowRight: "right",
  ArrowDown: "down",
  ArrowLeft: "left",
};

const SPRING = { stiffness: 260, damping: 26, mass: 0.9 } as const;

/* `Dictionary` is `typeof en`, so JSON string values widen to `string` and the
   tone name arrives unnarrowed. Resolve it rather than casting: a dictionary
   with a typo then loses a colour instead of rendering `undefined` into a CSS
   property, which paints nothing and is far harder to spot. */
const toneOf = (name: string): string => TONE[name as Tone] ?? TONE.violet;

type Entry = { dir: Dir; channel: ContactChannel };

/** Channels come from the dictionary, so the order is copy's to decide; this
 *  pins each one to a heading by index rather than trusting the data to carry
 *  a direction it has no reason to know about. */
const byDirection = (channels: ContactChannel[]): Entry[] =>
  DIRS.map((dir, i) => ({ dir, channel: channels[i] })).filter(
    (entry): entry is Entry => Boolean(entry.channel)
  );

type ContactCompassProps = {
  copy: ContactCopy;
  onPick: (channel: ContactChannel) => void;
  /** Label of the channel already chosen, so the compass can keep it marked
   *  while the form is open. */
  picked: string | null;
};

export function ContactCompass({ copy, onPick, picked }: ContactCompassProps) {
  const entries = byDirection(copy.channels);
  const [hot, setHot] = useState<Dir | null>(null);
  const reduced = Boolean(useReducedMotion());
  const stageRef = useRef<HTMLDivElement>(null);
  /* Arrow keys have to move real focus, not just the highlight. Without this
     the highlight and the focus ring drift apart and Enter fires whichever card
     was last tabbed to — which is not the one the needle is pointing at. */
  const cardRefs = useRef<Partial<Record<Dir, HTMLButtonElement | null>>>({});

  /* Whole-stage parallax. Springs rather than raw motion values so the stage
     settles instead of snapping to wherever the pointer last was. */
  const tiltX = useSpring(0, SPRING);
  const tiltY = useSpring(0, SPRING);
  const rotateX = useTransform(tiltX, (v) => `${v}deg`);
  const rotateY = useTransform(tiltY, (v) => `${v}deg`);

  const onPointer = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (reduced) {
        return;
      }
      const node = stageRef.current;
      if (!node) {
        return;
      }
      const rect = node.getBoundingClientRect();
      const nx = (event.clientX - rect.left) / rect.width - 0.5;
      const ny = (event.clientY - rect.top) / rect.height - 0.5;
      // Deliberately small: this is depth cueing, not a ride.
      tiltX.set(-ny * 9);
      tiltY.set(nx * 9);
    },
    [reduced, tiltX, tiltY]
  );

  const onLeave = useCallback(() => {
    tiltX.set(0);
    tiltY.set(0);
  }, [tiltX, tiltY]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const dir = ARROW_KEY[event.key];
    if (!dir) {
      return;
    }
    // The arrows are the control here, so they must not also scroll the dialog.
    event.preventDefault();
    setHot(dir);
    cardRefs.current[dir]?.focus();
  };

  const hotEntry = entries.find((e) => e.dir === hot) ?? null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: parallax only — the radiogroup inside owns semantics and keyboard.
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onMouseMove writes a decorative CSS transform and carries no state; there is no behaviour here for a keyboard user to miss, and the cards below are real buttons.
    <div
      className="relative mx-auto w-full max-w-[720px]"
      onMouseLeave={onLeave}
      onMouseMove={onPointer}
      ref={stageRef}
      style={{ perspective: "1400px" }}
    >
      <motion.div
        className="grid grid-cols-[1fr_minmax(190px,1fr)_1fr] items-center gap-4"
        style={
          reduced
            ? { transformStyle: "preserve-3d" }
            : { transformStyle: "preserve-3d", rotateX, rotateY }
        }
      >
        <div
          aria-label={copy.groupLabel}
          className="contents"
          onKeyDown={onKeyDown}
          role="radiogroup"
        >
          {entries.map(({ dir, channel }, i) => (
            <ChannelCard
              channel={channel}
              dir={dir}
              hot={hot}
              key={dir}
              onHighlight={setHot}
              onPick={onPick}
              picked={picked}
              reduced={reduced}
              registerRef={(node) => {
                cardRefs.current[dir] = node;
              }}
              // Roving tabindex: one stop for the group, arrows do the rest.
              tabbable={hot === dir || (hot === null && i === 0)}
            />
          ))}
        </div>

        <Hub
          copy={copy}
          hot={hot}
          hotEntry={hotEntry}
          onPick={onPick}
          reduced={reduced}
        />
      </motion.div>

      <p className="mono mt-6 text-center text-[11px] text-muted">
        {copy.hint}
      </p>
    </div>
  );
}

/* ── the hub: needle plus the highlighted heading ─────────── */

type HubProps = {
  copy: ContactCopy;
  hot: Dir | null;
  hotEntry: Entry | null;
  onPick: (channel: ContactChannel) => void;
  reduced: boolean;
};

function Hub({ copy, hot, hotEntry, onPick, reduced }: HubProps) {
  const heading = useSpring(0, { stiffness: 180, damping: 22 });
  const rotate = useTransform(heading, (v) => `${v}deg`);

  /* Unwrapped heading, so a turn from left (270°) to up (0°) goes the short way
     round instead of spinning three quarters of a circle backwards. */
  const previous = useRef(0);
  if (hot) {
    const target = HEADING[hot];
    const delta = ((target - (previous.current % 360) + 540) % 360) - 180;
    previous.current += delta;
    heading.set(previous.current);
  }

  return (
    <div
      className="col-start-2 row-start-2 flex min-h-[164px] flex-col items-center justify-center rounded-[18px] border border-hairline bg-canvas/80 px-5 py-6 text-center backdrop-blur-md"
      style={{ transform: "translateZ(24px)", transformStyle: "preserve-3d" }}
    >
      <div className="relative mb-4 h-[46px] w-[46px]">
        <svg
          aria-hidden="true"
          className="absolute inset-0 text-white/15"
          viewBox="0 0 54 54"
        >
          <circle
            cx="27"
            cy="27"
            fill="none"
            r="25"
            stroke="currentColor"
            strokeDasharray="2 5"
            strokeWidth="1"
          />
        </svg>
        <motion.svg
          aria-hidden="true"
          className="absolute inset-0"
          style={reduced ? undefined : { rotate }}
          viewBox="0 0 54 54"
        >
          <path
            d="M27 9 L31 27 L27 24 L23 27 Z"
            fill={
              hotEntry ? toneOf(hotEntry.channel.tone) : "rgba(255,255,255,.3)"
            }
          />
          <circle cx="27" cy="27" fill="rgba(255,255,255,.35)" r="2.5" />
        </motion.svg>
      </div>

      {hotEntry ? (
        <>
          <p className="label mb-3 text-muted">{hotEntry.channel.label}</p>
          <button
            className="btn-primary !h-[38px] !text-[13px]"
            onClick={() => onPick(hotEntry.channel)}
            type="button"
          >
            <span>{copy.pick}</span>
          </button>
        </>
      ) : (
        <>
          <p className="label mb-2 text-muted">{copy.idleTitle}</p>
          <p className="max-w-[190px] text-[13px] text-body leading-[1.5]">
            {copy.idleDesc}
          </p>
        </>
      )}
    </div>
  );
}

/* ── one card ─────────────────────────────────────────────── */

type ChannelCardProps = {
  channel: ContactChannel;
  dir: Dir;
  hot: Dir | null;
  onHighlight: (dir: Dir) => void;
  onPick: (channel: ContactChannel) => void;
  picked: string | null;
  reduced: boolean;
  registerRef: (node: HTMLButtonElement | null) => void;
  tabbable: boolean;
};

/** The card's animated pose. Pulled out of the component because inline it was
 *  a nested ternary inside a six-key object literal — the complexity rule was
 *  right that it had stopped being readable. */
function poseFor(
  dir: Dir,
  isHot: boolean,
  dimmed: boolean,
  reduced: boolean
): Record<string, number> {
  if (reduced) {
    return { opacity: dimmed ? 0.75 : 1 };
  }
  let depth = 0;
  if (isHot) {
    depth = 60;
  } else if (dimmed) {
    depth = -30;
  }
  return {
    rotateX: isHot ? 0 : REST[dir].rotateX,
    rotateY: isHot ? 0 : REST[dir].rotateY,
    z: depth,
    scale: isHot ? 1.03 : 1,
    opacity: dimmed ? 0.72 : 1,
  };
}

function ChannelCard({
  channel,
  dir,
  hot,
  onHighlight,
  onPick,
  picked,
  reduced,
  registerRef,
  tabbable,
}: ChannelCardProps) {
  const isHot = hot === dir;
  const isPicked = picked === channel.label;
  const dimmed = hot !== null && !isHot;

  return (
    <motion.button
      animate={poseFor(dir, isHot, dimmed, reduced)}
      aria-checked={isPicked}
      className={`${CELL[dir]} group relative flex flex-col items-start gap-1 rounded-[14px] border px-4 py-3 text-left backdrop-blur-md transition-colors ${
        isHot || isPicked
          ? "border-white/25 bg-canvas/85"
          : "border-hairline bg-canvas/70 hover:border-white/15"
      }`}
      onClick={() => onPick(channel)}
      onFocus={() => onHighlight(dir)}
      onMouseEnter={() => onHighlight(dir)}
      ref={registerRef}
      role="radio"
      style={{ transformStyle: "preserve-3d" }}
      tabIndex={tabbable ? 0 : -1}
      transition={SPRING}
      type="button"
    >
      {isHot ? <BorderBeam duration={5} /> : null}
      <span
        aria-hidden="true"
        className="mb-1 h-[3px] w-6 rounded-full"
        style={{ background: toneOf(channel.tone) }}
      />
      <span className="font-medium text-[14px] text-white">
        {channel.label}
      </span>
      <span className="text-[12px] text-muted leading-[1.45]">
        {channel.desc}
      </span>
    </motion.button>
  );
}

/* ── mobile list ──────────────────────────────────────────── */

type ContactListProps = {
  copy: ContactCopy;
  onPick: (channel: ContactChannel) => void;
  picked: string | null;
};

export function ContactList({ copy, onPick, picked }: ContactListProps) {
  return (
    <ul className="grid gap-2.5">
      {copy.channels.map((channel) => (
        <li key={channel.label}>
          <button
            aria-pressed={picked === channel.label}
            className={`flex w-full items-center gap-3.5 rounded-[14px] border px-4 py-3.5 text-left ${
              picked === channel.label
                ? "border-white/25 bg-canvas/85"
                : "border-hairline bg-canvas/70"
            }`}
            onClick={() => onPick(channel)}
            type="button"
          >
            <span
              aria-hidden="true"
              className="h-7 w-[3px] shrink-0 rounded-full"
              style={{ background: toneOf(channel.tone) }}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium text-[14px] text-white">
                {channel.label}
              </span>
              <span className="block text-[12px] text-muted leading-[1.4]">
                {channel.desc}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
