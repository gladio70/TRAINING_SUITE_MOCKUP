// Soglie degli avvisi (DASH-03) e gestione dei dati dimostrativi
import { useStore } from '../data/store';
import { VERSIONE, etichettaVersione } from '../lib/versione';

export function Impostazioni() {
  const { db, setSoglie, ripristina } = useStore();
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Impostazioni</h1>
        </div>
      </div>
      <div className="grid grid-2">
        <div className="card" style={{ margin: 0 }}>
          <h2>Soglie degli avvisi</h2>
          <label className="lbl">Avvisa quando le sessioni residue sono al massimo</label>
          <input className="field" type="number" min={0} max={10} value={db.soglie.residueMin}
            onChange={(e) => setSoglie({ ...db.soglie, residueMin: Number(e.target.value) })} />
          <label className="lbl">Avvisa quando pacchetti e abbonamenti scadono entro (giorni)</label>
          <input className="field" type="number" min={1} max={60} value={db.soglie.giorniScadenza}
            onChange={(e) => setSoglie({ ...db.soglie, giorniScadenza: Number(e.target.value) })} />
        </div>
        <div className="card" style={{ margin: 0 }}>
          <h2>Dati dimostrativi</h2>
          <p className="small muted">
            Questo è un mockup: i dati sono inventati e le modifiche restano salvate solo in questo browser.
          </p>
          <p className="small muted">
            Versione {etichettaVersione()} del {new Date(VERSIONE.data).toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' })}.
            A ogni apertura la app controlla se ne è uscita una nuova e la carica da sola.
          </p>
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
