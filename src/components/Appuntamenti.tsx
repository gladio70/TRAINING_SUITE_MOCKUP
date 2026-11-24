// AGE-01/02/03: scheda appuntamento con esito in un tocco, creazione appuntamento (anche ricorrente).
// v0.3: Body Check gratuiti, appuntamenti da confermare, pacchetti condivisi, presenze alle classi.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, MapPin, Repeat, UserCheck, Users } from 'lucide-react';
import { useStore } from '../data/store';
import { consuma, inCarico, nomeAppuntamento, nomeCliente, prodottoDi, statoPacchetto, titolariDi } from '../data/logic';
import { ATTIVITA, ESITI, type Appuntamento, type Attivita, type Esito, type Luogo } from '../data/types';
import { aggiungiGiorni, fmtOra, inizioGiorno, toIsoLocale } from '../lib/format';
import { Modal } from './ui';
import { PresenzeModal } from './Presenze';

/** onPresenze: se presente, la finestra delle presenze la apre la pagina (la riga può sparire dalla lista mentre si registra) */
export function RigaAppuntamento({ a, compatta, onPresenze }: { a: Appuntamento; compatta?: boolean; onPresenze?: (id: string) => void }) {
  const { db, setEsito, confermaAppuntamento } = useStore();
  const [eccezione, setEccezione] = useState(false);
  const [presenze, setPresenze] = useState(false);
  const c = a.clienteId ? db.clienti.find((x) => x.id === a.clienteId) : undefined;
  const k = a.pacchettoId ? db.pacchetti.find((x) => x.id === a.pacchettoId) : undefined;
  const classe = !!a.presenze;
  const stato = k ? statoPacchetto(db, k) : undefined;
  const passato = new Date(a.inizio) < new Date();
  const fine = new Date(new Date(a.inizio).getTime() + a.durataMin * 60000);

  const scegli = (e: Esito) => {
    if (a.esito === e) return setEsito(a.id, undefined);
    setEsito(a.id, e);
  };

  return (
    <div className={`appt ${a.attivita} ${a.esito ? 'done' : ''}`}>
      <div className="ora">
        {fmtOra(a.inizio)}
        <div className="small muted" style={{ fontWeight: 500 }}>
          {fmtOra(toIsoLocale(fine))}
        </div>
      </div>
      <div className="info">
        <div style={{ fontWeight: 650 }}>
          {c ? <Link to={`/clienti/${c.id}`}>{nomeAppuntamento(db, a)}</Link> : nomeAppuntamento(db, a)}
          {classe && (
            <span className="small muted">
              {' '}
              · <Users size={12} /> {a.presenze!.length} present{a.presenze!.length === 1 ? 'e' : 'i'}
            </span>
          )}
          {a.gratuito && <span className="badge ok" style={{ marginLeft: 6 }}>gratuito</span>}
          {a.daConfermare && <span className="badge warn" style={{ marginLeft: 6 }}>da confermare</span>}
        </div>
        <div className="small muted row" style={{ gap: 6 }}>
          <span>{a.servizio}</span>·<MapPin size={12} />
          <span>{a.luogo}</span>
          {!compatta && a.serie && (
            <>
              · <Repeat size={12} /> <span>{a.serie}</span>
            </>
          )}
          {stato?.residue != null && (
            <span className={`badge ${stato.residue <= db.soglie.residueMin ? 'danger' : 'neutral'}`}>{stato.residue} residue</span>
          )}
          {a.eccezione && <span className="badge warn">Eccezione: {a.eccezione}</span>}
        </div>
      </div>
      {a.daConfermare && (
        <div className="esiti">
          <button className="btn sm" onClick={() => confermaAppuntamento(a.id)}><Check size={14} /> Conferma</button>
        </div>
      )}
      {classe && (
        <div className="esiti">
          <button className={`btn sm ${a.presenze!.length ? 'on' : ''}`} onClick={() => (onPresenze ? onPresenze(a.id) : setPresenze(true))}>
            <UserCheck size={14} /> Presenze{a.presenze!.length ? ` (${a.presenze!.length})` : ''}
          </button>
        </div>
      )}
      {presenze && <PresenzeModal appuntamentoId={a.id} onClose={() => setPresenze(false)} />}
      {!classe && !a.daConfermare && (passato || a.esito) && (
        <div className="esiti">
          {(Object.keys(ESITI) as Esito[]).map((e) => (
            <button key={e} className={`btn sm ${a.esito === e ? 'on' : ''}`} onClick={() => scegli(e)} title={ESITI[e]}>
              {e === 'effettuata' ? '✓ Fatta' : e === 'disdetta' ? 'Disdetta' : e === 'tardiva' ? 'Tardiva' : 'Assente'}
            </button>
          ))}
          {a.esito && k && (consuma(a, prodottoDi(db, k)) || a.eccezione) && (
            <button className="btn sm ghost" onClick={() => setEccezione(true)} title="Non scalare questa sessione (PAC-03)">
              Eccezione…
            </button>
          )}
        </div>
      )}
      {eccezione && (
        <EccezioneModal
          iniziale={a.eccezione}
          onClose={() => setEccezione(false)}
          onSave={(nota) => {
            setEsito(a.id, a.esito, nota);
            setEccezione(false);
          }}
        />
      )}
    </div>
  );
}

function EccezioneModal({ iniziale, onClose, onSave }: { iniziale?: string; onClose: () => void; onSave: (n: string) => void }) {
  const [nota, setNota] = useState(iniziale ?? '');
  return (
    <Modal
      titolo="Eccezione manuale"
      onClose={onClose}
      footer={
        <>
          {iniziale && (
            <button className="btn" onClick={() => onSave('')}>
              Rimuovi eccezione
            </button>
          )}
          <button className="btn primary" disabled={!nota.trim()} onClick={() => onSave(nota.trim())}>
            Non scalare la sessione
          </button>
        </>
      }
    >
      <p className="small muted">La sessione non verrà scalata dal pacchetto. Indica il motivo (resta nello storico).</p>
      <input className="field" autoFocus value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Es. malattia certificata" />
    </Modal>
  );
}

export function NuovoAppuntamento({ onClose, clienteId, giorno }: { onClose: () => void; clienteId?: string; giorno?: Date }) {
  const { db, aggiungiAppuntamenti } = useStore();
  const base = giorno ?? aggiungiGiorni(inizioGiorno(), 1);
  const [cid, setCid] = useState(clienteId ?? '');
  const cliente = db.clienti.find((c) => c.id === cid);
  const [att, setAtt] = useState<Attivita>(cliente?.servizi[0]?.attivita ?? 'LT');
  const [servizio, setServizio] = useState('Personal Training');
  const [contatto, setContatto] = useState('');
  const bodyCheck = servizio === 'Body Check';
  const [luogo, setLuogo] = useState<Luogo>('Studio');
  const [data, setData] = useState(toIsoLocale(base).slice(0, 10));
  const [ora, setOra] = useState('18:00');
  const [durata, setDurata] = useState(60);
  const [settimane, setSettimane] = useState(1);

  const pacchettiCliente = db.pacchetti.filter((k) => k.clienteId === cid && prodottoDi(db, k).attivita === att && !statoPacchetto(db, k).scaduto);
  const [pid, setPid] = useState('');

  const salva = () => {
    const [h, m] = ora.split(':').map(Number);
    const giornoSett = new Date(`${data}T00:00`).toLocaleDateString('it-IT', { weekday: 'long' });
    const lista: Omit<Appuntamento, 'id'>[] = [];
    const k = bodyCheck ? undefined : db.pacchetti.find((x) => x.id === (pid || pacchettiCliente[0]?.id));
    // pacchetto condiviso: nella stessa sessione ci sono anche gli altri titolari
    const con = k ? titolariDi(k).filter((x) => x !== cid) : [];
    for (let i = 0; i < settimane; i++) {
      const d = aggiungiGiorni(new Date(`${data}T00:00`), i * 7);
      d.setHours(h, m);
      lista.push({
        attivita: att, servizio, luogo, inizio: toIsoLocale(d), durataMin: durata, clienteId: cid || undefined,
        con: con.length ? con : undefined, contatto: !cid && contatto.trim() ? contatto.trim() : undefined, gratuito: bodyCheck || undefined,
        pacchettoId: k?.id, serie: settimane > 1 ? `Ogni ${giornoSett} alle ${ora}` : undefined,
      });
    }
    aggiungiAppuntamenti(lista);
    onClose();
  };

  return (
    <Modal
      titolo="Nuovo appuntamento"
      onClose={onClose}
      footer={
        <button className="btn primary" disabled={!cid && !(bodyCheck && contatto.trim())} onClick={salva}>
          Salva{settimane > 1 ? ` ${settimane} appuntamenti` : ''}
        </button>
      }
    >
      <label className="lbl">Cliente</label>
      <select
        className="field"
        value={cid}
        onChange={(e) => {
          setCid(e.target.value);
          const c = db.clienti.find((x) => x.id === e.target.value);
          if (c) setAtt(c.servizi.find((s) => s.stato !== 'terminato')?.attivita ?? c.servizi[0].attivita);
          setPid('');
        }}
      >
        <option value="">{bodyCheck ? 'Nessuno: nuovo contatto' : 'Scegli…'}</option>
        {db.clienti
          .filter((c) => inCarico(c))
          .sort((a, b) => a.cognome.localeCompare(b.cognome))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.cognome} {c.nome}
            </option>
          ))}
      </select>
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label className="lbl">Attività</label>
          <select className="field" value={att} onChange={(e) => setAtt(e.target.value as Attivita)}>
            {(Object.keys(ATTIVITA) as Attivita[]).map((a) => (
              <option key={a} value={a}>
                {ATTIVITA[a].nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">Servizio</label>
          <select
            className="field"
            value={servizio}
            onChange={(e) => {
              setServizio(e.target.value);
              if (e.target.value === 'Body Check') {
                setAtt('VA');
                setLuogo('Virgin Active');
                setDurata(45);
              }
            }}
          >
            {['Personal Training', 'Body Check', 'Incontro + scheda', 'Videocall', 'Coaching', 'Small Group'].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">Luogo</label>
          <select className="field" value={luogo} onChange={(e) => setLuogo(e.target.value as Luogo)}>
            {(['Virgin Active', 'Studio', 'Online', 'Parco'] as Luogo[]).map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">Durata</label>
          <select className="field" value={durata} onChange={(e) => setDurata(Number(e.target.value))}>
            {[30, 45, 60, 75, 90].map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="lbl">Data</label>
          <input className="field" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div>
          <label className="lbl">Ora</label>
          <input className="field" type="time" value={ora} step={900} onChange={(e) => setOra(e.target.value)} />
        </div>
      </div>
      {bodyCheck ? (
        <>
          {!cid && (
            <>
              <label className="lbl">Nome del contatto</label>
              <input className="field" value={contatto} onChange={(e) => setContatto(e.target.value)} placeholder="Es. nuovo iscritto assegnato dalla palestra" />
            </>
          )}
          <p className="small muted">Body Check gratuito: nessun pacchetto da scalare, le ore sono contate a parte.</p>
        </>
      ) : (
        <>
          <label className="lbl">Pacchetto da scalare</label>
          <select className="field" value={pid} onChange={(e) => setPid(e.target.value)} disabled={!cid}>
            {pacchettiCliente.length === 0 && <option value="">Nessun pacchetto attivo</option>}
            {pacchettiCliente.map((k) => {
              const s = statoPacchetto(db, k);
              const altri = titolariDi(k).filter((x) => x !== cid).map((x) => nomeCliente(db.clienti.find((c) => c.id === x)));
              return (
                <option key={k.id} value={k.id}>
                  {s.nome} ({s.residue ?? '∞'} residue){altri.length ? ` · condiviso con ${altri.join(', ')}` : ''}
                </option>
              );
            })}
          </select>
        </>
      )}
      <label className="lbl">Ripetizione (AGE-02)</label>
      <select className="field" value={settimane} onChange={(e) => setSettimane(Number(e.target.value))}>
        <option value={1}>Solo questa volta</option>
        {[4, 8, 12].map((n) => (
          <option key={n} value={n}>
            Ogni settimana per {n} settimane
          </option>
        ))}
      </select>
      <p className="small muted">In F1 l’appuntamento comparirà anche su Google Calendar (AGE-04).</p>
    </Modal>
  );
}
