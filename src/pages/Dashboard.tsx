// DASH-01..05: vista "Oggi" con widget cliccabili, avvisi per priorità, cose da fare, messaggi da inviare
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CalendarClock, ClipboardCheck, Package, PhoneCall, Plus, Send, Settings, TrendingUp, Wallet } from 'lucide-react';
import { useStore } from '../data/store';
import { attivitaDi, calcolaAvvisi, daRichiamare, economiaMese, daSeguire, messaggiSuggeriti, nomeCliente, oreAppuntamenti, statoPagamento, statoPacchetto, titolariDi } from '../data/logic';
import type { Attivita } from '../data/types';
import { aggiungiGiorni, fmtDataLunga, fmtEuro, inizioGiorno, inizioSettimana, stessoGiorno, toIsoLocale } from '../lib/format';
import { FiltroAttivita, MostraAltri, VOCI_VISIBILI } from '../components/ui';
import { NuovoAppuntamento, RigaAppuntamento } from '../components/Appuntamenti';
import { InvioMessaggio } from '../components/InvioMessaggio';
import type { MessaggioSuggerito } from '../data/logic';

const PRIO = ['Scaduto / urgente', 'Oggi', 'Questa settimana'];

export function Dashboard() {
  const { db, toggleTodo, aggiungiTodo } = useStore();
  // dagli avvisi: "?vai=cose-da-fare" porta al riquadro Cose da fare e lo evidenzia un momento
  const [sp, setSp] = useSearchParams();
  const coseDaFare = useRef<HTMLDivElement>(null);
  const [evidenzia, setEvidenzia] = useState(false);
  // liste accorciate a 5 voci: quali sono aperte per intero ("Mostra altri")
  const [aperti, setAperti] = useState<string[]>([]);
  const apri = (k: string) => setAperti((x) => (x.includes(k) ? x.filter((y) => y !== k) : [...x, k]));
  const visibili = <T,>(lista: T[], k: string) => (aperti.includes(k) ? lista : lista.slice(0, VOCI_VISIBILI));
  useEffect(() => {
    if (sp.get('vai') !== 'cose-da-fare') return;
    coseDaFare.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setEvidenzia(true);
    setAperti((x) => (x.includes('todo') ? x : [...x, 'todo'])); // la cosa da fare cercata potrebbe essere oltre le prime 5
    setSp({}, { replace: true });
  }, [sp, setSp]);
  useEffect(() => {
    if (!evidenzia) return;
    const t = setTimeout(() => setEvidenzia(false), 1600);
    return () => clearTimeout(t);
  }, [evidenzia]);
  const [filtro, setFiltro] = useState<Attivita | 'tutte'>('tutte');
  const [nuovo, setNuovo] = useState(false);
  const [msg, setMsg] = useState<MessaggioSuggerito | null>(null);
  const [todoTxt, setTodoTxt] = useState('');
  const ok = (a?: Attivita) => filtro === 'tutte' || a === filtro;

  const oggi = inizioGiorno();
  const appOggi = db.appuntamenti.filter((a) => stessoGiorno(a.inizio, oggi) && ok(a.attivita)).sort((a, b) => a.inizio.localeCompare(b.inizio));
  const avvisi = calcolaAvvisi(db).filter((a) => !a.attivita || ok(a.attivita));
  const suggeriti = messaggiSuggeriti(db).filter((m) => {
    const c = db.clienti.find((x) => x.id === m.clienteId);
    return filtro === 'tutte' || (!!c && attivitaDi(c).includes(filtro));
  });
  const lun = inizioSettimana(oggi);
  const appSett = db.appuntamenti.filter((a) => new Date(a.inizio) >= lun && new Date(a.inizio) < aggiungiGiorni(lun, 7) && ok(a.attivita));

  const pacchettiAttenzione = db.pacchetti.filter((k) => {
    const s = statoPacchetto(db, k);
    const seguito = titolariDi(k).some((id) => daSeguire(db.clienti.find((x) => x.id === id), s.prodotto.attivita));
    return seguito && !s.scaduto && ok(s.prodotto.attivita) && ((s.residue != null && s.residue <= db.soglie.residueMin) || s.giorni <= db.soglie.giorniScadenza);
  }).length;
  const pagScaduti = db.pagamenti.filter((p) => statoPagamento(p) === 'scaduto' && ok(p.attivita));
  const daRegistrare = avvisi.filter((a) => a.tipo === 'esito').length;
  // persone (non servizi) da richiamare o verificare, con la stessa regola del filtro della pagina Clienti
  const richiami = new Set(daRichiamare(db).filter((r) => ok(r.servizio.attivita)).map((r) => r.cliente.id)).size;
  const eco = economiaMese(db);

  // cose di oggi, in ritardo e scadenze amministrative della settimana
  const todoOggi = db.todo.filter(
    (t) =>
      (stessoGiorno(t.data, oggi) || (new Date(t.data) < oggi && !t.fatto) || (t.categoria === 'amministrazione' && new Date(t.data) < aggiungiGiorni(oggi, 8))) &&
      (!t.attivita || ok(t.attivita)),
  );

  return (
    <>
      <div className="page-head">
        <div className="titolo-con-azione">
          <div>
            <h1>Ciao Mattia</h1>
            <div className="sub" style={{ textTransform: 'capitalize' }}>{fmtDataLunga(oggi)}</div>
          </div>
          <Link to="/impostazioni" className="btn ghost icona" aria-label="Impostazioni" title="Impostazioni">
            <Settings size={20} />
          </Link>
        </div>
        <div className="row">
          <FiltroAttivita valore={filtro} onChange={setFiltro} />
          <button className="btn primary" onClick={() => setNuovo(true)}>
            <Plus size={16} /> Appuntamento
          </button>
        </div>
      </div>

      <div className="banner">Mockup con dati dimostrativi: le modifiche restano solo in questo browser (rotella ⚙ in alto → ripristina).</div>

      <div className="widgets">
        <Link to="/agenda" className="widget">
          <div className="w-ico"><CalendarClock size={18} /></div>
          <div className="w-num">{appOggi.length}</div>
          <div className="w-lbl">appuntamenti oggi · {oreAppuntamenti(appOggi).toFixed(1).replace('.', ',')} h</div>
        </Link>
        <Link to="/agenda?filtro=esiti" className={`widget ${daRegistrare ? 'warn' : ''}`}>
          <div className="w-ico"><ClipboardCheck size={18} /></div>
          <div className="w-num">{daRegistrare}</div>
          <div className="w-lbl">eventi da registrare</div>
        </Link>
        <Link to="/pacchetti?filtro=attenzione" className={`widget ${pacchettiAttenzione ? 'warn' : ''}`}>
          <div className="w-ico"><Package size={18} /></div>
          <div className="w-num">{pacchettiAttenzione}</div>
          <div className="w-lbl">pacchetti in esaurimento o scadenza</div>
        </Link>
        <Link to="/pagamenti?filtro=scaduti" className={`widget ${pagScaduti.length ? 'alert' : ''}`}>
          <div className="w-ico"><Wallet size={18} /></div>
          <div className="w-num">{pagScaduti.length}</div>
          <div className="w-lbl">pagamenti scaduti · {fmtEuro(pagScaduti.reduce((s, p) => s + p.importo, 0))}</div>
        </Link>
        <Link to="/messaggi" className="widget">
          <div className="w-ico"><Send size={18} /></div>
          <div className="w-num">{suggeriti.length}</div>
          <div className="w-lbl">messaggi da inviare</div>
        </Link>
        <Link to="/agenda?vista=settimana" className="widget">
          <div className="w-ico"><CalendarClock size={18} /></div>
          <div className="w-num">{oreAppuntamenti(appSett).toFixed(0)} h</div>
          <div className="w-lbl">carico della settimana · {appSett.length} impegni</div>
        </Link>
        <Link to={`/clienti?stato=da richiamare${filtro !== 'tutte' ? `&att=${filtro}` : ''}`} className={`widget ${richiami ? 'warn' : ''}`}>
          <div className="w-ico"><PhoneCall size={18} /></div>
          <div className="w-num">{richiami}</div>
          <div className="w-lbl">persone da richiamare o verificare</div>
        </Link>
        <Link to="/economia" className="widget">
          <div className="w-ico"><TrendingUp size={18} /></div>
          <div className="w-num">{fmtEuro(eco.righe.filter((r) => ok(r.attivita)).reduce((s, r) => s + r.incassato, 0))}</div>
          <div className="w-lbl">incassato nel mese · da incassare {fmtEuro(eco.righe.filter((r) => ok(r.attivita)).reduce((s, r) => s + r.daIncassare, 0))}</div>
        </Link>
      </div>

      <div className="grid grid-2">
        <div>
          <div className="card">
            <div className="card-head">
              <h2>Agenda di oggi</h2>
              <Link to="/agenda" className="btn sm">Apri agenda</Link>
            </div>
            {appOggi.length === 0 && <div className="empty">Nessun appuntamento oggi.</div>}
            {visibili(appOggi, 'agenda').map((a) => (
              <RigaAppuntamento key={a.id} a={a} compatta />
            ))}
            <MostraAltri totale={appOggi.length} aperto={aperti.includes('agenda')} onToggle={() => apri('agenda')} />
          </div>

          <div className={`card ${evidenzia ? 'evidenziata' : ''}`} ref={coseDaFare}>
            <div className="card-head">
              <h2>Cose da fare</h2>
            </div>
            {visibili(todoOggi, 'todo').map((t) => (
              <label key={t.id} className={`todo ${t.fatto ? 'fatto' : ''}`}>
                <input type="checkbox" checked={t.fatto} onChange={() => toggleTodo(t.id)} />
                {t.attivita && <span className={`dot ${t.attivita}`} />}
                <span>{t.testo}</span>
                {t.categoria === 'amministrazione' && <span className="badge neutral">amministrazione</span>}
                {new Date(t.data) < oggi && !t.fatto && <span className="badge danger">in ritardo</span>}
              </label>
            ))}
            <MostraAltri totale={todoOggi.length} aperto={aperti.includes('todo')} onToggle={() => apri('todo')} />
            <form
              className="row"
              style={{ marginTop: 8 }}
              onSubmit={(e) => {
                e.preventDefault();
                if (!todoTxt.trim()) return;
                aggiungiTodo({ testo: todoTxt.trim(), data: toIsoLocale(oggi).slice(0, 10), attivita: filtro === 'tutte' ? undefined : filtro });
                setTodoTxt('');
              }}
            >
              <input className="field" style={{ flex: 1 }} placeholder="Aggiungi una cosa da fare…" value={todoTxt} onChange={(e) => setTodoTxt(e.target.value)} />
              <button className="btn"><Plus size={16} /></button>
            </form>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-head">
              <h2>
                <AlertTriangle size={16} style={{ verticalAlign: -2 }} /> Richiede attenzione
              </h2>
              <span className="muted small">{avvisi.length} avvisi</span>
            </div>
            {avvisi.length === 0 && <div className="empty">Tutto in ordine.</div>}
            <div className="list">
              {[0, 1, 2].map((p) => {
                const gruppo = avvisi.filter((a) => a.priorita === p);
                if (!gruppo.length) return null;
                return (
                  <div key={p}>
                    <div className="group-lbl">{PRIO[p]}</div>
                    {visibili(gruppo, `p${p}`).map((a) => (
                      <Link key={a.id} to={a.link} className="item">
                        <span className={`prio p${a.priorita}`} />
                        {a.attivita && <span className={`dot ${a.attivita}`} />}
                        <div className="grow">
                          <div className="t">{a.titolo}</div>
                          <div className="d">{a.dettaglio}</div>
                        </div>
                      </Link>
                    ))}
                    <MostraAltri totale={gruppo.length} aperto={aperti.includes(`p${p}`)} onToggle={() => apri(`p${p}`)} />
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Messaggi da inviare</h2>
              <Link to="/messaggi" className="btn sm">Tutti</Link>
            </div>
            {suggeriti.length === 0 && <div className="empty">Nessun messaggio in sospeso.</div>}
            <div className="list">
              {visibili(suggeriti, 'msg').map((m) => (
                <div key={m.chiave} className="item">
                  <div className="grow">
                    <div className="t">{nomeCliente(db.clienti.find((c) => c.id === m.clienteId))}</div>
                    <div className="d">{m.motivo}</div>
                  </div>
                  <button className="btn sm wa" onClick={() => setMsg(m)}>
                    <Send size={14} /> Prepara
                  </button>
                </div>
              ))}
            </div>
            <MostraAltri totale={suggeriti.length} aperto={aperti.includes('msg')} onToggle={() => apri('msg')} />
          </div>
        </div>
      </div>

      {nuovo && <NuovoAppuntamento onClose={() => setNuovo(false)} />}
      {msg && <InvioMessaggio clienteId={msg.clienteId} modelloId={msg.modelloId} campi={msg.campi} chiave={msg.chiave} onClose={() => setMsg(null)} />}
    </>
  );
}
