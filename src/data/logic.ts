// Regole di business del mockup: residue (PAC-02/03), stato pagamenti (PAC-04), avvisi (DASH-03/05),
// messaggi suggeriti, stati per servizio (CRM), riepilogo economico del mese (anteprima ECO-02 / DASH-06)
import type { Appuntamento, Attivita, Cliente, Db, PacchettoCliente, Pagamento, Prodotto, ServizioCliente } from './types';
import { ATTIVITA, STATI } from './types';
import { aggiungiGiorni, fmtData, fmtDataBreve, fmtEuro, fmtOra, giorniTra, inizioGiorno, riempi, stessoGiorno } from '../lib/format';

export const nomeCliente = (c?: Cliente) => (c ? `${c.nome} ${c.cognome}` : '—');

/** Ordine standard degli elenchi di persone: prima i clienti fissati in cima, poi per cognome */
export const ordineClienti = (a: Cliente, b: Cliente) => Number(!!b.fissato) - Number(!!a.fissato) || a.cognome.localeCompare(b.cognome);

/**
 * Clienti "fissati in cima" (es. il cliente di prova): in ogni elenco vengono per primi, il resto mantiene il suo ordine.
 * idDi restituisce il cliente (o i clienti) di ogni voce.
 */
export function fissatiPrima<T>(db: Db, lista: T[], idDi: (x: T) => string | string[] | undefined): T[] {
  const fissati = new Set(db.clienti.filter((c) => c.fissato).map((c) => c.id));
  if (!fissati.size) return lista;
  const eFissato = (x: T) => {
    const id = idDi(x);
    return (Array.isArray(id) ? id : id ? [id] : []).some((i) => fissati.has(i));
  };
  return [...lista.filter(eFissato), ...lista.filter((x) => !eFissato(x))];
}

// ---------- clienti e servizi ----------

export const attivitaDi = (c: Cliente): Attivita[] => c.servizi.map((s) => s.attivita);
export const servizioDi = (c: Cliente | undefined, a: Attivita): ServizioCliente | undefined => c?.servizi.find((s) => s.attivita === a);
/** La persona è ancora in carico per quell'attività (o per almeno una)? */
export const inCarico = (c: Cliente | undefined, a?: Attivita) =>
  !!c && c.servizi.some((s) => (!a || s.attivita === a) && s.stato !== 'terminato');
/** Va seguita con avvisi di residue, scadenze e rinnovi (non in pausa, non terminata, non occasionale) */
export const daSeguire = (c: Cliente | undefined, a: Attivita) => {
  const s = servizioDi(c, a);
  return !!s && (s.stato === 'attivo' || s.stato === 'da verificare');
};

/** Soglia di residue per l'avviso: i pacchetti piccoli avvisano all'ultima sessione, i percorsi mensili solo alla scadenza */
export function sogliaResidue(db: Db, k: PacchettoCliente): number | undefined {
  const p = prodottoDi(db, k);
  if (k.sessioniTot == null || p.tipo === 'percorso') return undefined;
  return k.sessioniTot <= 4 ? Math.min(1, db.soglie.residueMin) : db.soglie.residueMin;
}
export const etichettaStato = (s: ServizioCliente) => STATI[s.stato].nome;

/**
 * Persone da richiamare o verificare: servizi non terminati con ripresa/richiamo entro 7 giorni (o già passata),
 * oppure "da verificare" senza data. Usata da avvisi, widget della pagina Oggi e filtro della pagina Clienti.
 */
export function daRichiamare(db: Db) {
  const oggi = inizioGiorno();
  const out: { cliente: Cliente; servizio: ServizioCliente; giorni?: number }[] = [];
  for (const cliente of db.clienti) {
    for (const servizio of cliente.servizi) {
      if (servizio.stato === 'terminato') continue;
      if (servizio.ripresa) {
        const giorni = giorniTra(oggi, new Date(servizio.ripresa));
        if (giorni <= 7) out.push({ cliente, servizio, giorni });
      } else if (servizio.stato === 'da verificare') {
        out.push({ cliente, servizio });
      }
    }
  }
  return out;
}

/** Nome visualizzato di un appuntamento: cliente, persone del pacchetto condiviso, contatto o gruppo */
export function nomeAppuntamento(db: Db, a: Appuntamento) {
  if (a.clienteId) {
    const nomi = [a.clienteId, ...(a.con ?? [])].map((id) => db.clienti.find((c) => c.id === id)).filter(Boolean) as Cliente[];
    return nomi.map(nomeCliente).join(' + ');
  }
  return a.contatto ?? a.gruppo ?? '—';
}

// ---------- pacchetti ----------

export const prodottoDi = (db: Db, k: PacchettoCliente): Prodotto => db.prodotti.find((p) => p.id === k.prodottoId)!;
export const titolariDi = (k: PacchettoCliente) => [k.clienteId, ...(k.condivisoCon ?? [])];
export const pacchettiDi = (db: Db, clienteId: string) => db.pacchetti.filter((k) => titolariDi(k).includes(clienteId));

export function nomePacchetto(db: Db, k: PacchettoCliente) {
  const p = prodottoDi(db, k);
  return k.storico ? `${p.nome} da ${k.sessioniTot}` : p.nome;
}

/** Un appuntamento consuma una sessione del pacchetto? (PAC-03) */
export function consuma(a: Appuntamento, p?: Prodotto): boolean {
  if (!a.esito) return false;
  if (a.eccezione) return false; // eccezione manuale: non scalata
  if (a.esito === 'effettuata' || a.esito === 'assenza') return true;
  if (a.esito === 'tardiva') return p ? p.scalaTardiva : true;
  return false;
}

/** Sessioni consumate: esiti delle sessioni 1:1 + presenze alle classi registrate sul carnet */
function sessioniUsate(db: Db, k: PacchettoCliente, p: Prodotto) {
  const da1a1 = db.appuntamenti.filter((a) => a.pacchettoId === k.id && consuma(a, p)).length;
  const daClassi = db.appuntamenti.reduce((n, a) => n + (a.presenze?.filter((x) => x.pacchettoId === k.id).length ?? 0), 0);
  return k.usatePrima + da1a1 + daClassi;
}

export function statoPacchetto(db: Db, k: PacchettoCliente) {
  const p = prodottoDi(db, k);
  const usate = sessioniUsate(db, k, p);
  const residue = k.sessioniTot != null ? Math.max(0, k.sessioniTot - usate) : undefined;
  const giorni = giorniTra(new Date(), new Date(k.scadenza));
  const scaduto = giorni < 0 || (residue != null && residue <= 0);
  return { prodotto: p, usate, residue, giorni, scaduto, nome: nomePacchetto(db, k) };
}

/** Carnet community valido per una persona (il primo che scade) */
export function carnetAttivo(db: Db, clienteId: string) {
  return pacchettiDi(db, clienteId)
    .filter((k) => prodottoDi(db, k).attivita === 'VC' && k.sessioniTot != null && !statoPacchetto(db, k).scaduto)
    .sort((a, b) => a.scadenza.localeCompare(b.scadenza))[0];
}

export const FORMULE: Record<PacchettoCliente['formula'], string> = { pagamento: 'A pagamento', gratuito: 'Gratuito', scambio: 'Scambio professionale' };

// ---------- pagamenti ----------

export type StatoPagamento = 'pagato' | 'da pagare' | 'scaduto';
export function statoPagamento(pg: Pagamento): StatoPagamento {
  if (pg.pagatoIl) return 'pagato';
  return new Date(pg.scadenza) < inizioGiorno() ? 'scaduto' : 'da pagare';
}

// ---------- avvisi ----------

export type Priorita = 0 | 1 | 2; // 0 = scaduto/urgente, 1 = oggi, 2 = settimana
export interface Avviso {
  id: string;
  tipo: 'residue' | 'scadenza' | 'pagamento' | 'esito' | 'todo' | 'richiamo' | 'conferma';
  priorita: Priorita;
  attivita?: Attivita;
  titolo: string;
  dettaglio: string;
  link: string;
  clienti?: string[]; // clienti coinvolti (per mettere in cima i clienti fissati)
}

export function calcolaAvvisi(db: Db): Avviso[] {
  const out: Avviso[] = [];
  const oggi = inizioGiorno();
  const ora = new Date();
  const cli = (id: string) => db.clienti.find((c) => c.id === id);

  for (const k of db.pacchetti) {
    const s = statoPacchetto(db, k);
    const att = s.prodotto.attivita;
    const seguiti = titolariDi(k).map(cli).filter((c) => daSeguire(c, att));
    if (!seguiti.length) continue;
    const chi = titolariDi(k).map((id) => nomeCliente(cli(id))).join(' + ');
    const link = `/clienti/${k.clienteId}`;
    const soglia = sogliaResidue(db, k);
    if (s.giorni >= 0 && soglia != null && s.residue != null && s.residue <= soglia) {
      out.push({
        id: `res-${k.id}`, tipo: 'residue', priorita: s.residue <= 0 ? 0 : 1, attivita: att, clienti: titolariDi(k),
        titolo: `${chi}: ${s.residue <= 0 ? 'pacchetto esaurito' : `${s.residue} sessioni residue`}`, dettaglio: s.nome, link,
      });
    }
    if (s.giorni <= db.soglie.giorniScadenza && s.giorni >= -30 && !(s.residue != null && s.residue <= 0)) {
      out.push({
        id: `scad-${k.id}`, tipo: 'scadenza', priorita: s.giorni < 0 ? 0 : s.giorni <= 1 ? 1 : 2, attivita: att, clienti: titolariDi(k),
        titolo: `${chi}: ${s.giorni < 0 ? 'scaduto' : s.giorni === 0 ? 'scade oggi' : `scade tra ${s.giorni} giorni`}`,
        dettaglio: `${s.nome} · ${fmtDataBreve(k.scadenza)}`, link,
      });
    }
  }
  for (const pg of db.pagamenti) {
    const st = statoPagamento(pg);
    const c = cli(pg.clienteId);
    if (st === 'scaduto' || (st === 'da pagare' && giorniTra(oggi, new Date(pg.scadenza)) <= 7)) {
      out.push({
        id: `pag-${pg.id}`, tipo: 'pagamento', priorita: st === 'scaduto' ? 0 : 2, attivita: pg.attivita, clienti: [pg.clienteId],
        titolo: `${nomeCliente(c)}: ${fmtEuro(pg.importo)} ${st === 'scaduto' ? 'scaduto' : 'in scadenza'}`,
        dettaglio: `${pg.descrizione} · ${fmtDataBreve(pg.scadenza)}`, link: `/pagamenti?filtro=${st === 'scaduto' ? 'scaduti' : 'aperti'}`,
      });
    }
  }
  for (const a of db.appuntamenti) {
    const classe = !!a.presenze;
    if (!a.esito && !classe && new Date(a.inizio) < ora && new Date(a.inizio) >= aggiungiGiorni(oggi, -7)) {
      out.push({
        id: `esi-${a.id}`, tipo: 'esito', priorita: stessoGiorno(a.inizio, oggi) ? 1 : 0, attivita: a.attivita, clienti: a.clienteId ? [a.clienteId, ...(a.con ?? [])] : undefined,
        titolo: `Esito da registrare: ${nomeAppuntamento(db, a)}`,
        dettaglio: `${fmtData(a.inizio)} ${fmtOra(a.inizio)} · ${a.servizio}`, link: `/agenda?giorno=${a.inizio.slice(0, 10)}`,
      });
    }
    if (classe && new Date(a.inizio) < ora && a.presenze!.length === 0 && new Date(a.inizio) >= aggiungiGiorni(oggi, -7)) {
      out.push({
        id: `pres-${a.id}`, tipo: 'esito', priorita: stessoGiorno(a.inizio, oggi) ? 1 : 0, attivita: a.attivita,
        titolo: `Presenze da registrare: ${a.gruppo}`, dettaglio: `${fmtData(a.inizio)} ${fmtOra(a.inizio)}`, link: '/community',
      });
    }
    if (a.daConfermare && new Date(a.inizio) >= oggi) {
      out.push({
        id: `conf-${a.id}`, tipo: 'conferma', priorita: 1, attivita: a.attivita, clienti: a.clienteId ? [a.clienteId] : undefined,
        titolo: `${a.servizio} da confermare: ${nomeAppuntamento(db, a)}`, dettaglio: `${fmtData(a.inizio)} ${fmtOra(a.inizio)}`,
        link: `/agenda?giorno=${a.inizio.slice(0, 10)}`,
      });
    }
  }
  // CRM: riprese e richiami previsti, situazioni da verificare (stessa regola del widget e del filtro Clienti)
  for (const { cliente: c, servizio: s, giorni: d } of daRichiamare(db)) {
    if (s.ripresa && d != null) {
      out.push({
        id: `ric-${c.id}-${s.attivita}`, tipo: 'richiamo', priorita: d < 0 ? 0 : d === 0 ? 1 : 2, attivita: s.attivita, clienti: [c.id],
        titolo: `Richiamare ${nomeCliente(c)}`,
        dettaglio: `${STATI[s.stato].nome} · ${s.stato === 'pausa' ? 'ripresa prevista' : 'richiamo'} ${fmtDataBreve(s.ripresa)}`, link: `/clienti/${c.id}`,
      });
    } else {
      out.push({
        id: `ver-${c.id}-${s.attivita}`, tipo: 'richiamo', priorita: 2, attivita: s.attivita, clienti: [c.id],
        titolo: `Da verificare: ${nomeCliente(c)}`, dettaglio: s.nota ?? ATTIVITA[s.attivita].nome, link: `/clienti/${c.id}`,
      });
    }
  }
  for (const t of db.todo) {
    if (t.fatto) continue;
    const d = giorniTra(oggi, new Date(t.data));
    if (d <= 7) {
      out.push({
        id: `todo-${t.id}`, tipo: 'todo', priorita: d < 0 ? 0 : d === 0 ? 1 : 2, attivita: t.attivita, clienti: t.clienteId ? [t.clienteId] : undefined,
        titolo: t.testo, dettaglio: `${t.categoria === 'amministrazione' ? 'Amministrazione · ' : ''}${d < 0 ? 'In ritardo' : d === 0 ? 'Oggi' : `entro ${fmtData(t.data)}`}`,
        // con un cliente si apre la sua scheda; altrimenti la pagina Oggi scorre al riquadro "Cose da fare"
        link: t.clienteId ? `/clienti/${t.clienteId}` : '/?vai=cose-da-fare',
      });
    }
  }
  // per priorità; dentro ogni gruppo prima i clienti fissati in cima
  return ([0, 1, 2] as Priorita[]).flatMap((p) => fissatiPrima(db, out.filter((a) => a.priorita === p), (a) => a.clienti));
}

// ---------- messaggi ----------

export interface MessaggioSuggerito {
  chiave: string;
  clienteId: string;
  modelloId: string;
  motivo: string;
  campi: Record<string, string>;
}

/** Messaggi da inviare oggi (DASH-01): promemoria di domani, rinnovi, solleciti */
export function messaggiSuggeriti(db: Db): MessaggioSuggerito[] {
  const out: MessaggioSuggerito[] = [];
  const domani = aggiungiGiorni(inizioGiorno(), 1);
  const inviati = new Set(db.messaggi.map((m) => m.chiave));
  for (const a of db.appuntamenti) {
    if (a.clienteId && stessoGiorno(a.inizio, domani)) {
      for (const id of [a.clienteId, ...(a.con ?? [])]) {
        out.push({
          chiave: `prom-${a.id}-${id}`, clienteId: id, modelloId: 'm-prom', motivo: `Promemoria di domani ${fmtOra(a.inizio)}`,
          campi: { data: 'domani', ora: fmtOra(a.inizio), luogo: a.luogo },
        });
      }
    }
  }
  for (const k of db.pacchetti) {
    const s = statoPacchetto(db, k);
    const c = db.clienti.find((x) => x.id === k.clienteId);
    if (!daSeguire(c, s.prodotto.attivita) || k.formula !== 'pagamento') continue;
    const soglia = sogliaResidue(db, k);
    if (s.giorni >= -7 && ((soglia != null && s.residue != null && s.residue <= soglia) || s.giorni <= 7)) {
      out.push({
        chiave: `rinn-${k.id}`, clienteId: k.clienteId, modelloId: 'm-rinn', motivo: `Rinnovo: ${s.nome}`,
        campi: { pacchetto: s.nome, residue: s.residue != null ? String(Math.max(s.residue, 0)) : '—', scadenza: fmtDataBreve(k.scadenza) },
      });
    }
  }
  for (const c of db.clienti) {
    for (const s of c.servizi) {
      if (s.stato === 'pausa' && s.ripresa && giorniTra(inizioGiorno(), new Date(s.ripresa)) <= 3) {
        out.push({ chiave: `ripr-${c.id}-${s.attivita}-${s.ripresa}`, clienteId: c.id, modelloId: 'm-ripr', motivo: `Ripresa prevista ${fmtDataBreve(s.ripresa)}`, campi: {} });
      }
    }
  }
  for (const pg of db.pagamenti) {
    if (statoPagamento(pg) === 'scaduto') {
      out.push({
        chiave: `soll-${pg.id}`, clienteId: pg.clienteId, modelloId: 'm-soll', motivo: `Sollecito ${fmtEuro(pg.importo)}`,
        campi: { importo: fmtEuro(pg.importo), descrizione: pg.descrizione, scadenza: fmtDataBreve(pg.scadenza) },
      });
    }
  }
  return fissatiPrima(db, out.filter((m) => !inviati.has(m.chiave)), (m) => m.clienteId);
}

export function testoMessaggio(db: Db, modelloId: string, c: Cliente, campi: Record<string, string> = {}) {
  const m = db.modelli.find((x) => x.id === modelloId);
  return riempi(m?.testo ?? '', {
    nome: c.nome,
    cognome: c.cognome,
    attivita: attivitaDi(c).map((a) => ATTIVITA[a].nome).join(' / '),
    link: 'https://esempio.it/anamnesi/demo', // dominio ancora da definire (D-09)
    ...campi,
  });
}

/** Link per l'invio con un tocco (COM-02) */
export function linkInvio(canale: 'WhatsApp' | 'Telegram' | 'Email', c: Cliente, testo: string, oggetto = 'TRAINING SUITE') {
  const t = encodeURIComponent(testo);
  if (canale === 'WhatsApp') return `https://wa.me/${c.telefono.replace(/\D/g, '')}?text=${t}`;
  if (canale === 'Telegram') return c.telegram ? `https://t.me/${c.telegram.replace('@', '')}?text=${t}` : `https://t.me/share/url?url=&text=${t}`;
  return `mailto:${c.email}?subject=${encodeURIComponent(oggetto)}&body=${t}`;
}

// ---------- ore ed economia ----------

export const oreAppuntamenti = (lista: Appuntamento[]) => lista.reduce((s, a) => s + a.durataMin / 60, 0);

export interface RigaEconomia {
  attivita: Attivita;
  venduto: number; // pacchetti venduti nel mese (prezzo pieno)
  incassato: number;
  daIncassare: number; // scaduto o in scadenza nel mese, non ancora incassato
  erogato: number; // valore delle sessioni effettivamente erogate nel mese
  sessioniGratuite: number; // sessioni erogate gratuite o in scambio
  costi: number; // costi diretti dell'attività
  ore: number; // ore di sessione
  oreGratuite: number; // Body Check e altre attività gratuite
}

/** Anteprima del prospetto mensile (ECO-02, DASH-06): venduto, incassato, da incassare, erogato, costi, ore */
export function economiaMese(db: Db, rif = new Date()) {
  const ini = new Date(rif.getFullYear(), rif.getMonth(), 1);
  const fin = new Date(rif.getFullYear(), rif.getMonth() + 1, 1);
  const nel = (iso?: string) => !!iso && new Date(iso) >= ini && new Date(iso) < fin;
  const ora = new Date();

  const valoreSessione = (k?: PacchettoCliente) => (k && k.formula === 'pagamento' && k.sessioniTot ? k.prezzo / k.sessioniTot : 0);
  const righe: RigaEconomia[] = (Object.keys(ATTIVITA) as Attivita[]).map((att) => {
    const r: RigaEconomia = { attivita: att, venduto: 0, incassato: 0, daIncassare: 0, erogato: 0, sessioniGratuite: 0, costi: 0, ore: 0, oreGratuite: 0 };
    for (const k of db.pacchetti) if (prodottoDi(db, k).attivita === att && nel(k.inizio)) r.venduto += k.prezzo;
    for (const p of db.pagamenti.filter((x) => x.attivita === att)) {
      if (nel(p.pagatoIl)) r.incassato += p.importo;
      if (!p.pagatoIl && (nel(p.scadenza) || new Date(p.scadenza) < ini)) r.daIncassare += p.importo;
    }
    for (const a of db.appuntamenti.filter((x) => x.attivita === att && nel(x.inizio) && new Date(x.inizio) < ora)) {
      const conta = a.esito === 'effettuata' || (!!a.presenze && a.presenze.length > 0);
      if (conta) (a.gratuito ? (r.oreGratuite += a.durataMin / 60) : (r.ore += a.durataMin / 60));
      const k = db.pacchetti.find((x) => x.id === a.pacchettoId);
      if (k && consuma(a, prodottoDi(db, k))) {
        if (k.formula === 'pagamento') r.erogato += valoreSessione(k);
        else r.sessioniGratuite++;
      }
      for (const pr of a.presenze ?? []) {
        const kc = db.pacchetti.find((x) => x.id === pr.pacchettoId);
        if (kc?.formula === 'pagamento') r.erogato += valoreSessione(kc);
        else if (kc) r.sessioniGratuite++;
      }
    }
    r.costi = db.costi.filter((c) => c.attivita === att && nel(c.data)).reduce((s, c) => s + c.importo, 0);
    return r;
  });
  const costiComuni = db.costi.filter((c) => !c.attivita && nel(c.data)).reduce((s, c) => s + c.importo, 0);
  return { ini, righe, costiComuni };
}

// ---------- dettaglio del report economico (voci dietro ogni widget) ----------

export interface VoceErogata {
  data: string;
  chi: string;
  clienteId?: string;
  servizio: string;
  pacchetto: string;
  valore: number; // 0 per sessioni gratuite o in scambio
  formula: PacchettoCliente['formula'];
  attivita: Attivita;
}

/** Elenchi del mese per il report economico: stesse regole di economiaMese, voce per voce */
export function dettaglioMese(db: Db, rif = new Date()) {
  const ini = new Date(rif.getFullYear(), rif.getMonth(), 1);
  const fin = new Date(rif.getFullYear(), rif.getMonth() + 1, 1);
  const nel = (iso?: string) => !!iso && new Date(iso) >= ini && new Date(iso) < fin;
  const ora = new Date();
  const cli = (id: string) => db.clienti.find((c) => c.id === id);
  const perData = <T,>(f: (x: T) => string) => (a: T, b: T) => f(a).localeCompare(f(b));

  const venduti = db.pacchetti
    .filter((k) => nel(k.inizio))
    .map((k) => ({ k, nome: nomePacchetto(db, k), chi: titolariDi(k).map((id) => nomeCliente(cli(id))).join(' + '), attivita: prodottoDi(db, k).attivita }))
    .sort(perData((x) => x.k.inizio));
  const incassati = db.pagamenti.filter((p) => nel(p.pagatoIl)).sort(perData((p) => p.pagatoIl!));
  const daIncassare = db.pagamenti.filter((p) => !p.pagatoIl && (nel(p.scadenza) || new Date(p.scadenza) < ini)).sort(perData((p) => p.scadenza));

  const erogate: VoceErogata[] = [];
  const valore = (k: PacchettoCliente) => (k.formula === 'pagamento' && k.sessioniTot ? k.prezzo / k.sessioniTot : 0);
  for (const a of db.appuntamenti.filter((x) => nel(x.inizio) && new Date(x.inizio) < ora)) {
    const k = db.pacchetti.find((x) => x.id === a.pacchettoId);
    if (k && consuma(a, prodottoDi(db, k))) {
      erogate.push({ data: a.inizio, chi: nomeAppuntamento(db, a), clienteId: a.clienteId, servizio: a.servizio, pacchetto: nomePacchetto(db, k), valore: valore(k), formula: k.formula, attivita: a.attivita });
    }
    for (const pr of a.presenze ?? []) {
      const kc = db.pacchetti.find((x) => x.id === pr.pacchettoId);
      if (kc) erogate.push({ data: a.inizio, chi: nomeCliente(cli(pr.clienteId)), clienteId: pr.clienteId, servizio: a.gruppo ?? a.servizio, pacchetto: nomePacchetto(db, kc), valore: valore(kc), formula: kc.formula, attivita: a.attivita });
    }
  }
  erogate.sort(perData((x) => x.data));
  const costi = db.costi.filter((c) => nel(c.data)).sort(perData((c) => c.data));
  return {
    venduti: fissatiPrima(db, venduti, (v) => titolariDi(v.k)),
    incassati: fissatiPrima(db, incassati, (p) => p.clienteId),
    daIncassare: fissatiPrima(db, daIncassare, (p) => p.clienteId),
    erogate: fissatiPrima(db, erogate, (e) => e.clienteId),
    costi,
  };
}

// ---------- eliminazione di un cliente (GDPR, NFR-04: diritto alla cancellazione) ----------

/**
 * Elimina il cliente e tutto ciò che lo riguarda. I pacchetti condivisi passano all'altra persona
 * (con i loro pagamenti e sessioni), così i dati di chi resta non vengono toccati.
 */
export function eliminaClienteDa(db: Db, id: string): Db {
  const pacchettiEliminati = new Set<string>();
  const pacchetti: PacchettoCliente[] = [];
  const nuovoTitolare = new Map<string, string>(); // pacchetto condiviso → nuovo titolare
  for (const k of db.pacchetti) {
    const altri = (k.condivisoCon ?? []).filter((x) => x !== id);
    if (k.clienteId === id) {
      if (altri.length) {
        nuovoTitolare.set(k.id, altri[0]);
        pacchetti.push({ ...k, clienteId: altri[0], condivisoCon: altri.length > 1 ? altri.slice(1) : undefined });
      } else pacchettiEliminati.add(k.id);
    } else pacchetti.push(k.condivisoCon ? { ...k, condivisoCon: altri.length ? altri : undefined } : k);
  }
  const appuntamenti: Appuntamento[] = [];
  for (const a of db.appuntamenti) {
    if (a.pacchettoId && pacchettiEliminati.has(a.pacchettoId)) continue;
    let x = a;
    const con = (a.con ?? []).filter((c) => c !== id);
    if (a.clienteId === id) {
      if (!con.length) continue; // sessione solo sua
      x = { ...x, clienteId: con[0], con: con.length > 1 ? con.slice(1) : undefined };
    } else if (a.con?.includes(id)) x = { ...x, con: con.length ? con : undefined };
    if (a.presenze?.some((p) => p.clienteId === id)) x = { ...x, presenze: a.presenze.filter((p) => p.clienteId !== id) };
    appuntamenti.push(x);
  }
  const pagamenti = db.pagamenti
    .filter((p) => !(p.pacchettoId && pacchettiEliminati.has(p.pacchettoId)))
    .map((p) => (p.clienteId === id && p.pacchettoId && nuovoTitolare.has(p.pacchettoId) ? { ...p, clienteId: nuovoTitolare.get(p.pacchettoId)! } : p))
    .filter((p) => p.clienteId !== id);
  return {
    ...db,
    clienti: db.clienti.filter((c) => c.id !== id),
    pacchetti,
    appuntamenti,
    pagamenti,
    messaggi: db.messaggi.filter((m) => m.clienteId !== id),
    todo: db.todo.filter((t) => t.clienteId !== id),
  };
}

/** Cosa sparirebbe eliminando il cliente: per la finestra di conferma */
export function effettiEliminazione(db: Db, id: string) {
  const dopo = eliminaClienteDa(db, id);
  const presenzePrima = db.appuntamenti.reduce((n, a) => n + (a.presenze?.filter((p) => p.clienteId === id).length ?? 0), 0);
  return {
    pacchetti: db.pacchetti.length - dopo.pacchetti.length,
    pacchettiCeduti: db.pacchetti.filter((k) => k.clienteId === id && (k.condivisoCon ?? []).length > 0).length,
    sessioni: db.appuntamenti.length - dopo.appuntamenti.length,
    presenze: presenzePrima,
    pagamenti: db.pagamenti.length - dopo.pagamenti.length,
    messaggi: db.messaggi.length - dopo.messaggi.length,
    cose: db.todo.length - dopo.todo.length,
  };
}
