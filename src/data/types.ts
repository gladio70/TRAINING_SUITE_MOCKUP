// Modello dati del mockup TRAINING SUITE (provvisorio: verrà rivisto sui Google Sheets reali, D-08)
// v0.3: aggiornato con le risposte di Mattia del 24/11/2026.

/** Le tre attività: ogni dato è associato a una di esse (requisito trasversale) */
export type Attivita = 'VA' | 'LT' | 'VC';

export const ATTIVITA: Record<Attivita, { nome: string; breve: string }> = {
  VA: { nome: 'Virgin Active', breve: 'Virgin' },
  LT: { nome: 'Life Training', breve: 'Life' },
  VC: { nome: 'Community', breve: 'Community' },
};

/** Stato di una persona in un singolo servizio: la stessa persona può avere stati diversi per attività */
export type StatoServizio = 'attivo' | 'pausa' | 'occasionale' | 'da verificare' | 'terminato';

export const STATI: Record<StatoServizio, { nome: string; badge: string }> = {
  attivo: { nome: 'Attivo', badge: 'ok' },
  pausa: { nome: 'In pausa', badge: 'warn' },
  occasionale: { nome: 'Occasionale', badge: 'neutral' },
  'da verificare': { nome: 'Da verificare', badge: 'danger' },
  terminato: { nome: 'Terminato', badge: 'neutral' },
};

export interface ServizioCliente {
  attivita: Attivita;
  stato: StatoServizio;
  /** data prevista di ripresa o di richiamo */
  ripresa?: string;
  nota?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  cognome: string;
  telefono: string;
  email: string;
  telegram?: string;
  servizi: ServizioCliente[];
  obiettivi: string;
  note: string;
  privacyData?: string; // ISO date del consenso
  creatoIl: string;
  fissato?: boolean; // compare in cima all'elenco clienti (es. cliente di prova per i test interni)
}

export type TipoProdotto = 'pacchetto' | 'carnet' | 'abbonamento' | 'percorso' | 'smallgroup' | 'programmazione';

export interface Prodotto {
  id: string;
  attivita: Attivita;
  nome: string;
  tipo: TipoProdotto;
  sessioni?: number; // assente = senza sessioni da scalare (abbonamento, programmazione)
  prezzo: number;
  validitaGiorni: number; // validità predefinita, modificabile alla vendita
  preavvisoOre: number; // PAC-03
  scalaTardiva: boolean; // PAC-03: disdetta tardiva scalata?
  nonVendibile?: boolean; // es. carnet storici: esistono solo quelli già venduti
}

/** Come è stato acquisito il pacchetto: pagato, gratuito o in scambio professionale */
export type Formula = 'pagamento' | 'gratuito' | 'scambio';

export interface Proroga {
  data: string;
  giorni: number;
  nota: string;
}

export interface PacchettoCliente {
  id: string;
  clienteId: string; // titolare (a cui sono intestati i pagamenti)
  condivisoCon?: string[]; // altri clienti che usano lo stesso pacchetto
  prodottoId: string;
  inizio: string;
  scadenza: string; // già comprensiva delle proroghe
  sessioniTot?: number;
  usatePrima: number; // sessioni consumate prima dei dati presenti nel mockup
  prezzo: number;
  formula: Formula;
  storico?: string; // carnet storico: condizioni già concordate da mantenere
  proroghe?: Proroga[];
}

export type Esito = 'effettuata' | 'disdetta' | 'tardiva' | 'assenza';

export const ESITI: Record<Esito, string> = {
  effettuata: 'Effettuata',
  disdetta: 'Disdetta in tempo',
  tardiva: 'Disdetta tardiva',
  assenza: 'Assenza',
};

export type Luogo = 'Virgin Active' | 'Studio' | 'Online' | 'Parco';

export interface Presenza {
  clienteId: string;
  pacchettoId?: string; // carnet scalato; assente = ingresso senza carnet
}

export interface Appuntamento {
  id: string;
  attivita: Attivita;
  servizio: string;
  luogo: Luogo;
  inizio: string; // ISO datetime
  durataMin: number;
  clienteId?: string;
  con?: string[]; // altri clienti nella stessa sessione (pacchetto condiviso)
  contatto?: string; // persona non ancora cliente (es. Body Check di un nuovo iscritto)
  gratuito?: boolean; // es. Body Check: ore contate a parte, nessun pacchetto
  daConfermare?: boolean;
  gruppo?: string; // classi / small group
  partecipanti?: number;
  presenze?: Presenza[]; // classi community: presenze effettive che scalano i carnet
  pacchettoId?: string;
  esito?: Esito;
  eccezione?: string; // nota eccezione manuale (PAC-03)
  serie?: string; // descrizione ricorrenza (AGE-02)
}

export type MetodoPagamento = 'contanti' | 'bonifico' | 'POS' | 'online';

export interface Pagamento {
  id: string;
  clienteId: string;
  pacchettoId?: string;
  attivita: Attivita;
  descrizione: string;
  importo: number;
  scadenza: string;
  pagatoIl?: string;
  metodo?: MetodoPagamento;
  automatico?: boolean; // incasso registrato da solo (pagamento online, simulato nel mockup – anteprima PAC-05)
  linkInviato?: string; // data di invio del link di pagamento
}

/** Costi professionali (anteprima ECO-03) */
export interface Costo {
  id: string;
  attivita?: Attivita; // assente = costo comune
  descrizione: string;
  categoria: 'affitto' | 'attrezzatura' | 'formazione' | 'software' | 'altro';
  importo: number;
  data: string;
}

export interface Modello {
  id: string;
  titolo: string;
  testo: string;
}

export interface MessaggioInviato {
  id: string;
  clienteId: string;
  canale: 'WhatsApp' | 'Telegram' | 'Email';
  titolo: string;
  testo: string;
  data: string;
  chiave?: string; // per non riproporre lo stesso messaggio suggerito
}

export interface Todo {
  id: string;
  testo: string;
  data: string;
  fatto: boolean;
  attivita?: Attivita;
  categoria?: 'amministrazione';
  clienteId?: string; // cosa da fare che riguarda un cliente: dagli avvisi si apre la sua scheda
}

export interface Soglie {
  residueMin: number; // DASH-03: sessioni residue <= soglia
  giorniScadenza: number; // DASH-03: scadenza entro N giorni
}

// ---------- utenti dell'app (anteprima della versione reale: nel mockup gli inviti sono simulati) ----------

export type Ruolo = 'amministratore' | 'collaboratore' | 'cliente';

export const RUOLI: Record<Ruolo, { nome: string; descrizione: string }> = {
  amministratore: { nome: 'Amministratore', descrizione: 'Vede e gestisce tutto: clienti, agenda, pagamenti, report economico, utenti e impostazioni.' },
  collaboratore: { nome: 'Collaboratore', descrizione: 'Agenda, clienti e presenze. Non vede pagamenti, report economico, utenti e impostazioni.' },
  cliente: { nome: 'Cliente', descrizione: 'Vede solo i propri dati, scelti nel riquadro “Cosa vede il cliente”. Mai i dati degli altri clienti né le note di Mattia.' },
};

export type StatoUtente = 'invitato' | 'attivo' | 'disattivato';

export interface UtenteApp {
  id: string;
  nome: string;
  email: string;
  ruolo: Ruolo;
  clienteId?: string; // per i clienti: la scheda a cui è collegato l'accesso
  stato: StatoUtente;
  invitatoIl?: string; // ISO datetime dell'ultimo invito
  canaleInvito?: 'Email' | 'WhatsApp';
  ultimoAccesso?: string; // ISO datetime
}

/** Sezioni dell'app che il cliente può vedere (da decidere con Mattia) */
export type VoceVistaCliente = 'pacchetti' | 'appuntamenti' | 'richieste' | 'pagamenti' | 'storico' | 'obiettivi';

export const VOCI_VISTA_CLIENTE: { voce: VoceVistaCliente; nome: string; descrizione: string }[] = [
  { voce: 'pacchetti', nome: 'Pacchetti e sessioni residue', descrizione: 'Pacchetto o carnet in corso, sessioni rimaste e scadenza.' },
  { voce: 'appuntamenti', nome: 'Prossimi appuntamenti', descrizione: 'Data, ora e luogo delle prossime sessioni.' },
  { voce: 'richieste', nome: 'Richiesta di spostamento o disdetta', descrizione: 'Il cliente chiede dall’app; Mattia conferma (resta la regola delle 24 ore).' },
  { voce: 'pagamenti', nome: 'Pagamenti', descrizione: 'Rate da pagare con scadenza e pagamenti già fatti; in futuro “Paga online”.' },
  { voce: 'storico', nome: 'Storico sessioni', descrizione: 'Sessioni fatte, disdette e assenze (cosa è stato scalato).' },
  { voce: 'obiettivi', nome: 'Obiettivi', descrizione: 'Gli obiettivi scritti da Mattia nella scheda cliente (le note restano private).' },
];

export interface Db {
  clienti: Cliente[];
  prodotti: Prodotto[];
  pacchetti: PacchettoCliente[];
  appuntamenti: Appuntamento[];
  pagamenti: Pagamento[];
  costi: Costo[];
  modelli: Modello[];
  messaggi: MessaggioInviato[];
  todo: Todo[];
  soglie: Soglie;
  utenti: UtenteApp[];
  vistaCliente: Record<VoceVistaCliente, boolean>;
  /** Migrazioni dei dati salvati già applicate (per non ripeterle) */
  migrazioni?: string[];
}
