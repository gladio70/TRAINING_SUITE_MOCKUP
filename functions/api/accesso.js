// Accesso con utente e password (solo sul sito Cloudflare training-suite-mockup.pages.dev).
// Prova tecnica della login che servirà in TEST e PROD: sul mockup blocca l'interfaccia,
// ma i dati dei clienti restano quelli dimostrativi salvati nel browser.
//
//   GET  /api/accesso                         → chi ha fatto l'accesso (o nessuno) e se esistono utenti
//   POST /api/accesso {azione:'entra', email, password}
//   POST /api/accesso {azione:'esci'}
//   POST /api/accesso {azione:'crea', codice, nome, email, password}  → nuovo utente (serve il codice di attivazione)
//
// Sicurezza:
// - le password non sono salvate: si salva solo un'impronta PBKDF2-SHA256 con sale casuale;
// - la sessione è un codice casuale in un cookie HttpOnly/Secure/SameSite=Strict (JavaScript non lo legge);
//   nel database c'è solo l'impronta SHA-256 del codice, che scade dopo 30 giorni;
// - dopo 5 tentativi sbagliati in 15 minuti dallo stesso indirizzo IP le prove si bloccano;
// - il codice di attivazione è un segreto del progetto Cloudflare (CODICE_ATTIVAZIONE), non sta nel codice.

const ITERAZIONI = 100_000; // massimo consentito da Cloudflare Workers per PBKDF2
const DURATA_SESSIONE_GIORNI = 30;
const MAX_TENTATIVI = 5;
const FINESTRA_MINUTI = 15;
const COOKIE = 'ts_sessione';

const json = (dati, stato = 200, intestazioni = {}) =>
  new Response(JSON.stringify(dati), {
    status: stato,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...intestazioni },
  });

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const daHex = (s) => new Uint8Array(s.match(/../g).map((h) => parseInt(h, 16)));
const casuale = (n) => crypto.getRandomValues(new Uint8Array(n));
const sha256 = async (testo) => hex(await crypto.subtle.digest('SHA-256', enc.encode(testo)));

async function impronta(password, sale, iterazioni) {
  const chiave = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sale, iterations: iterazioni }, chiave, 256));
}

/** Confronto a tempo costante (non rivela quanti caratteri iniziali coincidono) */
function uguali(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function preparaTabelle(db) {
  await db.batch([
    db.prepare(
      'CREATE TABLE IF NOT EXISTS utenti (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE, nome TEXT NOT NULL, impronta TEXT NOT NULL, sale TEXT NOT NULL, iterazioni INTEGER NOT NULL, creato TEXT NOT NULL)',
    ),
    db.prepare(
      'CREATE TABLE IF NOT EXISTS sessioni (codice TEXT PRIMARY KEY, utente_id INTEGER NOT NULL, creata TEXT NOT NULL, scade TEXT NOT NULL, ip TEXT)',
    ),
    db.prepare('CREATE TABLE IF NOT EXISTS tentativi (ip TEXT NOT NULL, quando TEXT NOT NULL)'),
  ]);
}

const leggiCookie = (request) => {
  const riga = request.headers.get('Cookie') ?? '';
  const m = riga.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([a-f0-9]{64})`));
  return m ? m[1] : null;
};

const cookieSessione = (codice) =>
  `${COOKIE}=${codice}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${DURATA_SESSIONE_GIORNI * 86400}`;
const cookieCancellato = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

async function utenteDellaSessione(db, request) {
  const codice = leggiCookie(request);
  if (!codice) return null;
  return db
    .prepare('SELECT u.id, u.email, u.nome FROM sessioni s JOIN utenti u ON u.id = s.utente_id WHERE s.codice = ? AND s.scade > ?')
    .bind(await sha256(codice), new Date().toISOString())
    .first();
}

async function apriSessione(db, utenteId, ip) {
  const codice = hex(casuale(32));
  const ora = new Date();
  const scade = new Date(ora.getTime() + DURATA_SESSIONE_GIORNI * 86400_000);
  await db
    .prepare('INSERT INTO sessioni (codice, utente_id, creata, scade, ip) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(codice), utenteId, ora.toISOString(), scade.toISOString(), ip || null)
    .run();
  return codice;
}

async function troppiTentativi(db, ip) {
  const dal = new Date(Date.now() - FINESTRA_MINUTI * 60_000).toISOString();
  const n = await db.prepare('SELECT COUNT(*) AS n FROM tentativi WHERE ip = ? AND quando > ?').bind(ip, dal).first('n');
  return n >= MAX_TENTATIVI;
}
const segnaTentativo = (db, ip) => db.prepare('INSERT INTO tentativi (ip, quando) VALUES (?, ?)').bind(ip, new Date().toISOString()).run();

const pulisciEmail = (v) => String(v ?? '').trim().toLowerCase().slice(0, 120);
const emailValida = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export async function onRequest({ request, env }) {
  const db = env.DB;
  if (!db) return json({ ok: false, errore: 'Database non collegato al progetto (manca il collegamento "DB").' }, 503);
  if (request.method !== 'GET' && request.method !== 'POST') return json({ ok: false, errore: 'Metodo non ammesso' }, 405);
  const ip = (request.headers.get('CF-Connecting-IP') ?? '').slice(0, 45);

  try {
    await preparaTabelle(db);

    if (request.method === 'GET') {
      // pulizia: sessioni scadute e tentativi vecchi
      const ora = new Date();
      await db.batch([
        db.prepare('DELETE FROM sessioni WHERE scade <= ?').bind(ora.toISOString()),
        db.prepare('DELETE FROM tentativi WHERE quando <= ?').bind(new Date(ora.getTime() - FINESTRA_MINUTI * 60_000).toISOString()),
      ]);
      const utente = await utenteDellaSessione(db, request);
      const utenti = await db.prepare('SELECT COUNT(*) AS n FROM utenti').first('n');
      return json({ ok: true, utente: utente ? { email: utente.email, nome: utente.nome } : null, ciSonoUtenti: utenti > 0 });
    }

    const corpo = await request.json().catch(() => ({}));

    if (corpo.azione === 'esci') {
      const codice = leggiCookie(request);
      if (codice) await db.prepare('DELETE FROM sessioni WHERE codice = ?').bind(await sha256(codice)).run();
      return json({ ok: true }, 200, { 'set-cookie': cookieCancellato });
    }

    if (corpo.azione === 'entra') {
      if (await troppiTentativi(db, ip)) return json({ ok: false, errore: `Troppi tentativi sbagliati: riprova tra ${FINESTRA_MINUTI} minuti.` }, 429);
      const email = pulisciEmail(corpo.email);
      const password = String(corpo.password ?? '');
      const u = await db.prepare('SELECT id, email, nome, impronta, sale, iterazioni FROM utenti WHERE email = ?').bind(email).first();
      // se l'utente non esiste si calcola comunque un'impronta, così i tempi di risposta non rivelano quali email esistono
      const calcolata = await impronta(password, u ? daHex(u.sale) : casuale(16), u ? u.iterazioni : ITERAZIONI);
      if (!u || !uguali(calcolata, u.impronta)) {
        await segnaTentativo(db, ip);
        return json({ ok: false, errore: 'Email o password non corretti.' }, 401);
      }
      await db.prepare('DELETE FROM tentativi WHERE ip = ?').bind(ip).run();
      const codice = await apriSessione(db, u.id, ip);
      return json({ ok: true, utente: { email: u.email, nome: u.nome } }, 200, { 'set-cookie': cookieSessione(codice) });
    }

    if (corpo.azione === 'crea') {
      if (!env.CODICE_ATTIVAZIONE)
        return json({ ok: false, errore: 'Codice di attivazione non configurato su Cloudflare (variabile segreta CODICE_ATTIVAZIONE).' }, 503);
      if (await troppiTentativi(db, ip)) return json({ ok: false, errore: `Troppi tentativi sbagliati: riprova tra ${FINESTRA_MINUTI} minuti.` }, 429);
      if (!uguali(await sha256(String(corpo.codice ?? '')), await sha256(env.CODICE_ATTIVAZIONE))) {
        await segnaTentativo(db, ip);
        return json({ ok: false, errore: 'Codice di attivazione non corretto.' }, 403);
      }
      const nome = String(corpo.nome ?? '').trim().slice(0, 80);
      const email = pulisciEmail(corpo.email);
      const password = String(corpo.password ?? '');
      if (!nome) return json({ ok: false, errore: 'Scrivi il nome.' }, 400);
      if (!emailValida(email)) return json({ ok: false, errore: 'Email non valida.' }, 400);
      if (password.length < 8 || password.length > 200) return json({ ok: false, errore: 'La password deve avere almeno 8 caratteri.' }, 400);
      const esiste = await db.prepare('SELECT id FROM utenti WHERE email = ?').bind(email).first();
      if (esiste) return json({ ok: false, errore: 'Esiste già un utente con questa email.' }, 409);
      const sale = casuale(16);
      const id = await db
        .prepare('INSERT INTO utenti (email, nome, impronta, sale, iterazioni, creato) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
        .bind(email, nome, await impronta(password, sale, ITERAZIONI), hex(sale), ITERAZIONI, new Date().toISOString())
        .first('id');
      const codice = await apriSessione(db, id, ip);
      return json({ ok: true, utente: { email, nome } }, 200, { 'set-cookie': cookieSessione(codice) });
    }

    return json({ ok: false, errore: 'Azione sconosciuta' }, 400);
  } catch (e) {
    return json({ ok: false, errore: `Errore del server: ${e instanceof Error ? e.message : String(e)}` }, 500);
  }
}
