// Prova del database Cloudflare D1 (solo sul sito training-suite-mockup.pages.dev).
// Cloudflare Pages trasforma i file nella cartella functions/ in piccole API sul server:
// questo file risponde all'indirizzo /api/prova.
//   GET  /api/prova → quante prove sono state registrate e le ultime 5
//   POST /api/prova → registra una prova (data, tipo di dispositivo, versione dell'app, indirizzo IP)
// Il database è collegato al progetto Pages con il nome "DB" (Impostazioni → Bindings).
// Nessun dato dei clienti. L'indirizzo IP (dato personale per il GDPR) è salvato su richiesta
// di Claudio solo per questa prova interna: in TEST e PROD andranno previsti informativa e conservazione.

const json = (dati, stato = 200) =>
  new Response(JSON.stringify(dati), { status: stato, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

/** Crea la tabella alla prima chiamata e aggiunge la colonna ip alle tabelle create prima della 0.3.16 */
async function preparaTabella(db) {
  await db.prepare(
    'CREATE TABLE IF NOT EXISTS prove (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT NOT NULL, dispositivo TEXT, versione TEXT, ip TEXT)',
  ).run();
  const { results: colonne } = await db.prepare('PRAGMA table_info(prove)').all();
  if (!colonne.some((c) => c.name === 'ip')) await db.prepare('ALTER TABLE prove ADD COLUMN ip TEXT').run();
}

export async function onRequest({ request, env }) {
  if (!env.DB) return json({ ok: false, errore: 'Database non collegato al progetto (manca il collegamento "DB").' }, 503);
  if (request.method !== 'GET' && request.method !== 'POST') return json({ ok: false, errore: 'Metodo non ammesso' }, 405);

  try {
    await preparaTabella(env.DB);

    if (request.method === 'POST') {
      const corpo = await request.json().catch(() => ({}));
      const dispositivo = corpo.dispositivo === 'telefono' ? 'telefono' : 'PC';
      const versione = String(corpo.versione ?? '').slice(0, 20);
      const ip = (request.headers.get('CF-Connecting-IP') ?? '').slice(0, 45); // 45 = lunghezza massima di un IPv6
      await env.DB.prepare('INSERT INTO prove (quando, dispositivo, versione, ip) VALUES (?1, ?2, ?3, ?4)')
        .bind(new Date().toISOString(), dispositivo, versione, ip || null)
        .run();
    }

    const totale = await env.DB.prepare('SELECT COUNT(*) AS n FROM prove').first('n');
    const { results } = await env.DB.prepare('SELECT quando, dispositivo, versione, ip FROM prove ORDER BY id DESC LIMIT 5').all();
    return json({ ok: true, totale, ultime: results });
  } catch (e) {
    return json({ ok: false, errore: `Errore del database: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
}
