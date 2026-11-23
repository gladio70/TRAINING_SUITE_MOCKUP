// PAC-04 + ECO-01 + anteprima DASH-06: pagamenti registrati a mano, stato, incassato / da incassare per attività
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../data/store';
import { nomeCliente, statoPagamento } from '../data/logic';
import { ATTIVITA, type Attivita, type MetodoPagamento, type Pagamento } from '../data/types';
import { fmtDataBreve, fmtEuro } from '../lib/format';
import { BadgePagamento, FiltroAttivita, Modal } from '../components/ui';

type Filtro = 'tutti' | 'aperti' | 'scaduti' | 'pagati';

export function Pagamenti() {
  const { db, registraPagamento } = useStore();
  const [sp, setSp] = useSearchParams();
  const filtro = (sp.get('filtro') as Filtro) || 'tutti';
  const [att, setAtt] = useState<Attivita | 'tutte'>('tutte');
  const [incassa, setIncassa] = useState<Pagamento | null>(null);

  const ora = new Date();
  const meseIni = new Date(ora.getFullYear(), ora.getMonth(), 1);
  const meseFin = new Date(ora.getFullYear(), ora.getMonth() + 1, 1);
  const delMese = (iso?: string) => !!iso && new Date(iso) >= meseIni && new Date(iso) < meseFin;

  const lista = db.pagamenti
    .filter((p) => att === 'tutte' || p.attivita === att)
    .filter((p) => {
      const s = statoPagamento(p);
      if (filtro === 'aperti') return s !== 'pagato';
      if (filtro === 'scaduti') return s === 'scaduto';
      if (filtro === 'pagati') return s === 'pagato';
      return true;
    })
    .sort((a, b) => (a.pagatoIl ? 1 : 0) - (b.pagatoIl ? 1 : 0) || a.scadenza.localeCompare(b.scadenza));

  const riepilogo = (Object.keys(ATTIVITA) as Attivita[]).map((a) => {
    const pp = db.pagamenti.filter((p) => p.attivita === a);
    return {
      a,
      incassato: pp.filter((p) => delMese(p.pagatoIl)).reduce((s, p) => s + p.importo, 0),
      daIncassare: pp.filter((p) => !p.pagatoIl && (delMese(p.scadenza) || new Date(p.scadenza) < ora)).reduce((s, p) => s + p.importo, 0),
    };
  });
  const tot = riepilogo.reduce((s, r) => ({ incassato: s.incassato + r.incassato, daIncassare: s.daIncassare + r.daIncassare }), { incassato: 0, daIncassare: 0 });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pagamenti</h1>
          <div className="sub" style={{ textTransform: 'capitalize' }}>{ora.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</div>
        </div>
      </div>

      <div className="widgets">
        {riepilogo.map((r) => (
          <button key={r.a} className="widget" style={{ textAlign: 'left', cursor: 'pointer' }} onClick={() => setAtt(r.a)}>
            <div className="row" style={{ gap: 6 }}><span className={`dot ${r.a}`} /><span className="w-lbl">{ATTIVITA[r.a].nome}</span></div>
            <div className="w-num">{fmtEuro(r.incassato)}</div>
            <div className="w-lbl">incassato · da incassare {fmtEuro(r.daIncassare)}</div>
          </button>
        ))}
        <div className="widget">
          <span className="w-lbl">Totale mese</span>
          <div className="w-num">{fmtEuro(tot.incassato)}</div>
          <div className="w-lbl">da incassare {fmtEuro(tot.daIncassare)}</div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <FiltroAttivita valore={att} onChange={setAtt} />
        <div className="chips">
          {(['tutti', 'aperti', 'scaduti', 'pagati'] as Filtro[]).map((f) => (
            <button key={f} className={`chip ${filtro === f ? 'on' : ''}`} onClick={() => setSp({ filtro: f })} style={{ textTransform: 'capitalize' }}>
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="card tbl-wrap" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Descrizione</th>
              <th>Scadenza</th>
              <th className="right">Importo</th>
              <th>Stato</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {lista.length === 0 && <tr><td colSpan={6} className="empty">Nessun pagamento.</td></tr>}
            {lista.map((p) => {
              const s = statoPagamento(p);
              return (
                <tr key={p.id}>
                  <td><Link to={`/clienti/${p.clienteId}`} style={{ fontWeight: 600 }}>{nomeCliente(db.clienti.find((c) => c.id === p.clienteId))}</Link></td>
                  <td><span className="row" style={{ gap: 6 }}><span className={`dot ${p.attivita}`} />{p.descrizione}</span></td>
                  <td className="small">{fmtDataBreve(p.scadenza)}</td>
                  <td className="right num" style={{ fontWeight: 700 }}>{fmtEuro(p.importo)}</td>
                  <td>
                    <BadgePagamento s={s} />
                    {p.pagatoIl && <div className="small muted">{fmtDataBreve(p.pagatoIl)} · {p.metodo}</div>}
                  </td>
                  <td className="right">{s !== 'pagato' && <button className="btn sm" onClick={() => setIncassa(p)}>Registra incasso</button>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        In F2: pagamento online con link Stripe (PAC-05), fatture Fiscozen con PDF (ECO-04), costi ed esportazione per il commercialista (ECO-03/06).
      </p>

      {incassa && <IncassoModal p={incassa} onClose={() => setIncassa(null)} onSave={(m) => { registraPagamento(incassa.id, m); setIncassa(null); }} />}
    </>
  );
}

function IncassoModal({ p, onClose, onSave }: { p: Pagamento; onClose: () => void; onSave: (m: MetodoPagamento) => void }) {
  const [m, setM] = useState<MetodoPagamento>('contanti');
  return (
    <Modal titolo="Registra incasso" onClose={onClose} footer={<button className="btn primary" onClick={() => onSave(m)}>Conferma {fmtEuro(p.importo)}</button>}>
      <p style={{ marginTop: 0 }}>{p.descrizione}</p>
      <label className="lbl">Metodo</label>
      <div className="tabs">
        {(['contanti', 'bonifico', 'POS'] as MetodoPagamento[]).map((x) => (
          <button key={x} className={m === x ? 'on' : ''} onClick={() => setM(x)}>{x}</button>
        ))}
      </div>
      <p className="small muted">Data incasso: oggi.</p>
    </Modal>
  );
}
