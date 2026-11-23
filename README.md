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
