// Anteprima della gestione utenti della versione reale: chi può entrare nell'app, con quale ruolo,
// e cosa vede un cliente. Nel mockup gli inviti sono simulati: non parte nessun messaggio.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Check, Eye, Mail, RotateCcw, Send, ShieldCheck, Smartphone, UserPlus } from 'lucide-react';
import { useStore } from '../data/store';
import { nomeCliente, ordineClienti } from '../data/logic';
import { RUOLI, VOCI_VISTA_CLIENTE, type StatoUtente, type UtenteApp } from '../data/types';
import { fmtDataBreve, fmtOra } from '../lib/format';
import { Modal } from '../components/ui';

const VALIDITA_INVITO_ORE = 48;

const STATI_UTENTE: Record<StatoUtente, { nome: string; badge: string }> = {
  invitato: { nome: 'invitato', badge: 'warn' },
  attivo: { nome: 'attivo', badge: 'ok' },
  disattivato: { nome: 'disattivato', badge: 'neutral' },
};

export const invitoScaduto = (u: UtenteApp) =>
  u.stato === 'invitato' && !!u.invitatoIl && Date.now() - new Date(u.invitatoIl).getTime() > VALIDITA_INVITO_ORE * 3600_000;

/** "oggi alle 7:40", "ieri alle 21:12", "3 giorni fa" */
export function quando(iso: string) {
  const giorni = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(iso).setHours(0, 0, 0, 0)) / 86400_000);
  if (giorni <= 0) return `oggi alle ${fmtOra(iso)}`;
  if (giorni === 1) return `ieri alle ${fmtOra(iso)}`;
  if (giorni < 30) return `${giorni} giorni fa`;
  return `il ${fmtDataBreve(iso)}`;
}

function dettaglio(u: UtenteApp) {
  if (u.stato === 'invitato' && u.invitatoIl) {
    const base = `invitato ${quando(u.invitatoIl)} via ${u.canaleInvito ?? 'Email'}`;
    if (invitoScaduto(u)) return `${base}: va reinviato`;
    const ore = Math.max(1, Math.ceil(VALIDITA_INVITO_ORE - (Date.now() - new Date(u.invitatoIl).getTime()) / 3600_000));
    return `${base} · valido ancora ${ore} h`;
  }
  return u.ultimoAccesso ? `ultimo accesso ${quando(u.ultimoAccesso)}` : 'mai entrato';
}

type Filtro = 'tutti' | 'clienti' | 'staff' | 'attesa' | 'disattivati';

export function Utenti() {
  const { db, reinviaInvito, setStatoUtente, setVistaCliente } = useStore();
  const [filtro, setFiltro] = useState<Filtro>('tutti');
  const [invita, setInvita] = useState(false);

  const filtri: { f: Filtro; nome: string; ok: (u: UtenteApp) => boolean }[] = [
    { f: 'tutti', nome: 'Tutti', ok: () => true },
    { f: 'clienti', nome: 'Clienti', ok: (u) => u.ruolo === 'cliente' },
    { f: 'staff', nome: 'Staff', ok: (u) => u.ruolo !== 'cliente' },
    { f: 'attesa', nome: 'Invitati', ok: (u) => u.stato === 'invitato' },
    { f: 'disattivati', nome: 'Disattivati', ok: (u) => u.stato === 'disattivato' },
  ];
  const ordine: Record<StatoUtente, number> = { invitato: 0, attivo: 1, disattivato: 2 };
  const lista = db.utenti
    .filter(filtri.find((x) => x.f === filtro)!.ok)
    .sort((a, b) => Number(b.ruolo === 'amministratore') - Number(a.ruolo === 'amministratore') || ordine[a.stato] - ordine[b.stato] || a.nome.localeCompare(b.nome));
  const esempio = db.utenti.find((u) => u.ruolo === 'cliente' && u.stato === 'attivo' && u.clienteId);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Utenti dell’app</h1>
          <div className="sub">Chi può entrare, con quale ruolo e cosa vede</div>
        </div>
        <button className="btn primary" onClick={() => setInvita(true)}>
          <UserPlus size={16} /> Invita
        </button>
      </div>

      <div className="banner">Anteprima della versione reale: qui gli inviti sono simulati e non parte nessun messaggio.</div>

      <div className="grid grid-2">
        <div className="card" style={{ margin: 0 }}>
          <div className="chips una-riga" style={{ marginBottom: 8 }}>
            {filtri.map((x) => (
              <button key={x.f} className={`chip ${filtro === x.f ? 'on' : ''}`} onClick={() => setFiltro(x.f)}>
                {x.nome}
              </button>
            ))}
          </div>
          {lista.length === 0 && <div className="empty">Nessun utente.</div>}
          <div className="list">
            {lista.map((u) => {
              const cliente = db.clienti.find((c) => c.id === u.clienteId);
              const a = cliente?.servizi[0]?.attivita;
              const scaduto = invitoScaduto(u);
              return (
                <div key={u.id} className="item utente" style={{ alignItems: 'flex-start' }}>
                  <div className="avatar" style={a ? { background: `var(--${a.toLowerCase()}-soft)`, color: `var(--${a.toLowerCase()})` } : undefined}>
                    {u.ruolo === 'cliente' ? u.nome.split(' ').map((p) => p[0]).slice(0, 2).join('') : <ShieldCheck size={18} />}
                  </div>
                  <div className="grow">
                    <div className="t">
                      {cliente ? <Link to={`/clienti/${cliente.id}`}>{u.nome}</Link> : u.nome}
                    </div>
                    <div className="d" style={{ overflowWrap: 'anywhere' }}>{u.email}</div>
                    <div className="row" style={{ gap: 4, marginTop: 4 }}>
                      <span className="badge neutral">{RUOLI[u.ruolo].nome.toLowerCase()}</span>
                      <span className={`badge ${scaduto ? 'danger' : STATI_UTENTE[u.stato].badge}`}>{scaduto ? 'invito scaduto' : STATI_UTENTE[u.stato].nome}</span>
                    </div>
                    <div className="d" style={{ marginTop: 4 }}>{dettaglio(u)}</div>
                    {u.id !== 'u-mattia' && (
                      <div className="row" style={{ gap: 6, marginTop: 8 }}>
                        {u.stato === 'invitato' && (
                          <>
                            <button className="btn sm" onClick={() => reinviaInvito(u.id)}>
                              <RotateCcw size={14} /> Reinvia
                            </button>
                            <button className="btn sm simula" onClick={() => setStatoUtente(u.id, 'attivo')} title="Simula il cliente che apre il link e sceglie la password">
                              <Check size={14} /> Simula accettazione
                            </button>
                          </>
                        )}
                        {u.stato === 'attivo' && u.clienteId && (
                          <Link className="btn sm" to={`/vista-cliente/${u.clienteId}`}>
                            <Eye size={14} /> Vedi come lui
                          </Link>
                        )}
                        {u.stato === 'attivo' && (
                          <button className="btn sm" onClick={() => confirm(`Disattivare l’accesso di ${u.nome}? Esce subito da tutti i dispositivi; i suoi dati restano.`) && setStatoUtente(u.id, 'disattivato')}>
                            <Ban size={14} /> Disattiva
                          </button>
                        )}
                        {u.stato === 'disattivato' && (
                          <button className="btn sm" onClick={() => setStatoUtente(u.id, 'attivo')}>
                            <RotateCcw size={14} /> Riattiva
                          </button>
                        )}
                      </div>
                    )}
                    {u.id === 'u-mattia' && <div className="d" style={{ marginTop: 4 }}>Amministratore principale: non si può disattivare.</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="card" style={{ marginTop: 0 }}>
            <h2>Cosa vede il cliente</h2>
            <p className="small muted" style={{ marginTop: 0 }}>Da decidere con Mattia: le scelte valgono per tutti i clienti e si vedono subito nell’anteprima.</p>
            <div className="list">
              {VOCI_VISTA_CLIENTE.map((v) => (
                <label key={v.voce} className="item voce-vista">
                  <input type="checkbox" checked={db.vistaCliente[v.voce]} onChange={(e) => setVistaCliente(v.voce, e.target.checked)} />
                  <span className="grow">
                    <span className="t" style={{ display: 'block' }}>{v.nome}</span>
                    <span className="d">{v.descrizione}</span>
                  </span>
                </label>
              ))}
            </div>
            {esempio && (
              <Link className="btn primary pulsante-largo" to={`/vista-cliente/${esempio.clienteId}`}>
                <Smartphone size={16} /> Anteprima: l’app di {esempio.nome.split(' ')[0]}
              </Link>
            )}
          </div>

          <div className="card">
            <h2>Ruoli</h2>
            <div className="list">
              {(Object.keys(RUOLI) as (keyof typeof RUOLI)[]).map((r) => (
                <div key={r} className="item" style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <div className="t">{RUOLI[r].nome}</div>
                    <div className="d">{RUOLI[r].descrizione}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h2>Come funziona l’invito</h2>
            <ol className="small" style={{ paddingLeft: 18, margin: 0, display: 'grid', gap: 4 }}>
              <li>Mattia invita il cliente da qui o dalla sua scheda (“Invita all’app”).</li>
              <li>Al cliente arriva un link personale via email o WhatsApp, valido {VALIDITA_INVITO_ORE} ore.</li>
              <li>Il cliente apre il link e sceglie la password: l’accesso è già collegato alla sua scheda.</li>
              <li>Password dimenticata: link via email per sceglierne una nuova.</li>
              <li>Se il cliente smette, Mattia lo disattiva: esce subito da tutti i dispositivi, i dati restano.</li>
            </ol>
            <p className="small muted" style={{ marginBottom: 0 }}>Niente registrazione libera: entra solo chi è stato invitato.</p>
          </div>
        </div>
      </div>

      {invita && <InvitoModal onClose={() => setInvita(false)} />}
    </>
  );
}

/** Invito all'app (simulato): da questa pagina o dalla scheda cliente */
export function InvitoModal({ clienteId, onClose }: { clienteId?: string; onClose: () => void }) {
  const { db, invitaUtente } = useStore();
  const senzaAccesso = db.clienti.filter((c) => !db.utenti.some((u) => u.clienteId === c.id)).sort(ordineClienti);
  const [tipo, setTipo] = useState<'cliente' | 'collaboratore'>('cliente');
  const [cid, setCid] = useState(clienteId ?? senzaAccesso[0]?.id ?? '');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [canale, setCanale] = useState<'Email' | 'WhatsApp'>('Email');
  const [inviato, setInviato] = useState(false);

  const c = db.clienti.find((x) => x.id === cid);
  const nomeInvitato = tipo === 'cliente' ? c?.nome ?? '' : nome.split(' ')[0];
  const destinatario = tipo === 'cliente' ? (canale === 'Email' ? c?.email : c?.telefono) : email;
  const valido = tipo === 'cliente' ? !!c : nome.trim() !== '' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const testo =
    tipo === 'cliente'
      ? `Ciao ${nomeInvitato}, ti ho attivato l’app Training Suite: qui trovi le sessioni rimaste, i prossimi appuntamenti e i pagamenti. Apri il link entro ${VALIDITA_INVITO_ORE} ore e scegli la tua password: https://…/invito/a7k2q9. Mattia`
      : `Ciao ${nomeInvitato}, ti ho dato accesso a Training Suite come collaboratore. Apri il link entro ${VALIDITA_INVITO_ORE} ore e scegli la tua password: https://…/invito/x3m8p1. Mattia`;

  const invia = () => {
    if (tipo === 'cliente' && c) invitaUtente({ nome: nomeCliente(c), email: c.email, ruolo: 'cliente', clienteId: c.id, canaleInvito: canale });
    else invitaUtente({ nome: nome.trim(), email: email.trim().toLowerCase(), ruolo: 'collaboratore', canaleInvito: 'Email' });
    setInviato(true);
  };

  if (inviato)
    return (
      <Modal titolo="Invito registrato" onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Chiudi</button>}>
        <p>
          Nella versione reale {nomeInvitato} riceverebbe adesso il link via {tipo === 'cliente' ? canale : 'Email'}. Nel mockup non parte nessun messaggio: nella pagina
          Utenti puoi usare “Simula accettazione”.
        </p>
      </Modal>
    );

  return (
    <Modal
      titolo="Invita all’app"
      onClose={onClose}
      footer={
        <button className="btn primary" disabled={!valido} onClick={invia}>
          <Send size={16} /> Invia invito (simulato)
        </button>
      }
    >
      {!clienteId && (
        <div className="tabs" style={{ marginBottom: 4 }}>
          <button className={tipo === 'cliente' ? 'on' : ''} onClick={() => setTipo('cliente')}>Cliente</button>
          <button className={tipo === 'collaboratore' ? 'on' : ''} onClick={() => setTipo('collaboratore')}>Collaboratore</button>
        </div>
      )}
      {tipo === 'cliente' ? (
        <>
          <label className="lbl">Cliente</label>
          {clienteId ? (
            <div><b>{c ? nomeCliente(c) : '—'}</b></div>
          ) : senzaAccesso.length === 0 ? (
            <div className="empty">Tutti i clienti hanno già un accesso.</div>
          ) : (
            <select className="field" value={cid} onChange={(e) => setCid(e.target.value)}>
              {senzaAccesso.map((x) => (
                <option key={x.id} value={x.id}>{nomeCliente(x)}</option>
              ))}
            </select>
          )}
          <label className="lbl">Invia con</label>
          <div className="chips">
            {(['Email', 'WhatsApp'] as const).map((k) => (
              <button key={k} className={`chip ${canale === k ? 'on' : ''}`} onClick={() => setCanale(k)}>
                {k === 'Email' ? <Mail size={14} /> : <Send size={14} />} {k}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <label className="lbl">Nome e cognome</label>
          <input className="field" value={nome} onChange={(e) => setNome(e.target.value)} />
          <label className="lbl">Email</label>
          <input className="field" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <p className="small muted" style={{ margin: '6px 0 0' }}>{RUOLI.collaboratore.descrizione}</p>
        </>
      )}
      {valido && (
        <>
          <label className="lbl">Messaggio{destinatario ? ` a ${destinatario}` : ''}</label>
          <div className="anteprima-messaggio small">{testo}</div>
        </>
      )}
    </Modal>
  );
}
