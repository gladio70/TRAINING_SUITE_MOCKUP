// Controllo di nuove versioni pubblicate su GitHub Pages.
// Ogni build pubblica version.json; la app lo rilegge dal server (senza cache)
// e, se la build è diversa dalla propria, ricarica la pagina con la versione nuova.

export type InfoVersione = typeof __VERSIONE__;

export const VERSIONE: InfoVersione = __VERSIONE__;

export const etichettaVersione = (v: InfoVersione = VERSIONE) => `v${v.versione} · ${v.build}`;

/** Restituisce la versione sul server se è diversa da quella in uso, altrimenti null. */
export async function cercaAggiornamento(): Promise<InfoVersione | null> {
  if (import.meta.env.DEV) return null; // in sviluppo la pagina si aggiorna già da sola
  try {
    const r = await fetch(`version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const remota = (await r.json()) as InfoVersione;
    return remota.build && remota.build !== VERSIONE.build ? remota : null;
  } catch {
    return null; // offline o server non raggiungibile: si continua con la versione in uso
  }
}

const CHIAVE_TENTATIVO = 'training_suite-aggiornamento';

/**
 * Ricarica la app chiedendo la pagina con un parametro nuovo, così il telefono
 * non riusa la copia in cache. Se per quella build ci si è già provato in questa
 * sessione (es. il server non ha ancora finito di pubblicare) non riprova, per
 * evitare ricaricamenti a ripetizione.
 */
export function applicaAggiornamento(remota: InfoVersione, forza = false): boolean {
  try {
    if (!forza && sessionStorage.getItem(CHIAVE_TENTATIVO) === remota.build) return false;
    sessionStorage.setItem(CHIAVE_TENTATIVO, remota.build);
  } catch {
    /* sessionStorage non disponibile: si ricarica comunque una volta */
  }
  const { pathname, hash } = window.location;
  window.location.replace(`${pathname}?v=${encodeURIComponent(remota.build)}${hash}`);
  return true;
}
