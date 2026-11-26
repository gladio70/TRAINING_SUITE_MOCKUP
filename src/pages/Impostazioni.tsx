// Aspetto (tema), soglie degli avvisi (DASH-03) e gestione dei dati dimostrativi.
// Si apre dalla rotella nella pagina Oggi.
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Download, Globe, Moon, Smartphone, Sun } from 'lucide-react';
import { apertaComeApp, appenaInstallata, installa, installabile, seguiInstallazione, suIPhone } from '../lib/installazione';
import { useStore } from '../data/store';
import { CampoNumero } from '../components/ui';
import { VERSIONE, etichettaVersione } from '../lib/versione';
import { impostaTema, temaAttuale, type Tema } from '../lib/tema';

/** Come è aperta l'app e, se il browser lo consente, pulsante per installarla */
function StatoInstallazione() {
  const [, aggiorna] = useState(0);
  useEffect(() => seguiInstallazione(() => aggiorna((n) => n + 1)), []);
  const comeApp = apertaComeApp();
  const sw = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;

  let stato: string;
  let spiegazione: string | null = null;
  if (comeApp) stato = 'Aperta come app installata';
  else if (appenaInstallata()) stato = 'Installata: aprila dall’icona sulla schermata Home';
  else {
    stato = 'Aperta nel browser';
    if (installabile()) spiegazione = null;
    else if (suIPhone()) spiegazione = 'Su iPhone: tasto Condividi → “Aggiungi alla schermata Home”.';
    else
      spiegazione =
        'Il browser non propone l’installazione: probabilmente è già installata su questo dispositivo (cerca “Training Suite” tra le app e disinstallala per reinstallarla) oppure usa il menu ⋮ → “Aggiungi a schermata Home” → “Installa”.';
  }

  return (
    <div className="stato-installazione">
      <div className="row" style={{ justifyContent: 'space-between', gap: 8 }}>
        <span className="row" style={{ gap: 6 }}>
          {comeApp || appenaInstallata() ? <Smartphone size={16} /> : <Globe size={16} />}
          <b>{stato}</b>
        </span>
        {!comeApp && installabile() && (
          <button className="btn primary sm" onClick={() => installa()}>
            <Download size={14} /> Installa app
          </button>
        )}
      </div>
      {spiegazione && <p className="small muted" style={{ margin: '6px 0 0' }}>{spiegazione}</p>}
      <p className="small muted" style={{ margin: '6px 0 0' }}>Funzionamento senza rete: {sw ? 'attivo' : 'non attivo'}</p>
    </div>
  );
}

export function Impostazioni() {
  const { db, setSoglie, ripristina } = useStore();
  const [tema, setTema] = useState<Tema>(temaAttuale);
  const scegli = (t: Tema) => {
    impostaTema(t);
    setTema(t);
  };

  return (
    <>
      <Link to="/" className="btn ghost sm" style={{ marginBottom: 8 }}>
        <ArrowLeft size={16} /> Oggi
      </Link>
      <div className="page-head">
        <div>
          <h1>Impostazioni</h1>
        </div>
      </div>
      <div className="grid grid-2">
        <div>
          <div className="card" style={{ marginTop: 0 }}>
            <h2>Aspetto</h2>
            <label className="lbl">Tema</label>
            <div className="tabs tema">
              <button className={tema === 'dark' ? 'on' : ''} onClick={() => scegli('dark')}>
                <Moon size={15} /> Dark
              </button>
              <button className={tema === 'light' ? 'on' : ''} onClick={() => scegli('light')}>
                <Sun size={15} /> Light
              </button>
            </div>
            <p className="small muted">Predefinito: Dark. La scelta resta salvata su questo dispositivo.</p>
          </div>
          <div className="card">
            <h2>Soglie degli avvisi</h2>
            <label className="lbl">Avvisa quando le sessioni residue sono al massimo</label>
            <CampoNumero min={0} max={10} valore={db.soglie.residueMin} onChange={(n) => setSoglie({ ...db.soglie, residueMin: n })} />
            <label className="lbl">Avvisa quando pacchetti e abbonamenti scadono entro (giorni)</label>
            <CampoNumero min={1} max={60} valore={db.soglie.giorniScadenza} onChange={(n) => setSoglie({ ...db.soglie, giorniScadenza: n })} />
            <p className="small muted">Valori ammessi: residue da 0 a 10, giorni da 1 a 60.</p>
          </div>
        </div>
        <div className="card" style={{ margin: 0 }}>
          <h2>Informazioni Applicazione</h2>
          <p className="small">
            Questo è un <b>mockup dell’applicazione Training Suite</b>: serve a provare schermate e flussi prima di realizzare la versione reale.
          </p>
          <p className="small muted">
            I dati sono inventati e le modifiche restano salvate solo in questo browser.
          </p>
          <p className="small muted">
            Versione {etichettaVersione()} del {new Date(VERSIONE.data).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}.
            A ogni apertura la app controlla se ne è uscita una nuova e la carica da sola.
          </p>
          <a className="btn link-manuale" href="manuale-utente.pdf" target="_blank" rel="noopener">
            <BookOpen size={16} /> Manuale utente (PDF)
          </a>
          <StatoInstallazione />
          <button className="btn" onClick={() => confirm('Ripristinare i dati dimostrativi? Le modifiche fatte andranno perse.') && ripristina()}>
            Ripristina dati demo
          </button>
          <h2 style={{ marginTop: 20 }}>Integrazioni (versione reale)</h2>
          <ul className="small muted" style={{ paddingLeft: 18 }}>
            <li>Google Calendar – appuntamenti visibili nel calendario (F1), sincronizzazione nei due sensi (F2)</li>
            <li>Bot Telegram ed email – promemoria automatici (F2)</li>
            <li>Stripe – pagamenti con link e abbonamenti (F2–F3)</li>
          </ul>
        </div>
      </div>
    </>
  );
}
