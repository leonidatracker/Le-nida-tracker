// Optional cross-device sync for Leonida Tracker – no accounts.
// A random 12-character sync code maps to the list of ticked item ids and the time of the last edit.
// Nothing personal is stored. Routes:
//   GET  /api/sync/health   -> { ok: true }   (the tracker only shows sync when this answers)
//   POST /api/sync          -> create a code from { ids, updated }, returns { key }
//   GET  /api/sync/:code    -> { ids, updated }
//   PUT  /api/sync/:code    -> save { ids, updated } for an existing code
import { getStore } from "@netlify/blobs";

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L
const CODE_RE = /^[A-Z2-9]{12}$/;
const ID_RE = /^[a-z]{3}-\d{1,4}$/;
const MAX_IDS = 5000;
const MAX_BODY = 100_000;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json", "cache-control": "no-store" }
});

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join("");
}

async function readProgress(req) {
  const text = await req.text();
  if (text.length > MAX_BODY) throw new Error("too big");
  const body = JSON.parse(text || "{}");
  const ids = Array.isArray(body.ids) ? body.ids : null;
  if (!ids || ids.length > MAX_IDS || !ids.every(id => typeof id === "string" && ID_RE.test(id))) throw new Error("bad ids");
  const updated = Number(body.updated);
  if (!Number.isFinite(updated) || updated <= 0) throw new Error("bad time");
  return { ids: [...new Set(ids)], updated: Math.min(updated, Date.now() + 60_000) };
}

export default async (req) => {
  const url = new URL(req.url);
  const parts = url.pathname.replace(/^\/api\/sync\/?/, "").split("/").filter(Boolean);
  const store = getStore("progress");

  if (parts[0] === "health") return json({ ok: true });

  if (parts.length === 0) {
    if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
    let progress;
    try { progress = await readProgress(req); } catch { return json({ error: "invalid progress" }, 400); }
    let key = newCode();
    for (let tries = 0; tries < 3 && (await store.get(key)); tries++) key = newCode();
    await store.setJSON(key, progress);
    return json({ key });
  }

  const key = String(parts[0]).toUpperCase();
  if (!CODE_RE.test(key) || parts.length > 1) return json({ error: "bad code" }, 400);

  if (req.method === "GET") {
    const saved = await store.get(key, { type: "json" });
    return saved ? json(saved) : json({ error: "not found" }, 404);
  }
  if (req.method === "PUT") {
    if (!(await store.get(key))) return json({ error: "not found" }, 404);
    let progress;
    try { progress = await readProgress(req); } catch { return json({ error: "invalid progress" }, 400); }
    await store.setJSON(key, progress);
    return json({ ok: true });
  }
  return json({ error: "method not allowed" }, 405);
};

export const config = { path: ["/api/sync", "/api/sync/*"] };
