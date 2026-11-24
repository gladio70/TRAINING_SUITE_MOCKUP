// AGE-01..03 + DASH-02: agenda giorno / settimana / mese, carico ore per attività
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useStore } from '../data/store';
import { nomeAppuntamento, oreAppuntamenti } from '../data/logic';
import { ATTIVITA, type Appuntamento, type Attivita } from '../data/types';
import { aggiungiGiorni, fmtData, fmtDataLunga, inizioGiorno, inizioSettimana, stessoGiorno } from '../lib/format';
import { FiltroAttivita, Modal } from '../components/ui';
import { NuovoAppuntamento, RigaAppuntamento } from '../components/Appuntamenti';

type Vista = 'giorno' | 'settimana' | 'mese';
const ORA_INIZIO = 7;
const ORA_FINE = 22;
const PX_ORA = 46;

export function Agenda() {
  const { db } = useStore();
  const [sp, setSp] = useSearchParams();
  const soloEsiti = sp.get('filtro') === 'esiti';
  const [vista, setVista] = useState<Vista>((sp.get('vista') as Vista) || (window.innerWidth < 860 || sp.get('giorno') ? 'giorno' : 'settimana'));
  const [rif, setRif] = useState<Date>(() => (sp.get('giorno') ? new Date(`${sp.get('giorno')}T00:00`) : inizioGiorno()));
  const [filtro, setFiltro] = useState<Attivita | 'tutte'>('tutte');
  const [nuovo, setNuovo] = useState<Date | null>(null);
  const [aperto, setAperto] = useState<Appuntamento | null>(null);

  const lista = useMemo(
    () => db.appuntamenti.filter((a) => filtro === 'tutte' || a.attivita === filtro).sort((a, b) => a.inizio.localeCompare(b.inizio)),
    [db.appuntamenti, filtro],
  );

  const sposta = (dir: number) => {
    if (vista === 'giorno') setRif(aggiungiGiorni(rif, dir));
    else if (vista === 'settimana') setRif(aggiungiGiorni(rif, dir * 7));
    else setRif(new Date(rif.getFullYear(), rif.getMonth() + dir, 1));
  };

  // intervallo visibile, per il riepilogo ore
  let da: Date, a: Date, titolo: string;
  if (vista === 'giorno') {
    da = inizioGiorno(rif);
    a = aggiungiGiorni(da, 1);
    titolo = fmtDataLunga(da);
  } else if (vista === 'settimana') {
    da = inizioSettimana(rif);
    a = aggiungiGiorni(da, 7);
    titolo = `${fmtData(da.toISOString())} – ${fmtData(aggiungiGiorni(da, 6).toISOString())}`;
  } else {
    da = new Date(rif.getFullYear(), rif.getMonth(), 1);
    a = new Date(rif.getFullYear(), rif.getMonth() + 1, 1);
    titolo = da.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
  }
  const inPeriodo = lista.filter((x) => new Date(x.inizio) >= da && new Date(x.inizio) < a);

  if (soloEsiti) {
    const daRegistrare = db.appuntamenti
      .filter((x) => !x.esito && !x.presenze?.length && new Date(x.inizio) < new Date())
      .sort((x, y) => y.inizio.localeCompare(x.inizio));
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Eventi da registrare</h1>
            <div className="sub">Sessioni passate senza esito: un tocco per registrarle (AGE-03)</div>
          </div>
          <button className="btn" onClick={() => setSp({})}>Torna all’agenda</button>
        </div>
        <div className="card">
          {daRegistrare.length === 0 && <div className="empty">Tutti gli esiti sono registrati. 👍</div>}
          {daRegistrare.map((x) => (
            <div key={x.id}>
              <div className="small muted" style={{ margin: '4px 0' }}>{fmtData(x.inizio)}</div>
              <RigaAppuntamento a={x} />
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Agenda</h1>
          <div className="sub" style={{ textTransform: 'capitalize' }}>{titolo}</div>
        </div>
        <div className="row toolbar">
          <div className="tabs">
            {(['giorno', 'settimana', 'mese'] as Vista[]).map((v) => (
              <button key={v} className={vista === v ? 'on' : ''} onClick={() => setVista(v)} style={{ textTransform: 'capitalize' }}>
                {v}
              </button>
            ))}
          </div>
          <div className="toolbar-riga">
            <div className="periodo">
              <button className="btn sm" onClick={() => sposta(-1)} aria-label="Precedente"><ChevronLeft size={16} /></button>
              <button className="btn sm" onClick={() => setRif(inizioGiorno())}>Oggi</button>
              <button className="btn sm" onClick={() => sposta(1)} aria-label="Successivo"><ChevronRight size={16} /></button>
            </div>
            <button className="btn primary" onClick={() => setNuovo(vista === 'giorno' ? rif : aggiungiGiorni(inizioGiorno(), 1))}>
              <Plus size={16} /> Nuovo
            </button>
          </div>
        </div>
      </div>

      <div className="row" style={{ marginBottom: 14 }}>
        <FiltroAttivita valore={filtro} onChange={setFiltro} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
        {vista === 'giorno' && (
          <div className="card">
            {inPeriodo.length === 0 && <div className="empty">Nessun appuntamento.</div>}
            {inPeriodo.map((x) => (
              <RigaAppuntamento key={x.id} a={x} />
            ))}
          </div>
        )}
        {vista === 'settimana' && <Settimana lun={da} lista={inPeriodo} onApri={setAperto} />}
        {vista === 'mese' && (
          <Mese
            mese={da}
            lista={lista}
            onGiorno={(d) => {
              setRif(d);
              setVista('giorno');
            }}
          />
        )}

        <div className="card">
          <h2>Carico ore nel periodo</h2>
          <CaricoOre lista={inPeriodo} />
        </div>
      </div>

      {nuovo && <NuovoAppuntamento giorno={nuovo} onClose={() => setNuovo(null)} />}
      {aperto && (
        <Modal titolo={fmtData(aperto.inizio)} onClose={() => setAperto(null)}>
          <RigaAppuntamento a={db.appuntamenti.find((x) => x.id === aperto.id) ?? aperto} />
        </Modal>
      )}
    </>
  );
}

function Settimana({ lun, lista, onApri }: { lun: Date; lista: Appuntamento[]; onApri: (a: Appuntamento) => void }) {
  const { db } = useStore();
  const giorni = Array.from({ length: 7 }, (_, i) => aggiungiGiorni(lun, i));
  const altezza = (ORA_FINE - ORA_INIZIO) * PX_ORA;
  const ora = new Date();
  const top = (d: Date) => (d.getHours() + d.getMinutes() / 60 - ORA_INIZIO) * PX_ORA;

  return (
    <div className="week">
      <div className="wh" />
      {giorni.map((g) => (
        <div key={g.toISOString()} className={`wh ${stessoGiorno(g, ora) ? 'today' : ''}`}>
          <div style={{ textTransform: 'capitalize' }}>{g.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' })}</div>
          <div className="h">{oreAppuntamenti(lista.filter((x) => stessoGiorno(x.inizio, g))).toFixed(1).replace('.', ',')} h</div>
        </div>
      ))}
      <div className="hours" style={{ height: altezza }}>
        {Array.from({ length: ORA_FINE - ORA_INIZIO }, (_, i) => (
          <div key={i} className="hlabel" style={{ top: i * PX_ORA + 8 }}>{ORA_INIZIO + i}</div>
        ))}
      </div>
      {giorni.map((g) => (
        <div key={g.toISOString()} className="col" style={{ height: altezza }}>
          {Array.from({ length: ORA_FINE - ORA_INIZIO }, (_, i) => (
            <div key={i} className="hl" style={{ top: i * PX_ORA }} />
          ))}
          {stessoGiorno(g, ora) && <div className="now-line" style={{ top: top(ora) }} />}
          {lista
            .filter((x) => stessoGiorno(x.inizio, g))
            .map((x) => {
              const d = new Date(x.inizio);
              const c = db.clienti.find((cl) => cl.id === x.clienteId);
              return (
                <div
                  key={x.id}
                  className={`ev ${x.attivita} ${x.esito ? 'done' : ''} ${x.gratuito ? 'free' : ''}`}
                  style={{ top: top(d), height: Math.max((x.durataMin / 60) * PX_ORA - 2, 20) }}
                  onClick={() => onApri(x)}
                  title={`${nomeAppuntamento(db, x)} · ${x.servizio} · ${x.luogo}`}
                >
                  <b>{c ? `${c.nome} ${c.cognome[0]}.${x.con?.length ? ' +' + x.con.length : ''}` : x.contatto ?? x.gruppo}</b>
                  {x.servizio}
                </div>
              );
            })}
        </div>
      ))}
    </div>
  );
}

function Mese({ mese, lista, onGiorno }: { mese: Date; lista: Appuntamento[]; onGiorno: (d: Date) => void }) {
  const inizio = inizioSettimana(mese);
  const celle = Array.from({ length: 42 }, (_, i) => aggiungiGiorni(inizio, i));
  const oggi = new Date();
  return (
    <div className="card">
      <div className="month">
        {['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'].map((d) => (
          <div key={d} className="mh">{d}</div>
        ))}
        {celle.map((d) => {
          const delGiorno = lista.filter((x) => stessoGiorno(x.inizio, d));
          return (
            <div key={d.toISOString()} className={`mday ${d.getMonth() !== mese.getMonth() ? 'out' : ''} ${stessoGiorno(d, oggi) ? 'today' : ''}`} onClick={() => onGiorno(d)}>
              <span className="n">{d.getDate()}</span>
              <div className="bars">
                {(Object.keys(ATTIVITA) as Attivita[]).map((att) => {
                  const ore = oreAppuntamenti(delGiorno.filter((x) => x.attivita === att));
                  return ore > 0 ? (
                    <span key={att} className={`mb ${att}`}>
                      {ATTIVITA[att].breve} {ore.toFixed(1).replace('.', ',')}h
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// V-06: le ore di sessione sono separate da quelle gratuite (Body Check); preparazione, amministrazione
// e spostamenti arriveranno in F2, quando sarà definita l'"ora lavorata"
function CaricoOre({ lista: tutte }: { lista: Appuntamento[] }) {
  const lista = tutte.filter((x) => !x.gratuito);
  const gratuite = oreAppuntamenti(tutte.filter((x) => x.gratuito));
  const tot = oreAppuntamenti(lista);
  return (
    <div className="load">
      {gratuite > 0 && (
        <div className="small muted" style={{ marginBottom: 6 }}>
          Ore di sessione. A parte: Body Check gratuiti {gratuite.toFixed(1).replace('.', ',')} h.
        </div>
      )}
      {(Object.keys(ATTIVITA) as Attivita[]).map((att) => {
        const ore = oreAppuntamenti(lista.filter((x) => x.attivita === att));
        return (
          <div key={att} className="load-row">
            <span className="row" style={{ gap: 6 }}>
              <span className={`dot ${att}`} />
              {ATTIVITA[att].breve}
            </span>
            <div className="load-bar">
              <span style={{ width: `${tot ? (ore / tot) * 100 : 0}%`, background: `var(--${att.toLowerCase()})` }} />
            </div>
            <span className="right num">{ore.toFixed(1).replace('.', ',')} h</span>
          </div>
        );
      })}
      <div className="load-row" style={{ fontWeight: 700 }}>
        <span>Totale</span>
        <span />
        <span className="right num">{tot.toFixed(1).replace('.', ',')} h</span>
      </div>
    </div>
  );
}
