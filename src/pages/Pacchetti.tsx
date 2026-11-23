// PAC-01..03: catalogo prodotti per attività e pacchetti dei clienti con residue e scadenze
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useStore } from '../data/store';
import { nomeCliente, statoPacchetto } from '../data/logic';
import { ATTIVITA, type Attivita, type TipoProdotto } from '../data/types';
import { fmtDataBreve, fmtEuro } from '../lib/format';
import { BadgeAttivita, FiltroAttivita } from '../components/ui';

const TIPI: Record<TipoProdotto, string> = { pacchetto: 'Pacchetto sessioni', abbonamento: 'Abbonamento', percorso: 'Percorso coaching', smallgroup: 'Small group' };
type Filtro = 'attivi' | 'attenzione' | 'conclusi' | 'tutti';

export function Pacchetti() {
  const { db } = useStore();
  const [sp, setSp] = useSearchParams();
  const filtro = (sp.get('filtro') as Filtro) || 'attivi';
  const [tab, setTab] = useState<'clienti' | 'catalogo'>('clienti');
  const [att, setAtt] = useState<Attivita | 'tutte'>('tutte');

  const righe = db.pacchetti
    .map((k) => ({ k, s: statoPacchetto(db, k), c: db.clienti.find((x) => x.id === k.clienteId) }))
    .filter(({ s }) => att === 'tutte' || s.prodotto.attivita === att)
    .filter(({ s, c }) => {
      const attenzione = c?.stato === 'attivo' && !s.scaduto && ((s.residue != null && s.residue <= db.soglie.residueMin) || s.giorni <= db.soglie.giorniScadenza);
      if (filtro === 'attenzione') return attenzione || (c?.stato === 'attivo' && s.scaduto && s.giorni > -30);
      if (filtro === 'attivi') return !s.scaduto;
      if (filtro === 'conclusi') return s.scaduto;
      return true;
    })
    .sort((a, b) => a.s.giorni - b.s.giorni);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Pacchetti</h1>
          <div className="sub">Sessioni residue scalate automaticamente dagli esiti delle sessioni</div>
        </div>
        <div className="tabs">
          <button className={tab === 'clienti' ? 'on' : ''} onClick={() => setTab('clienti')}>Dei clienti</button>
          <button className={tab === 'catalogo' ? 'on' : ''} onClick={() => setTab('catalogo')}>Catalogo</button>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <FiltroAttivita valore={att} onChange={setAtt} />
        {tab === 'clienti' && (
          <div className="chips">
            {(['attivi', 'attenzione', 'conclusi', 'tutti'] as Filtro[]).map((f) => (
              <button key={f} className={`chip ${filtro === f ? 'on' : ''}`} onClick={() => setSp({ filtro: f })}>
                {f === 'attenzione' ? 'In esaurimento / scadenza' : f[0].toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        )}
      </div>

      {tab === 'clienti' ? (
        <div className="card tbl-wrap" style={{ padding: 0 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Prodotto</th>
                <th>Periodo</th>
                <th>Sessioni</th>
                <th className="right">Residue</th>
                <th>Scadenza</th>
              </tr>
            </thead>
            <tbody>
              {righe.length === 0 && (
                <tr><td colSpan={6} className="empty">Nessun pacchetto.</td></tr>
              )}
              {righe.map(({ k, s, c }) => (
                <tr key={k.id}>
                  <td><Link to={`/clienti/${k.clienteId}`} style={{ fontWeight: 600 }}>{nomeCliente(c)}</Link></td>
                  <td><span className="row" style={{ gap: 6 }}><span className={`dot ${s.prodotto.attivita}`} />{s.prodotto.nome}</span></td>
                  <td className="small muted">{fmtDataBreve(k.inizio)} → {fmtDataBreve(k.scadenza)}</td>
                  <td style={{ minWidth: 120 }}>
                    {s.residue != null ? (
                      <div className={`bar ${s.residue <= db.soglie.residueMin ? 'low' : ''}`}>
                        <span style={{ width: `${Math.max(0, (s.residue / (k.sessioniTot || 1)) * 100)}%` }} />
                      </div>
                    ) : (
                      <span className="small muted">illimitato</span>
                    )}
                  </td>
                  <td className="right num" style={{ fontWeight: 700 }}>
                    {s.residue != null ? (
                      <span style={{ color: s.residue <= db.soglie.residueMin ? 'var(--danger)' : undefined }}>{s.residue}/{k.sessioniTot}</span>
                    ) : '—'}
                  </td>
                  <td>
                    {s.giorni < 0 ? (
                      <span className="badge neutral">scaduto</span>
                    ) : s.giorni <= db.soglie.giorniScadenza ? (
                      <span className="badge warn">tra {s.giorni} g</span>
                    ) : (
                      <span className="small muted">tra {s.giorni} g</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-3">
          {db.prodotti
            .filter((p) => att === 'tutte' || p.attivita === att)
            .map((p) => (
              <div key={p.id} className="card" style={{ margin: 0 }}>
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <BadgeAttivita a={p.attivita} breve />
                  <span className="badge neutral">{TIPI[p.tipo]}</span>
                </div>
                <h3 style={{ marginTop: 10 }}>{p.nome}</h3>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, margin: '6px 0' }}>{fmtEuro(p.prezzo)}</div>
                <div className="small muted">
                  {p.sessioni ? `${p.sessioni} sessioni` : 'Accesso illimitato'} · validità {p.validitaGiorni} giorni
                </div>
                <div className="small" style={{ marginTop: 8 }}>
                  <b>Disdetta:</b> preavviso {p.preavvisoOre} h · tardiva {p.scalaTardiva ? 'scalata' : 'non scalata'}
                </div>
              </div>
            ))}
          <div className="card empty" style={{ margin: 0, borderStyle: 'dashed' }}>
            + Nuovo prodotto
            <div className="small">(gestione catalogo nella versione reale)</div>
          </div>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 12 }}>
        Soglie avvisi: ≤ {db.soglie.residueMin} sessioni residue, scadenza entro {db.soglie.giorniScadenza} giorni (modificabili in Impostazioni). Attività: {Object.values(ATTIVITA).map((a) => a.breve).join(', ')}.
      </p>
    </>
  );
}
