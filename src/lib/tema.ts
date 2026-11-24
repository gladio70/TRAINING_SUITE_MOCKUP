// Tema dell'app: scuro (predefinito) o chiaro. La scelta resta salvata su questo dispositivo.
// index.html lo applica già all'apertura, prima che la pagina venga disegnata.
export type Tema = 'dark' | 'light';

const CHIAVE = 'training_suite-tema';
const COLORE_BARRA: Record<Tema, string> = { dark: '#12151b', light: '#f4f5f7' };

export function temaAttuale(): Tema {
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

export function impostaTema(t: Tema) {
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLORE_BARRA[t]);
  try {
    localStorage.setItem(CHIAVE, t);
  } catch {
    /* senza storage il tema vale fino alla chiusura */
  }
}
