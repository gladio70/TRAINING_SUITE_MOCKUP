// Anticipazione proposta per la F1 (risposte di Mattia, D-07): presenze effettive alle classi e carnet della community,
// per sostituire progressivamente APP Palestre. La prenotazione autonoma degli allievi resta in F3 (GRP-02).
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarRange, Info, Send } from 'lucide-react';
import { useStore } from '../data/store';
import { inCarico, nomeCliente, prodottoDi, statoPacchetto, titolariDi } from '../data/logic';
import type { PacchettoCliente } from '../data/types';
import { aggiungiGiorni, fmtData, fmtDataBreve, inizioGiorno } from '../lib/format';
import { RigaAppuntamento } from '../components/Appuntamenti';
import { InvioMessaggio } from '../components/InvioMessaggio';
import { PresenzeModal } from '../components/Presenze';
import { ProrogaModal } from './ClienteDettaglio';

const MEMBRI_WHATSAPP = 89; // dato dichiarato da Mattia al 24/11/2026

export function Community() {
  const { db } = useStore();
  const [proroga, setProroga] = useState<PacchettoCliente | null>(null);
  const [rinnovo, setRinnovo] = useState<{ clienteId: string; k: PacchettoCliente } | null>(null);
  const [presenze, setPresenze] = useState<string | null>(null);
  const oggi = inizioGiorno();
  const ora = new Date();

  const classi = db.appuntamenti.filter((a) => a.presenze && a.attivita === 'VC').sort((a, b) => a.inizio.localeCompare(b.inizio));
  const daRegistrare = classi.filter((a) => new Date(a.inizio) < ora && a.presenze!.length === 0 && new Date(a.inizio) >= aggiungiGiorni(oggi, -7));
  const prossime = classi.filter((a) => new Date(a.inizio) >= ora && new Date(a.inizio) < aggiungiGiorni(oggi, 8));
  const recenti = classi.filter((a) => new Date(a.inizio) < ora && a.presenze!.length > 0).slice(-4).reverse();

  // carnet: validi, appena scaduti o esauriti (da rinnovare) e storici
  const carnet = db.pacchetti
    .filter((k) => prodottoDi(db, k).tipo === 'carnet')
    .map((k) => ({ k, s: statoPacchetto(db, k) }))
    .filter(({ s }) => !s.scaduto || s.giorni > -30)
    .sort((a, b) => Number(b.s.scaduto) - Number(a.s.scaduto) || (a.s.residue ?? 99) - (b.s.residue ?? 99));
  const attivi = carnet.filter(({ s }) => !s.scaduto).length;
  const programmazioni = db.pacchetti
    .filter((k) => prodottoDi(db, k).tipo === 'programmazione' && prodottoDi(db, k).attivita === 'VC')
    .map((k) => ({ k, s: statoPacchetto(db, k) }));
  const senzaCarnet = db.clienti.filter(
    (c) => inCarico(c, 'VC') && !carnet.some(({ k, s }) => !s.scaduto && titolariDi(k).includes(c.id)) && !programmazioni.some(({ k }) => k.clienteId === c.id),
  );
  const nome = (id: string) => nomeCliente(db.clienti.find((c) => c.id === id));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Community</h1>
          <div className="sub">
            Gruppo WhatsApp {MEMBRI_WHATSAPP} membri · {attivi} carnet validi · {programmazioni.filter(({ s }) => !s.scaduto).length} programmazioni aggiuntive
          </div>
        </div>
      </div>

      <div className="banner">
        <Info size={16} />
        <span>
          Proposta di anticipo in F1: registro delle presenze e carnet, al posto di APP Palestre. Flusso completo in F3: pubblicazione dell’allenamento → link →
          prenotazione autonoma → conferma presenze → scalatura → avviso di rinnovo.
        </span>
      </div>

      <div className="grid grid-2">
        <div>
          <div className="card">
            <h2>Presenze da registrare</h2>
            {daRegistrare.length === 0 && <div className="empty">Tutte le presenze sono registrate.</div>}
            {daRegistrare.map((a) => (
              <div key={a.id}>
                <div className="small muted" style={{ margin: '4px 0' }}>{fmtData(a.inizio)}</div>
                <RigaAppuntamento a={a} compatta onPresenze={setPresenze} />
              </div>
            ))}
          </div>
          <div className="card">
            <h2>Prossime classi</h2>
            {prossime.length === 0 && <div className="empty">Nessuna classe in programma.</div>}
            {prossime.map((a) => (
              <div key={a.id}>
                <div className="small muted" style={{ margin: '4px 0' }}>{fmtData(a.inizio)}</div>
                <RigaAppuntamento a={a} compatta onPresenze={setPresenze} />
              </div>
            ))}
          </div>
          <div className="card">
            <h2>Ultime classi registrate</h2>
            {recenti.map((a) => (
              <div key={a.id}>
                <div className="small muted" style={{ margin: '4px 0' }}>{fmtData(a.inizio)}</div>
                <RigaAppuntamento a={a} compatta onPresenze={setPresenze} />
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="card">
            <h2>Carnet</h2>
            <p className="small muted" style={{ marginTop: 0 }}>
              5 sessioni 50 € · 10 sessioni 80 € · pagamento anticipato, frequenza libera. Validità oggi 1 mese, configurabile fino a 3 con proroga manuale.
            </p>
            <div className="list">
              {carnet.map(({ k, s }) => {
                const daRinnovare = s.scaduto || (s.residue != null && s.residue <= db.soglie.residueMin);
                return (
                  <div key={k.id} className="item" style={{ alignItems: 'flex-start' }}>
                    <div className="grow">
                      <div className="t">
                        <Link to={`/clienti/${k.clienteId}`}>{nome(k.clienteId)}</Link>
                      </div>
                      <div className="d">
                        {s.nome} · {s.giorni < 0 ? `scaduto il ${fmtDataBreve(k.scadenza)}` : `scade il ${fmtDataBreve(k.scadenza)}`}
                        {k.storico && ' · condizioni storiche'}
                      </div>
                      {s.residue != null && (
                        <div className={`bar ${s.residue <= db.soglie.residueMin ? 'low' : ''}`} style={{ marginTop: 6 }}>
                          <span style={{ width: `${(s.residue / (k.sessioniTot || 1)) * 100}%` }} />
                        </div>
                      )}
                    </div>
                    <div className="right">
                      <div style={{ fontWeight: 700 }}>{s.residue}</div>
                      <div className="small muted">residue</div>
                      <div className="row" style={{ gap: 4, justifyContent: 'flex-end', marginTop: 4 }}>
                        {s.residue !== 0 && (
                          <button className="btn sm ghost" onClick={() => setProroga(k)} title="Proroga"><CalendarRange size={14} /></button>
                        )}
                        {daRinnovare && (
                          <button className="btn sm wa" onClick={() => setRinnovo({ clienteId: k.clienteId, k })}><Send size={14} /> Rinnovo</button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h2>Programmazioni aggiuntive</h2>
            <p className="small muted" style={{ marginTop: 0 }}>100 € oltre al carnet · frequenza di rinnovo da definire.</p>
            <div className="list">
              {programmazioni.map(({ k, s }) => (
                <div key={k.id} className="item">
                  <div className="grow">
                    <div className="t"><Link to={`/clienti/${k.clienteId}`}>{nome(k.clienteId)}</Link></div>
                    <div className="d">{k.formula === 'gratuito' ? 'Percorso gratuito' : s.nome} · {s.giorni < 0 ? 'scaduta' : `fino al ${fmtDataBreve(k.scadenza)}`}</div>
                  </div>
                  {s.giorni >= 0 && s.giorni <= db.soglie.giorniScadenza && <span className="badge warn">scade tra {s.giorni} g</span>}
                  {s.giorni < 0 && <span className="badge neutral">da rinnovare</span>}
                </div>
              ))}
            </div>
          </div>

          {senzaCarnet.length > 0 && (
            <div className="card">
              <h2>Partecipanti senza carnet</h2>
              <p className="small muted" style={{ marginTop: 0 }}>Occasionali o con carnet scaduto: da distinguere dagli abbonati.</p>
              {senzaCarnet.map((c) => (
                <div key={c.id} className="item">
                  <div className="grow t"><Link to={`/clienti/${c.id}`}>{nomeCliente(c)}</Link></div>
                  <span className="badge neutral">{c.servizi.find((s) => s.attivita === 'VC')?.stato}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {proroga && <ProrogaModal k={proroga} onClose={() => setProroga(null)} />}
      {presenze && <PresenzeModal appuntamentoId={presenze} onClose={() => setPresenze(null)} />}
      {rinnovo && (
        <InvioMessaggio
          clienteId={rinnovo.clienteId}
          modelloId="m-rinn"
          campi={{ pacchetto: statoPacchetto(db, rinnovo.k).nome, residue: String(statoPacchetto(db, rinnovo.k).residue ?? 0), scadenza: fmtDataBreve(rinnovo.k.scadenza) }}
          chiave={`rinn-${rinnovo.k.id}`}
          onClose={() => setRinnovo(null)}
        />
      )}
    </>
  );
}
