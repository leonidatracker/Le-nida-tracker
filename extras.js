/*
  Extra pages for the Netlify build (called from build.js):
  - /map/                schematic county map with filterable pins, ticks shared with the tracker
  - /map-data.json       the pins, built from the tracker data (lazy-loaded by the map page)
  - /gta-6-best-setup/   "Best setup for a 100% run" (Amazon UK affiliate links)
  - /progress/           shareable progress card (reads numbers from the link, nothing stored)
  - /tell-us/            feedback form (Netlify Forms) + /tell-us/thanks/

  MAP RULES: the map is our own schematic drawing – no Rockstar map art. Pins are grouped by county,
  taken only from the county or region written in each item's note. Pins show the AREA, not the exact
  spot. Items with no confirmed county go in the "Area not confirmed yet" list – never guess one.
*/
module.exports = function extras(h) {
  const { CATEGORIES, realItems, isMissable, esc, shell, crumbsLD, faqLD, faqHTML, prettyDate, SITE, AD_SLOT } = h;
  const TAG = "simonjwarnera-21";
  const amazon = q => `https://www.amazon.co.uk/s?k=${encodeURIComponent(q).replace(/%20/g, "+")}&amp;tag=${TAG}`;
  const pages = [], files = [];

  /* ---------------- Map data ---------------- */
  const GROUPS = [
    { key: "flamingo", label: "Cocaine Flamingos", color: "#ff4f87", test: i => /^Cocaine Flamingo:/.test(i.name) },
    { key: "card", label: "Trading cards", color: "#7b5cff", test: i => / card: /.test(i.name) },
    { key: "stunt", label: "Stunt jumps", color: "#ff8a3d", test: i => /^Stunt jump:/.test(i.name) },
    { key: "garage", label: "Garages", color: "#1f8f8a", test: (i, c) => c === "properties" },
    { key: "bank", label: "Bank jobs", color: "#c99700", test: i => /^Bank (job|vault):/.test(i.name) },
    { key: "waink", label: "WAiNK scans", color: "#2f6fd6", test: i => /^WAiNK [A-Za-z]+:/.test(i.name) },
    { key: "wreck", label: "Shipwrecks", color: "#123c47", test: i => /^Kenton shipwreck:/.test(i.name) }
  ];
  const COUNTIES = [
    { key: "kelly", label: "Kelly County", note: "Port Gellhorn, the north-west" },
    { key: "lummox", label: "Lummox County", note: "Mount Kalaga, the north" },
    { key: "leonard", label: "Leonard County", note: "the north-east coast" },
    { key: "ambrosia", label: "Ambrosia", note: "the middle of the state" },
    { key: "mariana", label: "Mariana County", note: "Grassrivers and the Keys" },
    { key: "vicedale", label: "Vice-Dale County", note: "Vice City" }
  ];
  // Only explicit county / region names count. Anything else stays "not confirmed".
  const countyOf = i => {
    const t = `${i.note || ""} | ${i.region || ""}`;
    if (/Vice-Dale County|Vice City/.test(t)) return "vicedale";
    if (/Mariana County|Leonida Keys|Grassrivers/.test(t)) return "mariana";
    if (/Kelly County|Port Gellhorn|\bGellhorn\b/.test(t)) return "kelly";
    if (/Lummox County|Mount Kalaga/.test(t)) return "lummox";
    if (/Leonard County/.test(t)) return "leonard";
    if (/Ambrosia/.test(t)) return "ambrosia";
    return "";
  };
  const mapItems = [];
  for (const c of CATEGORIES) for (const i of realItems(c)) {
    const g = GROUPS.find(g => g.test(i, c.key));
    if (!g) continue;
    mapItems.push({ id: i.id, name: i.name, note: i.note || "", cat: c.key, group: g.key,
      set: g.key === "card" ? i.name.split(" card:")[0] : "", county: countyOf(i), missable: isMissable(i) });
  }
  files.push({ name: "map-data.json", content: JSON.stringify({
    updated: prettyDate,
    groups: GROUPS.map(({ key, label, color }) => ({ key, label, color })),
    counties: COUNTIES,
    items: mapItems
  }) });
  const placed = mapItems.filter(i => i.county).length;

  /* ---------------- Map page ---------------- */
  const MAP_SVG = `<svg id="leo" viewBox="0 0 600 780" role="img" aria-label="Schematic map of Leonida's counties">
  <rect width="600" height="780" fill="#1f8f8a"/>
  <g stroke="#fffbf2" stroke-opacity=".35" stroke-width="2" fill="none"><path d="M20 720h90M40 740h50M480 30h80M500 50h40"/></g>
  <g class="counties" stroke="#123c47" stroke-width="3" stroke-linejoin="round">
    <path data-c="kelly" d="M40 60 L250 52 L262 250 L235 430 L170 380 L110 270 L48 170 Z" fill="#ffe08a"/>
    <path data-c="lummox" d="M250 52 L455 44 L470 200 L380 240 L262 250 Z" fill="#cfe7b6"/>
    <path data-c="leonard" d="M455 44 L530 70 L565 300 L545 410 L430 405 L405 265 L470 200 Z" fill="#ffd0b8"/>
    <path data-c="ambrosia" d="M262 250 L380 240 L470 200 L405 265 L430 405 L330 440 L235 430 Z" fill="#f4e3c8"/>
    <path data-c="mariana" d="M235 430 L330 440 L360 600 L330 650 L250 640 L195 560 L170 470 Z" fill="#bfe8a8"/>
    <path data-c="vicedale" d="M330 440 L430 405 L545 410 L540 560 L470 640 L360 600 Z" fill="#ffc2d6"/>
  </g>
  <g fill="#fffbf2" stroke="#123c47" stroke-width="2"><ellipse cx="300" cy="690" rx="16" ry="7"/><ellipse cx="345" cy="705" rx="20" ry="7"/><ellipse cx="395" cy="715" rx="18" ry="6"/><ellipse cx="440" cy="722" rx="22" ry="7"/><ellipse cx="490" cy="725" rx="16" ry="6"/></g>
  <text x="400" y="752" class="lbl small">The Keys (Mariana County)</text>
  <ellipse cx="300" cy="410" rx="26" ry="14" fill="#1f8f8a" stroke="#123c47" stroke-width="2"/>
  <path d="M268 240 l20 -34 l20 34 z" fill="#8fbf7a" stroke="#123c47" stroke-width="2"/>
  <g id="labels"></g>
  <g id="pins"></g>
</svg>`;

  const MAP_CSS = `
  .mapwrap{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(0,1fr);gap:18px;align-items:start}
  @media (max-width:760px){.mapwrap{grid-template-columns:1fr}}
  .mapbox{background:var(--shell);border:3px solid var(--ink);border-radius:16px;overflow:hidden;box-shadow:5px 5px 0 var(--ink);position:sticky;top:8px}
  @media (max-width:760px){.mapbox{position:static}}
  #leo{display:block;width:100%;height:auto}
  #leo .counties path{cursor:pointer}
  #leo .counties path.sel{stroke-width:6}
  #leo .lbl{font:800 16px Figtree,sans-serif;fill:#123c47;text-anchor:middle;pointer-events:none;paint-order:stroke;stroke:#fffbf2;stroke-width:5px;stroke-linejoin:round}
  #leo .lbl.small{font-size:13px}
  #leo .cnt{font:800 14px Figtree,sans-serif;fill:#123c47;text-anchor:middle;pointer-events:none;paint-order:stroke;stroke:#fffbf2;stroke-width:4px;stroke-linejoin:round}
  #leo .pin{cursor:pointer;stroke:#123c47;stroke-width:1.5}
  #leo .pin.done{opacity:.35}
  .mapnote{font-size:13px;color:var(--ink-soft);padding:8px 12px;border-top:2px solid var(--ink);background:var(--done)}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 12px}
  .chip{display:inline-flex;align-items:center;gap:7px;border:2px solid var(--ink);background:var(--shell);border-radius:999px;padding:8px 13px;font:700 15px Figtree,sans-serif;color:var(--ink);cursor:pointer;min-height:44px}
  .chip i{width:12px;height:12px;border-radius:50%;border:2px solid var(--ink);display:inline-block}
  .chip[aria-pressed="false"]{opacity:.5;background:transparent}
  .chip em{font-style:normal;font-weight:400;font-size:13px}
  .row2{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px}
  .row2 select{background:var(--shell);border:2px solid var(--ink);border-radius:10px;padding:10px 12px;font:16px Figtree,sans-serif;color:var(--ink);min-height:44px}
  .row2 label{display:flex;gap:8px;align-items:center;font-weight:700;min-height:44px}
  .row2 input{width:20px;height:20px;accent-color:var(--ink)}
  .panel{background:var(--shell);border:2px solid var(--ink);border-radius:14px;padding:14px;box-shadow:5px 5px 0 var(--ink)}
  .panel h2{font-size:20px;margin:0 0 4px}
  .panel .sub{color:var(--ink-soft);font-size:14px;margin-bottom:10px}
  .areas{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
  .areas button{border:2px solid var(--ink);background:var(--pool);border-radius:10px;padding:7px 10px;font:700 14px Figtree,sans-serif;color:var(--ink);cursor:pointer;min-height:40px}
  .areas button.on{background:var(--ink);color:var(--shell)}
  .mi{display:flex;gap:12px;align-items:flex-start;border:2px solid var(--ink);border-radius:12px;padding:11px 12px;margin-bottom:8px;background:var(--shell)}
  .mi.done{background:var(--done)}
  .mi .tick{width:30px;height:30px;border-radius:8px;border:2px solid var(--ink);background:var(--shell);flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;font:800 18px Figtree,sans-serif;color:var(--shell)}
  .mi.done .tick{background:var(--ink)}
  .mi b{display:block;font-size:16px}
  .mi.done b{text-decoration:line-through;text-decoration-color:var(--flamingo);text-decoration-thickness:3px}
  .mi span{display:block;font-size:14px;color:var(--ink-soft)}
  .mi .dot{display:inline-block;width:10px;height:10px;border-radius:50%;border:2px solid var(--ink);margin-right:6px;vertical-align:-1px}
  .mi a{font-size:14px;font-weight:700}
  .mi.flash{box-shadow:0 0 0 4px var(--flamingo)}
  .empty{color:var(--ink-soft);font-size:15px;padding:10px 0}
  .missable{display:inline-block;font-size:12px;font-weight:800;color:var(--shell);background:#b3124a;border-radius:6px;padding:1px 7px;margin-left:6px;vertical-align:2px}`;

  const MAP_JS = `
(function(){
  var KEY = "leonida-tracker-v1", done = {};
  function load(){ try { done = JSON.parse(localStorage.getItem(KEY)) || {}; } catch(e){ done = {}; } }
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(done)); localStorage.setItem("leonida-tracker-updated", String(Date.now())); } catch(e){} }
  load();
  var $ = function(id){ return document.getElementById(id); };
  var BOX = { kelly:[80,120,150,200], lummox:[300,90,150,115], leonard:[450,120,90,260], ambrosia:[275,280,130,105], mariana:[200,465,130,150], vicedale:[365,430,160,155] };
  var data, on = {}, county = "", setF = "", hide = false;
  var esc = function(s){ return String(s).replace(/[&<>"]/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); };
  function visible(){ return data.items.filter(function(i){ return on[i.group] && (!setF || i.set === setF) && (!hide || !done[i.id]); }); }
  function color(g){ for (var k = 0; k < data.groups.length; k++) if (data.groups[k].key === g) return data.groups[k].color; return "#123c47"; }
  function drawPins(){
    var vis = visible(), out = "", lbl = "";
    data.counties.forEach(function(c){
      var b = BOX[c.key], its = vis.filter(function(i){ return i.county === c.key; });
      var all = data.items.filter(function(i){ return on[i.group] && (!setF || i.set === setF) && i.county === c.key; });
      var dn = all.filter(function(i){ return done[i.id]; }).length;
      lbl += '<text class="lbl" x="'+(b[0]+b[2]/2)+'" y="'+(b[1]-16)+'">'+esc(c.label)+'</text>';
      lbl += '<text class="cnt" x="'+(b[0]+b[2]/2)+'" y="'+(b[1]+1)+'">'+dn+' / '+all.length+'</text>';
      var n = its.length; if (!n) return;
      var cols = Math.max(1, Math.ceil(Math.sqrt(n * b[2] / b[3]))), rows = Math.ceil(n / cols);
      var sp = Math.min(b[2] / cols, (b[3] - 10) / rows, 22), r = Math.max(2.5, Math.min(7, sp * 0.38));
      its.forEach(function(i, k){
        var x = b[0] + (k % cols + 0.5) * (b[2] / cols), y = b[1] + 12 + (Math.floor(k / cols) + 0.5) * sp;
        out += '<circle class="pin'+(done[i.id]?' done':'')+'" data-id="'+i.id+'" cx="'+x.toFixed(1)+'" cy="'+y.toFixed(1)+'" r="'+r.toFixed(1)+'" fill="'+color(i.group)+'"><title>'+esc(i.name)+'</title></circle>';
      });
    });
    $("pins").innerHTML = out; $("labels").innerHTML = lbl;
    [].forEach.call(document.querySelectorAll("#leo .counties path"), function(p){ p.classList.toggle("sel", p.getAttribute("data-c") === county); });
  }
  function drawList(){
    var vis = visible().filter(function(i){ return county === "none" ? !i.county : (!county || i.county === county); });
    var c = data.counties.filter(function(x){ return x.key === county; })[0];
    $("listTitle").textContent = county === "none" ? "Area not confirmed yet" : c ? c.label : "Everything on the map";
    $("listSub").textContent = county === "none" ? "Confirmed in the checklist, but no county is confirmed yet, so they aren't pinned." : c ? "Around " + c.note + ". Pins show the area, not the exact spot – the note has the location." : "Pick an area on the map or below to narrow the list.";
    var h = vis.slice(0, 300).map(function(i){
      return '<div class="mi'+(done[i.id]?' done':'')+'" id="m-'+i.id+'"><button class="tick" data-id="'+i.id+'" aria-pressed="'+(!!done[i.id])+'" aria-label="Mark '+esc(i.name)+' as done">'+(done[i.id]?'✓':'')+'</button><div><b><i class="dot" style="background:'+color(i.group)+'"></i>'+esc(i.name)+(i.missable?'<em class="missable">Missable</em>':'')+'</b><span>'+esc(i.note)+'</span><a href="/#'+i.id+'">Show in checklist</a></div></div>';
    }).join("");
    if (vis.length > 300) h += '<p class="empty">Showing the first 300 – pick an area to see the rest.</p>';
    $("mlist").innerHTML = h || '<p class="empty">Nothing here with the current filters.</p>';
  }
  function drawAreas(){
    var vis = visible();
    var h = '<button data-a=""'+(county===""?' class="on"':'')+'>All areas</button>' + data.counties.map(function(c){
      return '<button data-a="'+c.key+'"'+(county===c.key?' class="on"':'')+'>'+esc(c.label)+' ('+vis.filter(function(i){return i.county===c.key;}).length+')</button>';
    }).join("") + '<button data-a="none"'+(county==="none"?' class="on"':'')+'>Area not confirmed ('+vis.filter(function(i){return !i.county;}).length+')</button>';
    $("areas").innerHTML = h;
  }
  function drawChips(){
    $("chips").innerHTML = data.groups.map(function(g){
      var n = data.items.filter(function(i){ return i.group === g.key; }), d = n.filter(function(i){ return done[i.id]; }).length;
      return '<button class="chip" data-g="'+g.key+'" aria-pressed="'+(!!on[g.key])+'"><i style="background:'+g.color+'"></i>'+esc(g.label)+' <em>'+d+'/'+n.length+'</em></button>';
    }).join("");
  }
  function all(){ drawChips(); drawPins(); drawAreas(); drawList(); }
  function toggle(id){ if (done[id]) delete done[id]; else done[id] = 1; save(); all(); }
  document.addEventListener("click", function(e){
    var t = e.target.closest ? e.target : null; if (!t) return;
    var tick = t.closest(".tick"); if (tick) { toggle(tick.getAttribute("data-id")); return; }
    var chip = t.closest(".chip"); if (chip) { var g = chip.getAttribute("data-g"); on[g] = !on[g]; all(); return; }
    var ar = t.closest("#areas button"); if (ar) { county = ar.getAttribute("data-a"); all(); return; }
    var pin = t.closest(".pin"); if (pin) {
      var id = pin.getAttribute("data-id"), it = data.items.filter(function(i){ return i.id === id; })[0];
      county = it.county; all();
      var row = $("m-" + id); if (row) { row.scrollIntoView({ block: "center" }); row.classList.add("flash"); setTimeout(function(){ row.classList.remove("flash"); }, 1600); }
      return;
    }
    var path = t.closest("#leo .counties path"); if (path) { county = path.getAttribute("data-c"); all(); if (window.innerWidth < 760) $("listTitle").scrollIntoView({ block: "start" }); }
  });
  // /map/#col-117 opens that item's area, makes sure its type is shown, and highlights it
  function focusHash(){
    var id = location.hash.slice(1); if (!data || !id) return;
    var it = data.items.filter(function(i){ return i.id === id; })[0]; if (!it) return;
    on[it.group] = true; if (setF && it.set !== setF) { setF = ""; $("setSel").value = ""; } hide = false; $("hideDone").checked = false;
    county = it.county || "none"; all();
    var row = $("m-" + id); if (row) { row.scrollIntoView({ block: "center" }); row.classList.add("flash"); setTimeout(function(){ row.classList.remove("flash"); }, 1800); }
  }
  window.addEventListener("hashchange", focusHash);
  $("setSel").addEventListener("change", function(){ setF = this.value; if (setF) on.card = true; all(); });
  $("hideDone").addEventListener("change", function(){ hide = this.checked; all(); });
  window.addEventListener("storage", function(e){ if (e.key === KEY) { load(); all(); } });
  window.addEventListener("pageshow", function(){ if (data) { load(); all(); } });
  fetch("/map-data.json").then(function(r){ return r.json(); }).then(function(d){
    data = d; d.groups.forEach(function(g){ on[g.key] = true; });
    var sets = []; d.items.forEach(function(i){ if (i.set && sets.indexOf(i.set) < 0) sets.push(i.set); });
    $("setSel").innerHTML = '<option value="">All card sets</option>' + sets.sort().map(function(s){ return '<option>'+esc(s)+'</option>'; }).join("");
    all(); $("loading").style.display = "none"; focusHash();
  }).catch(function(){ $("loading").textContent = "The map data didn't load. Check your connection and refresh – your checklist still works as normal."; });
})();`;

  pages.push({ slug: "map", sitemap: true, html: shell({
    slug: "map", title: "GTA 6 Interactive Map: Cocaine Flamingos, Cards, Stunt Jumps & More",
    description: `Unofficial interactive GTA 6 map – Cocaine Flamingos, trading cards, stunt jumps, garages, bank jobs, WAiNK scans and shipwrecks by county, synced with your checklist.`,
    ogType: "website", ctaHash: "", ld: [crumbsLD("Map", `${SITE}/map/`)],
    head: `<style>${MAP_CSS}</style>`,
    content: `
  <div class="crumbs"><a href="/">Leonida Tracker</a> › Map</div>
  <h1>GTA 6 map: collectibles and locations</h1>
  <p class="lead">Filter by what you're hunting, pick an area, and tick things off. Ticks here and in the checklist are the same – do one and the other updates.</p>
  <div class="chips" id="chips" aria-label="Show on the map"></div>
  <div class="row2">
    <select id="setSel" aria-label="Card set"><option value="">All card sets</option></select>
    <label><input type="checkbox" id="hideDone"> Hide what I've done</label>
  </div>
  <div class="mapwrap">
    <div class="mapbox">
      ${MAP_SVG}
      <p class="mapnote"><b>Unofficial schematic map – not to scale.</b> Counties are drawn from community mapping, and pins are grouped by county, so they show the area rather than the exact spot. Each item's note gives the location. ${placed} of ${mapItems.length} items have a confirmed county.</p>
    </div>
    <section class="panel">
      <p id="loading" class="empty">Loading the map…</p>
      <div class="areas" id="areas"></div>
      <h2 id="listTitle">Everything on the map</h2>
      <p class="sub" id="listSub"></p>
      <div id="mlist"></div>
    </section>
  </div>
  <script>${MAP_JS}</script>`
  }) });

  /* ---------------- Best setup (gear) page ---------------- */
  const gear = [
    ["A comfortable headset", "Long sessions are easier with a headset that doesn't pinch. A wired one plugs straight into the 3.5mm jack on a DualSense or Xbox controller; wireless ones need their own dongle or console support, so check the box says PS5 or Xbox Series X|S.", [["PS5 gaming headsets", "ps5 gaming headset"], ["Xbox Series X|S headsets", "xbox series x headset"]]],
    ["A second controller and a charger", "A spare controller on charge means you never stop mid-heist for a flat battery. A two-controller charging dock keeps both topped up.", [["DualSense controllers", "ps5 dualsense controller"], ["Xbox Wireless Controllers", "xbox wireless controller"], ["DualSense charging stations", "dualsense charging station"]]],
    ["More storage", "On PS5 you can add an M.2 NVMe SSD inside the console – Sony asks for a PCIe Gen4 drive, recommends 5,500MB/s or faster, and says to use a heatsink. On Xbox Series X|S, games run from internal storage or an official Storage Expansion Card; an ordinary USB drive can hold Series X|S games but not run them.", [["PS5 M.2 SSDs with heatsink", "ps5 m.2 ssd heatsink 2tb"], ["Xbox Series storage expansion cards", "xbox series x storage expansion card"]]],
    ["A TV or monitor you can read text on", "Map labels, phone messages and the checklist all mean a lot of small text. Pick a screen size that suits how far away you sit – and if you play at a desk, a monitor can be easier on the eyes than a TV across the room.", [["4K TVs", "4k tv"], ["Gaming monitors", "gaming monitor 27 inch"]]],
    ["A chair you can sit in for hours", "100% runs take a long time. A supportive chair with adjustable height makes a real difference over a weekend of collectible hunting.", [["Gaming chairs", "gaming chair"], ["Ergonomic office chairs", "ergonomic office chair"]]],
    ["A stand for your phone or tablet", "Prop the tracker up next to the TV so you can tick things off without picking your phone up.", [["Phone and tablet stands", "phone tablet stand adjustable"]]]
  ];
  pages.push({ slug: "gta-6-best-setup", sitemap: true, html: shell({
    slug: "gta-6-best-setup", title: "Best Setup for a GTA 6 100% Run: Headset, Controller, Storage & More",
    description: "What's worth having for a long GTA 6 completion run – headset, spare controller, storage, screen, chair and a stand for the tracker.",
    ld: [crumbsLD("Best setup", `${SITE}/gta-6-best-setup/`)],
    content: `
  <div class="crumbs"><a href="/">Leonida Tracker</a> › Best setup</div>
  <article>
  <h1>Best setup for a GTA 6 100% run</h1>
  <p class="answer"><b>For a long completion run, the things that make the most difference are comfort and not running out of charge:</b> a headset you can wear for hours, a spare controller on charge, enough storage, a screen you can read small text on, and a decent chair.</p>
  <p class="note" style="margin:8px 0 18px"><b>Affiliate disclosure:</b> the links below go to Amazon UK. As an Amazon Associate I earn from qualifying purchases – it doesn't cost you anything extra and it helps keep the tracker free. We don't list specific models we haven't checked; the links open Amazon searches so you can compare current prices and reviews.</p>
  ${gear.map(([t, d, links], k) => `<h2>${esc(t)}</h2><p>${esc(d)}</p><p>${links.map(([lt, q]) => `<a class="cta ghost" style="margin:4px 6px 4px 0;white-space:normal" href="${amazon(q)}" target="_blank" rel="sponsored nofollow noopener">${esc(lt)} on Amazon</a>`).join("")}</p>${k === 2 ? AD_SLOT("between gear sections") : ""}`).join("")}
  </article>
  <div class="box"><h2>Ready to start?</h2><p>The checklist is free and saves on your device.</p><a class="cta" href="/">Open the tracker</a></div>
  ${AD_SLOT("end of gear page")}`
  }) });

  /* ---------------- Shareable progress card ---------------- */
  pages.push({ slug: "progress", sitemap: false, html: shell({
    slug: "progress", title: "My GTA 6 progress", noindex: true, ogType: "website",
    description: "See how far through GTA 6 this player is – and track your own 100% run for free.",
    head: `<style>
  .pcard{background:var(--shell);border:3px solid var(--ink);border-radius:18px;box-shadow:7px 7px 0 var(--ink);overflow:hidden;max-width:560px;margin:18px 0}
  .pcard .top{background:linear-gradient(#ffcf3d,#ff8a3d);padding:22px 20px 18px;border-bottom:3px solid var(--ink)}
  .pcard .big{font-family:Bungee,sans-serif;font-size:72px;line-height:1;color:var(--shell);text-shadow:4px 4px 0 var(--ink)}
  .pcard .top p{font-weight:800;font-size:20px}
  .pcard ul{list-style:none;padding:14px 20px 18px}
  .pcard li{display:flex;justify-content:space-between;font-size:17px;padding:8px 0;border-bottom:2px dashed rgba(18,60,71,.2)}
  .pcard li b{font-weight:800}
</style>`,
    content: `
  <h1>Someone's GTA 6 progress</h1>
  <div class="pcard" id="pcard"><div class="top"><div class="big" id="pp">–</div><p>of GTA 6 done</p></div><ul id="plist"><li>This link doesn't include any progress.</li></ul></div>
  <p class="lead">Tracked with Leonida Tracker – a free GTA 6 100% checklist. No account needed.</p>
  <p style="margin-top:14px"><a class="cta" href="/">Start your own checklist</a></p>
  <script>
  (function(){
    var q = {}; location.hash.slice(1).split("&").forEach(function(p){ var kv = p.split("="); if (kv[0]) q[kv[0]] = decodeURIComponent(kv[1] || ""); });
    var num = function(v){ return /^\\d{1,4}$/.test(v || "") ? +v : null; };
    var pct = num(q.p); if (pct === null || pct > 100) return;
    document.getElementById("pp").textContent = pct + "%";
    var rows = [["m","Story missions"],["t","Trophies"],["c","Collectibles"],["h","Cheats unlocked"]], out = "";
    rows.forEach(function(r){ var v = (q[r[0]] || "").split("-"); var a = num(v[0]), b = num(v[1]); if (a !== null && b && a <= b) out += "<li><span>" + r[1] + "</span><b>" + a + " / " + b + "</b></li>"; });
    document.getElementById("plist").innerHTML = out || "<li>Overall progress only</li>";
  })();
  </script>`
  }) });

  /* ---------------- Tell us (Netlify Forms) ---------------- */
  pages.push({ slug: "tell-us", sitemap: false, html: shell({
    slug: "tell-us", title: "Tell us about a missing or wrong location", noindex: true,
    description: "Spotted something we missed or got wrong? Let us know and we'll check it against our sources.",
    content: `
  <h1>Tell us what we missed</h1>
  <p class="lead">Spotted a location we haven't got, or something that's wrong? Tell us and we'll check it before adding it. No account needed.</p>
  <form name="feedback" method="POST" action="/tell-us/thanks/" data-netlify="true" netlify-honeypot="company" class="box" style="max-width:620px">
    <input type="hidden" name="form-name" value="feedback">
    <p style="display:none"><label>Leave this empty <input name="company"></label></p>
    <input type="hidden" name="page" id="pageField">
    <p><label><b>What's it about?</b><br>
      <select name="type" style="width:100%;margin-top:6px;padding:10px;border:2px solid var(--ink);border-radius:10px;font:16px Figtree,sans-serif">
        <option>A location we're missing</option><option>Something that's wrong</option><option>A cheat code</option><option>Something else</option>
      </select></label></p>
    <p style="margin-top:12px"><label><b>Details</b><br>
      <textarea name="details" required rows="6" style="width:100%;margin-top:6px;padding:10px;border:2px solid var(--ink);border-radius:10px;font:16px Figtree,sans-serif" placeholder="What is it and where? A landmark or nearby street helps."></textarea></label></p>
    <p style="margin-top:12px"><label><b>Your email</b> (optional, only if you'd like a reply)<br>
      <input type="email" name="email" style="width:100%;margin-top:6px;padding:10px;border:2px solid var(--ink);border-radius:10px;font:16px Figtree,sans-serif"></label></p>
    <p style="margin-top:14px"><button class="cta" type="submit" style="border-color:var(--ink);cursor:pointer;font-family:inherit">Send it</button></p>
  </form>
  <script>try { document.getElementById("pageField").value = new URLSearchParams(location.search).get("page") || document.referrer || ""; } catch(e){}</script>`
  }) });
  pages.push({ slug: "tell-us/thanks", sitemap: false, html: shell({
    slug: "tell-us/thanks", title: "Thanks – we got it", noindex: true, description: "Thanks for the tip.",
    content: `<h1>Thanks – we got it</h1><p class="lead">We'll check it against our sources and add it if it's confirmed.</p><p style="margin-top:14px"><a class="cta" href="/">Back to the tracker</a></p>`
  }) });

  return { pages, files };
};
