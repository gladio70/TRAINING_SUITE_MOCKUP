// Solo per le prove sul PC (npx vite --mode api): esegue le funzioni di functions/api/
// dentro il server di sviluppo, con un database SQLite in memoria al posto di Cloudflare D1.
// Non finisce nella app pubblicata.
import { DatabaseSync } from 'node:sqlite';

/** Imitazione minima dell'interfaccia D1 usata dalle funzioni */
export function creaD1() {
  const sql = new DatabaseSync(':memory:');
  const prepara = (testo) => {
    let args = [];
    const st = {
      bind: (...a) => ((args = a), st),
      run: async () => ({ meta: { changes: sql.prepare(testo).run(...args).changes } }),
      first: async (col) => {
        const r = sql.prepare(testo).get(...args) ?? null;
        return col ? (r ? r[col] ?? null : null) : r ? { ...r } : null;
      },
      all: async () => ({ results: sql.prepare(testo).all(...args).map((r) => ({ ...r })) }),
    };
    return st;
  };
  return { prepare: prepara, batch: async (lista) => Promise.all(lista.map((s) => s.run())) };
}

export function apiLocale({ codiceAttivazione = 'prova-locale' } = {}) {
  const env = { DB: creaD1(), CODICE_ATTIVAZIONE: codiceAttivazione };
  return {
    name: 'api-locale',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        const m = url.pathname.match(/\/api\/([a-z]+)$/);
        if (!m) return next();
        try {
          const mod = await import(new URL(`../functions/api/${m[1]}.js`, import.meta.url).href);
          const pezzi = [];
          for await (const p of req) pezzi.push(p);
          const corpo = Buffer.concat(pezzi);
          const request = new Request(url, {
            method: req.method,
            headers: { ...req.headers, 'cf-connecting-ip': '127.0.0.1' },
            body: ['GET', 'HEAD'].includes(req.method) ? undefined : corpo,
          });
          const r = await mod.onRequest({ request, env });
          res.statusCode = r.status;
          r.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await r.arrayBuffer()));
        } catch (e) {
          res.statusCode = 500;
          res.end(String(e));
        }
      });
    },
  };
}
