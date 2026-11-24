// PAC-01..03: catalogo prodotti per attività e pacchetti dei clienti con residue e scadenze
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useStore } from '../data/store';
import { daSeguire, FORMULE, nomeCliente, statoPacchetto, titolariDi } from '../data/logic';
import { ATTIVITA, type Attivita, type PacchettoCliente, type Prodotto, type TipoProdotto } from '../data/types';
import { fmtDataBreve, fmtEuro } from '../lib/format';
import { BadgeAttivita, FiltroAttivita, Modal } from '../components/ui';
import { ProrogaModal } from './ClienteDettaglio';

// tipi senza sessioni da scalare: si usano a tempo (validità), non a sessioni
const SENZA_SESSIONI: TipoProdotto[] = ['abbonamento', 'programmazione'];

/** PAC-01: nuovo prodotto nel catalogo. Dopo il salvataggio si può vendere dalla scheda cliente ("Pacchetto"). */
function NuovoProdotto({ attivita, onClose }: { attivita: Attivita; onClose: () => void }) {
  const { aggiungiProdotto } = useStore();
  const [p, setP] = useState<Omit<Prodotto, 'id'>>({
    attivita, nome: '', tipo: attivita === 'VC' ? 'carnet' : 'pacchetto', sessioni: 10, prezzo: 0,
    validitaGiorni: 30, preavvisoOre: attivita === 'VC' ? 0 : 24, scalaTardiva: attivita !== 'VC',
  });
  const set = <K extends keyof typeof p>(k: K, v: (typeof p)[K]) => setP((x) => ({ ...x, [k]: v }));
  const conSessioni = !SENZA_SESSIONI.includes(p.tipo);
  const valido = p.nome.trim() && p.prezzo >= 0 && p.validitaGiorni > 0 && (!conSessioni || (p.sessioni ?? 0) > 0);
  const salva = () => {
    aggiungiProdotto({ ...p, nome: p.nome.trim(), sessioni: conSessioni ? p.sessioni : undefined });
    onClose();
  };

  return (
    <Modal titolo="Nuovo prodotto" onClose={onClose} footer={<button className="btn primary" disabled={!valido} onClick={salva}>Aggiungi al catalogo</button>}>
      <label className="lbl">Attività</label>
      <div className="tabs">
        {(Object.keys(ATTIVITA) as Attivita[]).map((a) => (
          <button key={a} className={p.attivita === a ? 'on' : ''} onClick={() => set('attivita', a)}>{ATTIVITA[a].breve}</button>
        ))}
      </div>
      <label className="lbl">Nome *</label>
      <input className="field" autoFocus value={p.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Es. PT Studio – 12 sessioni" />
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label className="lbl">Tipo</label>
          <select className="field" value={p.tipo} onChange={(e) => set('tipo', e.target.value as TipoProdotto)}>
            {(Object.keys(TIPI) as TipoProdotto[]).map((t) => (
              <option key={t} value={t}>{TIPI[t]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">Sessioni</label>
          <input className="field" type="number" min={1} disabled={!conSessioni} value={conSessioni ? p.sessioni ?? '' : ''}
            placeholder={conSessioni ? '' : 'non previste'} onChange={(e) => set('sessioni', Number(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="lbl">Prezzo (€)</label>
          <input className="field" type="number" min={0} step={5} value={p.prezzo} onChange={(e) => set('prezzo', Number(e.target.value))} />
        </div>
        <div>
          <label className="lbl">Validità (giorni)</label>
          <input className="field" type="number" min={1} value={p.validitaGiorni} onChange={(e) => set('validitaGiorni', Number(e.target.value))} />
        </div>
        <div>
          <label className="lbl">Preavviso disdetta (ore)</label>
          <input className="field" type="number" min={0} value={p.preavvisoOre} onChange={(e) => set('preavvisoOre', Number(e.target.value))} />
        </div>
        <div>
          <label className="lbl">Disdetta tardiva</label>
          <select className="field" value={p.scalaTardiva ? 'si' : 'no'} onChange={(e) => set('scalaTardiva', e.target.value === 'si')}>
            <option value="si">Scalata dal pacchetto</option>
            <option value="no">Non scalata</option>
          </select>
        </div>
      </div>
      {conSessioni && p.sessioni && p.prezzo > 0 && (
        <p className="small muted">Prezzo per sessione: {fmtEuro(p.prezzo / p.sessioni)}</p>
      )}
      <p className="small muted">Dopo l’aggiunta si vende dalla scheda del cliente con “Pacchetto”.</p>
    </Modal>
  );
}

const TIPI: Record<TipoProdotto, string> = {
  pacchetto: 'Pacchetto sessioni', carnet: 'Carnet community', abbonamento: 'Abbonamento', percorso: 'Percorso',
  smallgroup: 'Small group', programmazione: 'Programmazione / scheda',
};
type Filtro = 'attivi' | 'attenzione' | 'conclusi' | 'tutti';

export function Pacchetti() {
  const { db } = useStore();
  const [sp, setSp] = useSearchParams();
  const filtro = (sp.get('filtro') as Filtro) || 'attivi';
  const [tab, setTab] = useState<'clienti' | 'catalogo'>('clienti');
  const [att, setAtt] = useState<Attivita | 'tutte'>('tutte');
  const [proroga, setProroga] = useState<PacchettoCliente | null>(null);
  const [nuovoProdotto, setNuovoProdotto] = useState(false);

  const righe = db.pacchetti
    .map((k) => ({ k, s: statoPacchetto(db, k), seguito: titolariDi(k).some((id) => daSeguire(db.clienti.find((x) => x.id === id), statoPacchetto(db, k).prodotto.attivita)) }))
    .filter(({ s }) => att === 'tutte' || s.prodotto.attivita === att)
    .filter(({ s, seguito }) => {
      const attenzione = seguito && !s.scaduto && ((s.residue != null && s.residue <= db.soglie.residueMin) || s.giorni <= db.soglie.giorniScadenza);
      if (filtro === 'attenzione') return attenzione || (seguito && s.scaduto && s.giorni > -30);
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
          <table className="tbl stack">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Prodotto</th>
                <th>Periodo</th>
                <th>Sessioni</th>
                <th className="right">Residue</th>
                <th>Scadenza</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {righe.length === 0 && (
                <tr><td colSpan={7} className="empty">Nessun pacchetto.</td></tr>
              )}
              {righe.map(({ k, s }) => (
                <tr key={k.id}>
                  <td>
                    {titolariDi(k).map((id, i) => (
                      <span key={id}>
                        {i > 0 && ' + '}
                        <Link to={`/clienti/${id}`} style={{ fontWeight: 600 }}>{nomeCliente(db.clienti.find((x) => x.id === id))}</Link>
                      </span>
                    ))}
                  </td>
                  <td>
                    <span className="row" style={{ gap: 6 }}><span className={`dot ${s.prodotto.attivita}`} />{s.nome}</span>
                    <span className="row" style={{ gap: 4, marginTop: 2 }}>
                      {k.formula !== 'pagamento' && <span className="badge ok">{FORMULE[k.formula]}</span>}
                      {k.condivisoCon && <span className="badge neutral">condiviso</span>}
                      {k.storico && <span className="badge warn" title={k.storico}>storico</span>}
                    </span>
                  </td>
                  <td className="small muted">{fmtDataBreve(k.inizio)} → {fmtDataBreve(k.scadenza)}</td>
                  <td style={{ minWidth: 120, flex: '1 1 80px' }}>
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
                      <span className="badge warn">scade tra {s.giorni} g</span>
                    ) : (
                      <span className="small muted">scade tra {s.giorni} g</span>
                    )}
                  </td>
                  <td className="right">
                    {(s.residue == null || s.residue > 0) && s.giorni > -60 && (
                      <button className="btn sm ghost" onClick={() => setProroga(k)}>Proroga</button>
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
                {p.nonVendibile ? (
                  <div className="small muted" style={{ margin: '6px 0' }}>Non più in vendita: si mantengono residui e condizioni già concordate.</div>
                ) : (
                  <>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, margin: '6px 0' }}>{fmtEuro(p.prezzo)}</div>
                    <div className="small muted">
                      {p.sessioni ? `${p.sessioni} sessioni` : 'Senza sessioni da scalare'} · validità {p.validitaGiorni} giorni
                      {p.tipo === 'carnet' ? ' (modificabile fino a 90, con proroga manuale)' : ''}
                    </div>
                    <div className="small" style={{ marginTop: 8 }}>
                      {p.tipo === 'carnet' ? (
                        <><b>Pagamento anticipato</b>, frequenza libera: scala una sessione per ogni presenza</>
                      ) : (
                        <><b>Disdetta:</b> preavviso {p.preavvisoOre} h · tardiva {p.scalaTardiva ? 'scalata' : 'non scalata'}</>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}
          <button className="card empty nuovo-prodotto" style={{ margin: 0, borderStyle: 'dashed' }} onClick={() => setNuovoProdotto(true)}>
            <Plus size={20} />
            <div style={{ fontWeight: 600, marginTop: 4 }}>Nuovo prodotto</div>
            <div className="small">pacchetto, carnet, abbonamento, percorso…</div>
          </button>
        </div>
      )}
      <p className="small muted" style={{ marginTop: 12 }}>
        Soglie avvisi: ≤ {db.soglie.residueMin} sessioni residue, scadenza entro {db.soglie.giorniScadenza} giorni (modificabili in Impostazioni). Attività: {Object.values(ATTIVITA).map((a) => a.breve).join(', ')}.
        Prezzi dei carnet community reali; gli altri prezzi sono indicativi.
      </p>
      {proroga && <ProrogaModal k={proroga} onClose={() => setProroga(null)} />}
      {nuovoProdotto && <NuovoProdotto attivita={att === 'tutte' ? 'LT' : att} onClose={() => setNuovoProdotto(false)} />}
    </>
  );
}
