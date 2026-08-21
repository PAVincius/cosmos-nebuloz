"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { useContactDialog } from "./contact-dialog";
import { BlurFade, EASE_OUT } from "./magic";
import { AXES_NEUTRAL, useSceneSignals } from "./nebula-store";
import type { ShapeCopy } from "./types";

/* ════════════════════════════════════════════════════════════
   READINESS SHAPE — the site's interactive signature.

   Five questions, one per axis. Each answer (0–1) deforms the
   sphere along that axis's sector: weak axes stay ragged dust,
   strong axes condense into clean glass. The visual IS the
   assessment — you leave seeing your organisation's shape.
   ════════════════════════════════════════════════════════════ */

/** Option weights per question. Behaviour, so they live in code, not copy.
 *  Question 1 is deliberately gentler on its middle option than the rest. */
const WEIGHTS: number[][] = [
  [1, 0.55, 0.15],
  [1, 0.5, 0.15],
  [1, 0.5, 0.15],
  [1, 0.5, 0.15],
  [1, 0.5, 0.15],
];

type Answers = (number | null)[];

const EMPTY: Answers = [null, null, null, null, null];

/** Three bands, no nested ternary. */
function verdictFor(score: number, copy: ShapeCopy["verdicts"]): string {
  if (score >= 75) {
    return copy.high;
  }
  if (score >= 45) {
    return copy.mid;
  }
  return copy.low;
}

/** Three states, no nested ternary: current step, answered, untouched. */
function stepBorder(current: boolean, answered: boolean): string {
  if (current) {
    return "var(--c-violet)";
  }
  if (answered) {
    return "rgba(92,180,228,0.35)";
  }
  return "rgba(255,255,255,0.12)";
}

type StepperTabProps = {
  answered: boolean;
  answeredLabel: string;
  current: boolean;
  index: number;
  last: boolean;
  onSelect: (index: number) => void;
  axis: string;
};

function StepperTab({
  answered,
  answeredLabel,
  axis,
  current,
  index,
  last,
  onSelect,
}: StepperTabProps) {
  return (
    <button
      aria-label={`${axis}${answered ? ` — ${answeredLabel}` : ""}`}
      aria-selected={current}
      className="group flex min-h-11 items-center gap-1.5 px-0.5 py-1.5"
      onClick={() => onSelect(index)}
      role="tab"
      type="button"
    >
      <span
        className="mono flex h-8 w-8 items-center justify-center rounded-full border text-[11px] transition-all duration-300"
        style={{
          background: answered ? "rgba(92,180,228,0.10)" : "transparent",
          borderColor: stepBorder(current, answered),
          boxShadow: current ? "0 0 14px rgba(92,180,228,0.25)" : "none",
          color: current ? "var(--c-ink)" : "var(--c-muted)",
        }}
      >
        {answered ? "✓" : String(index + 1).padStart(2, "0")}
      </span>
      {last ? null : (
        <span aria-hidden="true" className="h-px w-3 bg-white/10" />
      )}
    </button>
  );
}

type StepperProps = {
  answers: Answers;
  copy: ShapeCopy;
  onSelect: (index: number) => void;
  questions: ShapeCopy["questions"];
  step: number;
};

function ShapeStepper({
  answers,
  copy,
  onSelect,
  questions,
  step,
}: StepperProps) {
  return (
    <div
      aria-label={copy.axesLabel}
      className="mb-8 flex items-center gap-1 md:gap-2"
      role="tablist"
    >
      {questions.map((question, i) => (
        <StepperTab
          answered={answers[i] !== null}
          answeredLabel={copy.answered}
          axis={question.axis}
          current={step === i}
          index={i}
          key={question.axis}
          last={i === questions.length - 1}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

type QuestionProps = {
  onAnswer: (weight: number) => void;
  question: ShapeCopy["questions"][number];
  selected: number | null;
  step: number;
};

function ShapeQuestion({ onAnswer, question, selected, step }: QuestionProps) {
  return (
    // Deliberately not <AnimatePresence mode="wait">: that holds the outgoing
    // card mounted until its exit finishes, and if the exit stalls — a
    // background tab throttling rAF is enough — the next question never mounts
    // and the quiz is stuck. Remounting on `key` gives the same enter animation
    // with no way to strand the user.
    <div>
      <motion.div
        animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
        initial={{ filter: "blur(4px)", opacity: 0, y: 14 }}
        key={step}
        transition={{ duration: 0.4, ease: EASE_OUT }}
      >
        <div className="label mb-2 text-faint">
          {question.axis.toUpperCase()}
        </div>
        <p className="display mb-5 max-w-[460px] text-[19px] leading-[1.25] md:text-[22px]">
          {question.q}
        </p>
        <div className="flex max-w-[460px] flex-col gap-2.5">
          {question.options.map((label, k) => {
            const weight = WEIGHTS[step][k];
            const active = selected === weight;
            return (
              <button
                className="rounded-xl border px-5 py-3.5 text-left text-[14px] leading-snug transition-all duration-200 hover:translate-x-1"
                key={label}
                onClick={() => onAnswer(weight)}
                style={{
                  background: active
                    ? "rgba(92,180,228,0.08)"
                    : "rgba(255,255,255,0.015)",
                  /* The unpicked options are the primary interaction of the
                     whole page and their background is rgba(255,255,255,0.015),
                     so the border is the control. 0.10 measured 1.24:1. */
                  borderColor: active
                    ? "var(--c-violet)"
                    : "var(--c-border-control)",
                  color: active ? "var(--c-ink)" : "var(--c-body)",
                }}
                type="button"
              >
                {label}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}

type ResultProps = {
  copy: ShapeCopy;
  score: number;
};

function ShapeResult({ copy, score }: ResultProps) {
  const { open: openContact } = useContactDialog();
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 flex flex-wrap items-center gap-6 border-hairline border-t pt-7"
      initial={{ opacity: 0, y: 16 }}
      transition={{ delay: 0.3, duration: 0.6, ease: EASE_OUT }}
    >
      <div>
        <div className="label mb-1 text-faint">{copy.scoreLabel}</div>
        <div className="display hero-heading grad-text text-[44px] leading-none">
          {score}
          <span className="text-[22px] text-muted">{copy.scoreSuffix}</span>
        </div>
      </div>
      <div className="min-w-[220px] flex-1">
        <p className="mb-3 text-[13px] text-body leading-[1.6]">
          {verdictFor(score, copy.verdicts)}
        </p>
        <button
          className="btn-primary !h-[40px] !text-[13px]"
          onClick={openContact}
          type="button"
        >
          <span>{copy.cta}</span>
          <svg
            aria-hidden="true"
            focusable="false"
            height="13"
            viewBox="0 0 14 14"
            width="13"
          >
            <path
              d="M1 7h12M8 2l5 5-5 5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.4"
            />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

type ReadoutProps = {
  answers: Answers;
  done: boolean;
  labels: string[];
  step: number;
};

/** Decorative axis meters, laid over the page-fixed sphere. */
function AxisReadout({ answers, done, labels, step }: ReadoutProps) {
  return (
    /* Visible on phones too. It used to be `hidden md:block`, which on mobile
       meant the quiz had no per-axis feedback at all — and the WebGL sphere the
       section's lead points at is switched off there, so the whole promise
       ("watch your shape form") had nothing to show. The stepper ticks and the
       chosen option highlights, but the five bars are the actual readout.
       `aria-hidden` stays: each stepper tab already announces "Data — answered",
       so five rows of dots would only pad the screen reader. */
    <div
      aria-hidden="true"
      className="pointer-events-none relative z-10 select-none md:col-span-6"
    >
      <div className="ml-0 flex max-w-none flex-col gap-3 md:ml-auto md:max-w-[300px]">
        {labels.map((label, i) => {
          const value = answers[i];
          return (
            <div className="flex items-center gap-3" key={label}>
              <span
                className="label w-[88px] shrink-0 text-right md:w-[102px]"
                style={{
                  color:
                    step === i && !done ? "var(--c-indigo)" : "var(--c-faint)",
                }}
              >
                {label}
              </span>
              <div className="relative h-px flex-1 overflow-visible bg-white/[0.08]">
                <div
                  className="absolute inset-y-0 left-0 h-px transition-all duration-700"
                  style={{
                    background:
                      "linear-gradient(90deg, var(--c-violet), var(--c-cyan))",
                    boxShadow:
                      value === null ? "none" : "0 0 8px rgba(92,180,228,0.5)",
                    width: `${(value ?? AXES_NEUTRAL[i]) * 100}%`,
                  }}
                />
              </div>
              <span
                className="mono w-8 shrink-0 text-[10px]"
                style={{
                  color: value === null ? "var(--c-faint)" : "var(--c-indigo)",
                }}
              >
                {value === null ? "· ·" : Math.round(value * 100)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type ReadinessShapeProps = {
  copy: ShapeCopy;
};

export function ReadinessShape({ copy }: ReadinessShapeProps) {
  const signals = useSceneSignals();
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [step, setStep] = useState(0);
  const done = answers.every((a) => a !== null);
  const started = answers.some((a) => a !== null);

  // Publish to the WebGL scene. Restored on unmount so the sphere relaxes back
  // to its neutral shape rather than freezing on the last answers.
  useEffect(() => {
    const current = signals.current;
    current.axes = answers.map((a) => a ?? AXES_NEUTRAL[0]) as [
      number,
      number,
      number,
      number,
      number,
    ];
    // -1 until the visitor actually answers something: otherwise the Data
    // sector sits there pulsing at rest, which reads as a defect rather than
    // as "this is the axis you are on".
    current.axisFocus = done || !started ? -1 : step;
    return () => {
      current.axes = [...AXES_NEUTRAL] as typeof current.axes;
      current.axisFocus = -1;
    };
  }, [answers, done, signals, started, step]);

  const score = useMemo(() => {
    const given = answers.filter((a): a is number => a !== null);
    if (given.length === 0) {
      return 0;
    }
    return Math.round(
      (given.reduce((sum, a) => sum + a, 0) / given.length) * 100
    );
  }, [answers]);

  const answer = (weight: number) => {
    const next = [...answers];
    next[step] = weight;
    setAnswers(next);
    const missing = next.indexOf(null);
    if (missing !== -1) {
      setStep(missing);
    }
  };

  const labels = copy.questions.map((q) => q.axis);

  return (
    <section
      className="relative overflow-hidden border-hairline border-t py-16 sm:py-24 md:py-36"
      id="shape"
    >
      <div className="relative mx-auto max-w-[1280px] px-6">
        <div className="grid items-center gap-10 md:grid-cols-12">
          <div className="relative z-10 md:col-span-6">
            <BlurFade blur={4} y={12}>
              <div className="label mb-4 flex items-center gap-2 text-muted">
                <span aria-hidden="true" className="dot dot-cyan" />
                <span>{copy.eyebrow}</span>
              </div>
              <h2 className="display display-tight mb-4 text-[clamp(32px,4vw,56px)]">
                <span className="grad-text">{copy.titleA}</span>
                <br />
                <span className="accent-text">{copy.titleB}</span>
              </h2>
              <p className="mb-10 max-w-[440px] text-[15px] text-body leading-[1.6]">
                {copy.lead}
              </p>
            </BlurFade>

            <ShapeStepper
              answers={answers}
              copy={copy}
              onSelect={setStep}
              questions={copy.questions}
              step={step}
            />

            <ShapeQuestion
              onAnswer={answer}
              question={copy.questions[step]}
              selected={answers[step]}
              step={step}
            />

            <AnimatePresence>
              {done ? <ShapeResult copy={copy} score={score} /> : null}
            </AnimatePresence>
          </div>

          <AxisReadout
            answers={answers}
            done={done}
            labels={labels}
            step={step}
          />
        </div>
      </div>
    </section>
  );
}
