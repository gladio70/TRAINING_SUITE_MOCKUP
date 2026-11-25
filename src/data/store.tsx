// Archivio del mockup: tutto in memoria, salvato nel localStorage del browser.
// Nella versione reale sarà sostituito dalle API (Cloudflare Workers + D1).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Appuntamento, Cliente, Db, Esito, Formula, MessaggioInviato, PacchettoCliente, Pagamento, Prodotto, Soglie, Todo } from './types';
import { creaDbDemo, MODELLO_LINK } from './mock';
import { carnetAttivo, eliminaClienteDa } from './logic';
import { aggiungiGiorni, toIsoLocale, uid } from '../lib/format';

// v0.3 ha cambiato il modello dei dati: i dati salvati con le versioni precedenti non sono compatibili
const CHIAVE = 'training_suite-mockup-v3';
const CHIAVI_VECCHIE = ['training_suite-mockup-v1'];

function carica(): Db {
  try {
    CHIAVI_VECCHIE.forEach((k) => localStorage.removeItem(k));
    const s = localStorage.getItem(CHIAVE);
    if (s) {
      const db = JSON.parse(s) as Db;
      // v0.3.6: la cosa da fare demo su Sara Conti ora porta alla sua scheda (dati salvati prima non hanno il collegamento)
      db.todo = db.todo.map((t) => (t.id === 't1' && !t.clienteId && t.testo.includes('Sara Conti') ? { ...t, clienteId: 'lt1' } : t));
      // v0.4: modello del messaggio con il link di pagamento
      if (!db.modelli.some((m) => m.id === 'm-link')) db.modelli = [...db.modelli, { id: 'm-link', titolo: 'Link di pagamento', testo: MODELLO_LINK }];
      // v0.3.11: cliente di prova Claudio Nanni (con pacchetto, pagamento e appuntamento) anche nei dati già salvati.
      // Applicata una sola volta: se poi lo si elimina, non ricompare.
      if (!db.migrazioni?.includes('cliente-cn1')) {
        db.migrazioni = [...(db.migrazioni ?? []), 'cliente-cn1'];
        if (!db.clienti.some((c) => c.id === 'cn1')) {
          const demo = creaDbDemo();
          const aggiungi = <T extends { id: string }>(lista: T[], nuovi: T[]) => [...nuovi.filter((n) => !lista.some((x) => x.id === n.id)), ...lista];
          db.clienti = aggiungi(db.clienti, demo.clienti.filter((c) => c.id === 'cn1'));
          db.pacchetti = aggiungi(db.pacchetti, demo.pacchetti.filter((k) => k.id === 'k-cn1'));
          db.pagamenti = aggiungi(db.pagamenti, demo.pagamenti.filter((p) => p.id === 'pg-cn1'));
          db.appuntamenti = aggiungi(db.appuntamenti, demo.appuntamenti.filter((a) => a.id === 'a-cn1'));
        }
      }
      return db;
    }
  } catch {
    /* storage non disponibile: si riparte dai dati demo */
  }
  return creaDbDemo();
}

const oggiIso = () => toIsoLocale(new Date()).slice(0, 10);

export interface OpzioniVendita {
  validitaGiorni: number;
  formula: Formula;
  condivisoCon?: string[];
}

interface Azioni {
  db: Db;
  setEsito: (id: string, esito: Esito | undefined, eccezione?: string) => void;
  confermaAppuntamento: (id: string) => void;
  aggiungiAppuntamenti: (a: Omit<Appuntamento, 'id'>[]) => void;
  togglePresenza: (appuntamentoId: string, clienteId: string) => void;
  salvaCliente: (c: Cliente) => void;
  eliminaCliente: (id: string) => void;
  nuovoCliente: (c: Omit<Cliente, 'id' | 'creatoIl'>) => string;
  registraPagamento: (id: string, metodo: Pagamento['metodo']) => void;
  aggiungiPagamento: (p: Omit<Pagamento, 'id'>) => void;
  segnaLinkInviato: (id: string) => void;
  simulaPagamentoOnline: (id: string) => void;
  vendiPacchetto: (clienteId: string, prodottoId: string, inizio: string, rate: { importo: number; scadenza: string; pagato: boolean }[], opz: OpzioniVendita) => void;
  proroga: (pacchettoId: string, giorni: number, nota: string) => void;
  aggiungiProdotto: (p: Omit<Prodotto, 'id'>) => void;
  registraMessaggio: (m: Omit<MessaggioInviato, 'id' | 'data'>) => void;
  aggiornaModello: (id: string, testo: string) => void;
  toggleTodo: (id: string) => void;
  aggiungiTodo: (t: Omit<Todo, 'id' | 'fatto'>) => void;
  setSoglie: (s: Soglie) => void;
  ripristina: () => void;
}

const Ctx = createContext<Azioni | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Db>(carica);

  useEffect(() => {
    try {
      localStorage.setItem(CHIAVE, JSON.stringify(db));
    } catch {
      /* ignora */
    }
  }, [db]);

  const az: Azioni = {
    db,
    setEsito: (id, esito, eccezione) =>
      setDb((d) => ({ ...d, appuntamenti: d.appuntamenti.map((a) => (a.id === id ? { ...a, esito, eccezione: eccezione || undefined } : a)) })),
    confermaAppuntamento: (id) =>
      setDb((d) => ({ ...d, appuntamenti: d.appuntamenti.map((a) => (a.id === id ? { ...a, daConfermare: undefined } : a)) })),
    aggiungiAppuntamenti: (lista) =>
      setDb((d) => ({ ...d, appuntamenti: [...d.appuntamenti, ...lista.map((a) => ({ ...a, id: uid() }))] })),
    // GRP: presenza effettiva a una classe; scala il carnet valido della persona (se c'è)
    togglePresenza: (appId, clienteId) =>
      setDb((d) => ({
        ...d,
        appuntamenti: d.appuntamenti.map((a) => {
          if (a.id !== appId) return a;
          const prima = a.presenze ?? [];
          const presenze = prima.some((p) => p.clienteId === clienteId)
            ? prima.filter((p) => p.clienteId !== clienteId)
            : [...prima, { clienteId, pacchettoId: carnetAttivo(d, clienteId)?.id }];
          return { ...a, presenze, esito: presenze.length ? 'effettuata' : undefined };
        }),
      })),
    salvaCliente: (c) => setDb((d) => ({ ...d, clienti: d.clienti.map((x) => (x.id === c.id ? c : x)) })),
    eliminaCliente: (id) => setDb((d) => eliminaClienteDa(d, id)),
    nuovoCliente: (c) => {
      const id = uid();
      setDb((d) => ({ ...d, clienti: [...d.clienti, { ...c, id, creatoIl: oggiIso() }] }));
      return id;
    },
    registraPagamento: (id, metodo) =>
      setDb((d) => ({ ...d, pagamenti: d.pagamenti.map((p) => (p.id === id ? { ...p, pagatoIl: oggiIso(), metodo } : p)) })),
    aggiungiPagamento: (p) => setDb((d) => ({ ...d, pagamenti: [...d.pagamenti, { ...p, id: uid() }] })),
    segnaLinkInviato: (id) => setDb((d) => ({ ...d, pagamenti: d.pagamenti.map((p) => (p.id === id ? { ...p, linkInviato: oggiIso() } : p)) })),
    // simulazione: il cliente paga online e l'incasso si registra da solo (in F2 lo farà Stripe)
    simulaPagamentoOnline: (id) =>
      setDb((d) => ({ ...d, pagamenti: d.pagamenti.map((p) => (p.id === id ? { ...p, pagatoIl: oggiIso(), metodo: 'online', automatico: true } : p)) })),
    vendiPacchetto: (clienteId, prodottoId, inizio, rate, opz) =>
      setDb((d) => {
        const p = d.prodotti.find((x) => x.id === prodottoId)!;
        const gratis = opz.formula !== 'pagamento';
        const k: PacchettoCliente = {
          id: uid(), clienteId, prodottoId, inizio,
          scadenza: toIsoLocale(aggiungiGiorni(new Date(`${inizio}T00:00`), opz.validitaGiorni)).slice(0, 10),
          sessioniTot: p.sessioni, usatePrima: 0, prezzo: gratis ? 0 : p.prezzo, formula: opz.formula,
          condivisoCon: opz.condivisoCon?.length ? opz.condivisoCon : undefined,
        };
        const condiviso = k.condivisoCon ? ' (condiviso)' : '';
        const pag: Pagamento[] = gratis
          ? []
          : rate.map((r, i) => ({
              id: uid(), clienteId, pacchettoId: k.id, attivita: p.attivita, importo: r.importo, scadenza: r.scadenza,
              descrizione: rate.length > 1 ? `${p.nome}${condiviso} – rata ${i + 1}/${rate.length}` : `${p.nome}${condiviso}`,
              pagatoIl: r.pagato ? oggiIso() : undefined, metodo: r.pagato ? 'POS' : undefined,
            }));
        return { ...d, pacchetti: [...d.pacchetti, k], pagamenti: [...d.pagamenti, ...pag] };
      }),
    proroga: (id, giorni, nota) =>
      setDb((d) => ({
        ...d,
        pacchetti: d.pacchetti.map((k) =>
          k.id === id
            ? {
                ...k,
                scadenza: toIsoLocale(aggiungiGiorni(new Date(`${k.scadenza}T00:00`), giorni)).slice(0, 10),
                proroghe: [...(k.proroghe ?? []), { data: oggiIso(), giorni, nota }],
              }
            : k,
        ),
      })),
    // PAC-01: nuovo prodotto nel catalogo (pacchetto, carnet, abbonamento…)
    aggiungiProdotto: (p) => setDb((d) => ({ ...d, prodotti: [...d.prodotti, { ...p, id: uid() }] })),
    registraMessaggio: (m) =>
      setDb((d) => ({ ...d, messaggi: [...d.messaggi, { ...m, id: uid(), data: new Date().toISOString() }] })),
    aggiornaModello: (id, testo) => setDb((d) => ({ ...d, modelli: d.modelli.map((m) => (m.id === id ? { ...m, testo } : m)) })),
    toggleTodo: (id) => setDb((d) => ({ ...d, todo: d.todo.map((t) => (t.id === id ? { ...t, fatto: !t.fatto } : t)) })),
    aggiungiTodo: (t) => setDb((d) => ({ ...d, todo: [...d.todo, { ...t, id: uid(), fatto: false }] })),
    setSoglie: (soglie) => setDb((d) => ({ ...d, soglie })),
    ripristina: () => setDb(creaDbDemo()),
  };

  return <Ctx.Provider value={az}>{children}</Ctx.Provider>;
}

export function useStore() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useStore fuori da StoreProvider');
  return c;
}
