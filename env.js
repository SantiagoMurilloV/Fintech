// Deploy-time configuration, loaded before the app modules (see index.html).
//
// Locally this file stays as committed and the app talks to the backend on
// localhost:8000. On Vercel, scripts/build.mjs overwrites it with the API_BASE
// environment variable so the deployed front points at the deployed API.
window.__API_BASE__ = '';
