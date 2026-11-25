# Leonida Tracker

Unofficial GTA 6 completion tracker – https://leonida-tracker.com

## How it's built
- `index.html` is the tracker. **All item data lives in the DATA section near the top of its script** (REGIONS + CATEGORIES). Never change an existing item id once live – players' ticks are keyed on ids.
- `build.js` runs on Netlify (`netlify.toml`) and writes `dist/`: a copy of the tracker with "Full lists" links filled in, one SEO page per category that has real items (e.g. `/gta-6-missions/`), and `sitemap.xml`. Category pages update automatically whenever `index.html` changes – don't edit `dist/` (it isn't committed).
- Items made by `placeholders()` are flagged `placeholder: true` and are left off the category pages.
- Run `node build.js` locally before pushing data changes: it fails on duplicate ids or a broken DATA section.

## Guides (question pages)
- Each file in `guides/` becomes a page at `/<file-name>/` (e.g. `guides/gta-6-stunt-jumps.html` → `/gta-6-stunt-jumps/`) and is listed on `/guides/`, in the sitemap and in `llms.txt`.
- A guide starts with a `<!--meta {JSON} -->` header (title, h1, description, answer, cat, published, related, faq), followed by the HTML body. Copy an existing guide as a template.
- Use data tokens instead of typing numbers, so pages stay correct as the data grows: `{{count:CAT}}`, `{{count:CAT:PATTERN}}`, `{{table:CAT:PATTERN}}`, `{{sumnum:CAT:PATTERN}}`, `{{sumcash:CAT:PATTERN}}`, `{{chapters}}`, `{{tiers}}`, `{{updated}}` (full details at the top of `build.js`).
- Only state facts that are in the tracker data or confirmed by two independent sources (note them in SOURCES.md). Write everything in your own words.
- Don't paste a full category table into a guide – link to the list page instead (avoids duplicate content).

## Added 25 Nov 2026
- **Map** (`/map/`, built by `extras.js`): our own schematic county map – no Rockstar map art. Pins come from `dist/map-data.json`, grouped by the county/region named in each item's note (pins show the area, not the exact spot; items without a confirmed county are listed as "Area not confirmed yet"). Ticks use the same browser storage as the tracker, so they stay in step. `/#<item-id>` on the tracker and `/map/#<item-id>` deep-link to an item.
- **Missables**: any item whose note says "missable", "can't be reached after" or "Chapter 1 only" is flagged and listed in the "Missable – do these first" box. Write notes that way to flag new ones.
- **Optional sync** (`netlify/functions/sync.mjs`, Netlify Blobs): no account – a random 12-character code stores only the list of ticked ids. The tracker hides the sync box unless `/api/sync/health` answers.
- **Pro tier**: hooks only, hidden (`PRO.enabled = false` in index.html). TODO: decide pricing before enabling.
- **Ads**: AdSense ad units are NOT live. Placeholder comments marked `AD SLOT` show where they'd go (below the homepage hero, between panels, between guide sections, end of guides, gear page). Never place one inside the checklist or over the map.
- **Pages**: `/gta-6-best-setup/` (Amazon UK), `/progress/` (share card, numbers travel in the link), `/tell-us/` (Netlify Forms – enable form detection in Netlify).
- **Guide tokens**: `{{bycounty:CAT:PATTERN}}` groups a table by county; `{{cardsets}}` lists every card set with its confirmed card locations.

## Design pass 25 Nov 2026
- Update banner: the homepage headline lives in `<b id="updateHeadline">` (keep it under ~8 words), with the full details in `#notice` below it. `/banner/` (not linked) makes matching images for social posts from that headline.
- Story missions are grouped under chapter headings; notes never show "map region to be confirmed" (stripped at render/build), so the region only appears once one is confirmed in the data.
- Guide graphics are all inline SVG built by `build.js`: thumbnails (meta `icon`), stat cards (meta `stats`), route diagrams (`{{route:CAT:TITLE::PATTERN}}`). Product pictures are our own illustrations in `art/products.json`.
- Map pins: pink = to do, teal = done, yellow = missable.
