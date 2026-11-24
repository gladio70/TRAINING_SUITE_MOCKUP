// Stato di installazione dell'app (PWA) e pulsante "Installa app".
// Chrome/Edge su Android e computer, quando l'app è installabile e non ancora installata, inviano l'evento
// "beforeinstallprompt": lo teniamo da parte e lo usiamo quando l'utente tocca "Installa app".
// Va registrato il prima possibile (main.tsx), perché l'evento arriva subito dopo il caricamento.

interface ProposteInstallazione extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let proposta: ProposteInstallazione | null = null;
let installataOra = false;
const ascoltatori = new Set<() => void>();
const avvisa = () => ascoltatori.forEach((f) => f());

export function avviaRilevamentoInstallazione() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // niente banner automatico: l'installazione parte dal pulsante in Impostazioni
    proposta = e as ProposteInstallazione;
    avvisa();
  });
  window.addEventListener('appinstalled', () => {
    proposta = null;
    installataOra = true;
    avvisa();
  });
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', avvisa);
}

/** L'app è aperta come app installata (finestra propria, senza barra del browser)? */
export function apertaComeApp() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export const installabile = () => proposta !== null;
export const appenaInstallata = () => installataOra;
export const suIPhone = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/** Mostra la finestra di installazione del browser; restituisce true se l'utente ha confermato */
export async function installa(): Promise<boolean> {
  if (!proposta) return false;
  const p = proposta;
  proposta = null;
  await p.prompt();
  const { outcome } = await p.userChoice;
  avvisa();
  return outcome === 'accepted';
}

export function seguiInstallazione(f: () => void) {
  ascoltatori.add(f);
  return () => {
    ascoltatori.delete(f);
  };
}
