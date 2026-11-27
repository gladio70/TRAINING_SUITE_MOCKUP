// CRM-01 / CRM-04: elenco clienti con ricerca e filtri; nuovo cliente.
// Una persona può seguire più servizi, ognuno con il suo stato (risposte di Mattia, D-02).
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Trash2, Upload, UserPlus } from 'lucide-react';
import { useStore } from '../data/store';
import { daRichiamare, effettiEliminazione, ordineClienti, pacchettiDi, statoPacchetto } from '../data/logic';
import { ATTIVITA, STATI, type Attivita, type Cliente, type ServizioCliente, type StatoServizio } from '../data/types';
import { fmtDataBreve, toIsoLocale } from '../lib/format';
import { AvvisoSalute, Avatar, BadgeServizio, FiltroAttivita, linkTelegramValido, Modal, OBIETTIVI_ALLENAMENTO } from '../components/ui';

type FiltroStato = StatoServizio | 'in carico' | 'da richiamare' | 'tutti';

export function Clienti() {
  const { db } = useStore();
  const [sp] = useSearchParams();
  const [q, setQ] = useState('');
  const [att, setAtt] = useState<Attivita | 'tutte'>((sp.get('att') as Attivita) || 'tutte');
  const [stato, setStato] = useState<FiltroStato>((sp.get('stato') as FiltroStato) || 'in carico');
  const [nuovo, setNuovo] = useState(false);
  const [importa, setImporta] = useState(false);

  // lo stato si valuta sul servizio dell'attività scelta (o su uno qualsiasi se "tutte")
  const servizi = (c: Cliente) => c.servizi.filter((s) => att === 'tutte' || s.attivita === att);
  // "da richiamare": stessa regola del widget della pagina Oggi e degli avvisi
  const richiami = daRichiamare(db);
  const daRichiamareIl = (c: Cliente, s: ServizioCliente) => richiami.some((r) => r.cliente.id === c.id && r.servizio.attivita === s.attivita);
  const lista = db.clienti
    .filter((c) =>
      servizi(c).some(
        (s) =>
          stato === 'tutti' ||
          (stato === 'in carico' ? s.stato !== 'terminato' : stato === 'da richiamare' ? daRichiamareIl(c, s) : s.stato === stato),
      ),
    )
    .filter((c) => `${c.nome} ${c.cognome} ${c.email} ${c.telefono}`.toLowerCase().includes(q.toLowerCase()))
    // prima i clienti fissati in cima (es. cliente di prova), poi in ordine alfabetico
    .sort(ordineClienti);

  // persone uniche: chi segue più servizi è contato una volta sola
  const conteggi = (Object.keys(ATTIVITA) as Attivita[]).map((a) => ({
    a,
    n: db.clienti.filter((c) => c.servizi.some((s) => s.attivita === a && s.stato !== 'terminato')).length,
  }));
  const uniche = db.clienti.filter((c) => c.servizi.some((s) => s.stato !== 'terminato')).length;

  return (
    <>
      <div className="page-head">
        <div className="titolo-con-azione">
          <div>
            <h1>Clienti</h1>
            <div className="sub">
              {uniche} persone in carico · {conteggi.map((x) => `${ATTIVITA[x.a].breve} ${x.n}`).join(' · ')} (chi segue più servizi è contato una volta)
            </div>
          </div>
          <button className="btn primary icona-nuovo" onClick={() => setNuovo(true)} aria-label="Nuovo cliente" title="Nuovo cliente">
            <UserPlus size={20} />
          </button>
        </div>
        <button className="btn primary importa-sheets" onClick={() => setImporta(true)} title="Importa da Google Sheets">
          <Upload size={16} /> Importa da Google Sheets
        </button>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <div className="search">
          <Search size={16} />
          <input className="field" placeholder="Cerca nome, email, telefono…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <FiltroAttivita valore={att} onChange={setAtt} />
        <select className="field" style={{ width: 'auto' }} value={stato} onChange={(e) => setStato(e.target.value as FiltroStato)}>
          <option value="in carico">In carico (non terminati)</option>
          <option value="da richiamare">Da richiamare o verificare</option>
          {(Object.keys(STATI) as StatoServizio[]).map((s) => (
            <option key={s} value={s}>{STATI[s].nome}</option>
          ))}
          <option value="tutti">Tutti</option>
        </select>
        <span className="small muted">{lista.length} risultati</span>
      </div>

      <div className="card" style={{ padding: 6 }}>
        <div className="list">
          {lista.length === 0 && <div className="empty">Nessun cliente trovato.</div>}
          {lista.map((c) => {
            const pk = pacchettiDi(db, c.id).map((k) => statoPacchetto(db, k)).filter((s) => !s.scaduto);
            const minRes = pk.filter((s) => s.residue != null).map((s) => s.residue!);
            const prossimaScad = pk.map((s) => s.giorni).sort((a, b) => a - b)[0];
            return (
              <Link key={c.id} to={`/clienti/${c.id}`} className="item" style={{ padding: '10px 10px' }}>
                <Avatar c={c} />
                <div className="grow">
                  <div className="t">
                    {c.cognome} {c.nome}
                  </div>
                  <div className="d">{c.obiettivi}</div>
                </div>
                <div className="row" style={{ justifyContent: 'flex-end' }}>
                  {c.servizi.map((s) => (
                    <BadgeServizio key={s.attivita} s={s} breve />
                  ))}
                  {minRes.length > 0 && Math.min(...minRes) <= db.soglie.residueMin && <span className="badge danger">{Math.min(...minRes)} residue</span>}
                  {prossimaScad != null && prossimaScad <= db.soglie.giorniScadenza && <span className="badge warn">scade tra {prossimaScad} g</span>}
                  {!c.privacyData && <span className="badge danger">privacy mancante</span>}
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {nuovo && <ClienteForm onClose={() => setNuovo(false)} />}
      {importa && (
        <Modal titolo="Importazione da Google Sheets (CRM-03)" onClose={() => setImporta(false)} footer={<button className="btn primary" onClick={() => setImporta(false)}>Ok</button>}>
          <p>Nella versione reale qui si carica l’esportazione dei fogli attuali (clienti, pacchetti, incassi):</p>
          <ol className="small">
            <li>scelta del file (.xlsx o .csv) o collegamento al foglio Google;</li>
            <li>abbinamento delle colonne ai campi di TRAINING SUITE e scelta dell’attività;</li>
            <li>anteprima con duplicati ed errori evidenziati;</li>
            <li>conferma dell’importazione.</li>
          </ol>
          <p className="small muted">Per progettarla servono i Google Sheets attuali, anche anonimizzati (domanda D-08).</p>
        </Modal>
      )}
    </>
  );
}

/** Conferma dell'eliminazione: elenca cosa verrà cancellato e propone l'alternativa "Terminato" */
function ConfermaElimina({ cliente, onAnnulla, onElimina }: { cliente: Cliente; onAnnulla: () => void; onElimina: () => void }) {
  const { db } = useStore();
  const e = effettiEliminazione(db, cliente.id);
  const voci = (
    [
      [e.pacchetti, 'pacchetto, carnet o percorso', 'pacchetti, carnet o percorsi'],
      [e.sessioni, 'sessione in agenda', 'sessioni in agenda'],
      [e.presenze, 'presenza alle classi', 'presenze alle classi'],
      [e.pagamenti, 'pagamento', 'pagamenti (anche quelli già incassati)'],
      [e.messaggi, 'messaggio inviato', 'messaggi inviati'],
      [e.cose, 'task della Task List', 'task della Task List'],
    ] as [number, string, string][]
  )
    .filter(([n]) => n > 0)
    .map(([n, uno, tanti]) => [n, n === 1 ? uno : tanti] as [number, string]);
  return (
    <Modal
      titolo="Eliminare il cliente?"
      onClose={onAnnulla}
      footer={
        <>
          <button className="btn" onClick={onAnnulla}>Annulla</button>
          <button className="btn danger" onClick={onElimina}><Trash2 size={16} /> Elimina definitivamente</button>
        </>
      }
    >
      <p style={{ marginTop: 0 }}>
        Verranno cancellati <b>{cliente.nome} {cliente.cognome}</b> e tutti i suoi dati{voci.length ? ':' : '.'}
      </p>
      {voci.length > 0 && (
        <ul className="small" style={{ paddingLeft: 18, margin: '0 0 8px' }}>
          {voci.map(([n, t]) => <li key={t}>{n} {t}</li>)}
        </ul>
      )}
      {e.pacchettiCeduti > 0 && (
        <p className="small">I pacchetti condivisi ({e.pacchettiCeduti}) restano all’altra persona, che ne diventa titolare.</p>
      )}
      <p className="small" style={{ color: 'var(--danger)', fontWeight: 600 }}>L’operazione non si può annullare e cambia anche i report dei mesi passati.</p>
      <p className="small muted">
        Se vuoi solo toglierlo dagli elenchi e dagli avvisi conservando lo storico, annulla e imposta lo stato del servizio su “Terminato”.
      </p>
    </Modal>
  );
}

/** servizioIniziale: per un nuovo cliente, l'attività già selezionata (es. Community dalla pagina Community) */
export function ClienteForm({ cliente, onClose, servizioIniziale = 'LT' }: { cliente?: Cliente; onClose: () => void; servizioIniziale?: Attivita }) {
  const { nuovoCliente, salvaCliente, eliminaCliente } = useStore();
  const nav = useNavigate();
  const [elimina, setElimina] = useState(false);
  const [c, setC] = useState<Omit<Cliente, 'id' | 'creatoIl'>>(
    cliente ?? { nome: '', cognome: '', telefono: '', email: '', telegram: '', servizi: [{ attivita: servizioIniziale, stato: 'attivo' }], obiettivi: '', note: '', privacyData: undefined },
  );
  const set = <K extends keyof typeof c>(k: K, v: (typeof c)[K]) => setC((x) => ({ ...x, [k]: v }));
  const ha = (a: Attivita) => c.servizi.some((s) => s.attivita === a);
  const toggleAtt = (a: Attivita) =>
    set('servizi', ha(a) ? c.servizi.filter((s) => s.attivita !== a) : [...c.servizi, { attivita: a, stato: 'attivo' }]);
  const setServizio = (a: Attivita, v: Partial<ServizioCliente>) =>
    set('servizi', c.servizi.map((s) => (s.attivita === a ? { ...s, ...v } : s)));
  const valido = c.nome.trim() && c.cognome.trim() && c.servizi.length > 0;

  const salva = () => {
    if (cliente) salvaCliente({ ...cliente, ...c });
    else nav(`/clienti/${nuovoCliente(c)}`);
    onClose();
  };

  return (
    <Modal
      titolo={cliente ? 'Modifica cliente' : servizioIniziale === 'VC' ? 'Nuovo membro della Community' : 'Nuovo cliente'}
      onClose={onClose}
      footer={
        <>
          {cliente && (
            <button className="btn danger" style={{ marginRight: 'auto' }} onClick={() => setElimina(true)}>
              <Trash2 size={16} /> Elimina cliente
            </button>
          )}
          <button className="btn primary" disabled={!valido} onClick={salva}>Salva</button>
        </>
      }
    >
      {elimina && cliente && (
        <ConfermaElimina
          cliente={cliente}
          onAnnulla={() => setElimina(false)}
          onElimina={() => {
            eliminaCliente(cliente.id);
            onClose();
            nav('/clienti');
          }}
        />
      )}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label className="lbl">Nome *</label>
          <input className="field" value={c.nome} onChange={(e) => set('nome', e.target.value)} />
        </div>
        <div>
          <label className="lbl">Cognome *</label>
          <input className="field" value={c.cognome} onChange={(e) => set('cognome', e.target.value)} />
        </div>
        <div>
          <label className="lbl">Telefono</label>
          <input className="field" type="tel" value={c.telefono} onChange={(e) => set('telefono', e.target.value)} />
        </div>
        <div>
          <label className="lbl">Email</label>
          <input className="field" type="email" value={c.email} onChange={(e) => set('email', e.target.value)} />
        </div>
        <div>
          <label className="lbl">Telegram</label>
          <input className="field" value={c.telegram ?? ''} onChange={(e) => set('telegram', e.target.value)} placeholder="@utente" />
        </div>
      </div>
      {/* CLI-08 / PRIV-15: schede, foto, video e feedback restano su Telegram; qui solo il link */}
      <label className="lbl">Canale Telegram (schede, video e feedback)</label>
      <input className="field" type="url" value={c.canaleTelegram ?? ''} onChange={(e) => set('canaleTelegram', e.target.value.trim() || undefined)} placeholder="https://t.me/… oppure https://web.telegram.org/a/#…" />
      {c.canaleTelegram && !linkTelegramValido(c.canaleTelegram) && <p className="small" style={{ color: 'var(--danger)', margin: '4px 0 0' }}>Il link deve iniziare con https://t.me/ oppure https://web.telegram.org/</p>}
      <label className="lbl">Servizi * (anche più di uno, ognuno con il suo stato)</label>
      <div className="chips">
        {(Object.keys(ATTIVITA) as Attivita[]).map((a) => (
          <button key={a} type="button" className={`chip ${ha(a) ? 'on' : ''}`} onClick={() => toggleAtt(a)}>
            <span className={`dot ${a}`} /> {ATTIVITA[a].nome}
          </button>
        ))}
      </div>
      {c.servizi.map((s) => (
        <div key={s.attivita} className="servizio-box">
          <div className="row" style={{ gap: 6, fontWeight: 600 }}>
            <span className={`dot ${s.attivita}`} /> {ATTIVITA[s.attivita].nome}
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label className="lbl">Stato</label>
              <select className="field" value={s.stato} onChange={(e) => setServizio(s.attivita, { stato: e.target.value as StatoServizio })}>
                {(Object.keys(STATI) as StatoServizio[]).map((x) => (
                  <option key={x} value={x}>{STATI[x].nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl">{s.stato === 'pausa' ? 'Ripresa prevista' : 'Data di richiamo'}</label>
              <input className="field" type="date" value={s.ripresa ?? ''} onChange={(e) => setServizio(s.attivita, { ripresa: e.target.value || undefined })} />
            </div>
          </div>
          <input className="field" style={{ marginTop: 8 }} placeholder="Nota sul servizio (es. pausa per lavoro fino a fine mese)" value={s.nota ?? ''}
            onChange={(e) => setServizio(s.attivita, { nota: e.target.value || undefined })} />
        </div>
      ))}
      {/* PRIV-01/02: obiettivi di allenamento (da elenco o testo breve) e nessun dato sulla salute nei campi liberi */}
      <label className="lbl">Obiettivi di allenamento</label>
      <input className="field" list="obiettivi-allenamento" placeholder="Scegli dall’elenco o scrivi (es. Primo muscle-up)" value={c.obiettivi} onChange={(e) => set('obiettivi', e.target.value)} />
      <datalist id="obiettivi-allenamento">
        {OBIETTIVI_ALLENAMENTO.map((o) => <option key={o} value={o} />)}
      </datalist>
      <label className="lbl">Note</label>
      <textarea className="field" rows={3} placeholder="Es. preferisce allenarsi la mattina" value={c.note} onChange={(e) => set('note', e.target.value)} />
      <AvvisoSalute />
      <label className="todo" style={{ marginTop: 10 }}>
        <input
          type="checkbox"
          checked={!!c.privacyData}
          onChange={(e) => set('privacyData', e.target.checked ? toIsoLocale(new Date()).slice(0, 10) : undefined)}
        />
        <span>Consenso privacy raccolto {c.privacyData && <span className="muted">il {fmtDataBreve(c.privacyData)}</span>}</span>
      </label>
    </Modal>
  );
}
