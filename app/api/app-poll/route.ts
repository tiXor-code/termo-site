import { createHash } from "node:crypto";

import { validateAppPoll } from "@/lib/app-poll";

// Anonymous "would you want an app?" poll. Same posture as /api/feedback: raw
// IPs never touch storage, only a salted hash used for best-effort rate
// limiting. No GET - unlike the feedback tally there is nothing here the site
// should expose publicly.
//
// The poll is answered in two steps and both write the SAME row, upserted on
// the client's nonce. That way someone who taps "Da" and closes the dialog
// without picking a platform still counts as a "Da" rather than vanishing.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 6; // two writes per answer, plus slack
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
  const result = validateAppPoll(body as Record<string, unknown>);
  if (!result.ok) {
    // Honeypot hits get a clean 204 so bots learn nothing.
    return new Response(null, { status: result.reason === "honeypot" ? 204 : 400 });
  }

  const ip = (req.headers.get("x-forwarded-for") ?? "unknown").split(",")[0].trim();
  const ipHash = createHash("sha256").update(salt + ip).digest("hex");
  if (rateLimited(ipHash)) {
    return new Response(null, { status: 429 });
  }

  // Upsert on the unique nonce: step 1 inserts the interest, step 2 merges the
  // platform onto that same row.
  const res = await fetch(`${url}/rest/v1/fac_app_poll?on_conflict=nonce`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal,resolution=merge-duplicates",
    },
    body: JSON.stringify({
      ...result.record,
      updated_at: new Date().toISOString(),
      ip_hash: ipHash,
      ua: (req.headers.get("user-agent") ?? "").slice(0, 300),
    }),
  });
  return new Response(null, { status: res.ok ? 204 : 502 });
}
