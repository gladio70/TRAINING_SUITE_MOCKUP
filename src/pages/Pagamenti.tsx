// PAC-04 + ECO-01 + anteprima DASH-06: pagamenti registrati a mano, stato, incassato / da incassare per attività.
// Anteprima PAC-05 (F2): link di pagamento e incasso online che si registra da solo (simulato nel mockup).
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Link2, ReceiptEuro, Zap } from 'lucide-react';
import { useStore } from '../data/store';
import { attivitaDi, fissatiPrima, inCarico, nomeCliente, nomePacchetto, ordineClienti, pacchettiDi, statoPagamento } from '../data/logic';
import { ATTIVITA, type Attivita, type MetodoPagamento, type Pagamento } from '../data/types';
import { fmtDataBreve, fmtEuro, toIsoLocale } from '../lib/format';
import { BadgePagamento, CampoNumero, FiltroAttivita, IconaConPiu, Modal } from '../components/ui';
import { InvioMessaggio } from '../components/InvioMessaggio';

type Filtro = 'tutti' | 'aperti' | 'scaduti' | 'pagati';
const METODI_MANUALI: MetodoPagamento[] = ['contanti', 'bonifico', 'POS'];

export function Pagamenti() {
  const { db, registraPagamento, segnaLinkInviato, simulaPagamentoOnline } = useStore();
  const [sp, setSp] = useSearchParams();
  const filtro = (sp.get('filtro') as Filtro) || 'tutti';
  const [att, setAtt] = useState<Attivita | 'tutte'>('tutte');
  const [incassa, setIncassa] = useState<Pagamento | null>(null);
  const [linkPer, setLinkPer] = useState<Pagamento | null>(null);
  const [simula, setSimula] = useState<Pagamento | null>(null);
  const [nuovo, setNuovo] = useState(false);
  const [appenaPagato, setAppenaPagato] = useState<string | null>(null);
  const [rif, setRif] = useState(() => new Date());

  // mese scelto con le frecce (come nel Report Economico)
  const meseIni = new Date(rif.getFullYear(), rif.getMonth(), 1);
  const meseFin = new Date(rif.getFullYear(), rif.getMonth() + 1, 1);
  const delMese = (iso?: string) => !!iso && new Date(iso) >= meseIni && new Date(iso) < meseFin;
  const sposta = (d: number) => setRif(new Date(meseIni.getFullYear(), meseIni.getMonth() + d, 1));
  // da incassare nel mese: non pagati con scadenza nel mese o già scaduti prima (stessa regola del Report Economico)
  const apertoNelMese = (p: Pagamento) => !p.pagatoIl && (delMese(p.scadenza) || new Date(p.scadenza) < meseIni);

  // prima i clienti fissati in cima, poi aperti e pagati come sotto
  const lista = fissatiPrima(db, db.pagamenti
    .filter((p) => delMese(p.scadenza) || delMese(p.pagatoIl) || apertoNelMese(p))
    .filter((p) => att === 'tutte' || p.attivita === att)
    .filter((p) => {
      const s = statoPagamento(p);
      if (filtro === 'aperti') return s !== 'pagato';
      if (filtro === 'scaduti') return s === 'scaduto';
      if (filtro === 'pagati') return s === 'pagato';
      return true;
    })
    // prima i non pagati (dal più urgente: scadenza più vecchia), poi i pagati dal più recente al più vecchio
    .sort((a, b) => {
      if (!a.pagatoIl !== !b.pagatoIl) return a.pagatoIl ? 1 : -1;
      if (!a.pagatoIl) return a.scadenza.localeCompare(b.scadenza);
      return b.pagatoIl!.localeCompare(a.pagatoIl!);
    }), (p) => p.clienteId);

  const riepilogo = (Object.keys(ATTIVITA) as Attivita[]).map((a) => {
    const pp = db.pagamenti.filter((p) => p.attivita === a);
    return {
      a,
      incassato: pp.filter((p) => delMese(p.pagatoIl)).reduce((s, p) => s + p.importo, 0),
      daIncassare: pp.filter(apertoNelMese).reduce((s, p) => s + p.importo, 0),
    };
  });
  const tot = riepilogo.reduce((s, r) => ({ incassato: s.incassato + r.incassato, daIncassare: s.daIncassare + r.daIncassare }), { incassato: 0, daIncassare: 0 });

  return (
    <>
      <div className="page-head">
        <div className="titolo-con-azione">
          <div>
            <h1>Pagamenti</h1>
          </div>
          <button className="btn primary icona-nuovo" onClick={() => setNuovo(true)} aria-label="Nuovo pagamento" title="Nuovo pagamento">
            <IconaConPiu icona={ReceiptEuro} />
          </button>
        </div>
      </div>

      {/* navigatore del mese al centro: il nome del mese riporta al mese corrente */}
      <div className="navigatore-mese">
        <button className="btn sm" onClick={() => sposta(-1)} aria-label="Mese precedente"><ChevronLeft size={16} /></button>
        <button className="btn sm mese" onClick={() => setRif(new Date())} title="Torna al mese corrente">
          {meseIni.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
        </button>
        <button className="btn sm" onClick={() => sposta(1)} aria-label="Mese successivo"><ChevronRight size={16} /></button>
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
        <table className="tbl stack">
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
                <tr key={p.id} className={appenaPagato === p.id ? 'appena-pagato' : ''}>
                  <td><Link to={`/clienti/${p.clienteId}`} style={{ fontWeight: 600 }}>{nomeCliente(db.clienti.find((c) => c.id === p.clienteId))}</Link></td>
                  <td className="pieno"><span className="row" style={{ gap: 6 }}><span className={`dot ${p.attivita}`} />{p.descrizione}</span></td>
                  <td className="small" data-label="scadenza">{fmtDataBreve(p.scadenza)}</td>
                  <td className="right num" style={{ fontWeight: 700 }}>{fmtEuro(p.importo)}</td>
                  <td>
                    <BadgePagamento s={s} />
                    {p.automatico && <span className="badge auto" title="Incasso registrato da solo (pagamento online)"><Zap size={11} /> automatico</span>}
                    {p.pagatoIl && <div className="small muted">{fmtDataBreve(p.pagatoIl)} · {p.metodo}</div>}
                    {!p.pagatoIl && p.linkInviato && <div className="small muted">link inviato il {fmtDataBreve(p.linkInviato)}</div>}
                  </td>
                  <td className="right pieno-mobile">
                    {s !== 'pagato' && (
                      <div className="azioni-pagamento">
                        <button className="btn sm" onClick={() => setIncassa(p)}>Registra incasso</button>
                        <button className="btn sm" onClick={() => setLinkPer(p)} title="Invia il link di pagamento online"><Link2 size={14} /> Link</button>
                        <button className="btn sm simula" onClick={() => setSimula(p)} title="Simulazione del pagamento online"><Zap size={14} /> Simula online</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        “Link” e “Simula online” sono un’anteprima della F2: con Stripe (PAC-05) il cliente pagherà dal link e l’incasso si registrerà da solo. Nel mockup il link è finto e
        il pagamento è simulato. In F2 anche fatture Fiscozen con PDF (ECO-04), costi ed esportazione per il commercialista (ECO-03/06).
      </p>

      {incassa && <IncassoModal p={incassa} onClose={() => setIncassa(null)} onSave={(m) => { registraPagamento(incassa.id, m); setIncassa(null); }} />}
      {nuovo && <NuovoPagamento onClose={() => setNuovo(false)} />}
      {linkPer && (
        <InvioMessaggio
          clienteId={linkPer.clienteId}
          modelloId="m-link"
          campi={{ descrizione: linkPer.descrizione, importo: fmtEuro(linkPer.importo), link: `https://pagamenti.esempio.it/p/${linkPer.id}` }}
          onInviato={() => segnaLinkInviato(linkPer.id)}
          onClose={() => setLinkPer(null)}
        />
      )}
      {simula && (
        <Modal
          titolo="Simulazione: pagamento online"
          onClose={() => setSimula(null)}
          footer={
            <>
              <button className="btn" onClick={() => setSimula(null)}>Annulla</button>
              <button
                className="btn primary"
                onClick={() => {
                  simulaPagamentoOnline(simula.id);
                  setAppenaPagato(simula.id);
                  setTimeout(() => setAppenaPagato(null), 2500);
                  setSimula(null);
                }}
              >
                <Zap size={16} /> Simula il pagamento
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0 }}>
            Simula che <b>{nomeCliente(db.clienti.find((c) => c.id === simula.clienteId))}</b> paghi <b>{fmtEuro(simula.importo)}</b> ({simula.descrizione}) con carta,
            Apple Pay o Google Pay dal link ricevuto.
          </p>
          <p className="small">
            Nella versione reale (F2) Stripe avvisa TRAINING SUITE e l’incasso si registra <b>da solo</b>: pagato, metodo “online”, data di oggi. Nessuna registrazione a mano.
          </p>
          <p className="small muted">Nel mockup non passa nessun pagamento reale.</p>
        </Modal>
      )}
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
        {METODI_MANUALI.map((x) => (
          <button key={x} className={m === x ? 'on' : ''} onClick={() => setM(x)}>{x}</button>
        ))}
      </div>
      <p className="small muted">Data incasso: oggi.</p>
    </Modal>
  );
}

/** PAC-04: pagamento "sciolto" (sessione singola, acconto, workshop…) già incassato o da incassare */
function NuovoPagamento({ onClose }: { onClose: () => void }) {
  const { db, aggiungiPagamento } = useStore();
  const oggi = toIsoLocale(new Date()).slice(0, 10);
  const clienti = db.clienti.filter((c) => inCarico(c)).sort(ordineClienti);
  const [clienteId, setClienteId] = useState('');
  const cliente = db.clienti.find((c) => c.id === clienteId);
  const [attivita, setAttivita] = useState<Attivita>('LT');
  const [descrizione, setDescrizione] = useState('');
  const [importo, setImporto] = useState<number | undefined>(undefined);
  const [pacchettoId, setPacchettoId] = useState('');
  const [incassato, setIncassato] = useState(true);
  const [data, setData] = useState(oggi);
  const [metodo, setMetodo] = useState<MetodoPagamento>('contanti');
  const pacchetti = cliente ? pacchettiDi(db, cliente.id).filter((k) => db.prodotti.find((p) => p.id === k.prodottoId)?.attivita === attivita) : [];
  const valido = !!cliente && descrizione.trim() && (importo ?? 0) > 0 && data;

  const salva = () => {
    if (!cliente || !importo) return;
    aggiungiPagamento({
      clienteId: cliente.id, attivita, descrizione: descrizione.trim(), importo, pacchettoId: pacchettoId || undefined,
      scadenza: data, pagatoIl: incassato ? data : undefined, metodo: incassato ? metodo : undefined,
    });
    onClose();
  };

  return (
    <Modal titolo="Nuovo pagamento" onClose={onClose} footer={<button className="btn primary" disabled={!valido} onClick={salva}>Registra</button>}>
      <label className="lbl">Cliente *</label>
      <select
        className="field"
        value={clienteId}
        onChange={(e) => {
          setClienteId(e.target.value);
          const c = db.clienti.find((x) => x.id === e.target.value);
          if (c) setAttivita(attivitaDi(c)[0]);
          setPacchettoId('');
        }}
      >
        <option value="">Scegli…</option>
        {clienti.map((c) => (
          <option key={c.id} value={c.id}>{c.cognome} {c.nome}</option>
        ))}
      </select>
      <label className="lbl">Attività</label>
      <div className="tabs">
        {(Object.keys(ATTIVITA) as Attivita[]).map((a) => (
          <button key={a} className={attivita === a ? 'on' : ''} onClick={() => { setAttivita(a); setPacchettoId(''); }}>{ATTIVITA[a].breve}</button>
        ))}
      </div>
      <label className="lbl">Descrizione *</label>
      <input className="field" value={descrizione} onChange={(e) => setDescrizione(e.target.value)} placeholder="Es. sessione singola, acconto, workshop" />
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label className="lbl">Importo (€) *</label>
          <CampoNumero min={0} max={10000} step={5} valore={importo} onChange={setImporto} />
        </div>
        <div>
          <label className="lbl">Pacchetto collegato</label>
          <select className="field" value={pacchettoId} onChange={(e) => setPacchettoId(e.target.value)} disabled={!pacchetti.length}>
            <option value="">{pacchetti.length ? 'Nessuno' : 'Nessun pacchetto'}</option>
            {pacchetti.map((k) => (
              <option key={k.id} value={k.id}>{nomePacchetto(db, k)}</option>
            ))}
          </select>
        </div>
      </div>
      <label className="lbl">Stato</label>
      <div className="tabs">
        <button className={incassato ? 'on' : ''} onClick={() => setIncassato(true)}>Già incassato</button>
        <button className={!incassato ? 'on' : ''} onClick={() => setIncassato(false)}>Da incassare</button>
      </div>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label className="lbl">{incassato ? 'Data incasso' : 'Scadenza'}</label>
          <input className="field" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        {incassato && (
          <div>
            <label className="lbl">Metodo</label>
            <select className="field" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPagamento)}>
              {METODI_MANUALI.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </Modal>
  );
}
