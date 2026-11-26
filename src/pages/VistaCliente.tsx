// Anteprima di cosa vede un cliente di Mattia quando entra nell'app (versione reale).
// Mostra solo i dati di quel cliente e solo le sezioni scelte nella pagina Utenti.
// Nel mockup i pulsanti del cliente (richieste, pagamento) sono simulati.
import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarClock, CreditCard, Eye, History, MessageCircle, Package, Target, Wallet, X } from 'lucide-react';
import { useStore } from '../data/store';
import { consuma, pacchettiDi, prodottoDi, statoPacchetto, statoPagamento } from '../data/logic';
import { ESITI } from '../data/types';
import { fmtData, fmtDataBreve, fmtEuro, fmtOra } from '../lib/format';
import { BadgePagamento } from '../components/ui';

const simulato = (testo: string) => alert(`${testo}\n\n(Anteprima: nel mockup non succede nulla.)`);

export function VistaCliente() {
  const { id } = useParams();
  const { db } = useStore();
  const naviga = useNavigate();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]); // fuori dal Layout: lo scorrimento non viene azzerato da solo
  const c = db.clienti.find((x) => x.id === id);
  if (!c) return <div className="empty">Cliente non trovato. <Link to="/utenti">Torna agli utenti</Link></div>;

  const vede = db.vistaCliente;
  const utente = db.utenti.find((u) => u.clienteId === c.id);
  const ora = new Date();
  const pacchetti = pacchettiDi(db, c.id)
    .map((k) => ({ k, s: statoPacchetto(db, k) }))
    .filter(({ s }) => !s.scaduto)
    .sort((a, b) => a.k.scadenza.localeCompare(b.k.scadenza));
  const suoi = db.appuntamenti.filter((a) => a.clienteId === c.id || a.con?.includes(c.id));
  const prossimi = suoi.filter((a) => new Date(a.inizio) >= ora).sort((a, b) => a.inizio.localeCompare(b.inizio)).slice(0, 3);
  const storico = [
    ...suoi.filter((a) => a.esito).map((a) => {
      const k = db.pacchetti.find((x) => x.id === a.pacchettoId);
      return { data: a.inizio, testo: `${a.servizio} · ${ESITI[a.esito!]}`, scalata: !!k && consuma(a, prodottoDi(db, k)) };
    }),
    ...db.appuntamenti
      .filter((a) => a.presenze?.some((p) => p.clienteId === c.id))
      .map((a) => ({ data: a.inizio, testo: `${a.gruppo ?? a.servizio} · presente`, scalata: !!a.presenze!.find((p) => p.clienteId === c.id)!.pacchettoId })),
  ]
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 5);
  const pagamenti = db.pagamenti.filter((p) => p.clienteId === c.id);
  const daPagare = pagamenti.filter((p) => !p.pagatoIl).sort((a, b) => a.scadenza.localeCompare(b.scadenza));
  const pagati = pagamenti.filter((p) => p.pagatoIl).sort((a, b) => b.pagatoIl!.localeCompare(a.pagatoIl!)).slice(0, 3);
  const nessunaSezione = !Object.values(vede).some(Boolean);

  return (
    <div className="vista-cliente-pagina">
      <div className="anteprima-cliente">
        <Eye size={16} />
        <span className="grow">Anteprima: così vede l’app <b>{c.nome} {c.cognome}</b></span>
        <button className="btn sm" onClick={() => (history.length > 1 ? naviga(-1) : naviga('/utenti'))}>
          <X size={14} /> Chiudi
        </button>
      </div>

      <div className="vista-cliente">
        <div className="vc-testa">
          <img src="icon-192.png" alt="" />
          <div>
            <h1>Ciao {c.nome}</h1>
            <div className="small muted">Il tuo spazio con Mattia</div>
          </div>
        </div>

        {utente?.stato === 'disattivato' && <div className="banner">Accesso disattivato: in questo momento {c.nome} non può entrare.</div>}
        {!utente && <div className="banner">{c.nome} non ha ancora un accesso all’app: invitalo dalla sua scheda.</div>}
        {nessunaSezione && <div className="empty">Nessuna sezione visibile: scegli cosa mostrare nella pagina Utenti.</div>}

        {vede.pacchetti && (
          <div className="card">
            <h2><Package size={18} /> Il tuo pacchetto</h2>
            {pacchetti.length === 0 && (
              <>
                <div className="empty" style={{ padding: '8px 0' }}>Nessun pacchetto in corso.</div>
                <button className="btn pulsante-largo" onClick={() => simulato('La richiesta di rinnovo arriva a Mattia.')}>Chiedi un rinnovo</button>
              </>
            )}
            {pacchetti.map(({ k, s }) => {
              const perc = s.residue != null && k.sessioniTot ? (s.residue / k.sessioniTot) * 100 : 100;
              return (
                <div key={k.id} className="vc-pacchetto">
                  <div className="t">{s.nome}</div>
                  {s.residue != null ? (
                    <>
                      <div className="vc-numero">
                        <b>{s.residue}</b> {s.residue === 1 ? 'sessione rimasta' : 'sessioni rimaste'} su {k.sessioniTot}
                      </div>
                      <div className={`bar ${s.residue <= db.soglie.residueMin ? 'low' : ''}`}>
                        <span style={{ width: `${Math.max(perc, 0)}%` }} />
                      </div>
                    </>
                  ) : (
                    <div className="small muted">Senza sessioni da scalare</div>
                  )}
                  <div className="small muted" style={{ marginTop: 6 }}>
                    Valido fino al {fmtDataBreve(k.scadenza)}
                    {s.giorni <= db.soglie.giorniScadenza ? ` · scade tra ${s.giorni} giorni` : ''}
                    {(k.condivisoCon ?? []).length > 0 || k.clienteId !== c.id ? ' · pacchetto condiviso' : ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {vede.appuntamenti && (
          <div className="card">
            <h2><CalendarClock size={18} /> Prossimi appuntamenti</h2>
            {prossimi.length === 0 && <div className="empty" style={{ padding: '8px 0' }}>Nessun appuntamento in programma.</div>}
            <div className="list">
              {prossimi.map((a) => (
                <div key={a.id} className="item" style={{ alignItems: 'flex-start' }}>
                  <span className={`dot ${a.attivita}`} style={{ marginTop: 7 }} />
                  <div className="grow">
                    <div className="t" style={{ textTransform: 'capitalize' }}>{fmtData(a.inizio)}</div>
                    <div className="d">
                      ore {fmtOra(a.inizio)} · {a.durataMin} min · {a.luogo}
                    </div>
                    <div className="d">{a.servizio}{a.daConfermare ? ' · da confermare' : ''}</div>
                    {vede.richieste && (
                      <div className="row" style={{ gap: 6, marginTop: 6 }}>
                        <button className="btn sm" onClick={() => simulato('La richiesta di spostamento arriva a Mattia, che propone un nuovo orario.')}>Chiedi di spostare</button>
                        <button className="btn sm" onClick={() => simulato('La disdetta arriva a Mattia. Con meno di 24 ore di preavviso la sessione viene conteggiata.')}>Disdici</button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {vede.richieste && prossimi.length > 0 && (
              <p className="small muted" style={{ marginBottom: 0 }}>Disdette con almeno 24 ore di anticipo, altrimenti la sessione viene conteggiata.</p>
            )}
          </div>
        )}

        {vede.pagamenti && (
          <div className="card">
            <h2><Wallet size={18} /> Pagamenti</h2>
            {daPagare.length === 0 && pagati.length === 0 && <div className="empty" style={{ padding: '8px 0' }}>Nessun pagamento.</div>}
            <div className="list">
              {daPagare.map((p) => (
                <div key={p.id} className="item">
                  <div className="grow">
                    <div className="t">{p.descrizione}</div>
                    <div className="d">Scadenza {fmtDataBreve(p.scadenza)}</div>
                  </div>
                  <div className="right">
                    <div style={{ fontWeight: 700 }}>{fmtEuro(p.importo)}</div>
                    <BadgePagamento s={statoPagamento(p)} />
                  </div>
                </div>
              ))}
              {daPagare.length > 0 && (
                <button className="btn primary pulsante-largo" style={{ marginBottom: 8 }} onClick={() => simulato('Si apre il pagamento con carta, Apple Pay o Google Pay; l’incasso si registra da solo.')}>
                  <CreditCard size={16} /> Paga online
                </button>
              )}
              {pagati.map((p) => (
                <div key={p.id} className="item">
                  <div className="grow">
                    <div className="t">{p.descrizione}</div>
                    <div className="d">Pagato il {fmtDataBreve(p.pagatoIl!)}</div>
                  </div>
                  <div className="right" style={{ fontWeight: 700 }}>{fmtEuro(p.importo)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {vede.storico && (
          <div className="card">
            <h2><History size={18} /> Ultime sessioni</h2>
            {storico.length === 0 && <div className="empty" style={{ padding: '8px 0' }}>Nessuna sessione registrata.</div>}
            <div className="list">
              {storico.map((e, i) => (
                <div key={i} className="item">
                  <div className="grow">
                    <div className="t">{e.testo}</div>
                    <div className="d">{fmtData(e.data)}{e.scalata ? ' · scalata dal pacchetto' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {vede.obiettivi && c.obiettivi && (
          <div className="card">
            <h2><Target size={18} /> I tuoi obiettivi</h2>
            <p style={{ margin: 0 }}>{c.obiettivi}</p>
          </div>
        )}

        <button className="btn wa pulsante-largo" onClick={() => simulato('Si apre WhatsApp con la chat di Mattia.')}>
          <MessageCircle size={16} /> Scrivi a Mattia
        </button>
        <p className="small muted" style={{ textAlign: 'center' }}>
          Il cliente non vede altri clienti, le note di Mattia, il report economico né le impostazioni.
        </p>
      </div>
    </div>
  );
}
