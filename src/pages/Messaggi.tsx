// COM-01/02 (+ anteprima COM-05): messaggi da inviare, modelli con campi automatici, registro invii
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { useStore } from '../data/store';
import { messaggiSuggeriti, nomeCliente, type MessaggioSuggerito } from '../data/logic';
import { fmtData, fmtOra } from '../lib/format';
import { InvioMessaggio } from '../components/InvioMessaggio';

export function Messaggi() {
  const { db, aggiornaModello } = useStore();
  const [tab, setTab] = useState<'da-inviare' | 'modelli' | 'registro'>('da-inviare');
  const [msg, setMsg] = useState<MessaggioSuggerito | null>(null);
  const sugg = messaggiSuggeriti(db);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Messaggi</h1>
          <div className="sub">Invio con un tocco su WhatsApp, Telegram o email</div>
        </div>
        <div className="tabs">
          <button className={tab === 'da-inviare' ? 'on' : ''} onClick={() => setTab('da-inviare')}>Da inviare ({sugg.length})</button>
          <button className={tab === 'modelli' ? 'on' : ''} onClick={() => setTab('modelli')}>Modelli</button>
          <button className={tab === 'registro' ? 'on' : ''} onClick={() => setTab('registro')}>Registro</button>
        </div>
      </div>

      {tab === 'da-inviare' && (
        <div className="card">
          {sugg.length === 0 && <div className="empty">Nessun messaggio in sospeso.</div>}
          <div className="list">
            {sugg.map((m) => {
              const c = db.clienti.find((x) => x.id === m.clienteId);
              return (
                <div key={m.chiave} className="item">
                  <div className="grow">
                    <div className="t"><Link to={`/clienti/${m.clienteId}`}>{nomeCliente(c)}</Link></div>
                    <div className="d">{m.motivo}</div>
                  </div>
                  <span className="badge neutral">{db.modelli.find((x) => x.id === m.modelloId)?.titolo}</span>
                  <button className="btn sm wa" onClick={() => setMsg(m)}><Send size={14} /> Prepara</button>
                </div>
              );
            })}
          </div>
          <p className="small muted">In F2 promemoria, rinnovi e solleciti partiranno da soli via bot Telegram ed email (COM-03/04).</p>
        </div>
      )}

      {tab === 'modelli' && (
        <div className="grid grid-2">
          {db.modelli.map((m) => (
            <div key={m.id} className="card" style={{ margin: 0 }}>
              <h3>{m.titolo}</h3>
              <textarea className="field" style={{ marginTop: 8 }} rows={4} value={m.testo} onChange={(e) => aggiornaModello(m.id, e.target.value)} />
            </div>
          ))}
          <div className="card small muted" style={{ margin: 0 }}>
            <b>Campi automatici disponibili:</b> {'{nome} {cognome} {attivita} {data} {ora} {luogo} {link} {pacchetto} {residue} {scadenza} {importo} {descrizione}'}
          </div>
        </div>
      )}

      {tab === 'registro' && (
        <div className="card">
          {db.messaggi.length === 0 && <div className="empty">Nessun messaggio inviato ancora.</div>}
          <div className="list">
            {[...db.messaggi].reverse().map((m) => (
              <div key={m.id} className="item" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="t">{nomeCliente(db.clienti.find((c) => c.id === m.clienteId))} · {m.titolo}</div>
                  <div className="d" style={{ whiteSpace: 'pre-wrap' }}>{m.testo}</div>
                </div>
                <div className="right small muted">
                  <span className={`badge ${m.canale === 'WhatsApp' ? 'ok' : 'neutral'}`}>{m.canale}</span>
                  <div>{fmtData(m.data)} {fmtOra(m.data)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {msg && <InvioMessaggio clienteId={msg.clienteId} modelloId={msg.modelloId} campi={msg.campi} chiave={msg.chiave} onClose={() => setMsg(null)} />}
    </>
  );
}
