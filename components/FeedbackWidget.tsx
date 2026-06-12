"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Floating "was this useful?" pill. Up = one-tap vote; down expands a small
// feedback panel. localStorage suppresses the pill after a vote (30d) or a
// dismiss (14d) so it never nags.
const STORAGE_KEY = "fac-feedback";
const SUPPRESS_VOTED_MS = 30 * 24 * 3600 * 1000;
const SUPPRESS_DISMISSED_MS = 14 * 24 * 3600 * 1000;

type Stage = "idle" | "down" | "sending" | "done" | "error";

function suppressed(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const { kind, t } = JSON.parse(raw) as { kind: string; t: number };
    const ttl = kind === "dismissed" ? SUPPRESS_DISMISSED_MS : SUPPRESS_VOTED_MS;
    return Date.now() - t < ttl;
  } catch {
    return false;
  }
}

function remember(kind: "voted" | "dismissed") {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ kind, t: Date.now() }));
  } catch {
    /* private mode etc. - fine */
  }
}

export default function FeedbackWidget() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setVisible(!suppressed());
  }, []);

  useEffect(() => {
    if (stage === "down") textareaRef.current?.focus();
  }, [stage]);

  if (!visible || pathname === "/harta") return null;

  async function send(vote: "up" | "down", msg?: string) {
    setStage("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote, message: msg, page: pathname, website: "" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStage("done");
      remember("voted");
      setTimeout(() => setVisible(false), 2500);
    } catch {
      setStage("error");
    }
  }

  function dismiss() {
    remember("dismissed");
    setVisible(false);
  }

  return (
    <div
      className="fixed right-3 bottom-3 z-20 max-w-xs border border-hairline bg-paper p-3 text-sm text-ink"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))" }}
      role="region"
      aria-label="Feedback despre site"
      onKeyDown={(e) => {
        if (e.key === "Escape" && stage === "down") setStage("idle");
      }}
    >
      {stage === "done" ? (
        <p className="font-medium">Mulțumim!</p>
      ) : stage === "error" ? (
        <p className="text-ink-soft">Nu am putut trimite. Încearcă mai târziu.</p>
      ) : stage === "down" ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send("down", message);
          }}
        >
          <label htmlFor="fac-feedback-msg" className="mb-1 block text-ink-soft">
            Ce nu a mers sau ce ai fi vrut să găsești?
          </label>
          <textarea
            id="fac-feedback-msg"
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
            rows={3}
            className="w-full border border-hairline bg-transparent p-2 outline-none placeholder:text-ink-soft"
          />
          <div className="mt-2 flex items-center gap-3">
            <button type="submit" className="border border-ink px-3 py-1 font-medium hover:bg-ok">
              Trimite
            </button>
            <button
              type="button"
              onClick={() => setStage("idle")}
              className="text-ink-soft underline-offset-2 hover:underline"
            >
              Renunță
            </button>
          </div>
        </form>
      ) : (
        <div className="flex items-center gap-2">
          <span>Ți-a fost util site-ul?</span>
          <button
            type="button"
            aria-label="Da, mi-a fost util"
            disabled={stage === "sending"}
            onClick={() => send("up")}
            className="border border-hairline px-2 py-1 hover:bg-ok"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 2 L12 9 L2 9 Z" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Nu, am întâmpinat probleme"
            disabled={stage === "sending"}
            onClick={() => setStage("down")}
            className="border border-hairline px-2 py-1 hover:bg-ok"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M7 12 L2 5 L12 5 Z" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Închide"
            onClick={dismiss}
            className="ml-1 text-ink-soft hover:text-ink"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
