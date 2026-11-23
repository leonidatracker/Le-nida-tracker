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
  return items.filter(i => re.test(i.name) || re.test(i.note || ""));
}
function tableHTML(items) {
  if (!items.length) return `<p class="note">Nothing confirmed yet – check back soon.</p>`;
  const showRegion = new Set(items.map(i => i.region)).size > 1;
  return `<table><tbody>${items.map((i, idx) => `
    <tr><td class="num">${idx + 1}</td><td><b>${esc(i.name)}</b>${i.note ? `<span class="note">${esc(i.note)}</span>` : ""}</td>${showRegion ? `<td class="reg">${esc(i.region)}</td>` : ""}</tr>`).join("")}
  </tbody></table>`;
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
}) : [];
const slugs = new Set([...live.map(l => l.page.slug), ...guides.map(g => g.slug), "guides"]);
if (slugs.size !== live.length + guides.length + 1) throw new Error("A guide slug clashes with another page");

/* ---------- 6. Shared page shell ---------- */
const STYLE = `
  :root{--bg:#0d0b14;--panel:#16131f;--panel2:#1d1929;--line:#2a2538;--text:#f3eff8;--muted:#9a93ab;--pink:#ff3d8b;--orange:#ff9a3c;--teal:#2de0c8;--grad:linear-gradient(120deg,#ff3d8b 0%,#ff9a3c 100%)}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.6;-webkit-font-smoothing:antialiased}
  a{color:var(--teal)}
  .wrap{max-width:860px;margin:0 auto;padding:0 16px}
  .bar{border-bottom:1px solid var(--line);background:radial-gradient(80% 140% at 100% 0%,rgba(255,61,139,.25),transparent 60%),var(--bg)}
  .bar .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;padding-top:14px;padding-bottom:14px}
  .logo{font-family:"Archivo Black",sans-serif;font-size:20px;text-decoration:none;color:var(--text);letter-spacing:-.01em}
  .logo span{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
  .cta{display:inline-block;background:var(--grad);color:#1a0a12;text-decoration:none;font-weight:700;font-size:14px;padding:10px 16px;border-radius:10px;white-space:nowrap}
  nav.cats{display:flex;gap:8px;overflow-x:auto;padding:12px 0;scrollbar-width:none}
  nav.cats::-webkit-scrollbar{display:none}
  nav.cats a{flex-shrink:0;text-decoration:none;color:var(--text);border:1px solid var(--line);background:var(--panel);border-radius:999px;padding:7px 13px;font-size:13px;font-weight:600}
  nav.cats a[aria-current]{background:var(--grad);color:#1a0a12;border-color:transparent}
  .crumbs{font-size:12px;color:var(--muted);margin-top:18px}
  .crumbs a{color:var(--muted)}
  h1{font-family:"Archivo Black",sans-serif;font-size:clamp(26px,6vw,40px);line-height:1.1;margin:10px 0 12px;letter-spacing:-.01em}
  .lead{color:#cfc8dc;font-size:16px;max-width:680px}
  .answer{background:linear-gradient(120deg,rgba(255,61,139,.12),rgba(255,154,60,.08));border:1px solid rgba(255,61,139,.35);border-radius:14px;padding:16px 18px;font-size:17px;color:#fff;margin:14px 0 6px}
  .meta{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 22px;align-items:center}
  .pill{font-size:12px;font-weight:600;color:var(--teal);background:rgba(45,224,200,.1);border-radius:6px;padding:4px 9px}
  article h2{font-size:21px;margin:30px 0 10px}
  article h3{font-size:17px;margin:20px 0 6px}
  article p{color:#d9d3e4;margin:10px 0}
  article ul,article ol{margin:10px 0 10px 22px;color:#d9d3e4}
  article li{margin:5px 0}
  table{width:100%;border-collapse:separate;border-spacing:0 6px;margin:8px 0}
  td{background:var(--panel);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:11px 12px;vertical-align:top;font-size:15px}
  td:first-child{border-left:1px solid var(--line);border-radius:10px 0 0 10px}
  td:last-child{border-right:1px solid var(--line);border-radius:0 10px 10px 0}
  td.num{color:var(--muted);width:44px;font-variant-numeric:tabular-nums;font-size:13px;padding-top:13px}
  td.reg{color:var(--teal);font-size:12px;font-weight:600;white-space:nowrap}
  td b{display:block;font-weight:600}
  .note{display:block;color:var(--muted);font-size:13px;margin-top:2px}
  .box{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;margin:26px 0}
  .box h2{font-size:18px;margin:0 0 8px}
  .box p{color:var(--muted);font-size:14px}
  .box .cta{margin-top:14px}
  .faq h3{font-size:15px;margin:14px 0 4px}
  .glist{display:grid;gap:8px;margin:10px 0}
  .glist a{display:block;text-decoration:none;color:var(--text);background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px}
  .glist a b{display:block;font-size:15px}
  .glist a span{display:block;color:var(--muted);font-size:13px;margin-top:2px}
  footer{border-top:1px solid var(--line);margin-top:34px;padding:22px 0 40px;color:var(--muted);font-size:12px}
  footer p+p{margin-top:8px}
`;
const navLinks = active => live.map(({ cat, page }) =>
  `<a href="/${page.slug}/"${page.slug === active ? ' aria-current="page"' : ""}>${esc(cat.title)}</a>`).join("") +
  (guides.length ? `<a href="/guides/"${active === "guides" ? ' aria-current="page"' : ""}>Guides</a>` : "");

function shell({ slug, title, description, ogType = "article", ld = [], ctaHash = "", content }) {
  const url = `${SITE}/${slug}/`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} | Leonida Tracker</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#0d0b14">
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
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${STYLE}</style>
</head>
<body>
<div class="bar"><div class="wrap">
  <a class="logo" href="/">LEONIDA <span>TRACKER</span></a>
  <a class="cta" href="/${ctaHash ? "#" + esc(ctaHash) : ""}">Open tracker →</a>
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
    <a class="cta" href="/#${esc(cat.key)}">Track ${esc(page.noun)} →</a>
  </div>
  ${related.length ? `<section class="box"><h2>Related guides</h2><div class="glist">${related.map(g => `<a href="/${g.slug}/"><b>${esc(g.h1)}</b><span>${esc(g.description)}</span></a>`).join("")}</div></section>` : ""}
  ${faqHTML(faq.map(([q, a]) => [esc(q), esc(a)]))}`
  });
}

/* ---------- 8. Guide pages ---------- */
function guidePage(g) {
  const url = `${SITE}/${g.slug}/`;
  const answer = render(g.answer), body = render(g.body);
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
  <div class="box">
    <h2>Track it as you play</h2>
    <p>Leonida Tracker is a free GTA 6 checklist – tick things off as you go, and your progress saves on your device. No sign-up.</p>
    <a class="cta" href="/${g.cat ? "#" + esc(g.cat) : ""}">Open the tracker →</a>
  </div>
  ${rel.length ? `<section class="box"><h2>Related</h2><div class="glist">${rel.map(r => `<a href="${r.href}"><b>${esc(r.title)}</b><span>${esc(r.sub)}</span></a>`).join("")}</div></section>` : ""}
  ${faqHTML(faq)}`
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
    <p>Leonida Tracker is a free GTA 6 100% checklist. It currently tracks ${countOf("missions")} story missions, ${countOf("trophies")} trophies, ${countOf("collectibles")} collectible entries, ${countOf("vehicles")} vehicles, ${countOf("properties")} properties and ${countOf("activities")} side activities and locations. Everything is checked against more than one source before it's added, and the lists are updated daily (last update ${esc(prettyDate)}).</p>
    ${guides.length ? `<p style="margin-top:10px"><b>Popular guides:</b> ${guides.slice(0, 6).map(g => `<a href="/${g.slug}/">${esc(g.h1)}</a>`).join(" · ")} · <a href="/guides/">all guides</a></p>` : ""}
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

let indexOut = html;
const glinks = live.map(({ cat, page, items }) => `<a href="/${page.slug}/">${esc(cat.title)} <em>${items.length}</em></a>`).join("") +
  (guides.length ? `<a href="/guides/">Guides <em>${guides.length}</em></a>` : "");
indexOut = indexOut.replace("<!--GUIDES-->", glinks).replace("<!--ABOUT-->", about)
  .replace("</head>", `<script type="application/ld+json">${JSON.stringify(faqLD(homeFaq)[0])}</script>\n</head>`);
fs.writeFileSync(path.join(OUT, "index.html"), indexOut);

const urls = [`${SITE}/`, ...live.map(({ page }) => `${SITE}/${page.slug}/`), ...(guides.length ? [`${SITE}/guides/`] : []), ...guides.map(g => `${SITE}/${g.slug}/`)];
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
