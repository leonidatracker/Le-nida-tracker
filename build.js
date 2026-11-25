#!/usr/bin/env node
/*
  Netlify build: node build.js  ->  publishes ./dist   (never commit dist/)

  What it does
  - Reads the tracker data (REGIONS + CATEGORIES) straight out of index.html,
    so the scheduled data updates only ever need to edit index.html.
  - Writes one list page per category that has real (non-placeholder) items, e.g. /gta-6-missions/.
  - Writes one page per guide in guides/*.html (question pages, e.g. /how-many-missions-in-gta-6/)
    plus a /guides/ index. Guides use data tokens (see GUIDE TOKENS below) so numbers stay current.
  - Fills the tracker's "Full lists" links and the crawlable "About" section, adds FAQ structured data,
    and writes sitemap.xml and llms.txt.
  Fails loudly on duplicate ids, a broken DATA section, a bad guide header or an unknown token.

  GUIDE TOKENS (usable in a guide's body, answer and faq)
    {{count:CAT}}                 number of real items in a category (missions, collectibles, vehicles,
                                  properties, activities, trophies)
    {{count:CAT:PATTERN}}         items whose name or note matches PATTERN (case-insensitive regex)
    {{table:CAT}} / {{table:CAT:PATTERN}}   a table of those items (name + note, region if it varies)
    {{sumnum:CAT:PATTERN}}        sum of the first number in each matching item's note (e.g. "24 cards")
    {{sumcash:CAT:PATTERN}}       sum of the first $ amount in each matching item's note, formatted $12,345
    {{chapters}}                  table of story chapters with mission counts (from mission notes)
    {{tiers}}                     trophy tier breakdown, e.g. "1 Platinum, 3 Gold, 7 Silver and 44 Bronze"
    {{updated}}                   build date, e.g. 23 November 2026
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");
const SITE = "https://leonida-tracker.com";
const ADSENSE = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3997327230760263" crossorigin="anonymous"></script>';

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* ---------- 1. Data ---------- */
const start = html.indexOf("const REGIONS");
const end = html.indexOf("/* Category icons");
if (start < 0 || end < 0 || end < start) throw new Error("Could not find the DATA section in index.html");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(html.slice(start, end).replace(/\bconst (REGIONS|CATEGORIES)\b/g, "var $1"), ctx);
const CATEGORIES = ctx.CATEGORIES;
if (!Array.isArray(CATEGORIES) || !CATEGORIES.length) throw new Error("CATEGORIES is empty");
const ids = new Set();
for (const c of CATEGORIES) for (const i of c.items) {
  if (ids.has(i.id)) throw new Error("Duplicate item id: " + i.id);
  ids.add(i.id);
}
const realItems = c => c.items.filter(i => !i.placeholder);
// Items whose note says they can be missed (same rule as the tracker page)
const isMissable = i => /missable|can't be reached after|Chapter 1 only/i.test(i.note || "");
const catByKey = k => {
  const c = CATEGORIES.find(c => c.key === k);
  if (!c) throw new Error("Unknown category in guide token: " + k);
  return c;
};

/* ---------- 2. Helpers ---------- */
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const now = new Date();
const today = now.toISOString().slice(0, 10);
const prettyDate = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
const fmt = n => n.toLocaleString("en-GB");
const stripTags = s => String(s).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

/* ---------- 3. List-page copy (own words; counts filled in from data) ---------- */
const PAGES = {
  missions: {
    slug: "gta-6-missions", noun: "story missions", h1: "GTA 6 story missions",
    title: n => `GTA 6 Mission List: All ${n} Story Missions in Order`,
    intro: n => `Every main story mission in Grand Theft Auto VI that we've confirmed so far – ${n} in total – listed in the order you play them, with the chapter each one belongs to. Tick them off in the free tracker as you go and your progress saves automatically.`,
    faq: n => [[`How many story missions are in GTA 6?`, `Our list currently has ${n} confirmed main story missions across the game's chapters. We add more as they're verified, so the number may still grow.`]]
  },
  collectibles: {
    slug: "gta-6-collectibles", noun: "collectibles", h1: "GTA 6 collectibles",
    title: n => `GTA 6 Collectibles Checklist: ${n} Collectible Types & Sets`,
    intro: n => `A checklist of the collectibles in Grand Theft Auto VI – card sets, scans, hidden items and more, ${n} entries so far. Individual locations are added as players confirm them. Use the tracker to mark each one off as you complete it.`,
    faq: n => [[`How many collectibles are in GTA 6?`, `We currently track ${n} collectible types, sets and confirmed locations. Counts for each type are shown in the notes; exact locations are added once more than one source confirms them.`]]
  },
  vehicles: {
    slug: "gta-6-vehicles", noun: "vehicles", h1: "GTA 6 vehicles",
    title: n => `GTA 6 Vehicle List: ${n} Cars and Where to Find Them`,
    intro: n => `Vehicles you can find in Grand Theft Auto VI and where to get them – ${n} entries so far, including Randy's Wish List cars and their spawn spots. Tick off each one in the tracker as you add it to your collection.`,
    faq: n => [[`Where do I find the cars for Randy's Wish List in GTA 6?`, `Each Wish List car's known spawn spot is listed on this page. Some only appear at certain times of day, so check the note for each car.`]]
  },
  properties: {
    slug: "gta-6-properties", noun: "properties", h1: "GTA 6 properties and garages",
    title: n => `GTA 6 Properties & Garages: All ${n} With Prices`,
    intro: n => `Properties and garages you can own in Grand Theft Auto VI, with prices and locations where they're known – ${n} so far. Mark each one in the tracker to see how close you are to owning them all.`,
    faq: n => [[`How many garages can you buy in GTA 6?`, `We currently list ${n} garages and properties, including one you're given during the story. Prices are shown where they've been confirmed.`]]
  },
  activities: {
    slug: "gta-6-side-activities", noun: "side activities", h1: "GTA 6 side activities",
    title: n => `GTA 6 Side Activities Checklist: ${n} Activities, Jobs & Locations`,
    intro: n => `Side activities, robberies, races, stunts and Strangers & Freaks missions in Grand Theft Auto VI – ${n} entries on our list so far, with notes on what each involves and which trophies they count towards.`,
    faq: n => [[`How many side activities are in GTA 6?`, `Our checklist currently has ${n} side activity entries – activity types plus individual locations such as stunt jumps, drone races and robberies – and we add more as they're confirmed.`]]
  },
  cheats: {
    slug: "gta-6-cheats", noun: "cheats", h1: "GTA 6 cheats and how to unlock them",
    title: n => `GTA 6 Cheats: All ${n} Codes and How to Unlock Each One`,
    intro: n => `All ${n} cheats in Grand Theft Auto VI, with the button code where it's been found and the challenge that unlocks each one. Cheats only work once you've finished the story, and using one turns off saving and trophies for that session.`,
    faq: n => [
      [`How many cheats are in GTA 6?`, `There are ${n} cheats: player, combat, vehicle spawn, world and screen-filter cheats. Each one is unlocked by its own challenge.`],
      [`How do you enter cheats in GTA 6?`, `Finish the story first. Then press Up on the D-pad to open the phone, hold L1 (LB on Xbox), press R1 (RB), and enter the code on the D-pad.`],
      [`Do cheats disable trophies in GTA 6?`, `Yes. Using any cheat turns off trophies, achievements and saving for that play session, so save first and reload a clean save afterwards.`],
      [`Can you keep the money from the $250,000 cheat?`, `No. Saving is blocked while a cheat is active, so the cash never makes it into a normal save.`]
    ]
  },
  trophies: {
    slug: "gta-6-trophies", noun: "trophies", h1: "GTA 6 trophies and achievements",
    title: n => `GTA 6 Trophy & Achievement List: All ${n} Trophies`,
    intro: n => `The full Grand Theft Auto VI trophy and achievement list – ${n} in total, including the Platinum – with a short note on how to unlock each one. Track them in the checklist and watch your completion percentage climb.`,
    faq: n => [[`How many trophies are in GTA 6?`, `GTA 6 has ${n} trophies on our list, including the Platinum trophy for unlocking all of the others.`]]
  }
};
const fallbackPage = c => ({
  slug: "gta-6-" + c.key, noun: c.title.toLowerCase(), h1: "GTA 6 " + c.title.toLowerCase(),
  title: n => `GTA 6 ${c.title}: Full List (${n})`,
  intro: n => `${n} ${c.title.toLowerCase()} in Grand Theft Auto VI, with notes. Track them in the free checklist.`,
  faq: () => []
});
const live = CATEGORIES
  .filter(c => realItems(c).length > 0)
  .map(c => ({ cat: c, page: PAGES[c.key] || fallbackPage(c), items: realItems(c) }));

/* ---------- 4. Guide tokens ---------- */
function itemsMatching(catKey, pattern) {
  const items = realItems(catByKey(catKey));
  if (!pattern) return items;
  const re = new RegExp(pattern, "i");
  return items.filter(i => re.test(i.name) || re.test(i.note || "") || re.test(i.name + " | " + (i.note || "")));
}
function tableHTML(items) {
  if (!items.length) return `<p class="note">Nothing confirmed yet – check back soon.</p>`;
  const showRegion = new Set(items.map(i => i.region)).size > 1 && items.some(i => i.region !== "Leonida");
  return `<table><tbody>${items.map((i, idx) => `
    <tr><td class="num">${idx + 1}</td><td><b>${esc(i.name)}${isMissable(i) ? '<span class="missable">Missable</span>' : ""}</b>${i.note ? `<span class="note">${esc(i.note)}</span>` : ""}${"code" in i ? (i.code ? `<span class="code">${i.code.split(" ").map(k => `<kbd>${esc(k)}</kbd>`).join("")}</span>` : `<span class="note"><i>Code not found yet</i></span>`) : ""}</td>${showRegion ? `<td class="reg">${esc(i.region)}</td>` : ""}</tr>`).join("")}
  </tbody></table>`;
}
// Group items by the county (or region) named in their note; unknown areas go last, marked as not yet verified.
function areaOf(i) {
  const t = (i.note || "") + " | " + (i.region || "");
  const m = /\b((?:North |South |East |West )?[A-Z][a-z]+(?:-[A-Z][a-z]+)? County)\b/.exec(t);
  if (m) return m[1].replace(/^(North|South|East|West) /, "");
  for (const r of ["Vice City", "Ambrosia", "Port Gellhorn", "Mount Kalaga", "Grassrivers", "Leonida Keys"]) if (t.includes(r)) return r;
  return "";
}
function byCounty(items) {
  if (!items.length) return `<p class="note">Nothing confirmed yet – check back soon.</p>`;
  const groups = new Map();
  for (const i of items) { const a = areaOf(i) || "Area not yet verified"; if (!groups.has(a)) groups.set(a, []); groups.get(a).push(i); }
  const keys = [...groups.keys()].sort((a, b) => (a === "Area not yet verified") - (b === "Area not yet verified") || groups.get(b).length - groups.get(a).length);
  return keys.map(k => `<h3>${esc(k)} (${groups.get(k).length})</h3>${tableHTML(groups.get(k))}`).join("");
}
// One section per trading-card set: how many cards, how many locations are confirmed, then the confirmed ones.
function cardSets() {
  const coll = realItems(catByKey("collectibles"));
  return coll.filter(i => / card set$/.test(i.name)).map(set => {
    const name = set.name.replace(/ card set$/, "");
    const total = +((/(\d+)/.exec(set.note || "") || [])[1] || 0);
    const found = coll.filter(i => i.name.startsWith(name + " card: "));
    return `<h3>${esc(name)} – ${total} cards</h3><p class="note" style="margin:2px 0 6px">${found.length} of ${total} locations confirmed${found.length < total ? "; the rest are not yet verified and will be added once they are." : "."}</p>${found.length ? tableHTML(found) : ""}`;
  }).join("");
}
function chapters() {
  const map = new Map();
  for (const m of realItems(catByKey("missions"))) {
    const g = /Chapter\s+(\d+)(?:\s*\(([^)]+)\))?/i.exec(m.note || "");
    const key = g ? `Chapter ${g[1]}${g[2] ? " – " + g[2] : ""}` : "Chapter not yet confirmed";
    map.set(key, (map.get(key) || 0) + 1);
  }
  return `<table><tbody>${[...map].sort((a, b) => a[0].localeCompare(b[0], "en", { numeric: true })).map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td class="reg">${v} missions</td></tr>`).join("")}</tbody></table>`;
}
function tiers() {
  const order = ["Platinum", "Gold", "Silver", "Bronze"], counts = {};
  for (const t of realItems(catByKey("trophies"))) {
    const tier = order.find(o => (t.note || "").startsWith(o));
    if (tier) counts[tier] = (counts[tier] || 0) + 1;
  }
  const parts = order.filter(o => counts[o]).map(o => `${counts[o]} ${o}`);
  return parts.length > 1 ? parts.slice(0, -1).join(", ") + " and " + parts.at(-1) : parts.join("");
}
function render(text) {
  return String(text).replace(/\{\{([^}]+)\}\}/g, (_, tok) => {
    const [name, cat, ...rest] = tok.split(":");
    const pattern = rest.join(":");
    switch (name) {
      case "count": return String(itemsMatching(cat, pattern).length);
      case "table": return tableHTML(itemsMatching(cat, pattern));
      case "sumnum": return fmt(itemsMatching(cat, pattern).reduce((s, i) => { const m = /(\d[\d,]*)/.exec(i.note || ""); return s + (m ? +m[1].replace(/,/g, "") : 0); }, 0));
      case "sumcash": return "$" + fmt(itemsMatching(cat, pattern).reduce((s, i) => { const m = /\$(\d[\d,]*)/.exec(i.note || ""); return s + (m ? +m[1].replace(/,/g, "") : 0); }, 0));
      case "chapters": return chapters();
      case "bycounty": return byCounty(itemsMatching(cat, pattern));
      case "cardsets": return cardSets();
      case "tiers": return tiers();
      case "updated": return prettyDate;
      default: throw new Error("Unknown guide token: {{" + tok + "}}");
    }
  });
}

/* ---------- 5. Guides ---------- */
const GUIDE_DIR = path.join(ROOT, "guides");
const guides = fs.existsSync(GUIDE_DIR) ? fs.readdirSync(GUIDE_DIR).filter(f => f.endsWith(".html")).sort().map(f => {
  const raw = fs.readFileSync(path.join(GUIDE_DIR, f), "utf8");
  const m = /^\s*<!--meta\s*([\s\S]*?)-->\s*([\s\S]*)$/.exec(raw);
  if (!m) throw new Error(`guides/${f}: missing <!--meta {...} --> header`);
  let meta;
  try { meta = JSON.parse(m[1]); } catch (e) { throw new Error(`guides/${f}: meta is not valid JSON – ${e.message}`); }
  for (const k of ["title", "h1", "description", "answer"]) if (!meta[k]) throw new Error(`guides/${f}: meta.${k} is required`);
  for (const k of ["title", "h1", "description"]) meta[k] = stripTags(render(meta[k]));
  meta.slug = f.replace(/\.html$/, "");
  meta.body = m[2];
  return meta;
}).sort((a, b) => (b.published || "").localeCompare(a.published || "") || a.slug.localeCompare(b.slug)) : [];
const slugs = new Set([...live.map(l => l.page.slug), ...guides.map(g => g.slug), "guides"]);
if (slugs.size !== live.length + guides.length + 1) throw new Error("A guide slug clashes with another page");

/* ---------- 5b. Small shared helpers ---------- */
// TODO(AdSense): replace each AD_SLOT comment with an ad unit once approval is confirmed. Never place one inside the checklist or over the map.
const AD_SLOT = where => `\n<!-- AD SLOT (${where}) – disabled until AdSense approval is confirmed. Paste the ad unit code here later. -->\n`;
const SHARE_JS = `document.querySelectorAll(".share-guide").forEach(b => b.addEventListener("click", async () => {
  const url = location.origin + location.pathname, msg = b.parentNode.querySelector(".share-msg");
  try { if (navigator.share) { await navigator.share({ title: b.dataset.title, url }); return; } await navigator.clipboard.writeText(url); msg.textContent = "Link copied"; }
  catch (e) { if (e && e.name !== "AbortError") msg.textContent = url; }
}));`;
// Guides shown in "Popular guides" on the homepage, in this order (missing slugs are skipped).
const POPULAR = ["gta-6-cocaine-flamingo-locations", "gta-6-collectible-cards", "gta-6-bank-robbery-locations", "gta-6-stunt-jumps", "gta-6-garages-prices", "what-to-do-before-finishing-chapter-1-gta-6", "gta-6-beginner-tips", "gta-6-100-percent-completion-checklist"];

/* ---------- 6. Shared page shell ---------- */
const STYLE = `
  :root{--pool:#bfe8de;--tile:rgba(18,60,71,.07);--ink:#123c47;--ink-soft:#3f6670;--flamingo:#ff4f87;--sun:#ffcf3d;--sea:#1f8f8a;--shell:#fffbf2;--done:#fff0b3}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Figtree,system-ui,sans-serif;font-size:17px;background:var(--pool);color:var(--ink);line-height:1.6;
    background-image:linear-gradient(var(--tile) 1px,transparent 1px),linear-gradient(90deg,var(--tile) 1px,transparent 1px);background-size:30px 30px}
  a{color:var(--ink);text-decoration-color:var(--flamingo);text-decoration-thickness:2px;text-underline-offset:3px}
  :focus-visible{outline:3px solid var(--flamingo);outline-offset:2px}
  .wrap{max-width:820px;margin:0 auto;padding:0 16px}
  .bar{background:var(--ink);border-bottom:3px solid var(--flamingo)}
  .bar .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:12px;padding-bottom:12px}
  .logo{font-family:Bungee,sans-serif;font-size:20px;text-decoration:none;color:var(--shell);line-height:1}
  .logo span{color:var(--sun)}
  .cta{display:inline-block;background:var(--flamingo);color:var(--ink);text-decoration:none;font-weight:700;font-size:15px;padding:9px 15px;border-radius:10px;border:2px solid var(--shell);white-space:nowrap}
  nav.cats{display:flex;flex-wrap:wrap;gap:8px;padding:14px 0}
  @media (max-width:700px){
    nav.cats{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:thin;scrollbar-color:var(--ink) transparent;padding-bottom:10px}
    nav.cats::-webkit-scrollbar{height:4px}
    nav.cats::-webkit-scrollbar-thumb{background:var(--ink);border-radius:4px}
  }
  nav.cats a{flex-shrink:0;text-decoration:none;color:var(--ink);border:2px solid var(--ink);background:var(--shell);border-radius:999px;padding:6px 13px;font-size:14px;font-weight:700}
  nav.cats a[aria-current]{background:var(--ink);color:var(--shell)}
  .crumbs{font-size:14px;color:var(--ink-soft);margin-top:14px}
  .crumbs a{color:var(--ink-soft)}
  h1{font-family:Bungee,sans-serif;font-weight:400;font-size:clamp(27px,6vw,42px);line-height:1.08;margin:10px 0 14px}
  .lead{font-size:18px;max-width:660px}
  .answer{background:var(--shell);border:3px solid var(--ink);border-radius:14px;padding:16px 18px;font-size:18px;margin:14px 0 8px;box-shadow:5px 5px 0 var(--flamingo)}
  .meta{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0 22px;align-items:center}
  .pill{font-size:13px;font-weight:700;color:var(--shell);background:var(--sea);border-radius:6px;padding:3px 9px}
  article{max-width:700px}
  article h2{font-size:23px;margin:32px 0 10px}
  article h3{font-size:18px;margin:20px 0 6px}
  article p{margin:10px 0}
  article ul,article ol{margin:10px 0 10px 22px}
  article li{margin:6px 0}
  table{width:100%;border-collapse:separate;border-spacing:0 6px;margin:8px 0}
  td{background:var(--shell);border-top:2px solid var(--ink);border-bottom:2px solid var(--ink);padding:11px 12px;vertical-align:top;font-size:16px}
  td:first-child{border-left:2px solid var(--ink);border-radius:10px 0 0 10px}
  td:last-child{border-right:2px solid var(--ink);border-radius:0 10px 10px 0}
  td.num{color:var(--ink-soft);width:46px;font-variant-numeric:tabular-nums;font-size:14px;padding-top:13px}
  td.reg{font-size:13px;font-weight:700;white-space:nowrap;color:var(--sea)}
  td b{display:block}
  .note{display:block;color:var(--ink-soft);font-size:14px;margin-top:2px}
  .code{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}
  .code kbd{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:7px;background:var(--ink);color:var(--sun);font:700 16px Figtree,sans-serif;box-shadow:0 2px 0 var(--flamingo)}
  .box{background:var(--shell);border:2px solid var(--ink);border-radius:14px;padding:18px;margin:28px 0;box-shadow:5px 5px 0 var(--ink)}
  .box h2{font-size:20px;margin:0 0 8px}
  .box p{color:var(--ink-soft);font-size:16px}
  .box .cta{margin-top:14px;border-color:var(--ink)}
  .faq h3{font-size:17px;margin:16px 0 4px}
  .glist{display:grid;gap:8px;margin:10px 0}
  .glist a{display:block;text-decoration:none;color:var(--ink);background:var(--pool);border:2px solid var(--ink);border-radius:12px;padding:13px 16px}
  .glist a:hover{background:var(--sun)}
  .glist a b{display:block;font-size:16px}
  .glist a span{display:block;color:var(--ink-soft);font-size:14px;margin-top:2px}
  .sharebar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:26px 0 6px}
  .sharebar .cta{border-color:var(--ink);cursor:pointer;font-family:inherit}
  .cta.ghost{background:var(--shell)}
  .share-msg{font-weight:700;font-size:14px}
  .tellus{font-size:15px;margin:10px 0 0}
  .missable{display:inline-block;font-size:12px;font-weight:800;color:var(--shell);background:#b3124a;border-radius:6px;padding:1px 7px;margin-left:6px;vertical-align:2px}
  footer{background:var(--ink);color:#d9ecea;margin-top:40px;padding:24px 0 40px;font-size:14px}
  footer a{color:var(--sun)}
  footer p+p{margin-top:8px}
`;
const navLinks = active => live.map(({ cat, page }) =>
  `<a href="/${page.slug}/"${page.slug === active ? ' aria-current="page"' : ""}>${esc(cat.title)}</a>`).join("") +
  (guides.length ? `<a href="/guides/"${active === "guides" ? ' aria-current="page"' : ""}>Guides</a>` : "") +
  `<a href="/map/"${active === "map" ? ' aria-current="page"' : ""}>Map</a><a href="/gta-6-best-setup/"${active === "gta-6-best-setup" ? ' aria-current="page"' : ""}>Best setup</a>`;

function shell({ slug, title, description, ogType = "article", ld = [], ctaHash = "", content, head = "", noindex = false }) {
  const url = `${SITE}/${slug}/`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Leonida Tracker</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
${noindex ? '<meta name="robots" content="noindex">\n' : ""}<meta name="theme-color" content="#123c47">
${ADSENSE}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="Leonida Tracker">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/og-image.png">
${ld.length ? `<script type="application/ld+json">${JSON.stringify(ld)}</script>` : ""}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Bungee&family=Figtree:ital,wght@0,400;0,700;0,800;1,400&display=swap" rel="stylesheet">
<style>${STYLE}</style>
${head}
</head>
<body>
<div class="bar"><div class="wrap">
  <a class="logo" href="/">Leonida <span>Tracker</span></a>
  <a class="cta" href="/${ctaHash ? "#" + esc(ctaHash) : ""}">Open the tracker</a>
</div></div>
<main class="wrap">
  <nav class="cats" aria-label="Lists">${navLinks(slug)}</nav>
${content}
</main>
<footer><div class="wrap">
  <p><b>Leonida Tracker is an unofficial fan site.</b> It isn't affiliated with, endorsed by or connected to Rockstar Games or Take-Two Interactive. Game titles and trademarks belong to their owners.</p>
  <p>Lists are compiled from multiple sources and checked before being added. Last updated ${esc(prettyDate)}.</p>
  <p>As an Amazon Associate I earn from qualifying purchases.</p>
</div></footer>
</body>
</html>
`;
}
const crumbsLD = (name, url) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Leonida Tracker", item: SITE + "/" },
    { "@type": "ListItem", position: 2, name, item: url }
  ]
});
const faqLD = faq => faq.length ? [{
  "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: stripTags(q), acceptedAnswer: { "@type": "Answer", text: stripTags(a) } }))
}] : [];
const faqHTML = faq => faq.length ? `<section class="box faq"><h2>Quick answers</h2>${faq.map(([q, a]) => `<h3>${q}</h3><p>${a}</p>`).join("")}</section>` : "";

/* ---------- 7. Category list pages ---------- */
function categoryPage({ cat, page, items }) {
  const n = items.length, url = `${SITE}/${page.slug}/`, faq = page.faq(n);
  const related = guides.filter(g => (g.related || []).includes(page.slug));
  const ld = [{
    "@context": "https://schema.org", "@type": "ItemList", name: page.title(n), url, numberOfItems: n,
    itemListElement: items.slice(0, 200).map((i, idx) => ({ "@type": "ListItem", position: idx + 1, name: i.name }))
  }, crumbsLD(cat.title, url), ...faqLD(faq)];
  return shell({
    slug: page.slug, title: page.title(n), description: page.intro(n).slice(0, 155), ld, ctaHash: cat.key,
    content: `
  <div class="crumbs"><a href="/">Leonida Tracker</a> › ${esc(cat.title)}</div>
  <h1>${esc(page.h1)} (${n})</h1>
  <p class="lead">${esc(page.intro(n))}</p>
  <div class="meta"><span class="pill">${n} ${esc(page.noun)}</span><span class="pill">Updated ${esc(prettyDate)}</span></div>
  ${tableHTML(items)}
  <div class="box">
    <h2>Track your progress</h2>
    <p>Tick these off as you play – your progress saves on your device, no sign-up. Filter by region, search, and hide what you've finished.</p>
    <a class="cta" href="/#${esc(cat.key)}">Track ${esc(page.noun)}</a>
  </div>
  ${related.length ? `<section class="box"><h2>Related guides</h2><div class="glist">${related.map(g => `<a href="/${g.slug}/"><b>${esc(g.h1)}</b><span>${esc(g.description)}</span></a>`).join("")}</div></section>` : ""}
  ${faqHTML(faq.map(([q, a]) => [esc(q), esc(a)]))}`
  });
}

/* ---------- 8. Guide pages ---------- */
function guidePage(g) {
  const url = `${SITE}/${g.slug}/`;
  const answer = render(g.answer);
  let body = render(g.body);
  // TODO(AdSense): prepared slot between guide sections – disabled until AdSense approval is confirmed.
  const h2s = [...body.matchAll(/<h2[\s>]/g)];
  if (h2s.length >= 3) body = body.slice(0, h2s[2].index) + AD_SLOT("between guide sections") + body.slice(h2s[2].index);
  const faq = (g.faq || []).map(([q, a]) => [render(q), render(a)]);
  const rel = (g.related || []).map(s => {
    const l = live.find(l => l.page.slug === s); if (l) return { href: `/${s}/`, title: l.page.h1, sub: `Full list – ${l.items.length} ${l.page.noun}` };
    const og = guides.find(x => x.slug === s); if (og) return { href: `/${s}/`, title: og.h1, sub: og.description };
    return null;
  }).filter(Boolean);
  const ld = [{
    "@context": "https://schema.org", "@type": "Article", headline: g.h1, description: g.description,
    datePublished: g.published || today, dateModified: today, mainEntityOfPage: url, image: `${SITE}/og-image.png`,
    author: { "@type": "Organization", name: "Leonida Tracker", url: SITE + "/" },
    publisher: { "@type": "Organization", name: "Leonida Tracker", url: SITE + "/" }
  }, crumbsLD(g.h1, url), ...faqLD(faq)];
  return shell({
    slug: g.slug, title: g.title, description: g.description, ld, ctaHash: g.cat || "",
    content: `
  <div class="crumbs"><a href="/">Leonida Tracker</a> › <a href="/guides/">Guides</a> › ${esc(g.h1)}</div>
  <article>
  <h1>${esc(g.h1)}</h1>
  <p class="answer">${answer}</p>
  <div class="meta"><span class="pill">Updated ${esc(prettyDate)}</span>${g.cat ? `<span class="pill">Tracked in the ${esc(catByKey(g.cat).title)} checklist</span>` : ""}</div>
  ${body}
  </article>
  <div class="sharebar">
    <button class="cta share-guide" type="button" data-title="${esc(g.h1)}">Share this guide</button>
    <a class="cta ghost" href="https://www.reddit.com/submit?url=${encodeURIComponent(url)}&amp;title=${encodeURIComponent(g.h1)}" target="_blank" rel="noopener">Post to Reddit</a>
    <a class="cta ghost" href="https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&amp;text=${encodeURIComponent(g.h1)}" target="_blank" rel="noopener">Post on X</a>
    <span class="share-msg" aria-live="polite"></span>
  </div>
  <p class="tellus">Found a location we missed, or something that's wrong? <a href="/tell-us/?page=${encodeURIComponent(g.slug)}">Tell us</a> and we'll check it.</p>
  <div class="box">
    <h2>Track it as you play</h2>
    <p>Leonida Tracker is a free GTA 6 checklist – tick things off as you go, and your progress saves on your device. No sign-up.</p>
    <a class="cta" href="/${g.cat ? "#" + esc(g.cat) : ""}">Open the tracker</a>
  </div>
  ${rel.length ? `<section class="box"><h2>Related</h2><div class="glist">${rel.map(r => `<a href="${r.href}"><b>${esc(r.title)}</b><span>${esc(r.sub)}</span></a>`).join("")}</div></section>` : ""}
  ${faqHTML(faq)}
  ${AD_SLOT("end of guide")}
  <script>${SHARE_JS}</script>`
  });
}
function guidesIndex() {
  const url = `${SITE}/guides/`;
  return shell({
    slug: "guides", title: "GTA 6 Guides: Quick Answers, Locations & Checklists", ogType: "website",
    description: "Straight answers to common GTA 6 questions – missions, trophies, 100% completion, collectibles, garages and locations – kept up to date.",
    ld: [crumbsLD("Guides", url)],
    content: `
  <div class="crumbs"><a href="/">Leonida Tracker</a> › Guides</div>
  <h1>GTA 6 guides</h1>
  <p class="lead">Straight answers to the questions players ask most, built from the same checked data as the tracker – so the numbers stay current.</p>
  <div class="glist" style="margin-top:20px">${guides.map(g => `<a href="/${g.slug}/"><b>${esc(g.h1)}</b><span>${esc(g.description)}</span></a>`).join("")}</div>`
  });
}

/* ---------- 9. Homepage additions (crawlable text + FAQ data) ---------- */
const countOf = k => { const c = CATEGORIES.find(c => c.key === k); return c ? realItems(c).length : 0; };
const homeFaq = [
  ["What is Leonida Tracker?", "A free, unofficial GTA 6 completion checklist. Tick off story missions, collectibles, vehicles, properties, side activities and trophies as you play – progress saves on your device with no account needed."],
  ["How many story missions are in GTA 6?", `Our list currently has ${countOf("missions")} confirmed main story missions.`],
  ["How many trophies are in GTA 6?", `There are ${countOf("trophies")} trophies on our list, including the Platinum.`],
  ["Does Leonida Tracker work on phones and consoles?", "Yes – it runs in any web browser, including phones and the PS5 and Xbox browsers. Use the save code to move your progress between devices."]
];
const about = `
  <section class="panel" id="about">
    <h3>About this GTA 6 checklist</h3>
    <p>Leonida Tracker is a free GTA 6 100% checklist. It currently tracks ${countOf("missions")} story missions, ${countOf("trophies")} trophies, all ${countOf("cheats")} cheats and their unlock challenges, ${countOf("collectibles")} collectible entries, ${countOf("vehicles")} vehicles, ${countOf("properties")} properties and ${countOf("activities")} side activities and locations. Everything is checked against more than one source before it's added, and the lists are updated daily (last update ${esc(prettyDate)}).</p>
    ${guides.length ? `<p style="margin-top:10px"><b>Popular guides:</b></p><ul class="poplist">${POPULAR.map(sl => guides.find(g => g.slug === sl)).filter(Boolean).map(g => `<li><a href="/${g.slug}/">${esc(g.h1)}</a></li>`).join("")}<li><a href="/guides/">All ${guides.length} guides</a></li></ul>` : ""}
    <p style="margin-top:10px">Leonida Tracker is an unofficial fan site. It isn't affiliated with, endorsed by or connected to Rockstar Games or Take-Two Interactive.</p>
    ${homeFaq.map(([q, a]) => `<p style="margin-top:10px"><b>${esc(q)}</b><br>${esc(a)}</p>`).join("")}
  </section>`;

/* ---------- 10. Write dist/ ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const f of ["og-image.png", "favicon.svg", "robots.txt", "ads.txt"]) {
  if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
}
const writePage = (slug, content) => {
  fs.mkdirSync(path.join(OUT, slug), { recursive: true });
  fs.writeFileSync(path.join(OUT, slug, "index.html"), content);
};
for (const p of live) writePage(p.page.slug, categoryPage(p));
for (const g of guides) writePage(g.slug, guidePage(g));
if (guides.length) writePage("guides", guidesIndex());

// Map, gear, progress-share and feedback pages + map data (see extras.js)
const extras = require("./extras.js")({ CATEGORIES, realItems, isMissable, esc, shell, crumbsLD, faqLD, faqHTML, prettyDate, today, SITE, AD_SLOT, SHARE_JS });
for (const pg of extras.pages) writePage(pg.slug, pg.html);
for (const f of extras.files) fs.writeFileSync(path.join(OUT, f.name), f.content);

let indexOut = html;
const glinks = live.map(({ cat, page, items }) => `<a href="/${page.slug}/">${esc(cat.title)} <em>${items.length}</em></a>`).join("") +
  (guides.length ? `<a href="/guides/">Guides <em>${guides.length}</em></a>` : "");
indexOut = indexOut.replace("<!--GUIDES-->", glinks).replace("<!--ABOUT-->", about)
  .replace("</head>", `<script type="application/ld+json">${JSON.stringify(faqLD(homeFaq)[0])}</script>\n</head>`);
fs.writeFileSync(path.join(OUT, "index.html"), indexOut);

const urls = [`${SITE}/`, ...live.map(({ page }) => `${SITE}/${page.slug}/`), ...(guides.length ? [`${SITE}/guides/`] : []), ...guides.map(g => `${SITE}/${g.slug}/`), ...extras.pages.filter(pg => pg.sitemap).map(pg => `${SITE}/${pg.slug}/`)];
fs.writeFileSync(path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>`).join("\n") + `\n</urlset>\n`);

fs.writeFileSync(path.join(OUT, "llms.txt"), `# Leonida Tracker

> Free, unofficial GTA 6 (Grand Theft Auto VI) 100% completion checklist and guides. Lists are checked against multiple sources and updated daily. Last updated ${prettyDate}.

The interactive tracker is at ${SITE}/ (progress saves in the browser, no account). Every list and guide below is plain HTML.

## Lists
${live.map(({ cat, page, items }) => `- [${page.h1} (${items.length})](${SITE}/${page.slug}/): ${page.intro(items.length)}`).join("\n")}

## Guides
${guides.map(g => `- [${g.h1}](${SITE}/${g.slug}/): ${g.description}`).join("\n")}

## Notes
- Unofficial fan site; not affiliated with Rockstar Games or Take-Two Interactive.
`);

console.log(`Built ${live.length} list pages (${live.map(l => `${l.page.slug} ${l.items.length}`).join(", ")}) and ${guides.length} guides.`);
