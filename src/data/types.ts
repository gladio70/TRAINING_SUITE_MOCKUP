// Modello dati del mockup TRAINING SUITE (provvisorio: verrà rivisto sui Google Sheets reali, D-08)

/** Le tre attività: ogni dato è associato a una di esse (requisito trasversale) */
export type Attivita = 'VA' | 'LT' | 'VC';

export const ATTIVITA: Record<Attivita, { nome: string; breve: string }> = {
  VA: { nome: 'Virgin Active', breve: 'Virgin' },
  LT: { nome: 'Life Training', breve: 'Life' },
  VC: { nome: 'Verticalisthenics Community', breve: 'Community' },
};

export type StatoCliente = 'attivo' | 'sospeso' | 'ex';

export interface Cliente {
  id: string;
  nome: string;
  cognome: string;
  telefono: string;
  email: string;
  telegram?: string;
  attivita: Attivita[];
  stato: StatoCliente;
  obiettivi: string;
  note: string;
  privacyData?: string; // ISO date del consenso
  creatoIl: string;
}

export type TipoProdotto = 'pacchetto' | 'abbonamento' | 'percorso' | 'smallgroup';

export interface Prodotto {
  id: string;
  attivita: Attivita;
  nome: string;
  tipo: TipoProdotto;
  sessioni?: number; // assente = illimitato (abbonamento)
  prezzo: number;
  validitaGiorni: number;
  preavvisoOre: number; // PAC-03
  scalaTardiva: boolean; // PAC-03: disdetta tardiva scalata?
}

export interface PacchettoCliente {
  id: string;
  clienteId: string;
  prodottoId: string;
  inizio: string;
  scadenza: string;
  sessioniTot?: number;
  usatePrima: number; // sessioni consumate prima dei dati presenti nel mockup
  prezzo: number;
}

export type Esito = 'effettuata' | 'disdetta' | 'tardiva' | 'assenza';

export const ESITI: Record<Esito, string> = {
  effettuata: 'Effettuata',
  disdetta: 'Disdetta in tempo',
  tardiva: 'Disdetta tardiva',
  assenza: 'Assenza',
};

export type Luogo = 'Virgin Active' | 'Studio' | 'Online' | 'Parco';

export interface Appuntamento {
  id: string;
  attivita: Attivita;
  servizio: string;
  luogo: Luogo;
  inizio: string; // ISO datetime
  durataMin: number;
  clienteId?: string;
  gruppo?: string; // classi / small group
  partecipanti?: number;
  pacchettoId?: string;
  esito?: Esito;
  eccezione?: string; // nota eccezione manuale (PAC-03)
  serie?: string; // descrizione ricorrenza (AGE-02)
}

export type MetodoPagamento = 'contanti' | 'bonifico' | 'POS';

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
}

export interface Soglie {
  residueMin: number; // DASH-03: sessioni residue <= soglia
  giorniScadenza: number; // DASH-03: scadenza entro N giorni
}

export interface Db {
  clienti: Cliente[];
  prodotti: Prodotto[];
  pacchetti: PacchettoCliente[];
  appuntamenti: Appuntamento[];
  pagamenti: Pagamento[];
  modelli: Modello[];
  messaggi: MessaggioInviato[];
  todo: Todo[];
  soglie: Soglie;
}
