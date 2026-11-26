// Login della app pubblicata su Cloudflare (training-suite-mockup.pages.dev).
// All'apertura chiede al server chi ha fatto l'accesso (/api/accesso):
// - se il server non c'è (GitHub Pages o sviluppo sul PC) l'app resta libera, come prima;
// - se c'è e nessuno ha fatto l'accesso, mostra la schermata di accesso;
// - senza rete lascia entrare chi aveva già fatto l'accesso su questo dispositivo.
import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { KeyRound, LogIn, UserPlus } from 'lucide-react';

export interface Utente {
  email: string;
  nome: string;
}
interface RispostaAccesso {
  ok: boolean;
  errore?: string;
  utente?: Utente | null;
  ciSonoUtenti?: boolean;
}

const MEMORIA = 'ts-accesso'; // ultimo utente entrato su questo dispositivo (serve solo senza rete)

const ricorda = (u: Utente | null) => {
  try {
    if (u) localStorage.setItem(MEMORIA, JSON.stringify(u));
    else localStorage.removeItem(MEMORIA);
  } catch {
    /* memoria del browser non disponibile */
  }
};
const ricordato = (): Utente | null => {
  try {
    return JSON.parse(localStorage.getItem(MEMORIA) ?? 'null') as Utente | null;
  } catch {
    return null;
  }
};

/** Chiamata al server; null se il server di Cloudflare non c'è (la risposta non è JSON) */
async function chiama(corpo?: object): Promise<RispostaAccesso | null> {
  const r = await fetch('api/accesso', corpo
    ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo), credentials: 'same-origin' }
    : { credentials: 'same-origin', cache: 'no-store' });
  if (!(r.headers.get('content-type') ?? '').includes('application/json')) return null;
  return (await r.json()) as RispostaAccesso;
}

interface ContestoAccesso {
  /** utente entrato; null dove la login non è prevista (GitHub Pages) */
  utente: Utente | null;
  senzaRete: boolean;
  esci: () => Promise<void>;
}
const Contesto = createContext<ContestoAccesso>({ utente: null, senzaRete: false, esci: async () => {} });
export const useAccesso = () => useContext(Contesto);

type Stato =
  | { fase: 'verifica' }
  | { fase: 'libera' }
  | { fase: 'dentro'; utente: Utente; senzaRete: boolean }
  | { fase: 'fuori'; ciSonoUtenti: boolean }
  | { fase: 'errore'; messaggio: string };

export function Accesso({ children }: { children: ReactNode }) {
  const [stato, setStato] = useState<Stato>({ fase: 'verifica' });

  const verifica = async () => {
    setStato({ fase: 'verifica' });
    try {
      const r = await chiama();
      if (!r) return setStato({ fase: 'libera' });
      if (!r.ok) return setStato({ fase: 'errore', messaggio: r.errore ?? 'Errore del server.' });
      ricorda(r.utente ?? null);
      setStato(r.utente ? { fase: 'dentro', utente: r.utente, senzaRete: false } : { fase: 'fuori', ciSonoUtenti: !!r.ciSonoUtenti });
    } catch {
      const u = ricordato();
      setStato(u ? { fase: 'dentro', utente: u, senzaRete: true } : { fase: 'errore', messaggio: 'Serve la connessione a internet per fare l’accesso.' });
    }
  };

  useEffect(() => {
    verifica();
  }, []);

  const esci = async () => {
    try {
      await chiama({ azione: 'esci' });
    } catch {
      /* senza rete la sessione sul server resta aperta fino alla scadenza */
    }
    ricorda(null);
    setStato({ fase: 'fuori', ciSonoUtenti: true });
  };

  if (stato.fase === 'libera') return <Contesto.Provider value={{ utente: null, senzaRete: false, esci }}>{children}</Contesto.Provider>;
  if (stato.fase === 'dentro')
    return <Contesto.Provider value={{ utente: stato.utente, senzaRete: stato.senzaRete, esci }}>{children}</Contesto.Provider>;

  return (
    <div className="accesso">
      <div className="card accesso-card">
        <div className="accesso-logo">
          <img src="icon-192.png" alt="" />
          <div>
            <b>Training Suite</b>
            <div className="small muted">Mockup · accesso riservato</div>
          </div>
        </div>
        {stato.fase === 'verifica' && <p className="small muted">Verifica dell’accesso…</p>}
        {stato.fase === 'errore' && (
          <>
            <p className="small" style={{ color: 'var(--danger)' }}>{stato.messaggio}</p>
            <button className="btn primary pulsante-largo" onClick={verifica}>Riprova</button>
          </>
        )}
        {stato.fase === 'fuori' && (
          <ModuloAccesso
            primoAvvio={!stato.ciSonoUtenti}
            entrato={(u) => {
              ricorda(u);
              setStato({ fase: 'dentro', utente: u, senzaRete: false });
            }}
          />
        )}
      </div>
    </div>
  );
}

type Modo = 'entra' | 'crea' | 'reimposta';
const TITOLI: Record<Modo, string> = { entra: 'Accedi', crea: 'Nuovo utente', reimposta: 'Password dimenticata' };

function ModuloAccesso({ primoAvvio, entrato }: { primoAvvio: boolean; entrato: (u: Utente) => void }) {
  const [modo, setModo] = useState<Modo>(primoAvvio ? 'crea' : 'entra');
  const [campi, setCampi] = useState({ nome: '', email: '', password: '', codice: '' });
  const [errore, setErrore] = useState('');
  const [attesa, setAttesa] = useState(false);
  const imposta = (k: keyof typeof campi) => (e: { target: { value: string } }) => setCampi({ ...campi, [k]: e.target.value });
  const vaiA = (m: Modo) => {
    setModo(m);
    setErrore('');
    setCampi({ ...campi, password: '', codice: '' });
  };
  const conCodice = modo !== 'entra';

  const invia = async (e: FormEvent) => {
    e.preventDefault();
    setErrore('');
    setAttesa(true);
    try {
      const corpo =
        modo === 'crea' ? { azione: 'crea', ...campi }
        : modo === 'reimposta' ? { azione: 'reimposta', email: campi.email, password: campi.password, codice: campi.codice }
        : { azione: 'entra', email: campi.email, password: campi.password };
      const r = await chiama(corpo);
      if (r?.ok && r.utente) entrato(r.utente);
      else setErrore(r?.errore ?? 'Risposta non valida dal server.');
    } catch {
      setErrore('Nessuna risposta dal server: controlla la connessione.');
    }
    setAttesa(false);
  };

  return (
    <form onSubmit={invia}>
      <h2 style={{ margin: '4px 0 2px' }}>{TITOLI[modo]}</h2>
      {modo === 'crea' && (
        <p className="small muted" style={{ margin: 0 }}>
          {primoAvvio ? 'Non c’è ancora nessun utente: crea il primo. ' : ''}Serve il codice di attivazione impostato su Cloudflare.
        </p>
      )}
      {modo === 'reimposta' && (
        <p className="small muted" style={{ margin: 0 }}>
          Scegli una password nuova: serve il codice di attivazione impostato su Cloudflare. Gli altri dispositivi dovranno rifare l’accesso.
        </p>
      )}
      {modo === 'crea' && (
        <>
          <label className="lbl" htmlFor="acc-nome">Nome</label>
          <input id="acc-nome" className="field" autoComplete="name" value={campi.nome} onChange={imposta('nome')} required />
        </>
      )}
      <label className="lbl" htmlFor="acc-email">Email</label>
      <input id="acc-email" className="field" type="email" autoComplete="username" value={campi.email} onChange={imposta('email')} required />
      <label className="lbl" htmlFor="acc-password">
        {modo === 'reimposta' ? 'Nuova password' : 'Password'}{conCodice ? ' (almeno 8 caratteri)' : ''}
      </label>
      <input
        id="acc-password"
        className="field"
        type="password"
        autoComplete={conCodice ? 'new-password' : 'current-password'}
        minLength={conCodice ? 8 : undefined}
        value={campi.password}
        onChange={imposta('password')}
        required
      />
      {conCodice && (
        <>
          <label className="lbl" htmlFor="acc-codice">Codice di attivazione</label>
          <input id="acc-codice" className="field" type="password" autoComplete="off" value={campi.codice} onChange={imposta('codice')} required />
        </>
      )}
      {errore && <p className="small" style={{ color: 'var(--danger)', marginBottom: 0 }}>{errore}</p>}
      <button className="btn primary pulsante-largo" type="submit" disabled={attesa}>
        {modo === 'crea' ? <UserPlus size={16} /> : modo === 'reimposta' ? <KeyRound size={16} /> : <LogIn size={16} />}{' '}
        {attesa ? 'Attendere…' : modo === 'crea' ? 'Crea utente ed entra' : modo === 'reimposta' ? 'Cambia password ed entra' : 'Entra'}
      </button>
      {!primoAvvio && (
        <div className="accesso-link">
          {modo !== 'entra' && (
            <button type="button" className="btn ghost small" onClick={() => vaiA('entra')}>
              <LogIn size={14} /> Torna all’accesso
            </button>
          )}
          {modo !== 'reimposta' && (
            <button type="button" className="btn ghost small" onClick={() => vaiA('reimposta')}>
              <KeyRound size={14} /> Password dimenticata
            </button>
          )}
          {modo !== 'crea' && (
            <button type="button" className="btn ghost small" onClick={() => vaiA('crea')}>
              <UserPlus size={14} /> Nuovo utente
            </button>
          )}
        </div>
      )}
    </form>
  );
}
