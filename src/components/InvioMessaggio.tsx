// COM-01 / COM-02: messaggio preimpostato con campi automatici, invio con un tocco
import { useState } from 'react';
import { Mail, MessageCircle, Send } from 'lucide-react';
import { useStore } from '../data/store';
import { linkInvio, nomeCliente, testoMessaggio } from '../data/logic';
import { Modal } from './ui';

interface Props {
  clienteId: string;
  modelloId?: string;
  campi?: Record<string, string>;
  chiave?: string;
  onClose: () => void;
  onInviato?: () => void; // es. il pagamento ricorda che il link è stato inviato
}

export function InvioMessaggio({ clienteId, modelloId, campi, chiave, onClose, onInviato }: Props) {
  const { db, registraMessaggio } = useStore();
  const c = db.clienti.find((x) => x.id === clienteId)!;
  const [mod, setMod] = useState(modelloId ?? db.modelli[0].id);
  const [testo, setTesto] = useState(() => testoMessaggio(db, mod, c, campi));
  const titolo = db.modelli.find((m) => m.id === mod)?.titolo ?? 'Messaggio';

  const cambiaModello = (id: string) => {
    setMod(id);
    setTesto(testoMessaggio(db, id, c, campi));
  };

  const invia = (canale: 'WhatsApp' | 'Telegram' | 'Email') => {
    window.open(linkInvio(canale, c, testo, titolo), '_blank', 'noopener');
    registraMessaggio({ clienteId, canale, titolo, testo, chiave }); // COM-05 (anticipato): registro nello storico
    onInviato?.();
    onClose();
  };

  return (
    <Modal titolo={`Messaggio a ${nomeCliente(c)}`} onClose={onClose}>
      <label className="lbl">Modello</label>
      <select className="field" value={mod} onChange={(e) => cambiaModello(e.target.value)}>
        {db.modelli.map((m) => (
          <option key={m.id} value={m.id}>
            {m.titolo}
          </option>
        ))}
      </select>
      <label className="lbl">Testo (modificabile prima dell’invio)</label>
      <textarea className="field" rows={6} value={testo} onChange={(e) => setTesto(e.target.value)} />
      <p className="small muted">
        Si apre l’app scelta con destinatario e testo già pronti: basta premere Invia. Il messaggio viene registrato nello storico del cliente.
      </p>
      <div className="modal-foot">
        <button className="btn wa" onClick={() => invia('WhatsApp')}>
          <MessageCircle size={16} /> WhatsApp
        </button>
        <button className="btn tg" onClick={() => invia('Telegram')}>
          <Send size={16} /> Telegram
        </button>
        <button className="btn" onClick={() => invia('Email')}>
          <Mail size={16} /> Email
        </button>
      </div>
    </Modal>
  );
}
