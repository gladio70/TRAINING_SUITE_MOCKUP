// CRM-01/02: scheda cliente con pacchetti, pagamenti, prossimi appuntamenti e storico cronologico
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarPlus, Mail, Pencil, Phone, Send, ShoppingBag } from 'lucide-react';
import { useStore } from '../data/store';
import { consuma, nomeCliente, prodottoDi, statoPacchetto, statoPagamento } from '../data/logic';
import { ESITI } from '../data/types';
import { fmtData, fmtDataBreve, fmtEuro, fmtOra, toIsoLocale } from '../lib/format';
import { Avatar, BadgeAttivita, BadgePagamento, Modal } from '../components/ui';
import { NuovoAppuntamento, RigaAppuntamento } from '../components/Appuntamenti';
import { InvioMessaggio } from '../components/InvioMessaggio';
import { ClienteForm } from './Clienti';

export function ClienteDettaglio() {
  const { id } = useParams();
  const { db, registraPagamento } = useStore();
  const [modifica, setModifica] = useState(false);
  const [msg, setMsg] = useState(false);
  const [appt, setAppt] = useState(false);
  const [vendi, setVendi] = useState(false);
  const c = db.clienti.find((x) => x.id === id);
  if (!c) return <div className="empty">Cliente non trovato. <Link to="/clienti">Torna all’elenco</Link></div>;

  const pacchetti = db.pacchetti.filter((k) => k.clienteId === c.id).sort((a, b) => b.inizio.localeCompare(a.inizio));
  const pagamenti = db.pagamenti.filter((p) => p.clienteId === c.id).sort((a, b) => b.scadenza.localeCompare(a.scadenza));
  const app = db.appuntamenti.filter((a) => a.clienteId === c.id);
  const ora = new Date();
  const prossimi = app.filter((a) => new Date(a.inizio) >= ora).sort((a, b) => a.inizio.localeCompare(b.inizio)).slice(0, 4);

  // CRM-02: storico cronologico unificato
  type Ev = { data: string; tipo: string; testo: string; det?: string };
  const storico: Ev[] = [
    ...app.filter((a) => a.esito || new Date(a.inizio) < ora).map((a) => {
      const k = db.pacchetti.find((x) => x.id === a.pacchettoId);
      const scalata = k && consuma(a, prodottoDi(db, k));
      return {
        data: a.inizio, tipo: 'sessione',
        testo: `${a.servizio} – ${a.esito ? ESITI[a.esito] : 'esito da registrare'}`,
        det: `${fmtOra(a.inizio)} · ${a.luogo}${scalata ? ' · scalata dal pacchetto' : ''}${a.eccezione ? ` · eccezione: ${a.eccezione}` : ''}`,
      };
    }),
    ...pacchetti.map((k) => ({ data: k.inizio, tipo: 'pacchetto', testo: `Acquistato: ${prodottoDi(db, k).nome}`, det: fmtEuro(k.prezzo) })),
    ...pagamenti.filter((p) => p.pagatoIl).map((p) => ({ data: p.pagatoIl!, tipo: 'pagamento', testo: `Pagamento ${fmtEuro(p.importo)}`, det: `${p.descrizione} · ${p.metodo}` })),
    ...db.messaggi.filter((m) => m.clienteId === c.id).map((m) => ({ data: m.data, tipo: 'messaggio', testo: `${m.canale}: ${m.titolo}`, det: m.testo })),
  ].sort((a, b) => b.data.localeCompare(a.data));

  return (
    <>
      <Link to="/clienti" className="btn ghost sm" style={{ marginBottom: 8 }}>
        <ArrowLeft size={16} /> Clienti
      </Link>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="row" style={{ gap: 14, alignItems: 'flex-start' }}>
          <Avatar c={c} lg />
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1>{nomeCliente(c)}</h1>
            <div className="row" style={{ marginTop: 6 }}>
              {c.attivita.map((a) => <BadgeAttivita key={a} a={a} />)}
              <span className={`badge ${c.stato === 'attivo' ? 'ok' : 'neutral'}`}>{c.stato}</span>
              {c.privacyData ? <span className="badge neutral">privacy {fmtDataBreve(c.privacyData)}</span> : <span className="badge danger">consenso privacy mancante</span>}
            </div>
            <div className="small muted row" style={{ marginTop: 8, gap: 14 }}>
              <span className="row" style={{ gap: 4 }}><Phone size={13} /> {c.telefono}</span>
              <span className="row" style={{ gap: 4 }}><Mail size={13} /> {c.email}</span>
              {c.telegram && <span>Telegram {c.telegram}</span>}
            </div>
            {c.obiettivi && <p style={{ margin: '10px 0 0' }}><b>Obiettivi:</b> {c.obiettivi}</p>}
            {c.note && <p className="small" style={{ margin: '4px 0 0' }}><b>Note:</b> {c.note}</p>}
          </div>
          <div className="row">
            <button className="btn wa" onClick={() => setMsg(true)}><Send size={16} /> Messaggio</button>
            <button className="btn" onClick={() => setAppt(true)}><CalendarPlus size={16} /> Appuntamento</button>
            <button className="btn" onClick={() => setVendi(true)}><ShoppingBag size={16} /> Vendi pacchetto</button>
            <button className="btn" onClick={() => setModifica(true)}><Pencil size={16} /> Modifica</button>
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div>
          <div className="card">
            <h2>Pacchetti e abbonamenti</h2>
            {pacchetti.length === 0 && <div className="empty">Nessun pacchetto.</div>}
            <div className="list">
              {pacchetti.map((k) => {
                const s = statoPacchetto(db, k);
                const perc = s.residue != null && k.sessioniTot ? (s.residue / k.sessioniTot) * 100 : 100;
                return (
                  <div key={k.id} className="item" style={{ alignItems: 'flex-start' }}>
                    <span className={`dot ${s.prodotto.attivita}`} style={{ marginTop: 7 }} />
                    <div className="grow">
                      <div className="t">{s.prodotto.nome}</div>
                      <div className="d">
                        {fmtDataBreve(k.inizio)} → {fmtDataBreve(k.scadenza)}
                        {s.residue != null ? ` · ${s.usate}/${k.sessioniTot} usate` : ' · illimitato'}
                      </div>
                      {s.residue != null && (
                        <div className={`bar ${s.residue <= db.soglie.residueMin ? 'low' : ''}`} style={{ marginTop: 6 }}>
                          <span style={{ width: `${Math.max(perc, 0)}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="right">
                      {s.scaduto ? (
                        <span className="badge neutral">concluso</span>
                      ) : (
                        <>
                          {s.residue != null && <div style={{ fontWeight: 800, fontSize: '1.2rem' }}>{s.residue}</div>}
                          <div className="small muted">{s.residue != null ? 'residue' : ''}</div>
                          {s.giorni <= db.soglie.giorniScadenza && <span className="badge warn">tra {s.giorni} g</span>}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h2>Pagamenti</h2>
            {pagamenti.length === 0 && <div className="empty">Nessun pagamento.</div>}
            <div className="list">
              {pagamenti.map((p) => {
                const st = statoPagamento(p);
                return (
                  <div key={p.id} className="item">
                    <div className="grow">
                      <div className="t">{p.descrizione}</div>
                      <div className="d">
                        {p.pagatoIl ? `Pagato il ${fmtDataBreve(p.pagatoIl)} · ${p.metodo}` : `Scadenza ${fmtDataBreve(p.scadenza)}`}
                      </div>
                    </div>
                    <span className="num" style={{ fontWeight: 700 }}>{fmtEuro(p.importo)}</span>
                    <BadgePagamento s={st} />
                    {st !== 'pagato' && (
                      <button className="btn sm" onClick={() => registraPagamento(p.id, 'contanti')}>Incassato</button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h2>Prossimi appuntamenti</h2>
            {prossimi.length === 0 && <div className="empty">Nessun appuntamento in programma.</div>}
            {prossimi.map((a) => (
              <div key={a.id}>
                <div className="small muted" style={{ margin: '2px 0 4px' }}>{fmtData(a.inizio)}</div>
                <RigaAppuntamento a={a} compatta />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <h2>Storico</h2>
          <div className="timeline">
            {storico.map((e, i) => (
              <div key={i} className={`tl ${e.tipo}`}>
                <div className="when">{fmtData(e.data)}</div>
                <div style={{ fontWeight: 600 }}>{e.testo}</div>
                {e.det && <div className="small muted" style={{ whiteSpace: 'pre-wrap' }}>{e.det}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {modifica && <ClienteForm cliente={c} onClose={() => setModifica(false)} />}
      {msg && <InvioMessaggio clienteId={c.id} onClose={() => setMsg(false)} />}
      {appt && <NuovoAppuntamento clienteId={c.id} onClose={() => setAppt(false)} />}
      {vendi && <VendiPacchetto clienteId={c.id} onClose={() => setVendi(false)} />}
    </>
  );
}

function VendiPacchetto({ clienteId, onClose }: { clienteId: string; onClose: () => void }) {
  const { db, vendiPacchetto } = useStore();
  const c = db.clienti.find((x) => x.id === clienteId)!;
  const prodotti = db.prodotti.filter((p) => c.attivita.includes(p.attivita));
  const [pid, setPid] = useState(prodotti[0]?.id ?? '');
  const [inizio, setInizio] = useState(toIsoLocale(new Date()).slice(0, 10));
  const [modo, setModo] = useState<'subito' | 'dopo' | 'rate'>('subito');
  const p = db.prodotti.find((x) => x.id === pid);

  const salva = () => {
    if (!p) return;
    const meseDopo = (n: number) => {
      const d = new Date(`${inizio}T00:00`);
      d.setMonth(d.getMonth() + n);
      return toIsoLocale(d).slice(0, 10);
    };
    const rate =
      modo === 'rate'
        ? [0, 1, 2].map((i) => ({ importo: Math.round((p.prezzo / 3) * 100) / 100, scadenza: meseDopo(i), pagato: i === 0 }))
        : [{ importo: p.prezzo, scadenza: inizio, pagato: modo === 'subito' }];
    vendiPacchetto(clienteId, pid, inizio, rate);
    onClose();
  };

  return (
    <Modal titolo="Vendi pacchetto" onClose={onClose} footer={<button className="btn primary" disabled={!p} onClick={salva}>Registra vendita</button>}>
      <label className="lbl">Prodotto</label>
      <select className="field" value={pid} onChange={(e) => setPid(e.target.value)}>
        {prodotti.map((x) => (
          <option key={x.id} value={x.id}>
            {x.nome} – {fmtEuro(x.prezzo)}
          </option>
        ))}
      </select>
      {p && (
        <p className="small muted">
          {p.sessioni ? `${p.sessioni} sessioni` : 'Accesso illimitato'} · validità {p.validitaGiorni} giorni · disdetta con {p.preavvisoOre} h di preavviso
          {p.scalaTardiva ? ' (la disdetta tardiva viene scalata)' : ''}
        </p>
      )}
      <label className="lbl">Data di inizio</label>
      <input className="field" type="date" value={inizio} onChange={(e) => setInizio(e.target.value)} />
      <label className="lbl">Pagamento</label>
      <div className="tabs">
        <button className={modo === 'subito' ? 'on' : ''} onClick={() => setModo('subito')}>Pagato ora</button>
        <button className={modo === 'dopo' ? 'on' : ''} onClick={() => setModo('dopo')}>Da incassare</button>
        <button className={modo === 'rate' ? 'on' : ''} onClick={() => setModo('rate')}>3 rate mensili</button>
      </div>
    </Modal>
  );
}
