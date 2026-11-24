// Anteprima della vista economica minima (proposta di anticipo dalla F2: ECO-02, ECO-03, DASH-06, V-06).
// Separa venduto, incassato, da incassare e valore delle sessioni erogate, con costi e ore per attività.
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useStore } from '../data/store';
import { economiaMese } from '../data/logic';
import { ATTIVITA } from '../data/types';
import { fmtDataBreve, fmtEuro } from '../lib/format';

const ore = (n: number) => `${n.toFixed(1).replace('.', ',')} h`;

export function Economia() {
  const { db } = useStore();
  const [rif, setRif] = useState(() => new Date());
  const { ini, righe, costiComuni } = economiaMese(db, rif);
  const fin = new Date(ini.getFullYear(), ini.getMonth() + 1, 1);
  const tot = righe.reduce(
    (t, r) => ({
      venduto: t.venduto + r.venduto, incassato: t.incassato + r.incassato, daIncassare: t.daIncassare + r.daIncassare,
      erogato: t.erogato + r.erogato, costi: t.costi + r.costi, ore: t.ore + r.ore, oreGratuite: t.oreGratuite + r.oreGratuite,
      sessioniGratuite: t.sessioniGratuite + r.sessioniGratuite,
    }),
    { venduto: 0, incassato: 0, daIncassare: 0, erogato: 0, costi: 0, ore: 0, oreGratuite: 0, sessioniGratuite: 0 },
  );
  const margine = tot.incassato - tot.costi - costiComuni;
  const costiMese = db.costi.filter((c) => new Date(c.data) >= ini && new Date(c.data) < fin);
  const sposta = (d: number) => setRif(new Date(ini.getFullYear(), ini.getMonth() + d, 1));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Economia</h1>
          <div className="sub" style={{ textTransform: 'capitalize' }}>{ini.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</div>
        </div>
        <div className="row">
          <button className="btn sm" onClick={() => sposta(-1)} aria-label="Mese precedente"><ChevronLeft size={16} /></button>
          <button className="btn sm" onClick={() => setRif(new Date())}>Questo mese</button>
          <button className="btn sm" onClick={() => sposta(1)} aria-label="Mese successivo"><ChevronRight size={16} /></button>
        </div>
      </div>

      <div className="banner">
        <Info size={16} />
        <span>Anteprima della vista economica minima (proposta di anticipo dalla F2). Accantonamenti fiscali e fatture Fiscozen arriveranno dopo, da validare con il commercialista.</span>
      </div>

      <div className="widgets">
        <div className="widget"><div className="w-lbl">Venduto</div><div className="w-num">{fmtEuro(tot.venduto)}</div><div className="w-lbl">pacchetti iniziati nel mese</div></div>
        <div className="widget"><div className="w-lbl">Incassato</div><div className="w-num">{fmtEuro(tot.incassato)}</div><div className="w-lbl">pagamenti ricevuti nel mese</div></div>
        <div className={`widget ${tot.daIncassare ? 'warn' : ''}`}><div className="w-lbl">Da incassare</div><div className="w-num">{fmtEuro(tot.daIncassare)}</div><div className="w-lbl">scaduti o in scadenza nel mese</div></div>
        <div className="widget"><div className="w-lbl">Valore erogato</div><div className="w-num">{fmtEuro(tot.erogato)}</div><div className="w-lbl">sessioni fatte × prezzo per sessione</div></div>
        <div className="widget"><div className="w-lbl">Costi</div><div className="w-num">{fmtEuro(tot.costi + costiComuni)}</div><div className="w-lbl">di cui comuni {fmtEuro(costiComuni)}</div></div>
        <div className={`widget ${margine < 0 ? 'alert' : ''}`}><div className="w-lbl">Incassato − costi</div><div className="w-num">{fmtEuro(margine)}</div><div className="w-lbl">prima delle tasse</div></div>
      </div>

      <div className="card tbl-wrap" style={{ padding: 0 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Attività</th>
              <th className="right">Venduto</th>
              <th className="right">Incassato</th>
              <th className="right">Da incassare</th>
              <th className="right">Valore erogato</th>
              <th className="right">Costi diretti</th>
              <th className="right">Ore sessione</th>
              <th className="right">€/ora</th>
              <th>Gratuito / scambio</th>
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr key={r.attivita}>
                <td><span className="row" style={{ gap: 6 }}><span className={`dot ${r.attivita}`} />{ATTIVITA[r.attivita].nome}</span></td>
                <td className="right num">{fmtEuro(r.venduto)}</td>
                <td className="right num" style={{ fontWeight: 700 }}>{fmtEuro(r.incassato)}</td>
                <td className="right num">{fmtEuro(r.daIncassare)}</td>
                <td className="right num">{fmtEuro(r.erogato)}</td>
                <td className="right num">{r.costi ? fmtEuro(r.costi) : '—'}</td>
                <td className="right num">{ore(r.ore)}</td>
                <td className="right num">{r.ore ? fmtEuro((r.incassato - r.costi) / r.ore) : '—'}</td>
                <td className="small">
                  {r.sessioniGratuite ? `${r.sessioniGratuite} sessioni` : ''}
                  {r.sessioniGratuite && r.oreGratuite ? ' · ' : ''}
                  {r.oreGratuite ? `Body Check ${ore(r.oreGratuite)}` : ''}
                  {!r.sessioniGratuite && !r.oreGratuite && <span className="muted">—</span>}
                </td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700 }}>
              <td>Totale</td>
              <td className="right num">{fmtEuro(tot.venduto)}</td>
              <td className="right num">{fmtEuro(tot.incassato)}</td>
              <td className="right num">{fmtEuro(tot.daIncassare)}</td>
              <td className="right num">{fmtEuro(tot.erogato)}</td>
              <td className="right num">{fmtEuro(tot.costi)}</td>
              <td className="right num">{ore(tot.ore)}</td>
              <td className="right num">{tot.ore ? fmtEuro(margine / tot.ore) : '—'}</td>
              <td className="small">{tot.sessioniGratuite} sessioni · {ore(tot.oreGratuite)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        €/ora = (incassato − costi diretti) ÷ ore di sessione: calcolo indicativo. Il metodo per ripartire i costi comuni e la definizione di “ora lavorata”
        (sessioni, Body Check, preparazione, amministrazione, spostamenti) sono da concordare (V-06).
      </p>

      <div className="card">
        <h2>Costi del mese</h2>
        {costiMese.length === 0 && <div className="empty">Nessun costo registrato.</div>}
        <div className="list">
          {costiMese.map((c) => (
            <div key={c.id} className="item">
              {c.attivita ? <span className={`dot ${c.attivita}`} /> : <span className="dot" />}
              <div className="grow">
                <div className="t">{c.descrizione}</div>
                <div className="d">{fmtDataBreve(c.data)} · {c.categoria} · {c.attivita ? ATTIVITA[c.attivita].breve : 'comune'}</div>
              </div>
              <span className="num" style={{ fontWeight: 700 }}>{fmtEuro(c.importo)}</span>
            </div>
          ))}
        </div>
        <p className="small muted">Registrazione dei costi, categorie e accantonamenti configurabili: nella versione reale (ECO-03).</p>
      </div>
    </>
  );
}
