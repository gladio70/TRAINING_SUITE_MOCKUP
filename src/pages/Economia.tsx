// Anteprima della vista economica minima (proposta di anticipo dalla F2: ECO-02, ECO-03, DASH-06, V-06).
// Separa venduto, incassato, da incassare e valore delle sessioni erogate, con costi e ore per attività.
import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useStore } from '../data/store';
import { dettaglioMese, economiaMese, FORMULE, nomeCliente, type RigaEconomia } from '../data/logic';
import { ATTIVITA, type Attivita } from '../data/types';
import { fmtData, fmtDataBreve, fmtEuro } from '../lib/format';
import { Modal } from '../components/ui';

const ore = (n: number) => `${n.toFixed(1).replace('.', ',')} h`;

type TipoDettaglio = 'venduto' | 'incassato' | 'daIncassare' | 'erogato' | 'costi' | 'margine';
const TITOLI: Record<TipoDettaglio, string> = {
  venduto: 'Venduto', incassato: 'Incassato', daIncassare: 'Da incassare', erogato: 'Valore erogato', costi: 'Costi', margine: 'Incassato − costi',
};

/** Riga del dettaglio: pallino dell'attività, testo, importo a destra (solo consultazione, nessun collegamento) */
function Voce({ attivita, titolo, sotto, importo }: {
  attivita?: Attivita; titolo: ReactNode; sotto: ReactNode; importo: ReactNode; clienteId?: string; onApri?: () => void;
}) {
  return (
    <div className="item">
      <span className={`dot ${attivita ?? ''}`} />
      <div className="grow">
        <div className="t">{titolo}</div>
        <div className="d">{sotto}</div>
      </div>
      <span className="num" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{importo}</span>
    </div>
  );
}

function DettaglioWidget({ tipo, dettaglio, margine, mese, onClose }: {
  tipo: TipoDettaglio;
  dettaglio: ReturnType<typeof dettaglioMese>;
  margine: { righe: RigaEconomia[]; costiComuni: number; totale: number };
  mese: string;
  onClose: () => void;
}) {
  const { db } = useStore();
  const nome = (id: string) => nomeCliente(db.clienti.find((c) => c.id === id));
  const somma = (n: number[]) => n.reduce((s, x) => s + x, 0);
  let righe: ReactNode = null;
  let totale = 0;
  let nota = '';

  if (tipo === 'venduto') {
    totale = somma(dettaglio.venduti.map((v) => v.k.prezzo));
    nota = 'Pacchetti, carnet e percorsi iniziati nel mese, a prezzo pieno (anche se pagati a rate).';
    righe = dettaglio.venduti.map((v) => (
      <Voce key={v.k.id} attivita={v.attivita} clienteId={v.k.clienteId} onApri={onClose} titolo={v.chi}
        sotto={`${v.nome} · ${fmtDataBreve(v.k.inizio)}${v.k.formula !== 'pagamento' ? ` · ${FORMULE[v.k.formula]}` : ''}`}
        importo={fmtEuro(v.k.prezzo)} />
    ));
  } else if (tipo === 'incassato' || tipo === 'daIncassare') {
    const lista = tipo === 'incassato' ? dettaglio.incassati : dettaglio.daIncassare;
    totale = somma(lista.map((p) => p.importo));
    nota = tipo === 'incassato' ? 'Pagamenti ricevuti nel mese, con data e metodo.' : 'Pagamenti non ancora ricevuti: scaduti o in scadenza entro fine mese.';
    righe = lista.map((p) => (
      <Voce key={p.id} attivita={p.attivita} clienteId={p.clienteId} onApri={onClose} titolo={nome(p.clienteId)}
        sotto={tipo === 'incassato' ? `${p.descrizione} · ${fmtDataBreve(p.pagatoIl!)} · ${p.metodo}` : `${p.descrizione} · ${new Date(p.scadenza) < new Date() ? 'scaduto il' : 'scade il'} ${fmtDataBreve(p.scadenza)}`}
        importo={fmtEuro(p.importo)} />
    ));
  } else if (tipo === 'erogato') {
    totale = somma(dettaglio.erogate.map((e) => e.valore));
    const gratuite = dettaglio.erogate.filter((e) => e.formula !== 'pagamento').length;
    nota = `Sessioni effettivamente svolte (o scalate) nel mese, valorizzate al prezzo per sessione del pacchetto.${gratuite ? ` ${gratuite} gratuite o in scambio, a valore zero.` : ''}`;
    righe = dettaglio.erogate.map((e, i) => (
      <Voce key={i} attivita={e.attivita} clienteId={e.clienteId} onApri={onClose} titolo={e.chi}
        sotto={`${fmtData(e.data)} · ${e.servizio} · ${e.pacchetto}`}
        importo={e.formula === 'pagamento' ? fmtEuro(e.valore) : <span className="badge ok">{FORMULE[e.formula]}</span>} />
    ));
  } else if (tipo === 'costi') {
    totale = somma(dettaglio.costi.map((c) => c.importo));
    nota = 'Costi diretti per attività e costi comuni. Registrazione dei costi, categorie e accantonamenti: nella versione reale (ECO-03).';
    righe = dettaglio.costi.map((c) => (
      <Voce key={c.id} attivita={c.attivita} onApri={onClose} titolo={c.descrizione}
        sotto={`${fmtDataBreve(c.data)} · ${c.categoria} · ${c.attivita ? ATTIVITA[c.attivita].breve : 'comune'}`}
        importo={fmtEuro(c.importo)} />
    ));
  } else {
    totale = margine.totale;
    nota = 'Incassato meno costi diretti per attività; i costi comuni sono sottratti solo dal totale.';
    righe = (
      <>
        {margine.righe.map((r) => (
          <Voce key={r.attivita} attivita={r.attivita} onApri={onClose} titolo={ATTIVITA[r.attivita].nome}
            sotto={`incassato ${fmtEuro(r.incassato)} − costi ${fmtEuro(r.costi)}`} importo={fmtEuro(r.incassato - r.costi)} />
        ))}
        <Voce onApri={onClose} titolo="Costi comuni" sotto="non attribuiti a un’attività" importo={`− ${fmtEuro(margine.costiComuni)}`} />
      </>
    );
  }

  const vuoto = Array.isArray(righe) && righe.length === 0;
  return (
    <Modal titolo={`${TITOLI[tipo]} · ${mese}`} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Chiudi</button>}>
      <p className="small muted" style={{ marginTop: 0 }}>{nota}</p>
      {vuoto ? <div className="empty">Nessuna voce nel mese.</div> : <div className="list">{righe}</div>}
      <div className="row" style={{ justifyContent: 'space-between', fontWeight: 700, marginTop: 10, paddingTop: 10, borderTop: '2px solid var(--border)' }}>
        <span>Totale{Array.isArray(righe) && !vuoto ? ` (${righe.length} voci)` : ''}</span>
        <span className="num">{fmtEuro(totale)}</span>
      </div>
    </Modal>
  );
}

export function Economia() {
  const { db } = useStore();
  const [rif, setRif] = useState(() => new Date());
  const { ini, righe, costiComuni } = economiaMese(db, rif);
  const tot = righe.reduce(
    (t, r) => ({
      venduto: t.venduto + r.venduto, incassato: t.incassato + r.incassato, daIncassare: t.daIncassare + r.daIncassare,
      erogato: t.erogato + r.erogato, costi: t.costi + r.costi, ore: t.ore + r.ore, oreGratuite: t.oreGratuite + r.oreGratuite,
      sessioniGratuite: t.sessioniGratuite + r.sessioniGratuite,
    }),
    { venduto: 0, incassato: 0, daIncassare: 0, erogato: 0, costi: 0, ore: 0, oreGratuite: 0, sessioniGratuite: 0 },
  );
  const margine = tot.incassato - tot.costi - costiComuni;
  const sposta = (d: number) => setRif(new Date(ini.getFullYear(), ini.getMonth() + d, 1));
  const [aperto, setAperto] = useState<TipoDettaglio | null>(null);
  const dettaglio = dettaglioMese(db, rif);

  return (
    <>
      <div className="page-head">
        <div style={{ width: '100%' }}>
          <h1>Report Economico</h1>
          {/* nome del mese e selettore sulla stessa riga, come nella pagina Pagamenti */}
          <div className="riga-mese">
            <div className="sub" style={{ textTransform: 'capitalize' }}>{ini.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}</div>
            <div className="periodo">
              <button className="btn sm" onClick={() => sposta(-1)} aria-label="Mese precedente"><ChevronLeft size={16} /></button>
              <button className="btn sm" onClick={() => setRif(new Date())}>Questo mese</button>
              <button className="btn sm" onClick={() => sposta(1)} aria-label="Mese successivo"><ChevronRight size={16} /></button>
            </div>
          </div>
        </div>
      </div>

      <div className="banner">
        <Info size={16} />
        <span>Anteprima della vista economica minima (proposta di anticipo dalla F2). Accantonamenti fiscali e fatture Fiscozen arriveranno dopo, da validare con il commercialista.</span>
      </div>

      <div className="widgets">
        <button className="widget" onClick={() => setAperto('venduto')}><div className="w-lbl">Venduto</div><div className="w-num">{fmtEuro(tot.venduto)}</div><div className="w-lbl">pacchetti iniziati nel mese</div></button>
        <button className="widget" onClick={() => setAperto('incassato')}><div className="w-lbl">Incassato</div><div className="w-num">{fmtEuro(tot.incassato)}</div><div className="w-lbl">pagamenti ricevuti nel mese</div></button>
        <button className={`widget ${tot.daIncassare ? 'warn' : ''}`} onClick={() => setAperto('daIncassare')}><div className="w-lbl">Da incassare</div><div className="w-num">{fmtEuro(tot.daIncassare)}</div><div className="w-lbl">scaduti o in scadenza nel mese</div></button>
        <button className="widget" onClick={() => setAperto('erogato')}><div className="w-lbl">Valore erogato</div><div className="w-num">{fmtEuro(tot.erogato)}</div><div className="w-lbl">sessioni fatte × prezzo per sessione</div></button>
        <button className="widget" onClick={() => setAperto('costi')}><div className="w-lbl">Costi</div><div className="w-num">{fmtEuro(tot.costi + costiComuni)}</div><div className="w-lbl">di cui comuni {fmtEuro(costiComuni)}</div></button>
        <button className={`widget ${margine < 0 ? 'alert' : ''}`} onClick={() => setAperto('margine')}><div className="w-lbl">Incassato − costi</div><div className="w-num">{fmtEuro(margine)}</div><div className="w-lbl">prima delle tasse</div></button>
      </div>
      {aperto && (
        <DettaglioWidget
          tipo={aperto}
          dettaglio={dettaglio}
          margine={{ righe, costiComuni, totale: margine }}
          mese={ini.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
          onClose={() => setAperto(null)}
        />
      )}

      <div className="card tbl-wrap" style={{ padding: 0 }}>
        <table className="tbl stack">
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
                <td className="num cella" data-label="venduto">{fmtEuro(r.venduto)}</td>
                <td className="num cella" data-label="incassato" style={{ fontWeight: 700 }}>{fmtEuro(r.incassato)}</td>
                <td className="num cella" data-label="da incassare">{fmtEuro(r.daIncassare)}</td>
                <td className="num cella" data-label="erogato">{fmtEuro(r.erogato)}</td>
                <td className="num cella" data-label="costi">{r.costi ? fmtEuro(r.costi) : '—'}</td>
                <td className="num cella" data-label="ore">{ore(r.ore)}</td>
                <td className="num cella" data-label="€/ora">{r.ore ? fmtEuro((r.incassato - r.costi) / r.ore) : '—'}</td>
                <td className="small pieno">
                  {r.sessioniGratuite ? `${r.sessioniGratuite} sessioni` : ''}
                  {r.sessioniGratuite && r.oreGratuite ? ' · ' : ''}
                  {r.oreGratuite ? `Body Check ${ore(r.oreGratuite)}` : ''}
                  {!r.sessioniGratuite && !r.oreGratuite && <span className="muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 10 }}>
        €/ora = (incassato − costi diretti) ÷ ore di sessione: calcolo indicativo. Il metodo per ripartire i costi comuni e la definizione di “ora lavorata”
        (sessioni, Body Check, preparazione, amministrazione, spostamenti) sono da concordare (V-06).
      </p>
    </>
  );
}
