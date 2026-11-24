// CRM-01 / CRM-04: elenco clienti con ricerca e filtri; nuovo cliente
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Search, Upload } from 'lucide-react';
import { useStore } from '../data/store';
import { statoPacchetto } from '../data/logic';
import { ATTIVITA, type Attivita, type Cliente, type StatoCliente } from '../data/types';
import { fmtDataBreve, toIsoLocale } from '../lib/format';
import { Avatar, BadgeAttivita, FiltroAttivita, Modal } from '../components/ui';

export function Clienti() {
  const { db } = useStore();
  const [q, setQ] = useState('');
  const [att, setAtt] = useState<Attivita | 'tutte'>('tutte');
  const [stato, setStato] = useState<StatoCliente | 'tutti'>('attivo');
  const [nuovo, setNuovo] = useState(false);
  const [importa, setImporta] = useState(false);

  const lista = db.clienti
    .filter((c) => (att === 'tutte' || c.attivita.includes(att)) && (stato === 'tutti' || c.stato === stato))
    .filter((c) => `${c.nome} ${c.cognome} ${c.email} ${c.telefono}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.cognome.localeCompare(b.cognome));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Clienti</h1>
          <div className="sub">{lista.length} su {db.clienti.length}</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => setImporta(true)}>
            <Upload size={16} /> Importa da Google Sheets
          </button>
          <button className="btn primary" onClick={() => setNuovo(true)}>
            <Plus size={16} /> Nuovo cliente
          </button>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <div className="search">
          <Search size={16} />
          <input className="field" placeholder="Cerca nome, email, telefono…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <FiltroAttivita valore={att} onChange={setAtt} />
        <select className="field" style={{ width: 'auto' }} value={stato} onChange={(e) => setStato(e.target.value as StatoCliente | 'tutti')}>
          <option value="tutti">Tutti gli stati</option>
          <option value="attivo">Attivi</option>
          <option value="sospeso">Sospesi</option>
          <option value="ex">Ex clienti</option>
        </select>
      </div>

      <div className="card" style={{ padding: 6 }}>
        <div className="list">
          {lista.length === 0 && <div className="empty">Nessun cliente trovato.</div>}
          {lista.map((c) => {
            const pk = db.pacchetti.filter((k) => k.clienteId === c.id).map((k) => statoPacchetto(db, k)).filter((s) => !s.scaduto);
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
                  {c.attivita.map((a) => (
                    <BadgeAttivita key={a} a={a} breve />
                  ))}
                  {c.stato !== 'attivo' && <span className="badge neutral">{c.stato === 'ex' ? 'ex cliente' : 'sospeso'}</span>}
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

export function ClienteForm({ cliente, onClose }: { cliente?: Cliente; onClose: () => void }) {
  const { nuovoCliente, salvaCliente } = useStore();
  const nav = useNavigate();
  const [c, setC] = useState<Omit<Cliente, 'id' | 'creatoIl'>>(
    cliente ?? { nome: '', cognome: '', telefono: '', email: '', telegram: '', attivita: ['LT'], stato: 'attivo', obiettivi: '', note: '', privacyData: undefined },
  );
  const set = <K extends keyof typeof c>(k: K, v: (typeof c)[K]) => setC((x) => ({ ...x, [k]: v }));
  const toggleAtt = (a: Attivita) => set('attivita', c.attivita.includes(a) ? c.attivita.filter((x) => x !== a) : [...c.attivita, a]);
  const valido = c.nome.trim() && c.cognome.trim() && c.attivita.length > 0;

  const salva = () => {
    if (cliente) salvaCliente({ ...cliente, ...c });
    else nav(`/clienti/${nuovoCliente(c)}`);
    onClose();
  };

  return (
    <Modal titolo={cliente ? 'Modifica cliente' : 'Nuovo cliente'} onClose={onClose} footer={<button className="btn primary" disabled={!valido} onClick={salva}>Salva</button>}>
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
        <div>
          <label className="lbl">Stato</label>
          <select className="field" value={c.stato} onChange={(e) => set('stato', e.target.value as StatoCliente)}>
            <option value="attivo">Attivo</option>
            <option value="sospeso">Sospeso</option>
            <option value="ex">Ex cliente</option>
          </select>
        </div>
      </div>
      <label className="lbl">Attività * (anche più di una)</label>
      <div className="chips">
        {(Object.keys(ATTIVITA) as Attivita[]).map((a) => (
          <button key={a} type="button" className={`chip ${c.attivita.includes(a) ? 'on' : ''}`} onClick={() => toggleAtt(a)}>
            <span className={`dot ${a}`} /> {ATTIVITA[a].nome}
          </button>
        ))}
      </div>
      <label className="lbl">Obiettivi</label>
      <input className="field" value={c.obiettivi} onChange={(e) => set('obiettivi', e.target.value)} />
      <label className="lbl">Note</label>
      <textarea className="field" rows={3} value={c.note} onChange={(e) => set('note', e.target.value)} />
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
