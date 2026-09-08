#!/usr/bin/env node
/**
 * Build step for static hosting (Vercel).
 *
 * The app has no bundler: this copies the site into dist/ as-is and writes
 * env.js with the API base URL taken from the API_BASE environment variable,
 * so the same code points at the local backend in development and at the
 * deployed one in production.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = resolve(root, 'dist');

// Everything the browser fetches; scripts/ and config files stay out.
const SITE = ['index.html', 'manifest.webmanifest', 'service-worker.js', 'icons', 'styles', 'src'];

const apiBase = (process.env.API_BASE || '').trim().replace(/\/+$/, '');
if (!apiBase) {
  console.warn('API_BASE is not set: the deployed app will look for the API on localhost:8000.');
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const entry of SITE) {
  cpSync(resolve(root, entry), resolve(out, entry), { recursive: true });
}
writeFileSync(
  resolve(out, 'env.js'),
  `// Generated at build time by scripts/build.mjs — do not edit.\nwindow.__API_BASE__ = ${JSON.stringify(apiBase)};\n`,
);
console.log(`dist/ ready · API_BASE=${apiBase || '(unset)'}`);
