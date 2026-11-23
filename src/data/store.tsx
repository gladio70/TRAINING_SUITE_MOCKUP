// Archivio del mockup: tutto in memoria, salvato nel localStorage del browser.
// Nella versione reale sarà sostituito dalle API (Cloudflare Workers + D1).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Appuntamento, Cliente, Db, Esito, MessaggioInviato, PacchettoCliente, Pagamento, Soglie, Todo } from './types';
import { creaDbDemo } from './mock';
import { aggiungiGiorni, toIsoLocale, uid } from '../lib/format';

const CHIAVE = 'training_suite-mockup-v1';

function carica(): Db {
  try {
    const s = localStorage.getItem(CHIAVE);
    if (s) return JSON.parse(s) as Db;
  } catch {
    /* storage non disponibile: si riparte dai dati demo */
  }
  return creaDbDemo();
}

interface Azioni {
  db: Db;
  setEsito: (id: string, esito: Esito | undefined, eccezione?: string) => void;
  aggiungiAppuntamenti: (a: Omit<Appuntamento, 'id'>[]) => void;
  salvaCliente: (c: Cliente) => void;
  nuovoCliente: (c: Omit<Cliente, 'id' | 'creatoIl'>) => string;
  registraPagamento: (id: string, metodo: Pagamento['metodo']) => void;
  aggiungiPagamento: (p: Omit<Pagamento, 'id'>) => void;
  vendiPacchetto: (clienteId: string, prodottoId: string, inizio: string, rate: { importo: number; scadenza: string; pagato: boolean }[]) => void;
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
    aggiungiAppuntamenti: (lista) =>
      setDb((d) => ({ ...d, appuntamenti: [...d.appuntamenti, ...lista.map((a) => ({ ...a, id: uid() }))] })),
    salvaCliente: (c) => setDb((d) => ({ ...d, clienti: d.clienti.map((x) => (x.id === c.id ? c : x)) })),
    nuovoCliente: (c) => {
      const id = uid();
      setDb((d) => ({ ...d, clienti: [...d.clienti, { ...c, id, creatoIl: new Date().toISOString().slice(0, 10) }] }));
      return id;
    },
    registraPagamento: (id, metodo) =>
      setDb((d) => ({
        ...d,
        pagamenti: d.pagamenti.map((p) => (p.id === id ? { ...p, pagatoIl: new Date().toISOString().slice(0, 10), metodo } : p)),
      })),
    aggiungiPagamento: (p) => setDb((d) => ({ ...d, pagamenti: [...d.pagamenti, { ...p, id: uid() }] })),
    vendiPacchetto: (clienteId, prodottoId, inizio, rate) =>
      setDb((d) => {
        const p = d.prodotti.find((x) => x.id === prodottoId)!;
        const k: PacchettoCliente = {
          id: uid(), clienteId, prodottoId, inizio, scadenza: toIsoLocale(aggiungiGiorni(new Date(`${inizio}T00:00`), p.validitaGiorni)).slice(0, 10),
          sessioniTot: p.sessioni, usatePrima: 0, prezzo: p.prezzo,
        };
        const oggi = toIsoLocale(new Date()).slice(0, 10);
        const pag: Pagamento[] = rate.map((r, i) => ({
          id: uid(), clienteId, pacchettoId: k.id, attivita: p.attivita, importo: r.importo, scadenza: r.scadenza,
          descrizione: rate.length > 1 ? `${p.nome} – rata ${i + 1}/${rate.length}` : p.nome,
          pagatoIl: r.pagato ? oggi : undefined, metodo: r.pagato ? 'POS' : undefined,
        }));
        return { ...d, pacchetti: [...d.pacchetti, k], pagamenti: [...d.pagamenti, ...pag] };
      }),
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
