// Regole di business del mockup: residue (PAC-02/03), stato pagamenti (PAC-04), avvisi (DASH-03/05), messaggi suggeriti
import type { Appuntamento, Attivita, Cliente, Db, PacchettoCliente, Pagamento, Prodotto } from './types';
import { ATTIVITA } from './types';
import { aggiungiGiorni, fmtData, fmtDataBreve, fmtEuro, fmtOra, giorniTra, inizioGiorno, riempi, stessoGiorno } from '../lib/format';

export const nomeCliente = (c?: Cliente) => (c ? `${c.nome} ${c.cognome}` : '—');

export const prodottoDi = (db: Db, k: PacchettoCliente): Prodotto => db.prodotti.find((p) => p.id === k.prodottoId)!;

/** Un appuntamento consuma una sessione del pacchetto? (PAC-03) */
export function consuma(a: Appuntamento, p?: Prodotto): boolean {
  if (!a.esito) return false;
  if (a.eccezione) return false; // eccezione manuale: non scalata
  if (a.esito === 'effettuata' || a.esito === 'assenza') return true;
  if (a.esito === 'tardiva') return p ? p.scalaTardiva : true;
  return false;
}

export function statoPacchetto(db: Db, k: PacchettoCliente) {
  const p = prodottoDi(db, k);
  const usate = k.usatePrima + db.appuntamenti.filter((a) => a.pacchettoId === k.id && consuma(a, p)).length;
  const residue = k.sessioniTot != null ? k.sessioniTot - usate : undefined;
  const giorni = giorniTra(new Date(), new Date(k.scadenza));
  const scaduto = giorni < 0 || (residue != null && residue <= 0);
  return { prodotto: p, usate, residue, giorni, scaduto };
}

export type StatoPagamento = 'pagato' | 'da pagare' | 'scaduto';
export function statoPagamento(pg: Pagamento): StatoPagamento {
  if (pg.pagatoIl) return 'pagato';
  return new Date(pg.scadenza) < inizioGiorno() ? 'scaduto' : 'da pagare';
}

export type Priorita = 0 | 1 | 2; // 0 = scaduto/urgente, 1 = oggi, 2 = settimana
export interface Avviso {
  id: string;
  tipo: 'residue' | 'scadenza' | 'pagamento' | 'esito' | 'todo';
  priorita: Priorita;
  attivita?: Attivita;
  titolo: string;
  dettaglio: string;
  link: string;
}

export function calcolaAvvisi(db: Db): Avviso[] {
  const out: Avviso[] = [];
  const oggi = inizioGiorno();
  const ora = new Date();
  const cli = (id: string) => db.clienti.find((c) => c.id === id);

  for (const k of db.pacchetti) {
    const c = cli(k.clienteId);
    if (!c || c.stato !== 'attivo') continue;
    const s = statoPacchetto(db, k);
    if (s.residue != null && s.residue <= db.soglie.residueMin) {
      out.push({
        id: `res-${k.id}`, tipo: 'residue', priorita: s.residue <= 0 ? 0 : 1, attivita: s.prodotto.attivita,
        titolo: `${nomeCliente(c)}: ${s.residue <= 0 ? 'pacchetto esaurito' : `${s.residue} sessioni residue`}`,
        dettaglio: s.prodotto.nome, link: `/clienti/${c.id}`,
      });
    }
    if (s.giorni <= db.soglie.giorniScadenza) {
      out.push({
        id: `scad-${k.id}`, tipo: 'scadenza', priorita: s.giorni < 0 ? 0 : s.giorni <= 1 ? 1 : 2, attivita: s.prodotto.attivita,
        titolo: `${nomeCliente(c)}: ${s.giorni < 0 ? 'scaduto' : s.giorni === 0 ? 'scade oggi' : `scade tra ${s.giorni} giorni`}`,
        dettaglio: `${s.prodotto.nome} · ${fmtDataBreve(k.scadenza)}`, link: `/clienti/${c.id}`,
      });
    }
  }
  for (const pg of db.pagamenti) {
    const st = statoPagamento(pg);
    const c = cli(pg.clienteId);
    if (st === 'scaduto' || (st === 'da pagare' && giorniTra(oggi, new Date(pg.scadenza)) <= 7)) {
      out.push({
        id: `pag-${pg.id}`, tipo: 'pagamento', priorita: st === 'scaduto' ? 0 : 2, attivita: pg.attivita,
        titolo: `${nomeCliente(c)}: ${fmtEuro(pg.importo)} ${st === 'scaduto' ? 'scaduto' : 'in scadenza'}`,
        dettaglio: `${pg.descrizione} · ${fmtDataBreve(pg.scadenza)}`, link: `/pagamenti?filtro=${st === 'scaduto' ? 'scaduti' : 'aperti'}`,
      });
    }
  }
  for (const a of db.appuntamenti) {
    if (!a.esito && new Date(a.inizio) < ora && new Date(a.inizio) >= aggiungiGiorni(oggi, -7)) {
      out.push({
        id: `esi-${a.id}`, tipo: 'esito', priorita: stessoGiorno(a.inizio, oggi) ? 1 : 0, attivita: a.attivita,
        titolo: `Esito da registrare: ${a.clienteId ? nomeCliente(cli(a.clienteId)) : a.gruppo}`,
        dettaglio: `${fmtData(a.inizio)} ${fmtOra(a.inizio)} · ${a.servizio}`, link: `/agenda?giorno=${a.inizio.slice(0, 10)}`,
      });
    }
  }
  for (const t of db.todo) {
    if (t.fatto) continue;
    const d = giorniTra(oggi, new Date(t.data));
    if (d <= 7) {
      out.push({
        id: `todo-${t.id}`, tipo: 'todo', priorita: d < 0 ? 0 : d === 0 ? 1 : 2, attivita: t.attivita,
        titolo: t.testo, dettaglio: d < 0 ? 'In ritardo' : d === 0 ? 'Oggi' : fmtData(t.data), link: '/',
      });
    }
  }
  return out.sort((a, b) => a.priorita - b.priorita);
}

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
      out.push({
        chiave: `prom-${a.id}`, clienteId: a.clienteId, modelloId: 'm-prom', motivo: `Promemoria di domani ${fmtOra(a.inizio)}`,
        campi: { data: 'domani', ora: fmtOra(a.inizio), luogo: a.luogo },
      });
    }
  }
  for (const k of db.pacchetti) {
    const s = statoPacchetto(db, k);
    const c = db.clienti.find((x) => x.id === k.clienteId);
    if (c?.stato !== 'attivo') continue;
    if ((s.residue != null && s.residue <= db.soglie.residueMin) || (s.giorni >= 0 && s.giorni <= 7)) {
      out.push({
        chiave: `rinn-${k.id}`, clienteId: k.clienteId, modelloId: 'm-rinn', motivo: `Rinnovo: ${s.prodotto.nome}`,
        campi: { pacchetto: s.prodotto.nome, residue: s.residue != null ? String(s.residue) : '—', scadenza: fmtDataBreve(k.scadenza) },
      });
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
  return out.filter((m) => !inviati.has(m.chiave));
}

export function testoMessaggio(db: Db, modelloId: string, c: Cliente, campi: Record<string, string> = {}) {
  const m = db.modelli.find((x) => x.id === modelloId);
  return riempi(m?.testo ?? '', {
    nome: c.nome,
    cognome: c.cognome,
    attivita: c.attivita.map((a) => ATTIVITA[a].nome).join(' / '),
    link: 'https://training_suite.it/anamnesi/demo',
    ...campi,
  });
}

/** Link per l'invio con un tocco (COM-02) */
export function linkInvio(canale: 'WhatsApp' | 'Telegram' | 'Email', c: Cliente, testo: string, oggetto = 'TRAINING_SUITE') {
  const t = encodeURIComponent(testo);
  if (canale === 'WhatsApp') return `https://wa.me/${c.telefono.replace(/\D/g, '')}?text=${t}`;
  if (canale === 'Telegram') return c.telegram ? `https://t.me/${c.telegram.replace('@', '')}?text=${t}` : `https://t.me/share/url?url=&text=${t}`;
  return `mailto:${c.email}?subject=${encodeURIComponent(oggetto)}&body=${t}`;
}

export const oreAppuntamenti = (lista: Appuntamento[]) => lista.reduce((s, a) => s + a.durataMin / 60, 0);
