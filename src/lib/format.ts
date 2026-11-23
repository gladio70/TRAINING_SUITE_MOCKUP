const LOCALE = 'it-IT';

export const fmtEuro = (n: number) =>
  new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'EUR' }).format(n);

export const fmtData = (iso: string) =>
  new Date(iso).toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtDataLunga = (iso: string | Date) =>
  new Date(iso).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

export const fmtDataBreve = (iso: string) =>
  new Date(iso).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });

export const fmtOra = (iso: string) =>
  new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

export const inizioGiorno = (d: Date = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const aggiungiGiorni = (d: Date, n: number) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

/** Lunedì della settimana che contiene d */
export const inizioSettimana = (d: Date) => {
  const x = inizioGiorno(d);
  const dow = (x.getDay() + 6) % 7;
  return aggiungiGiorni(x, -dow);
};

export const stessoGiorno = (a: Date | string, b: Date | string) =>
  inizioGiorno(new Date(a)).getTime() === inizioGiorno(new Date(b)).getTime();

export const giorniTra = (da: Date, a: Date) =>
  Math.round((inizioGiorno(a).getTime() - inizioGiorno(da).getTime()) / 86400000);

export const toIsoLocale = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

export const uid = () => Math.random().toString(36).slice(2, 10);

export const riempi = (testo: string, campi: Record<string, string>) =>
  testo.replace(/\{(\w+)\}/g, (m, k: string) => campi[k] ?? m);
