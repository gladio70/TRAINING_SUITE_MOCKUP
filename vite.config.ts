import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

// Versione della app: numero da package.json + identificativo della build
// (commit su GitHub Actions o Cloudflare Pages, altrimenti data e ora della compilazione locale).
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8').replace(/^﻿/, ''));
const adesso = new Date();
const versione = {
  versione: pkg.version as string,
  build: (process.env.GITHUB_SHA ?? process.env.CF_PAGES_COMMIT_SHA ?? '').slice(0, 7) ||`locale-${adesso.getTime().toString(36)}`,
  data: adesso.toISOString(),
};

// Pubblica version.json accanto alla app: il telefono lo legge all'apertura
// per sapere se sul server c'è una build più nuova di quella che sta usando.
const fileVersione: Plugin = {
  name: 'file-versione',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify(versione, null, 2) });
    // service worker con il codice della build: a ogni pubblicazione cambia, il telefono lo aggiorna e svuota la cache vecchia
    const sw = readFileSync(new URL('./pwa/sw.js', import.meta.url), 'utf8').replace(/__BUILD__/g, versione.build);
    this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
  },
};

export default defineConfig(async ({ mode }) => ({
  plugins: [
    react(),
    fileVersione,
    // "vite --mode api": prova sul PC delle API di Cloudflare (login, database) con un database in memoria
    ...(mode === 'api' ? [(await import('./dev/api-locale.mjs')).apiLocale()] : []),
  ],
  base: './',
  define: { __VERSIONE__: JSON.stringify(versione) },
  server: { port: 5173, strictPort: true },
}));
