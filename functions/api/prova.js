// Prova del database Cloudflare D1 (solo sul sito training-suite-mockup.pages.dev).
// Cloudflare Pages trasforma i file nella cartella functions/ in piccole API sul server:
// questo file risponde all'indirizzo /api/prova.
//   GET  /api/prova → quante prove sono state registrate e le ultime 5
//   POST /api/prova → registra una prova (data, tipo di dispositivo, versione dell'app)
// Il database è collegato al progetto Pages con il nome "DB" (Impostazioni → Bindings).
// Non salva dati personali: solo data e ora, "telefono"/"PC" e il numero di versione.

const json = (dati, stato = 200) =>
  new Response(JSON.stringify(dati), { status: stato, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequest({ request, env }) {
  if (!env.DB) return json({ ok: false, errore: 'Database non collegato al progetto (manca il collegamento "DB").' }, 503);
  if (request.method !== 'GET' && request.method !== 'POST') return json({ ok: false, errore: 'Metodo non ammesso' }, 405);

  try {
    // la tabella si crea da sola alla prima chiamata
    await env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS prove (id INTEGER PRIMARY KEY AUTOINCREMENT, quando TEXT NOT NULL, dispositivo TEXT, versione TEXT)',
    ).run();

    if (request.method === 'POST') {
      const corpo = await request.json().catch(() => ({}));
      const dispositivo = corpo.dispositivo === 'telefono' ? 'telefono' : 'PC';
      const versione = String(corpo.versione ?? '').slice(0, 20);
      await env.DB.prepare('INSERT INTO prove (quando, dispositivo, versione) VALUES (?1, ?2, ?3)')
        .bind(new Date().toISOString(), dispositivo, versione)
        .run();
    }

    const totale = await env.DB.prepare('SELECT COUNT(*) AS n FROM prove').first('n');
    const { results } = await env.DB.prepare('SELECT quando, dispositivo, versione FROM prove ORDER BY id DESC LIMIT 5').all();
    return json({ ok: true, totale, ultime: results });
  } catch (e) {
    return json({ ok: false, errore: `Errore del database: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
}
