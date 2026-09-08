# Mandioca — Frontend (PWA)

B2B financial panel with a conversational agent, installable as a **PWA**.
This repository is only the visual layer: components, hooks, hash routing,
service worker and manifest. **It processes no data**: every computation,
parsing step and aggregation happens in the backend, and the frontend paints
what it receives.

| Repository | Contents | Deployed on |
|---|---|---|
| [`Fintech`](https://github.com/SantiagoMurilloV/Fintech) (this one) | PWA (ES modules, no bundler) | Vercel |
| [`Fintech_back`](https://github.com/SantiagoMurilloV/Fintech_back) | FastAPI API + PostgreSQL | Railway |

## Layout

```
index.html · manifest.webmanifest · service-worker.js · env.js
icons/  styles/  (tokens, base, components)
src/
├── main.js · App.js · config.js
├── core/        runtime.js (vDOM + hooks) · api.js · router.js · pwa.js
├── components/  DataTable · EditableCell · Badge · Sidebar · AgentDock · blocks/ …
├── views/       Agent · Orders · Expenses · Reports · Library · Users · Settings · Login
├── modals/      NewOrder · NewExpense · Import
├── hooks/       useAsync · useAuth · useChat · useRowEdits …
└── lib/         format.js (formatting) · labels.js (UI texts) · columns.js (dynamic columns)
```

Convention: code, identifiers, comments, commit messages and documentation in
English; every text the user sees in Spanish (Colombia, formal register).

## Running locally

```bash
python3 -m http.server 3000        # or: npm run dev
# open http://localhost:3000 with the backend running on http://localhost:8000
```

`src/config.js` resolves the API URL in this order: `window.__API_BASE__`
(written in `env.js`), `localStorage['fa.apiBase']`, and
`http://localhost:8000`.

## Deploying on Vercel

The repository ships `vercel.json` and `scripts/build.mjs`. The build bundles
nothing: it copies the site into `dist/` and writes `env.js` with the backend
URL taken from the `API_BASE` variable.

1. **Add New → Project → Import** `SantiagoMurilloV/Fintech`. Framework:
   *Other*; the build command and output directory come from `vercel.json`.
2. Environment variable `API_BASE=https://<backend-domain>.up.railway.app`
   (no trailing slash).
3. In the backend (Railway) add the Vercel domain to `CORS_ORIGINS`.

Every frontend change bumps `APP_VERSION` in `src/config.js` and `VERSION` in
`service-worker.js` together: the service worker drops the previous cache and
the sidebar shows the version the browser is running.
