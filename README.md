# Rakan's World 301

Study site for MKT301 Consumer Behavior (KSU, Fall 2026): every slide, the matching textbook chapters,
and the in-scope test-bank questions with slide-first explanations.

- `site/`: the deployable site (static pages + Vercel functions in `site/api/`). See `site/README.md`.
- `tools/`: Node.js / PowerShell scripts that build `site/data.js`, `site/book.js` and `site/index.html`.
- `workflows/build_study_site.md`: how the site is built and updated.

## Deploy (Vercel)

Import this repo on vercel.com and leave **Root Directory empty**: the root `vercel.json` serves `site/`, and `api/` forwards to `site/api/`.
Accounts need an Upstash Redis store connected to the project; details in `site/README.md`.
