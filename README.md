# Leonida Tracker

Unofficial GTA 6 completion tracker – https://leonida-tracker.com

## How it's built
- `index.html` is the tracker. **All item data lives in the DATA section near the top of its script** (REGIONS + CATEGORIES). Never change an existing item id once live – players' ticks are keyed on ids.
- `build.js` runs on Netlify (`netlify.toml`) and writes `dist/`: a copy of the tracker with "Full lists" links filled in, one SEO page per category that has real items (e.g. `/gta-6-missions/`), and `sitemap.xml`. Category pages update automatically whenever `index.html` changes – don't edit `dist/` (it isn't committed).
- Items made by `placeholders()` are flagged `placeholder: true` and are left off the category pages.
- Run `node build.js` locally before pushing data changes: it fails on duplicate ids or a broken DATA section.
