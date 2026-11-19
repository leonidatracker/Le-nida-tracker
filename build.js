#!/usr/bin/env node
/*
  Netlify build: node build.js  ->  publishes ./dist
  - Reads the tracker data (REGIONS + CATEGORIES) straight out of index.html,
    so the scheduled data updates only ever need to edit index.html.
  - Writes one SEO page per category that has real (non-placeholder) items.
  - Injects links to those pages into the tracker, and writes sitemap.xml.
  Never commit dist/.
*/
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");
const SITE = "https://leonida-tracker.com";
const ADSENSE = '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3997327230760263" crossorigin="anonymous"></script>';

const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");

/* ---------- 1. Pull the data out of index.html ---------- */
const start = html.indexOf("const REGIONS");
const end = html.indexOf("/* Category icons");
if (start < 0 || end < 0 || end < start) throw new Error("Could not find the DATA section in index.html");
const dataSrc = html.slice(start, end).replace(/\bconst (REGIONS|CATEGORIES)\b/g, "var $1");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(dataSrc, ctx);
const CATEGORIES = ctx.CATEGORIES;
if (!Array.isArray(CATEGORIES) || !CATEGORIES.length) throw new Error("CATEGORIES is empty");

const ids = new Set();
for (const c of CATEGORIES) for (const i of c.items) {
  if (ids.has(i.id)) throw new Error("Duplicate item id: " + i.id);
  ids.add(i.id);
}

/* ---------- 2. Page copy (own words; counts filled in from data) ---------- */
const PAGES = {
  missions: {
    slug: "gta-6-missions",
    title: n => `GTA 6 Mission List: All ${n} Story Missions in Order`,
    h1: "GTA 6 story missions",
    noun: "story missions",
    intro: n => `Every main story mission in Grand Theft Auto VI that we've confirmed so far – ${n} in total – listed in the order you play them, with the chapter each one belongs to. Tick them off in the free tracker as you go and your progress saves automatically.`,
    faq: n => [[`How many story missions are in GTA 6?`, `Our list currently has ${n} confirmed main story missions across the game's chapters. We add more as they're verified, so the number may still grow.`]]
  },
  collectibles: {
    slug: "gta-6-collectibles",
    title: n => `GTA 6 Collectibles Checklist: All ${n} Collectible Sets`,
    h1: "GTA 6 collectibles",
    noun: "collectible sets",
    intro: n => `A checklist of the collectibles in Grand Theft Auto VI, grouped by set – ${n} sets so far. Individual locations are added as players confirm them. Use the tracker to mark each set off as you complete it.`,
    faq: n => [[`How many collectibles are in GTA 6?`, `We currently track ${n} collectible sets. Card counts per set are shown in the notes; exact locations are added once they've been confirmed by more than one source.`]]
  },
  vehicles: {
    slug: "gta-6-vehicles",
    title: n => `GTA 6 Vehicle List: ${n} Cars, Bikes and More`,
    h1: "GTA 6 vehicles",
    noun: "vehicles",
    intro: n => `Vehicles you can find in Grand Theft Auto VI and where to get them – ${n} confirmed so far. Tick off each one in the tracker as you add it to your collection.`,
    faq: n => [[`How many vehicles are in GTA 6?`, `Our list currently has ${n} confirmed vehicles and grows as more are verified.`]]
  },
  properties: {
    slug: "gta-6-properties",
    title: n => `GTA 6 Properties & Garages: All ${n} You Can Buy (With Prices)`,
    h1: "GTA 6 properties and garages",
    noun: "properties",
    intro: n => `Properties, garages and businesses you can buy in Grand Theft Auto VI, with prices where they're known – ${n} so far. Mark each purchase in the tracker to see how close you are to owning them all.`,
    faq: n => [[`How many properties can you buy in GTA 6?`, `We currently list ${n} purchasable properties and garages. Prices are shown where they've been confirmed.`]]
  },
  activities: {
    slug: "gta-6-side-activities",
    title: n => `GTA 6 Side Activities & Strangers and Freaks: ${n} to Complete`,
    h1: "GTA 6 side activities",
    noun: "side activities",
    intro: n => `Side activities, hobbies and Strangers & Freaks missions in Grand Theft Auto VI – ${n} on our list so far, with notes on what each involves and which trophies they count towards.`,
    faq: n => [[`How many side activities are in GTA 6?`, `Our checklist currently has ${n} side activities and Strangers & Freaks strands, and we add more as they're confirmed.`]]
  },
  trophies: {
    slug: "gta-6-trophies",
    title: n => `GTA 6 Trophy & Achievement List: All ${n} Trophies`,
    h1: "GTA 6 trophies and achievements",
    noun: "trophies",
    intro: n => `The full Grand Theft Auto VI trophy and achievement list – ${n} in total, including the Platinum – with a short note on how to unlock each one. Track them in the checklist and watch your completion percentage climb.`,
    faq: n => [[`How many trophies are in GTA 6?`, `GTA 6 has ${n} trophies on our list, including the Platinum trophy for unlocking all of the others.`]]
  }
};
const fallbackPage = c => ({
  slug: "gta-6-" + c.key,
  title: n => `GTA 6 ${c.title}: Full List (${n})`,
  h1: "GTA 6 " + c.title.toLowerCase(),
  noun: c.title.toLowerCase(),
  intro: n => `${n} ${c.title.toLowerCase()} in Grand Theft Auto VI, with notes. Track them in the free checklist.`,
  faq: () => []
});

/* ---------- 3. Helpers ---------- */
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));
const today = new Date().toISOString().slice(0, 10);
const prettyDate = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/London" });
const realItems = c => c.items.filter(i => !i.placeholder);

const live = CATEGORIES
  .filter(c => realItems(c).length > 0)
  .map(c => ({ cat: c, page: PAGES[c.key] || fallbackPage(c), items: realItems(c) }));

const navLinks = active => live.map(({ cat, page }) =>
  `<a href="/${page.slug}/"${cat.key === active ? ' aria-current="page"' : ""}>${esc(cat.title)}</a>`).join("");

/* ---------- 4. Category page template ---------- */
function categoryPage({ cat, page, items }) {
  const n = items.length;
  const url = `${SITE}/${page.slug}/`;
  const showRegion = new Set(items.map(i => i.region)).size > 1;
  const faq = page.faq(n);
  const rows = items.map((i, idx) => `
        <tr><td class="num">${idx + 1}</td><td><b>${esc(i.name)}</b>${i.note ? `<span class="note">${esc(i.note)}</span>` : ""}</td>${showRegion ? `<td class="reg">${esc(i.region)}</td>` : ""}</tr>`).join("");

  const ld = [
    {
      "@context": "https://schema.org", "@type": "ItemList", name: page.title(n), url,
      numberOfItems: n,
      itemListElement: items.slice(0, 200).map((i, idx) => ({ "@type": "ListItem", position: idx + 1, name: i.name }))
    },
    {
      "@context": "https://schema.org", "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Leonida Tracker", item: SITE + "/" },
        { "@type": "ListItem", position: 2, name: cat.title, item: url }
      ]
    }
  ];
  if (faq.length) ld.push({
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } }))
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(page.title(n))} | Leonida Tracker</title>
<meta name="description" content="${esc(page.intro(n).slice(0, 155))}">
<link rel="canonical" href="${url}">
<meta name="theme-color" content="#0d0b14">
${ADSENSE}
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Leonida Tracker">
<meta property="og:title" content="${esc(page.title(n))}">
<meta property="og:description" content="${esc(page.intro(n).slice(0, 155))}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/og-image.png">
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{--bg:#0d0b14;--panel:#16131f;--panel2:#1d1929;--line:#2a2538;--text:#f3eff8;--muted:#9a93ab;--pink:#ff3d8b;--orange:#ff9a3c;--teal:#2de0c8;--grad:linear-gradient(120deg,#ff3d8b 0%,#ff9a3c 100%)}
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Inter,system-ui,sans-serif;background:var(--bg);color:var(--text);line-height:1.55;-webkit-font-smoothing:antialiased}
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
  .meta{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 22px;align-items:center}
  .pill{font-size:12px;font-weight:600;color:var(--teal);background:rgba(45,224,200,.1);border-radius:6px;padding:4px 9px}
  table{width:100%;border-collapse:separate;border-spacing:0 6px}
  td{background:var(--panel);border-top:1px solid var(--line);border-bottom:1px solid var(--line);padding:11px 12px;vertical-align:top;font-size:15px}
  td:first-child{border-left:1px solid var(--line);border-radius:10px 0 0 10px}
  td:last-child{border-right:1px solid var(--line);border-radius:0 10px 10px 0}
  td.num{color:var(--muted);width:44px;font-variant-numeric:tabular-nums;font-size:13px;padding-top:13px}
  td.reg{color:var(--teal);font-size:12px;font-weight:600;white-space:nowrap}
  td b{display:block;font-weight:600}
  .note{display:block;color:var(--muted);font-size:13px;margin-top:2px}
  .box{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;margin:26px 0}
  .box h2{font-size:18px;margin-bottom:8px}
  .box p{color:var(--muted);font-size:14px}
  .box .cta{margin-top:14px}
  .faq h3{font-size:15px;margin:14px 0 4px}
  footer{border-top:1px solid var(--line);margin-top:34px;padding:22px 0 40px;color:var(--muted);font-size:12px}
  footer p+p{margin-top:8px}
</style>
</head>
<body>
<div class="bar"><div class="wrap">
  <a class="logo" href="/">LEONIDA <span>TRACKER</span></a>
  <a class="cta" href="/#${esc(cat.key)}">Open tracker →</a>
</div></div>

<main class="wrap">
  <nav class="cats" aria-label="Lists">${navLinks(cat.key)}</nav>
  <div class="crumbs"><a href="/">Leonida Tracker</a> › ${esc(cat.title)}</div>
  <h1>${esc(page.h1)} (${n})</h1>
  <p class="lead">${esc(page.intro(n))}</p>
  <div class="meta"><span class="pill">${n} ${esc(page.noun)}</span><span class="pill">Updated ${esc(prettyDate)}</span></div>

  <table>
    <tbody>${rows}
    </tbody>
  </table>

  <div class="box">
    <h2>Track your progress</h2>
    <p>Tick these off as you play – your progress saves on your device, no sign-up. Filter by region, search, and hide what you've finished.</p>
    <a class="cta" href="/#${esc(cat.key)}">Track ${esc(page.noun)} →</a>
  </div>

  ${faq.length ? `<section class="box faq"><h2>Quick answers</h2>${faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}</section>` : ""}
</main>

<footer><div class="wrap">
  <p><b>Leonida Tracker is an unofficial fan site.</b> It isn't affiliated with, endorsed by or connected to Rockstar Games or Take-Two Interactive. Game titles and trademarks belong to their owners.</p>
  <p>Lists are compiled from multiple sources and checked before being added. Spotted something wrong or missing? Let us know.</p>
  <p>As an Amazon Associate I earn from qualifying purchases.</p>
</div></footer>
</body>
</html>
`;
}

/* ---------- 5. Write dist/ ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

for (const f of ["og-image.png", "favicon.svg", "robots.txt", "ads.txt"]) {
  if (fs.existsSync(path.join(ROOT, f))) fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f));
}

for (const p of live) {
  const dir = path.join(OUT, p.page.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), categoryPage(p));
}

// Tracker page with guide links injected
const guides = live.map(({ cat, page, items }) =>
  `<a href="/${page.slug}/">${esc(cat.title)} <em>${items.length}</em></a>`).join("");
const marker = "<!--GUIDES-->";
let indexOut = html;
if (indexOut.includes(marker)) indexOut = indexOut.replace(marker, guides);
fs.writeFileSync(path.join(OUT, "index.html"), indexOut);

// Sitemap
const urls = [`${SITE}/`, ...live.map(({ page }) => `${SITE}/${page.slug}/`)];
fs.writeFileSync(path.join(OUT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls.map(u => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq></url>`).join("\n") +
  `\n</urlset>\n`);

console.log(`Built ${live.length} category pages: ${live.map(l => `${l.page.slug} (${l.items.length})`).join(", ")}`);
