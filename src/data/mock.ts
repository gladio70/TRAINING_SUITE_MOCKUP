// Dati dimostrativi, generati relativamente alla data di oggi così il mockup è sempre "vivo".
// v0.3: la composizione riprende i numeri delle risposte di Mattia del 24/11/2026 (D-02);
// nomi, recapiti e prezzi individuali sono INVENTATI (nessun dato reale, nessun contatto Virgin: V-01).
import type { Appuntamento, Cliente, Costo, Db, Esito, Formula, PacchettoCliente, Pagamento, Presenza, Prodotto, ServizioCliente, UtenteApp } from './types';
import { aggiungiGiorni, inizioGiorno, inizioSettimana, toIsoLocale } from '../lib/format';

const oggi = inizioGiorno();
const g = (n: number) => toIsoLocale(aggiungiGiorni(oggi, n)).slice(0, 10);
const at = (data: Date, h: number, m = 0) => {
  const x = new Date(data);
  x.setHours(h, m, 0, 0);
  return toIsoLocale(x);
};
const isoGiorno = (d: Date) => toIsoLocale(d).slice(0, 10);

// ---------- catalogo (PAC-01) ----------
// Carnet community: prezzi reali indicati da Mattia (D-07). Gli altri prezzi sono indicativi (tariffa 45–60 €/ora).
const P = (id: string, attivita: Prodotto['attivita'], nome: string, tipo: Prodotto['tipo'], sessioni: number | undefined, prezzo: number, validitaGiorni: number, extra: Partial<Prodotto> = {}): Prodotto => ({
  id, attivita, nome, tipo, sessioni, prezzo, validitaGiorni, preavvisoOre: 24, scalaTardiva: true, ...extra,
});
const prodotti: Prodotto[] = [
  P('va-pt4', 'VA', 'PT Virgin – 4 sessioni', 'pacchetto', 4, 220, 45),
  P('va-pt8', 'VA', 'PT Virgin – 8 sessioni', 'pacchetto', 8, 400, 45),
  P('va-pt10', 'VA', 'PT Virgin – 10 sessioni', 'pacchetto', 10, 480, 90),
  P('va-sing', 'VA', 'PT Virgin – sessione singola', 'pacchetto', 1, 60, 30),
  P('lt-pt8', 'LT', 'PT Studio – 8 sessioni al mese', 'pacchetto', 8, 400, 35),
  P('lt-pt4', 'LT', 'PT Studio – 4 sessioni al mese', 'pacchetto', 4, 220, 35),
  P('lt-scheda2', 'LT', 'Scheda + 2 incontri al mese', 'percorso', 2, 130, 30),
  P('lt-online2', 'LT', 'Online – 2 videocall al mese', 'percorso', 2, 100, 30),
  P('lt-scheda', 'LT', 'Scheda su richiesta', 'programmazione', undefined, 70, 30),
  P('lt-sing', 'LT', 'Sessione singola in studio', 'pacchetto', 1, 55, 30),
  P('vc-c5', 'VC', 'Carnet 5 sessioni', 'carnet', 5, 50, 30, { preavvisoOre: 0, scalaTardiva: false }),
  P('vc-c10', 'VC', 'Carnet 10 sessioni', 'carnet', 10, 80, 30, { preavvisoOre: 0, scalaTardiva: false }),
  P('vc-storico', 'VC', 'Carnet storico', 'carnet', undefined, 0, 365, { preavvisoOre: 0, scalaTardiva: false, nonVendibile: true }),
  P('vc-prog', 'VC', 'Programmazione aggiuntiva', 'programmazione', undefined, 100, 30, { preavvisoOre: 0, scalaTardiva: false }),
];

// ---------- persone (CRM-01) ----------
type S = [ServizioCliente['attivita'], ServizioCliente['stato'], number?, string?]; // attività, stato, ripresa (giorni da oggi), nota
type R = [string, string, string, S[], string, string?];
const fineMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0);
const inizioMeseProssimo = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 2);
const tra = (d: Date) => Math.round((d.getTime() - oggi.getTime()) / 86400000);

const anag: R[] = [
  // Life Training: 14 persone (7 continuative, 3 in pausa, 2 occasionali, 1 da verificare, 1 interrotta)
  ['lt1', 'Sara', 'Conti', [['LT', 'attivo'], ['VC', 'attivo']], 'Prima trazione alla sbarra'],
  ['lt2', 'Luca', 'Moretti', [['LT', 'attivo']], 'Gestione stress e routine'],
  ['lt3', 'Martina', 'Greco', [['LT', 'attivo']], 'Mobilità e flessibilità'],
  ['lt4', 'Elena', 'Rinaldi', [['LT', 'attivo'], ['VC', 'attivo']], 'Verticale libera'],
  ['lt5', 'Roberto', 'Fontana', [['LT', 'attivo']], 'Forza generale con scheda'],
  ['lt6', 'Chiara', 'Marini', [['LT', 'attivo']], 'Ricomposizione corporea'],
  ['lt7', 'Giorgia', 'Pellegrini', [['LT', 'attivo']], 'Percorso online continuativo'],
  ['lt8', 'Simone', 'Ferraro', [['LT', 'pausa', tra(inizioMeseProssimo), 'Rientro previsto il mese prossimo']], 'Ripresa dopo il trasloco'],
  ['lt9', 'Laura', 'Bianchi', [['LT', 'pausa', 3, 'Pausa per lavoro: risentirsi a fine mese']], 'Postura'],
  ['lt10', 'Federica', 'Villa', [['LT', 'pausa', -2, 'Doveva richiamare dopo le vacanze']], 'Tonificazione'],
  ['lt11', 'Matteo', 'Caruso', [['LT', 'occasionale', undefined, 'Circa una sessione ogni due mesi']], 'Mantenimento'],
  ['lt12', 'Irene', 'De Luca', [['LT', 'occasionale', undefined, 'Online: schede su richiesta']], 'Allenamento in viaggio'],
  ['lt13', 'Nicola', 'Fabbri', [['LT', 'da verificare', undefined, 'Percorso misto studio/online: definire la formula']], 'Corsa e forza'],
  ['lt14', 'Davide', 'Gallo', [['LT', 'terminato', undefined, 'Percorso interrotto']], 'Rientro dopo infortunio'],
  // Virgin Active: 7 acquisiti, 3 acquisti precedenti, 2 in scambio professionale
  ['va1', 'Giulia', 'Ferri', [['VA', 'attivo']], 'Tonificazione e postura'],
  ['va2', 'Marco', 'Bellini', [['VA', 'attivo']], 'Perdere 6 kg entro l’estate'],
  ['va3', 'Francesca', 'Romano', [['VA', 'attivo']], 'Forza generale'],
  ['va4', 'Alessio', 'Lombardi', [['VA', 'attivo', undefined, 'Pacchetto da rinnovare']], 'Preparazione concorso'],
  ['va5', 'Stefano', 'Bruno', [['VA', 'da verificare', undefined, 'Dettagli del pacchetto da verificare']], 'Rientro in palestra'],
  ['va6', 'Paolo', 'Esposito', [['VA', 'attivo']], 'Allenamento con un amico (pacchetto condiviso)'],
  ['va7', 'Andrea', 'Ricci', [['VA', 'attivo']], 'Allenamento con un amico (pacchetto condiviso)'],
  ['va8', 'Beatrice', 'Galli', [['VA', 'terminato', undefined, 'Acquisto precedente: sessione singola']], 'Prova'],
  ['va9', 'Emanuele', 'Riva', [['VA', 'terminato', undefined, 'Acquisto precedente: due sessioni']], 'Tecnica di squat'],
  ['va10', 'Silvia', 'Marchetti', [['VA', 'terminato', undefined, 'Acquisto precedente: sessione singola']], 'Prova'],
  ['va11', 'Giovanni', 'Sartori', [['VA', 'attivo', undefined, 'Scambio professionale, inizio la prossima settimana']], 'Forza e mobilità'],
  ['va12', 'Paola', 'Neri', [['VA', 'attivo', undefined, 'Scambio professionale, inizio la prossima settimana']], 'Forza e mobilità'],
  // Verticalisthenics Community: 9 carnet (2 sono anche clienti Life), programmazioni aggiuntive, 1 percorso gratuito
  ['vc1', 'Valerio', 'Testa', [['VC', 'attivo']], 'Muscle-up'],
  ['vc2', 'Camilla', 'Leone', [['VC', 'attivo']], 'Handstand'],
  ['vc3', 'Tommaso', 'Rossi', [['VC', 'attivo']], 'Front lever'],
  ['vc4', 'Giada', 'Ferrari', [['VC', 'attivo']], 'Verticale su pugni'],
  ['vc5', 'Riccardo', 'Moro', [['VC', 'attivo']], 'Planche'],
  ['vc6', 'Fabio', 'Serra', [['VC', 'attivo', undefined, 'Carnet storico: mantenere le condizioni concordate']], 'Mantenimento'],
  ['vc7', 'Marta', 'Lombardo', [['VC', 'attivo', undefined, 'Carnet storico: mantenere le condizioni concordate']], 'Handstand'],
  ['vc8', 'Pietro', 'Barbieri', [['VC', 'attivo']], 'Programmazione forza'],
  ['vc9', 'Sofia', 'Mancini', [['VC', 'attivo']], 'Programmazione mobilità'],
  ['vc10', 'Gabriele', 'Coppola', [['VC', 'da verificare', undefined, 'Programmazione: rinnovo da verificare']], 'Programmazione skill'],
  ['vc11', 'Elisa', 'Cattaneo', [['VC', 'attivo', undefined, 'Percorso gratuito']], 'Primo muscle-up'],
  ['vc12', 'Diego', 'Marino', [['VC', 'occasionale', undefined, 'Partecipa senza carnet']], 'Allenamento libero'],
];

const clienti: Cliente[] = anag.map(([id, nome, cognome, servizi, obiettivi, note], i) => ({
  id,
  nome,
  cognome,
  telefono: `+39 34${i % 10} ${String(1000000 + i * 73519).slice(0, 7)}`,
  email: `${nome.toLowerCase()}.${cognome.toLowerCase().replace(/\s/g, '')}@esempio.it`,
  telegram: i % 4 === 0 ? `@${nome.toLowerCase()}${i}` : undefined,
  servizi: servizi.map(([attivita, stato, rip, nota]) => ({ attivita, stato, ripresa: rip != null ? g(rip) : undefined, nota })),
  obiettivi,
  note: note ?? (id === 'lt14' ? 'Evitare carichi assiali pesanti fino a nuova indicazione del fisioterapista.' : ''),
  privacyData: id === 'vc12' ? undefined : g(-60 - i * 4),
  creatoIl: g(-90 - i * 6),
}));

// Cliente di prova con DATI REALI per i test interni (richiesto dall'utente il 25/11/2026), fissato in cima all'elenco.
// Attenzione: il mockup è pubblico, quindi questi recapiti sono visibili a chiunque apra il sito o il repository.
clienti.unshift({
  id: 'cn1', nome: 'Claudio', cognome: 'Nanni', telefono: '+39 338 4758583', email: 'cnanni70@gmail.com', telegram: '@gladio70',
  servizi: [{ attivita: 'VA', stato: 'attivo', nota: 'Cliente di prova con dati reali (test interno)' }],
  obiettivi: 'Test del mockup con dati reali', note: '', privacyData: g(0), creatoIl: g(0), fissato: true,
});

// ---------- pacchetti (PAC-02) ----------
// [id, titolare, prodotto, inizio (giorni da oggi), usate prima, opzioni]
type K = [string, string, string, number, number, { formula?: Formula; con?: string[]; tot?: number; storico?: string; prezzo?: number; validita?: number }?];
const pk: K[] = [
  ['k-lt1', 'lt1', 'lt-pt8', -18, 2],
  ['k-lt2', 'lt2', 'lt-pt8', -25, 3],
  ['k-lt3', 'lt3', 'lt-pt4', -15, 1],
  ['k-lt4', 'lt4', 'lt-pt4', -8, 0],
  ['k-lt5', 'lt5', 'lt-scheda2', -12, 0],
  ['k-lt6', 'lt6', 'lt-scheda2', -26, 1],
  ['k-lt7', 'lt7', 'lt-online2', -10, 0],
  ['k-lt8', 'lt8', 'lt-pt4', -70, 4],
  ['k-lt9', 'lt9', 'lt-pt8', -50, 8],
  ['k-lt10', 'lt10', 'lt-pt4', -60, 4],
  ['k-lt11', 'lt11', 'lt-sing', -40, 1],
  ['k-lt12', 'lt12', 'lt-scheda', -20, 0],
  ['k-lt14', 'lt14', 'lt-pt8', -95, 5],
  ['k-va1', 'va1', 'va-pt8', -16, 1],
  ['k-va2', 'va2', 'va-pt10', -35, 4],
  ['k-va3', 'va3', 'va-pt4', -12, 0],
  ['k-va4', 'va4', 'va-pt4', -26, 1],
  ['k-va5', 'va5', 'va-pt4', -30, 2],
  ['k-va6', 'va6', 'va-pt4', -10, 0, { con: ['va7'] }],
  ['k-va8', 'va8', 'va-sing', -110, 1],
  ['k-va9', 'va9', 'va-sing', -95, 1, { tot: 2, prezzo: 120 }],
  ['k-va10', 'va10', 'va-sing', -80, 1],
  ['k-va11', 'va11', 'va-pt10', 4, 0, { formula: 'scambio' }],
  ['k-va12', 'va12', 'va-pt10', 4, 0, { formula: 'scambio' }],
  ['k-cn1', 'cn1', 'va-pt4', -2, 0],
  ['k-vc1', 'vc1', 'vc-c5', -32, 2],
  ['k-vc2', 'vc2', 'vc-c5', -9, 0],
  ['k-vc-lt1', 'lt1', 'vc-c5', -14, 1],
  ['k-vc-lt4', 'lt4', 'vc-c10', -20, 3],
  ['k-vc3', 'vc3', 'vc-c10', -31, 4],
  ['k-vc4', 'vc4', 'vc-c10', -6, 1],
  ['k-vc5', 'vc5', 'vc-c10', -24, 2],
  ['k-vc6', 'vc6', 'vc-storico', -200, 11, { tot: 24, storico: 'Carnet da 24 acquistato prima del 2026: validità estesa', prezzo: 160, validita: 365 }],
  ['k-vc7', 'vc7', 'vc-storico', -150, 10, { tot: 12, storico: 'Carnet da 12: condizioni concordate a voce', prezzo: 90, validita: 300 }],
  ['k-vc3p', 'vc3', 'vc-prog', -20, 0],
  ['k-vc4p', 'vc4', 'vc-prog', -8, 0],
  ['k-vc8', 'vc8', 'vc-prog', -14, 0],
  ['k-vc9', 'vc9', 'vc-prog', -27, 0],
  ['k-vc10', 'vc10', 'vc-prog', -40, 0],
  ['k-vc11', 'vc11', 'vc-prog', -10, 0, { formula: 'gratuito' }],
];
const pacchetti: PacchettoCliente[] = pk.map(([id, clienteId, prodottoId, ini, usate, o = {}]) => {
  const p = prodotti.find((x) => x.id === prodottoId)!;
  const formula = o.formula ?? 'pagamento';
  return {
    id, clienteId, prodottoId,
    condivisoCon: o.con,
    inizio: g(ini),
    scadenza: g(ini + (o.validita ?? p.validitaGiorni)),
    sessioniTot: o.tot ?? p.sessioni,
    usatePrima: usate,
    prezzo: formula === 'pagamento' ? o.prezzo ?? p.prezzo : 0,
    formula,
    storico: o.storico,
  };
});
const kId = (id: string) => pacchetti.find((k) => k.id === id)!;

// ---------- appuntamenti (AGE) ----------
// [cliente, pacchetto, attività, servizio, luogo, giorno settimana (0 = lun), ora, durata, settimane (vuoto = tutte), altri]
type Slot = [string, string, 'VA' | 'LT', string, Appuntamento['luogo'], number, number, number, number[]?, string[]?];
const slot: Slot[] = [
  ['lt1', 'k-lt1', 'LT', 'Personal Training', 'Studio', 1, 18, 60],
  ['lt1', 'k-lt1', 'LT', 'Personal Training', 'Studio', 4, 18, 60],
  ['lt2', 'k-lt2', 'LT', 'Personal Training', 'Studio', 0, 19, 60],
  ['lt2', 'k-lt2', 'LT', 'Personal Training', 'Studio', 3, 19, 60],
  ['lt3', 'k-lt3', 'LT', 'Personal Training', 'Studio', 2, 17, 60],
  ['lt4', 'k-lt4', 'LT', 'Personal Training', 'Studio', 0, 17, 60],
  ['lt5', 'k-lt5', 'LT', 'Incontro + scheda', 'Studio', 3, 20, 60, [-1, 1]],
  ['lt6', 'k-lt6', 'LT', 'Incontro + scheda', 'Studio', 5, 10, 60, [0, 2]],
  ['lt7', 'k-lt7', 'LT', 'Videocall', 'Online', 2, 21, 45, [-1, 1]],
  ['va1', 'k-va1', 'VA', 'Personal Training', 'Virgin Active', 0, 7, 60],
  ['va1', 'k-va1', 'VA', 'Personal Training', 'Virgin Active', 3, 7, 60],
  ['va2', 'k-va2', 'VA', 'Personal Training', 'Virgin Active', 1, 13, 60],
  ['va3', 'k-va3', 'VA', 'Personal Training', 'Virgin Active', 2, 9, 60],
  ['va4', 'k-va4', 'VA', 'Personal Training', 'Virgin Active', 4, 9, 60],
  ['va6', 'k-va6', 'VA', 'Personal Training', 'Virgin Active', 3, 12, 60, undefined, ['va7']],
  ['va11', 'k-va11', 'VA', 'Personal Training', 'Virgin Active', 0, 14, 60, [1, 2]],
  ['va12', 'k-va12', 'VA', 'Personal Training', 'Virgin Active', 0, 15, 60, [1, 2]],
];
const GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica'];

const appuntamenti: Appuntamento[] = [];
const lun = inizioSettimana(oggi);
const ora = new Date();
const esitoFinto = (i: number): Esito => (i % 11 === 3 ? 'disdetta' : i % 13 === 5 ? 'tardiva' : i % 17 === 7 ? 'assenza' : 'effettuata');
let n = 0;

// Classi della community con presenze effettive (GRP): chi viene in quali giorni
const CLASSI: [number, number, string, Appuntamento['luogo']][] = [
  [0, 19, 'Calisthenics Base', 'Parco'],
  [2, 19, 'Calisthenics Intermedio', 'Parco'],
  [4, 19, 'Handstand Lab', 'Studio'],
  [5, 10, 'Community Open Session', 'Parco'],
];
const frequenze: [string, number[]][] = [
  ['lt1', [2]], ['vc1', [4]], ['vc2', [0, 5]], ['lt4', [0]], ['vc3', [2, 5]], ['vc4', [2, 4]], ['vc5', [0, 2, 4]], ['vc12', [5]],
];
const carnetValido = (clienteId: string, giorno: string) =>
  pacchetti.find((k) => k.clienteId === clienteId && k.prodottoId.startsWith('vc-c') && k.inizio <= giorno && giorno <= k.scadenza);

for (let w = -1; w <= 2; w++) {
  for (const [clienteId, pacchettoId, attivita, servizio, luogo, dow, h, durata, settimane, con] of slot) {
    if (settimane && !settimane.includes(w)) continue;
    const data = aggiungiGiorni(lun, w * 7 + dow);
    const k = kId(pacchettoId);
    if (isoGiorno(data) < k.inizio) continue;
    const inizio = at(data, h);
    const passato = new Date(inizio) < ora;
    const ieriOggi = data >= aggiungiGiorni(oggi, -1);
    n++;
    appuntamenti.push({
      id: `a${n}`, attivita, servizio, luogo, inizio, durataMin: durata, clienteId, con, pacchettoId,
      // gli appuntamenti di ieri/oggi già passati restano senza esito: compaiono come "da registrare"
      esito: passato && !ieriOggi ? esitoFinto(n) : undefined,
      serie: settimane && settimane.length < 4 ? `Ogni due settimane, ${GIORNI[dow]} alle ${h}:00` : `Ogni ${GIORNI[dow]} alle ${String(h).padStart(2, '0')}:00`,
    });
  }
  for (const [dow, h, nome, luogo] of CLASSI) {
    const data = aggiungiGiorni(lun, w * 7 + dow);
    const giorno = isoGiorno(data);
    const inizio = at(data, h, 30);
    const giaRegistrata = new Date(inizio) < ora && data < aggiungiGiorni(oggi, -1);
    const presenze: Presenza[] = giaRegistrata
      ? frequenze.filter(([, giorni]) => giorni.includes(dow)).map(([clienteId]) => ({ clienteId, pacchettoId: carnetValido(clienteId, giorno)?.id }))
      : [];
    n++;
    appuntamenti.push({
      id: `a${n}`, attivita: 'VC', servizio: 'Classe', luogo, inizio, durataMin: 75, gruppo: nome, partecipanti: 12,
      presenze, esito: giaRegistrata ? 'effettuata' : undefined, serie: `Ogni ${GIORNI[dow]} alle ${h}:30`,
    });
  }
}

// cliente di prova: appuntamento domani alle 18, così compare il promemoria da inviare
appuntamenti.push({
  id: 'a-cn1', attivita: 'VA', servizio: 'Personal Training', luogo: 'Virgin Active', inizio: at(aggiungiGiorni(oggi, 1), 18), durataMin: 60,
  clienteId: 'cn1', pacchettoId: 'k-cn1',
});

// Body Check gratuiti dei nuovi iscritti Virgin (contatti fittizi: V-01) – 3 programmati e 1 da confermare
const bc: [number, number, string, boolean?, Esito?][] = [
  [-5, 11, 'Nuovo iscritto A (contatto fittizio)', false, 'effettuata'],
  [1, 11, 'Nuovo iscritto B (contatto fittizio)'],
  [2, 12, 'Nuovo iscritto C (contatto fittizio)'],
  [3, 10, 'Nuovo iscritto D (contatto fittizio)'],
  [4, 11, 'Nuovo iscritto E (contatto fittizio)', true],
];
for (const [d, h, contatto, daConfermare, esito] of bc) {
  n++;
  appuntamenti.push({
    id: `a${n}`, attivita: 'VA', servizio: 'Body Check', luogo: 'Virgin Active', inizio: at(aggiungiGiorni(oggi, d), h), durataMin: 45,
    contatto, gratuito: true, daConfermare: daConfermare || undefined, esito,
  });
}

// ---------- pagamenti (PAC-04) ----------
const pagamenti: Pagamento[] = [];
const speciali: Record<string, (base: Omit<Pagamento, 'id' | 'descrizione' | 'importo' | 'scadenza'>, k: PacchettoCliente, nome: string) => Pagamento[]> = {
  'k-va1': (b, k, nome) => [
    { ...b, id: 'pg-va1a', descrizione: `${nome} – acconto`, importo: k.prezzo / 2, scadenza: k.inizio, pagatoIl: k.inizio, metodo: 'bonifico' },
    { ...b, id: 'pg-va1b', descrizione: `${nome} – saldo`, importo: k.prezzo / 2, scadenza: g(-6) },
  ],
  'k-va2': (b, k, nome) => [0, 1, 2].map((i) => ({
    ...b, id: `pg-va2-${i}`, descrizione: `${nome} – rata ${i + 1}/3`, importo: k.prezzo / 3, scadenza: g(-35 + i * 30),
    pagatoIl: i === 0 ? k.inizio : i === 1 ? g(-5) : undefined, metodo: i < 2 ? ('bonifico' as const) : undefined,
  })),
  'k-lt2': (b, k, nome) => [{ ...b, id: 'pg-lt2', descrizione: nome, importo: k.prezzo, scadenza: g(-3) }],
  'k-vc2': (b, k, nome) => [{ ...b, id: 'pg-vc2', descrizione: nome, importo: k.prezzo, scadenza: g(0) }],
  'k-vc8': (b, k, nome) => [{ ...b, id: 'pg-vc8', descrizione: nome, importo: k.prezzo, scadenza: g(2) }],
  // cliente di prova: pagamento ancora aperto, per provare "Link" e "Simula online"
  'k-cn1': (b, k, nome) => [{ ...b, id: 'pg-cn1', descrizione: nome, importo: k.prezzo, scadenza: g(3) }],
  'k-va6': (b, k, nome) => [{ ...b, id: 'pg-va6', descrizione: `${nome} (condiviso)`, importo: k.prezzo, scadenza: k.inizio, pagatoIl: k.inizio, metodo: 'contanti' }],
};
pacchetti.forEach((k, i) => {
  if (k.formula !== 'pagamento') return;
  const p = prodotti.find((x) => x.id === k.prodottoId)!;
  const nome = k.storico ? `${p.nome} da ${k.sessioniTot}` : p.nome;
  const base = { clienteId: k.clienteId, pacchettoId: k.id, attivita: p.attivita };
  if (speciali[k.id]) return pagamenti.push(...speciali[k.id](base, k, nome));
  pagamenti.push({
    ...base, id: `pg-${k.id}`, descrizione: nome, importo: k.prezzo, scadenza: k.inizio, pagatoIl: k.inizio,
    metodo: i % 3 === 0 ? 'contanti' : i % 3 === 1 ? 'POS' : 'bonifico',
  });
});

// ---------- costi (anteprima ECO-03) ----------
const primoDelMese = (delta: number) => isoGiorno(new Date(oggi.getFullYear(), oggi.getMonth() + delta, 1));
const costi: Costo[] = [
  { id: 'co1', attivita: 'VA', descrizione: 'Affitto sala Virgin Active', categoria: 'affitto', importo: 772.66, data: primoDelMese(-1) },
  { id: 'co2', attivita: 'VA', descrizione: 'Affitto sala Virgin Active (indicativo)', categoria: 'affitto', importo: 800, data: primoDelMese(0) },
  { id: 'co3', attivita: 'VC', descrizione: 'Elastici e paralletts', categoria: 'attrezzatura', importo: 45, data: g(-3) },
  { id: 'co4', descrizione: 'Software e app (comune)', categoria: 'software', importo: 12, data: primoDelMese(0) },
];

/** Messaggio con il link di pagamento online (anteprima PAC-05: nel mockup il link è finto) */
export const MODELLO_LINK =
  'Ciao {nome}, ecco il link per pagare {descrizione} ({importo}) con carta, Apple Pay o Google Pay: {link}. Il pagamento si registra da solo. Grazie!';

// ---------- utenti dell'app (anteprima: inviti simulati) ----------
const nomeDi = (id: string) => {
  const c = clienti.find((x) => x.id === id)!;
  return { nome: `${c.nome} ${c.cognome}`, email: c.email, clienteId: id };
};
export const utentiDemo = (): UtenteApp[] => [
  { id: 'u-mattia', nome: 'Mattia', email: 'mattia@esempio.it', ruolo: 'amministratore', stato: 'attivo', ultimoAccesso: at(oggi, 7, 40) },
  { id: 'u-coll', nome: 'Luca Verdi (esempio)', email: 'luca.verdi@esempio.it', ruolo: 'collaboratore', stato: 'attivo', invitatoIl: at(aggiungiGiorni(oggi, -20), 18), canaleInvito: 'Email', ultimoAccesso: at(aggiungiGiorni(oggi, -3), 19, 5) },
  { id: 'u-cn1', ...nomeDi('cn1'), ruolo: 'cliente', stato: 'attivo', invitatoIl: at(aggiungiGiorni(oggi, -2), 10), canaleInvito: 'Email', ultimoAccesso: at(aggiungiGiorni(oggi, -1), 21, 12) },
  { id: 'u-lt1', ...nomeDi('lt1'), ruolo: 'cliente', stato: 'attivo', invitatoIl: at(aggiungiGiorni(oggi, -15), 9), canaleInvito: 'WhatsApp', ultimoAccesso: at(aggiungiGiorni(oggi, -2), 8, 30) },
  { id: 'u-va1', ...nomeDi('va1'), ruolo: 'cliente', stato: 'attivo', invitatoIl: at(aggiungiGiorni(oggi, -12), 12), canaleInvito: 'Email', ultimoAccesso: at(aggiungiGiorni(oggi, -6), 13, 45) },
  { id: 'u-vc1', ...nomeDi('vc1'), ruolo: 'cliente', stato: 'invitato', invitatoIl: at(aggiungiGiorni(oggi, -1), 18, 20), canaleInvito: 'WhatsApp' },
  { id: 'u-va2', ...nomeDi('va2'), ruolo: 'cliente', stato: 'invitato', invitatoIl: at(aggiungiGiorni(oggi, -5), 11), canaleInvito: 'Email' },
  { id: 'u-lt14', ...nomeDi('lt14'), ruolo: 'cliente', stato: 'disattivato', invitatoIl: at(aggiungiGiorni(oggi, -80), 10), canaleInvito: 'Email', ultimoAccesso: at(aggiungiGiorni(oggi, -40), 20) },
];
export const vistaClienteDemo = (): Db['vistaCliente'] => ({
  pacchetti: true, appuntamenti: true, richieste: true, pagamenti: true, storico: true, obiettivi: false,
});

export function creaDbDemo(): Db {
  return {
    clienti,
    prodotti,
    pacchetti,
    appuntamenti,
    pagamenti,
    costi,
    modelli: [
      { id: 'm-pres', titolo: 'Presentazione', testo: 'Ciao {nome}! Sono Mattia, il tuo coach. Benvenuto/a in {attivita}: ti scrivo qui per organizzare i nostri allenamenti. A presto!' },
      { id: 'm-anam', titolo: 'Questionario anamnesi', testo: 'Ciao {nome}, prima di iniziare ti chiedo di compilare questo breve questionario: {link}. Grazie!' },
      { id: 'm-prom', titolo: 'Promemoria appuntamento', testo: 'Ciao {nome}, ti ricordo l’appuntamento di {data} alle {ora} ({luogo}). Se non puoi venire avvisami almeno 24 ore prima. A domani!' },
      { id: 'm-conf', titolo: 'Conferma appuntamento', testo: 'Ciao {nome}, confermato: {data} alle {ora} ({luogo}).' },
      { id: 'm-rinn', titolo: 'Rinnovo pacchetto', testo: 'Ciao {nome}, il tuo {pacchetto} sta per terminare ({residue} sessioni residue, scadenza {scadenza}). Vuoi che ti prepari il rinnovo?' },
      { id: 'm-soll', titolo: 'Sollecito pagamento', testo: 'Ciao {nome}, ti ricordo il pagamento di {importo} per {descrizione}, scaduto il {scadenza}. Grazie!' },
      { id: 'm-link', titolo: 'Link di pagamento', testo: MODELLO_LINK },
      { id: 'm-ripr', titolo: 'Ripresa allenamenti', testo: 'Ciao {nome}, come stai? Ci eravamo detti di risentirci per riprendere gli allenamenti: ti va di fissare la prossima sessione?' },
      { id: 'm-disd', titolo: 'Regole di disdetta', testo: 'Ciao {nome}, ti ricordo che le sessioni vanno disdette con almeno 24 ore di anticipo; in caso contrario la sessione viene conteggiata.' },
    ],
    messaggi: [],
    todo: [
      { id: 't1', testo: 'Preparare scheda nuova per Sara Conti', data: g(0), fatto: false, attivita: 'LT', clienteId: 'lt1' },
      { id: 't2', testo: 'Pubblicare gli allenamenti della settimana nel gruppo WhatsApp', data: g(0), fatto: false, attivita: 'VC' },
      { id: 't3', testo: 'Chiamare i nuovi iscritti assegnati da Virgin', data: g(-1), fatto: false, attivita: 'VA' },
      { id: 't4', testo: 'Rinnovo identità digitale Aruba', data: isoGiorno(fineMese), fatto: false, categoria: 'amministrazione' },
      { id: 't5', testo: 'Verifica adempimenti Fiscozen', data: isoGiorno(fineMese), fatto: false, categoria: 'amministrazione' },
    ],
    soglie: { residueMin: 2, giorniScadenza: 7 },
    utenti: utentiDemo(),
    vistaCliente: vistaClienteDemo(),
  };
}
