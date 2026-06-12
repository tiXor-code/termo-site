import { createHash } from "node:crypto";

import { validateFeedback } from "@/lib/feedback";

// Anonymous up/down feedback. Raw IPs never touch storage - only a salted
// hash, used for best-effort rate limiting. The in-memory limiter is
// per-lambda-instance (good enough against casual spam; the honeypot and
// localStorage suppression do the rest).
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const recent = new Map<string, number[]>();

function rateLimited(ipHash: string): boolean {
  const now = Date.now();
  const hits = (recent.get(ipHash) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) return true;
  hits.push(now);
  recent.set(ipHash, hits);
  if (recent.size > 5000) recent.clear(); // crude memory bound
  return false;
}

export async function POST(req: Request) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const salt = process.env.FEEDBACK_IP_SALT;
  if (!url || !key || !salt) {
    return new Response(null, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const result = validateFeedback(body as Record<string, unknown>);
  if (!result.ok) {
    // Honeypot hits get a clean 204 so bots learn nothing.
    return new Response(null, { status: result.reason === "honeypot" ? 204 : 400 });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const ipHash = createHash("sha256").update(salt + ip).digest("hex");
  if (rateLimited(ipHash)) {
    return new Response(null, { status: 429 });
  }

  const res = await fetch(`${url}/rest/v1/fac_feedback`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      ...result.record,
      ip_hash: ipHash,
      ua: (req.headers.get("user-agent") ?? "").slice(0, 300),
    }),
  });
  return new Response(null, { status: res.ok ? 204 : 502 });
}
