// GRP / D-07: registro delle presenze effettive a una classe della community.
// Ogni presenza scala il carnet valido della persona; chi non ha un carnet valido viene segnalato.
import { useState } from 'react';
import { Search } from 'lucide-react';
import { useStore } from '../data/store';
import { carnetAttivo, inCarico, ordineClienti, prodottoDi, statoPacchetto } from '../data/logic';
import { fmtData, fmtOra } from '../lib/format';
import { Modal } from './ui';

export function PresenzeModal({ appuntamentoId, onClose }: { appuntamentoId: string; onClose: () => void }) {
  const { db, togglePresenza } = useStore();
  const [q, setQ] = useState('');
  const a = db.appuntamenti.find((x) => x.id === appuntamentoId)!;
  const presenti = new Set(a.presenze?.map((p) => p.clienteId));
  const programmazione = (cid: string) =>
    db.pacchetti.some((k) => k.clienteId === cid && prodottoDi(db, k).tipo === 'programmazione' && !statoPacchetto(db, k).scaduto);
  const membri = db.clienti
    .filter((c) => inCarico(c, 'VC') || presenti.has(c.id))
    .filter((c) => `${c.nome} ${c.cognome}`.toLowerCase().includes(q.toLowerCase()))
    .sort((x, y) => Number(presenti.has(y.id)) - Number(presenti.has(x.id)) || ordineClienti(x, y));

  return (
    <Modal
      titolo={`Presenze · ${a.gruppo}`}
      onClose={onClose}
      footer={<button className="btn primary" onClick={onClose}>Fatto ({presenti.size} presenti)</button>}
    >
      <p className="small muted" style={{ marginTop: 0 }}>
        {fmtData(a.inizio)} alle {fmtOra(a.inizio)} · {a.luogo}. Un tocco per segnare chi è venuto davvero: la sessione si scala dal carnet.
      </p>
      <div className="search" style={{ marginBottom: 8 }}>
        <Search size={16} />
        <input className="field" placeholder="Cerca…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="list">
        {membri.map((c) => {
          const pr = a.presenze?.find((p) => p.clienteId === c.id);
          const k = pr ? db.pacchetti.find((x) => x.id === pr.pacchettoId) : carnetAttivo(db, c.id);
          const s = k ? statoPacchetto(db, k) : undefined;
          return (
            <label key={c.id} className={`todo presenza ${pr ? 'on' : ''}`}>
              <input type="checkbox" checked={!!pr} onChange={() => togglePresenza(a.id, c.id)} />
              <span className="grow">
                {c.cognome} {c.nome}
              </span>
              {s ? (
                <span className={`badge ${s.residue != null && s.residue <= db.soglie.residueMin ? 'danger' : 'neutral'}`}>
                  {s.nome.replace('Carnet ', '')} · {s.residue} residue
                </span>
              ) : (
                <span className="badge warn">{programmazione(c.id) ? 'solo programmazione' : 'senza carnet'}</span>
              )}
            </label>
          );
        })}
      </div>
    </Modal>
  );
}
