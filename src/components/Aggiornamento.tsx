// All'apertura della app controlla se su GitHub c'è una versione nuova e la carica.
// Il controllo si ripete quando la app torna in primo piano (sul telefono una PWA
// spesso non viene riaperta da zero ma ripresa dallo sfondo).
import { useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { applicaAggiornamento, cercaAggiornamento, etichettaVersione, type InfoVersione } from '../lib/versione';

const INTERVALLO_MINIMO = 60_000; // non più di un controllo al minuto

export function Aggiornamento() {
  const [stato, setStato] = useState<{ remota: InfoVersione; inCorso: boolean } | null>(null);
  const ultimo = useRef(0);

  useEffect(() => {
    let attivo = true;

    const controlla = async (apertura: boolean) => {
      if (Date.now() - ultimo.current < INTERVALLO_MINIMO) return;
      ultimo.current = Date.now();
      const remota = await cercaAggiornamento();
      if (!attivo || !remota) return;
      if (apertura) {
        // all'apertura non c'è lavoro in corso: si aggiorna subito
        setStato({ remota, inCorso: true });
        setTimeout(() => {
          if (!applicaAggiornamento(remota)) setStato(null);
        }, 900);
      } else {
        // al ritorno dallo sfondo potrebbe esserci un modulo a metà: si chiede prima
        setStato({ remota, inCorso: false });
      }
    };

    controlla(true);
    const alRitorno = () => document.visibilityState === 'visible' && controlla(false);
    document.addEventListener('visibilitychange', alRitorno);
    return () => {
      attivo = false;
      document.removeEventListener('visibilitychange', alRitorno);
    };
  }, []);

  if (!stato) return null;
  const { remota, inCorso } = stato;

  return (
    <div className="aggiornamento" role="status">
      <RefreshCw size={18} className={inCorso ? 'gira' : ''} />
      <span className="grow">
        {inCorso ? 'Aggiornamento alla nuova versione…' : 'È disponibile una nuova versione'}
        <span className="small"> {etichettaVersione(remota)}</span>
      </span>
      {!inCorso && (
        <>
          <button className="btn primary" onClick={() => { setStato({ remota, inCorso: true }); applicaAggiornamento(remota, true); }}>
            Aggiorna
          </button>
          <button className="btn" onClick={() => setStato(null)}>Dopo</button>
        </>
      )}
    </div>
  );
}
