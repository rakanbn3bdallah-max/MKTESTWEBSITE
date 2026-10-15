# Rakan's World 301

MKT301 Consumer Behavior study site: slides, textbook chapters and the in-scope test bank.

- `index.html`: the site. `page.html` is the same page in the claude.ai artifact format.
- `api/`: Vercel functions for username + password accounts that save each student's progress.
  - `GET/POST/DELETE /api/session`: who is signed in / sign in or create an account / sign out
  - `PUT /api/progress`: save progress
  Passwords are hashed with scrypt. Sessions are random tokens in an HttpOnly cookie that lasts 90 days.

## Deploy on Vercel

1. Push this folder to a GitHub repo. A **private** repo is fine and is better here, because the folder has textbook pages.
2. On vercel.com: **Add New → Project**, import the repo. Framework preset: **Other**. Leave build settings empty.
3. In the project: **Storage → Create Database → Upstash for Redis** (the free plan is enough), and connect it to the project.
   This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically.
4. **Deployments → Redeploy** so the functions pick up the new variables.

Until step 3 is done, the site works but Create Account says "Accounts are not set up on the server yet."

## Run locally

`node ../tools/dev_server.js` from this folder (or `node tools/dev_server.js` from the project root), then open http://localhost:3000.
It keeps accounts in memory, so they reset when the server stops.
