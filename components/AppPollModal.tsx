"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

// One-question poll: "would you want an app?", then Android or iOS.
//
// It only fires on the pages where a visitor has just been given their answer
// (a street or a punct termic), after a short delay.
//
// That delay was 10s, chosen so the dialog landed after real engagement rather
// than on arrival - the pattern Google's intrusive-interstitial guidance
// targets, which matters because this site lives on organic search. Teodor cut
// it to 3s on 2026-09-05 for response volume, accepting that trade knowingly.
// If organic impressions on /strada/ and /punct-termic/ dip in GSC over the
// next few weeks, this constant is the first thing to put back.
//
// Answers are written in two steps against one nonce-keyed row, so tapping
// "Da" and then closing still counts as a "Da".
const STORAGE_KEY = "fac-app-poll";
const SUPPRESS_ANSWERED_MS = 365 * 24 * 3600 * 1000;
const SUPPRESS_DISMISSED_MS = 90 * 24 * 3600 * 1000;
// Overridable so the e2e build can push the modal out of reach of specs that
// merely happen to visit a street page (see playwright.config.ts).
const DELAY_MS = Number(process.env.NEXT_PUBLIC_APP_POLL_DELAY_MS) || 3_000;
const ANSWER_PAGES = ["/strada/", "/punct-termic/"];

// Kill switch: set NEXT_PUBLIC_APP_POLL=0 and redeploy (or let the nightly
// rebuild pick it up) to take the poll down without reverting code.
const ENABLED = process.env.NEXT_PUBLIC_APP_POLL !== "0";

type Stage = "interest" | "platform" | "done";

function suppressed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { kind, t } = JSON.parse(raw) as { kind: string; t: number };
    const ttl = kind === "dismissed" ? SUPPRESS_DISMISSED_MS : SUPPRESS_ANSWERED_MS;
    return Date.now() - t < ttl;
  } catch {
    return false;
  }
}

function remember(kind: "answered" | "dismissed") {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ kind, t: Date.now() }));
  } catch {
    /* private mode etc. - fine */
  }
}

// crypto.randomUUID() needs a secure context; getRandomValues does not.
function uuid4(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((n) => n.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export default function AppPollModal() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("interest");
  const nonceRef = useRef<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstButtonRef = useRef<HTMLButtonElement>(null);

  const onAnswerPage = ANSWER_PAGES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!ENABLED || !onAnswerPage || suppressed()) return;
    const id = setTimeout(() => setOpen(true), DELAY_MS);
    return () => clearTimeout(id);
  }, [onAnswerPage, pathname]);

  // While the dialog holds the screen: lock scrolling, and hide the feedback
  // pill so there is only ever one ask on screen (see app/globals.css).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.dataset.appPoll = "open";
    return () => {
      document.body.style.overflow = prev;
      delete document.body.dataset.appPoll;
    };
  }, [open]);

  useEffect(() => {
    if (open) firstButtonRef.current?.focus();
  }, [open, stage]);

  const close = useCallback(
    (kind: "answered" | "dismissed") => {
      remember(kind);
      setOpen(false);
    },
    [],
  );

  function send(interested: boolean, platform?: "android" | "ios") {
    if (nonceRef.current === null) nonceRef.current = uuid4();
    // Best-effort: a poll answer is not worth blocking or scolding anyone over.
    void fetch("/api/app-poll", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nonce: nonceRef.current,
        interested,
        platform,
        page: pathname,
        website: "",
      }),
    }).catch(() => {});
  }

  function answerInterest(interested: boolean) {
    send(interested);
    if (interested) {
      setStage("platform");
    } else {
      setStage("done");
      setTimeout(() => close("answered"), 2500);
    }
  }

  function answerPlatform(platform: "android" | "ios") {
    send(true, platform);
    setStage("done");
    setTimeout(() => close("answered"), 2500);
  }

  // Tab cycles inside the dialog; Escape is equivalent to the × button.
  //
  // Both listen on the DOCUMENT, not on the backdrop element: clicking the
  // backdrop moves focus to <body>, and a handler bound to the backdrop subtree
  // stops firing the moment focus leaves it - which killed Escape exactly when
  // it was most needed, since a backdrop click is the first thing people try.
  useEffect(() => {
    if (!open) return;
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        close(stage === "interest" ? "dismissed" : "answered");
        return;
      }
      if (ev.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>("button");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!dialogRef.current.contains(active)) {
        // Focus escaped the dialog - pull it back rather than tabbing the page behind.
        ev.preventDefault();
        (ev.shiftKey ? last : first).focus();
        return;
      }
      if (ev.shiftKey && active === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && active === last) {
        ev.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, stage, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(33, 28, 23, 0.45)" }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Întrebare despre o aplicație"
        className="relative flex min-h-[9rem] w-full max-w-sm flex-col justify-center border border-hairline bg-paper p-5 text-ink"
      >
        <button
          type="button"
          aria-label="Închide"
          onClick={() => close(stage === "interest" ? "dismissed" : "answered")}
          // 40x40 hit area (WCAG 2.5.8 wants >=24x24); the glyph stays small.
          className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center text-lg text-ink-soft hover:text-ink"
        >
          ×
        </button>

        {stage === "done" ? (
          <p className="pr-6 font-medium">
            Mulțumesc mult! La cât mai puține zile fără apă caldă!
          </p>
        ) : stage === "platform" ? (
          <>
            <p className="pr-6 text-ink-soft">Preferi pe:</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                ref={firstButtonRef}
                onClick={() => answerPlatform("android")}
                className="flex-1 border border-ink px-3 py-2 font-medium hover:bg-ok"
              >
                Android
              </button>
              <button
                type="button"
                onClick={() => answerPlatform("ios")}
                className="flex-1 border border-ink px-3 py-2 font-medium hover:bg-ok"
              >
                iOS
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="pr-6 text-ink-soft">Hei, te deranjez o secundă cu o întrebare:</p>
            <p className="mt-2 pr-6 font-medium">
              Te-ar interesa o aplicație pentru faraapacalda.ro?
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                ref={firstButtonRef}
                onClick={() => answerInterest(true)}
                className="flex-1 border border-ink px-3 py-2 font-medium hover:bg-ok"
              >
                Da
              </button>
              <button
                type="button"
                onClick={() => answerInterest(false)}
                className="flex-1 border border-hairline px-3 py-2 hover:bg-ok"
              >
                Nu
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
