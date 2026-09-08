"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { contact as sendContact } from "@/app/[locale]/contact/actions/contact";
import { ContactCompass, ContactList } from "./contact-compass";
import { EASE_OUT } from "./magic";
import type { ContactChannel, ContactCopy } from "./types";

/* ════════════════════════════════════════════════════════════
   CONTACT DIALOG

   Opened by every "Book assessment" call to action on the page. The
   compass picks a channel, the channel opens a form, and the form
   stays open until it is submitted or the dialog is closed — picking
   a different heading swaps the panel without losing what was typed.

   The two channels that leave the site (WhatsApp, LinkedIn) get a
   button out instead of a form: sending them through our inbox to
   then reply on WhatsApp would be slower than the thing they clicked.
   ════════════════════════════════════════════════════════════ */

type ContactDialogApi = {
  open: () => void;
};

const Ctx = createContext<ContactDialogApi | null>(null);

/** Non-null inside the readiness tree; every CTA is rendered under the
 *  provider in app.tsx. */
export function useContactDialog(): ContactDialogApi {
  const api = useContext(Ctx);
  if (!api) {
    throw new Error("useContactDialog must be used inside <ContactDialog>");
  }
  return api;
}

type ContactDialogProps = {
  children: ReactNode;
  copy: ContactCopy;
};

export function ContactDialog({ children, copy }: ContactDialogProps) {
  const [isOpen, setOpen] = useState(false);
  const api = useMemo<ContactDialogApi>(
    () => ({ open: () => setOpen(true) }),
    []
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <AnimatePresence>
        {isOpen ? <Panel copy={copy} onClose={() => setOpen(false)} /> : null}
      </AnimatePresence>
    </Ctx.Provider>
  );
}

/* Keeping the trap out of the key handler is not only tidiness: with both jobs
   inline the handler tripped the cognitive-complexity rule, and the rule was
   right — closing and cycling focus have nothing to do with each other. */
function trapTab(root: HTMLElement | null, event: globalThis.KeyboardEvent) {
  if (!root) {
    return;
  }
  const focusable = [
    ...root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])'
    ),
  ].filter((node) => node.offsetParent !== null);
  const first = focusable[0];
  const last = focusable.at(-1);
  if (!(first && last)) {
    return;
  }
  const current = document.activeElement;
  if (event.shiftKey && (current === first || current === root)) {
    event.preventDefault();
    last.focus();
    return;
  }
  if (!event.shiftKey && current === last) {
    event.preventDefault();
    first.focus();
  }
}

/* ── the panel ────────────────────────────────────────────── */

type PanelProps = {
  copy: ContactCopy;
  onClose: () => void;
};

function Panel({ copy, onClose }: PanelProps) {
  const [picked, setPicked] = useState<ContactChannel | null>(null);
  const titleId = useId();
  const cardRef = useRef<HTMLDivElement>(null);

  /* Escape closes, and the page behind must not scroll while a modal owns the
     screen. Restoring the previous overflow rather than clearing it keeps this
     honest if anything else is already managing it. */
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "Tab") {
        trapTab(cardRef.current, event);
      }
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Move focus into the dialog on open, so the keyboard lands somewhere useful.
  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  const isExternal = picked ? picked.href.startsWith("http") : false;

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      {/* Backdrop. A button so dismissing by clicking outside is reachable by
          keyboard too, rather than being a mouse-only affordance. */}
      <button
        aria-label={copy.close}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        tabIndex={-1}
        type="button"
      />

      <motion.div
        animate={{ opacity: 1, y: 0, scale: 1 }}
        aria-labelledby={titleId}
        aria-modal="true"
        className="relative max-h-[92vh] w-full max-w-[860px] overflow-y-auto rounded-[20px] border border-hairline bg-canvas/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
        exit={{ opacity: 0, y: 8, scale: 0.985 }}
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        ref={cardRef}
        role="dialog"
        tabIndex={-1}
        transition={{ duration: 0.32, ease: EASE_OUT }}
      >
        <button
          aria-label={copy.close}
          className="absolute top-4 right-4 flex h-9 w-9 items-center justify-center rounded-lg border border-hairline text-muted transition-colors hover:text-white"
          onClick={onClose}
          type="button"
        >
          <svg aria-hidden="true" height="14" viewBox="0 0 14 14" width="14">
            <path
              d="M2 2l10 10M12 2L2 12"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeWidth="1.5"
            />
          </svg>
        </button>

        <div className="mb-6 text-center">
          <div className="label mb-3 inline-flex items-center gap-2 text-muted">
            <span aria-hidden="true" className="dot dot-violet" />
            <span>{copy.eyebrow}</span>
          </div>
          <h2 className="display text-[clamp(26px,4vw,40px)]" id={titleId}>
            <span className="grad-text">{copy.titleA}</span>{" "}
            <span className="text-white">{copy.titleB}</span>
          </h2>
          <p className="mx-auto mt-3 max-w-[440px] text-[14px] text-body leading-[1.55]">
            {copy.lead}
          </p>
        </div>

        {/* Desktop: the compass. Below md it is replaced outright by the list. */}
        <div className="hidden md:block">
          <ContactCompass
            copy={copy}
            onPick={setPicked}
            picked={picked?.label ?? null}
          />
        </div>
        <div className="md:hidden">
          <ContactList
            copy={copy}
            onPick={setPicked}
            picked={picked?.label ?? null}
          />
        </div>

        <AnimatePresence mode="wait">
          {picked ? (
            <motion.div
              animate={{ opacity: 1, height: "auto" }}
              className="overflow-hidden"
              exit={{ opacity: 0, height: 0 }}
              initial={{ opacity: 0, height: 0 }}
              key={picked.label}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              <div className="mt-7 border-hairline border-t pt-7">
                {isExternal ? (
                  <HandOff channel={picked} copy={copy} />
                ) : (
                  <ContactForm channel={picked} copy={copy} />
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}

/* ── leaving the site ─────────────────────────────────────── */

type HandOffProps = {
  channel: ContactChannel;
  copy: ContactCopy;
};

function HandOff({ channel, copy }: HandOffProps) {
  return (
    <div className="text-center">
      <p className="label mb-1 text-muted">{channel.label}</p>
      <p className="mono mb-5 break-all text-[13px] text-body">
        {channel.value}
      </p>
      <a
        className="btn-primary"
        href={channel.href}
        rel="noreferrer noopener"
        target="_blank"
      >
        <span>{copy.open}</span>
      </a>
    </div>
  );
}

/* ── the form ─────────────────────────────────────────────── */

type ContactFormProps = {
  channel: ContactChannel;
  copy: ContactCopy;
};

type Status = "idle" | "sending" | "sent" | "error";

function ContactForm({ channel, copy }: ContactFormProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const nameId = useId();
  const emailId = useId();
  const companyId = useId();
  const messageId = useId();

  const onSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const name = String(data.get("name") ?? "").trim();
      const email = String(data.get("email") ?? "").trim();
      const company = String(data.get("company") ?? "").trim();
      const message = String(data.get("message") ?? "").trim();

      setStatus("sending");
      setError(null);

      /* The action takes name/email/message only. Rather than widen its
         signature and the email template with it, the two extra facts are
         folded into the body — they are for a human to read, not for anything
         downstream to parse. */
      const body = [
        `Channel: ${channel.label}`,
        company ? `Company: ${company}` : null,
        "",
        message,
      ]
        .filter((line) => line !== null)
        .join("\n");

      try {
        const result = await sendContact(name, email, body);
        if (result.error) {
          setStatus("error");
          setError(result.error);
          return;
        }
        setStatus("sent");
      } catch {
        setStatus("error");
        setError(copy.formError);
      }
    },
    [channel.label, copy.formError]
  );

  if (status === "sent") {
    return (
      <div className="py-2 text-center">
        <p className="label mb-2 text-muted">{copy.sentTitle}</p>
        <p className="mx-auto max-w-[380px] text-[14px] text-body leading-[1.55]">
          {copy.sentDesc}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit}>
      <p className="label mb-4 text-muted">
        {copy.formFor} {channel.label}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id={nameId} label={copy.fieldName} name="name" required />
        <Field
          id={emailId}
          label={copy.fieldEmail}
          name="email"
          required
          type="email"
        />
      </div>
      <div className="mt-3">
        <Field id={companyId} label={copy.fieldCompany} name="company" />
      </div>
      <div className="mt-3">
        <label
          className="mono mb-1.5 block text-[11px] text-muted"
          htmlFor={messageId}
        >
          {copy.fieldMessage}
        </label>
        <textarea
          className="w-full rounded-[10px] border border-hairline bg-white/[0.03] px-3.5 py-2.5 text-[14px] text-white outline-none transition-colors placeholder:text-muted focus:border-white/30"
          id={messageId}
          name="message"
          required
          rows={4}
        />
      </div>

      {error ? (
        <p className="mt-3 text-[13px] text-[color:var(--c-warning)]">
          {error}
        </p>
      ) : null}

      {/* A notice, deliberately not a consent checkbox. Replying to someone who
          wrote to us rests on LGPD art. 7 V — preliminary steps taken at the
          data subject's own request — not on consent. A ticked box would
          declare the wrong legal basis, and a basis of consent is revocable, so
          it would also hand us an obligation to erase the enquiry the moment
          anyone changed their mind. What the law does ask for here is art. 9:
          say what happens to the data, at the point it is collected. A checkbox
          would only be right if we were also adding people to a marketing list,
          which we are not. */}
      <p className="mt-5 text-center text-[12px] text-muted leading-[1.55]">
        {copy.privacyNoticeA}{" "}
        <a
          className="underline decoration-white/25 underline-offset-2 transition-colors hover:text-white"
          href="/legal/privacy"
          rel="noreferrer noopener"
          target="_blank"
        >
          {copy.privacyNoticeLink}
        </a>{" "}
        {copy.privacyNoticeB}
      </p>

      <div className="mt-4 flex items-center justify-center">
        <button
          className="btn-primary"
          disabled={status === "sending"}
          type="submit"
        >
          <span>{status === "sending" ? copy.sending : copy.send}</span>
        </button>
      </div>
    </form>
  );
}

type FieldProps = {
  id: string;
  label: string;
  name: string;
  required?: boolean;
  type?: string;
};

function Field({
  id,
  label,
  name,
  required = false,
  type = "text",
}: FieldProps) {
  return (
    <div>
      <label className="mono mb-1.5 block text-[11px] text-muted" htmlFor={id}>
        {label}
      </label>
      <input
        className="h-[42px] w-full rounded-[10px] border border-hairline bg-white/[0.03] px-3.5 text-[14px] text-white outline-none transition-colors placeholder:text-muted focus:border-white/30"
        id={id}
        name={name}
        required={required}
        type={type}
      />
    </div>
  );
}
