// Dati dimostrativi, generati relativamente alla data di oggi così il mockup è sempre "vivo".
// Nomi e numeri sono inventati.
import type { Appuntamento, Cliente, Db, Esito, PacchettoCliente, Pagamento, Prodotto } from './types';
import { aggiungiGiorni, inizioGiorno, inizioSettimana, toIsoLocale } from '../lib/format';

const oggi = inizioGiorno();
const g = (n: number) => toIsoLocale(aggiungiGiorni(oggi, n)).slice(0, 10);
const at = (data: Date, h: number, m = 0) => {
  const x = new Date(data);
  x.setHours(h, m, 0, 0);
  return toIsoLocale(x);
};

const prodotti: Prodotto[] = [
  { id: 'p-va-pt10', attivita: 'VA', nome: 'PT Virgin – 10 sessioni', tipo: 'pacchetto', sessioni: 10, prezzo: 450, validitaGiorni: 90, preavvisoOre: 24, scalaTardiva: true },
  { id: 'p-va-sg', attivita: 'VA', nome: 'Small Group Virgin – mensile', tipo: 'smallgroup', sessioni: 8, prezzo: 120, validitaGiorni: 30, preavvisoOre: 12, scalaTardiva: true },
  { id: 'p-lt-pt10', attivita: 'LT', nome: 'PT Studio – 10 sessioni', tipo: 'pacchetto', sessioni: 10, prezzo: 500, validitaGiorni: 90, preavvisoOre: 24, scalaTardiva: true },
  { id: 'p-lt-coach', attivita: 'LT', nome: 'Percorso Coaching – 3 mesi', tipo: 'percorso', sessioni: 6, prezzo: 600, validitaGiorni: 90, preavvisoOre: 48, scalaTardiva: false },
  { id: 'p-lt-online', attivita: 'LT', nome: 'Online – mensile', tipo: 'abbonamento', prezzo: 80, validitaGiorni: 30, preavvisoOre: 24, scalaTardiva: false },
  { id: 'p-vc-mese', attivita: 'VC', nome: 'Community – abbonamento mensile', tipo: 'abbonamento', prezzo: 60, validitaGiorni: 30, preavvisoOre: 6, scalaTardiva: false },
  { id: 'p-vc-carnet', attivita: 'VC', nome: 'Community – carnet 10 ingressi', tipo: 'pacchetto', sessioni: 10, prezzo: 120, validitaGiorni: 120, preavvisoOre: 6, scalaTardiva: true },
];

type C = [string, string, Cliente['attivita'], string];
const anag: C[] = [
  ['Giulia', 'Ferri', ['VA'], 'Tonificazione e postura'],
  ['Marco', 'Bellini', ['VA'], 'Perdere 6 kg entro l’estate'],
  ['Sara', 'Conti', ['LT'], 'Prima trazione alla sbarra'],
  ['Luca', 'Moretti', ['LT'], 'Gestione stress e routine'],
  ['Elena', 'Rinaldi', ['LT', 'VC'], 'Verticale libera'],
  ['Davide', 'Gallo', ['VA'], 'Rientro dopo infortunio al ginocchio'],
  ['Chiara', 'Marini', ['LT'], 'Allenamento online 3 volte a settimana'],
  ['Paolo', 'Esposito', ['VC'], 'Muscle-up'],
  ['Francesca', 'Romano', ['VA'], 'Forza generale'],
  ['Andrea', 'Ricci', ['VC'], 'Front lever'],
  ['Martina', 'Greco', ['LT'], 'Mobilità e flessibilità'],
  ['Stefano', 'Bruno', ['VA', 'VC'], 'Ricomposizione corporea'],
  ['Valentina', 'Costa', ['VC'], 'Handstand'],
  ['Roberto', 'Fontana', ['LT'], 'Coaching carriera e abitudini'],
];

const clienti: Cliente[] = anag.map(([nome, cognome, attivita, obiettivi], i) => ({
  id: `c${i + 1}`,
  nome,
  cognome,
  telefono: `+39 34${i % 10} ${String(1000000 + i * 73519).slice(0, 7)}`,
  email: `${nome.toLowerCase()}.${cognome.toLowerCase()}@esempio.it`,
  telegram: i % 3 === 0 ? `@${nome.toLowerCase()}${i}` : undefined,
  attivita,
  stato: i === 13 ? 'sospeso' : 'attivo',
  obiettivi,
  note: i === 5 ? 'Evitare carichi assiali pesanti fino a nuova indicazione del fisioterapista.' : '',
  privacyData: i === 9 ? undefined : g(-60 - i * 5),
  creatoIl: g(-90 - i * 7),
}));
clienti.push({
  id: 'c15', nome: 'Alessio', cognome: 'Lombardi', telefono: '+39 333 1234567', email: 'alessio.lombardi@esempio.it',
  attivita: ['VA'], stato: 'ex', obiettivi: 'Preparazione concorso', note: 'Concluso a settembre.', privacyData: g(-300), creatoIl: g(-320),
});

// pacchetti: [cliente, prodotto, giorni dall'inizio, usate prima]
const pk: [string, string, number, number][] = [
  ['c1', 'p-va-pt10', -70, 6], // poche residue
  ['c2', 'p-va-pt10', -20, 1],
  ['c3', 'p-lt-pt10', -80, 5], // scade a breve
  ['c4', 'p-lt-coach', -40, 2],
  ['c5', 'p-lt-pt10', -10, 0],
  ['c5', 'p-vc-mese', -22, 0], // abbonamento in scadenza
  ['c6', 'p-va-pt10', -45, 4],
  ['c7', 'p-lt-online', -25, 0], // in scadenza
  ['c8', 'p-vc-carnet', -60, 7],
  ['c9', 'p-va-sg', -12, 2],
  ['c10', 'p-vc-mese', -5, 0],
  ['c11', 'p-lt-pt10', -30, 3],
  ['c12', 'p-va-pt10', -85, 7], // scade e poche residue
  ['c12', 'p-vc-carnet', -15, 1],
  ['c13', 'p-vc-mese', -28, 0],
];
const pacchetti: PacchettoCliente[] = pk.map(([clienteId, prodottoId, ini, usate], i) => {
  const p = prodotti.find((x) => x.id === prodottoId)!;
  return {
    id: `k${i + 1}`,
    clienteId,
    prodottoId,
    inizio: g(ini),
    scadenza: g(ini + p.validitaGiorni),
    sessioniTot: p.sessioni,
    usatePrima: usate,
    prezzo: p.prezzo,
  };
});
const pacchettoDi = (clienteId: string, att: string) =>
  pacchetti.find((k) => k.clienteId === clienteId && prodotti.find((p) => p.id === k.prodottoId)!.attivita === att);

// Appuntamenti 1:1 ricorrenti: [cliente, attività, servizio, luogo, giorno settimana (0=lun), ora]
const slot: [string, 'VA' | 'LT', string, Appuntamento['luogo'], number, number][] = [
  ['c1', 'VA', 'Personal Training', 'Virgin Active', 0, 7],
  ['c1', 'VA', 'Personal Training', 'Virgin Active', 3, 7],
  ['c2', 'VA', 'Personal Training', 'Virgin Active', 1, 13],
  ['c3', 'LT', 'Personal Training', 'Studio', 1, 18],
  ['c3', 'LT', 'Personal Training', 'Studio', 4, 18],
  ['c4', 'LT', 'Coaching', 'Online', 2, 21],
  ['c5', 'LT', 'Personal Training', 'Studio', 0, 17],
  ['c6', 'VA', 'Personal Training', 'Virgin Active', 2, 9],
  ['c6', 'VA', 'Personal Training', 'Virgin Active', 4, 9],
  ['c7', 'LT', 'Check-in online', 'Online', 3, 20],
  ['c9', 'VA', 'Personal Training', 'Virgin Active', 0, 12],
  ['c11', 'LT', 'Personal Training', 'Studio', 2, 17],
  ['c12', 'VA', 'Personal Training', 'Virgin Active', 1, 8],
  ['c12', 'VA', 'Personal Training', 'Virgin Active', 3, 8],
];
const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

const appuntamenti: Appuntamento[] = [];
const lun = inizioSettimana(oggi);
const ora = new Date();
const esitoFinto = (i: number): Esito => (i % 11 === 3 ? 'disdetta' : i % 13 === 5 ? 'tardiva' : i % 17 === 7 ? 'assenza' : 'effettuata');
let n = 0;
for (let w = -1; w <= 2; w++) {
  for (const [clienteId, attivita, servizio, luogo, dow, h] of slot) {
    const data = aggiungiGiorni(lun, w * 7 + dow);
    const inizio = at(data, h);
    const passato = new Date(inizio) < ora;
    const ieriOggi = data >= aggiungiGiorni(oggi, -1);
    n++;
    appuntamenti.push({
      id: `a${n}`,
      attivita,
      servizio,
      luogo,
      inizio,
      durataMin: servizio === 'Coaching' ? 60 : servizio === 'Check-in online' ? 30 : 60,
      clienteId,
      pacchettoId: pacchettoDi(clienteId, attivita)?.id,
      // gli appuntamenti di ieri/oggi già passati restano senza esito: compaiono come "da registrare"
      esito: passato && !ieriOggi ? esitoFinto(n) : undefined,
      serie: `Ogni ${GIORNI[dow]} alle ${String(h).padStart(2, '0')}:00`,
    });
  }
  // Classi community e small group
  const classi: [number, number, string, 'VA' | 'VC', Appuntamento['luogo'], number][] = [
    [0, 19, 'Calisthenics Base', 'VC', 'Parco', 12],
    [2, 19, 'Calisthenics Intermedio', 'VC', 'Parco', 9],
    [4, 19, 'Handstand Lab', 'VC', 'Studio', 6],
    [5, 10, 'Community Open Session', 'VC', 'Parco', 18],
    [1, 19, 'Small Group Functional', 'VA', 'Virgin Active', 7],
    [3, 19, 'Small Group Functional', 'VA', 'Virgin Active', 8],
  ];
  for (const [dow, h, nome, attivita, luogo, part] of classi) {
    const data = aggiungiGiorni(lun, w * 7 + dow);
    const inizio = at(data, h, 30);
    n++;
    appuntamenti.push({
      id: `a${n}`, attivita, servizio: attivita === 'VA' ? 'Small Group' : 'Classe', luogo, inizio, durataMin: 75,
      gruppo: nome, partecipanti: part, esito: new Date(inizio) < ora && data < oggi ? 'effettuata' : undefined,
      serie: `Ogni ${GIORNI[dow]} alle ${h}:30`,
    });
  }
}

const pagamenti: Pagamento[] = [];
pacchetti.forEach((k, i) => {
  const p = prodotti.find((x) => x.id === k.prodottoId)!;
  const base = { clienteId: k.clienteId, pacchettoId: k.id, attivita: p.attivita };
  if (k.prezzo >= 450 && i % 2 === 0) {
    // acconto + saldo a rate
    pagamenti.push({ ...base, id: `pg${i}a`, descrizione: `${p.nome} – acconto`, importo: k.prezzo / 2, scadenza: k.inizio, pagatoIl: k.inizio, metodo: 'bonifico' });
    pagamenti.push({ ...base, id: `pg${i}b`, descrizione: `${p.nome} – saldo`, importo: k.prezzo / 2, scadenza: g(i === 0 ? -6 : i === 2 ? -2 : 9) });
  } else {
    pagamenti.push({
      ...base, id: `pg${i}`, descrizione: p.nome, importo: k.prezzo, scadenza: k.inizio,
      pagatoIl: i === 7 ? undefined : k.inizio, metodo: i % 3 === 0 ? 'contanti' : i % 3 === 1 ? 'POS' : 'bonifico',
    });
  }
});

export function creaDbDemo(): Db {
  return {
    clienti,
    prodotti,
    pacchetti,
    appuntamenti,
    pagamenti,
    modelli: [
      { id: 'm-pres', titolo: 'Presentazione', testo: 'Ciao {nome}! Sono Mattia, il tuo coach. Benvenuto/a in {attivita}: ti scrivo qui per organizzare i nostri allenamenti. A presto!' },
      { id: 'm-anam', titolo: 'Questionario anamnesi', testo: 'Ciao {nome}, prima di iniziare ti chiedo di compilare questo breve questionario: {link}. Grazie!' },
      { id: 'm-prom', titolo: 'Promemoria appuntamento', testo: 'Ciao {nome}, ti ricordo l’appuntamento di {data} alle {ora} ({luogo}). Se non puoi venire avvisami almeno 24 ore prima. A domani!' },
      { id: 'm-conf', titolo: 'Conferma appuntamento', testo: 'Ciao {nome}, confermato: {data} alle {ora} ({luogo}).' },
      { id: 'm-rinn', titolo: 'Rinnovo pacchetto', testo: 'Ciao {nome}, il tuo {pacchetto} sta per terminare ({residue} sessioni residue, scadenza {scadenza}). Vuoi che ti prepari il rinnovo?' },
      { id: 'm-soll', titolo: 'Sollecito pagamento', testo: 'Ciao {nome}, ti ricordo il pagamento di {importo} per {descrizione}, scaduto il {scadenza}. Grazie!' },
      { id: 'm-disd', titolo: 'Regole di disdetta', testo: 'Ciao {nome}, ti ricordo che le sessioni vanno disdette con almeno 24 ore di anticipo; in caso contrario la sessione viene conteggiata.' },
    ],
    messaggi: [],
    todo: [
      { id: 't1', testo: 'Preparare scheda nuova per Sara Conti', data: g(0), fatto: false, attivita: 'LT' },
      { id: 't2', testo: 'Ordinare elastici per la classe Handstand Lab', data: g(0), fatto: false, attivita: 'VC' },
      { id: 't3', testo: 'Richiamare contatto Virgin (prova gratuita)', data: g(-1), fatto: false, attivita: 'VA' },
      { id: 't4', testo: 'Inviare fattura di ottobre al commercialista', data: g(2), fatto: false },
    ],
    soglie: { residueMin: 2, giorniScadenza: 14 },
  };
}
