import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { ATTIVITA, type Attivita, type Cliente } from '../data/types';
import type { StatoPagamento } from '../data/logic';

export function BadgeAttivita({ a, breve }: { a: Attivita; breve?: boolean }) {
  return (
    <span className={`badge ${a}`}>
      <span className={`dot ${a}`} />
      {breve ? ATTIVITA[a].breve : ATTIVITA[a].nome}
    </span>
  );
}

export function BadgePagamento({ s }: { s: StatoPagamento }) {
  const cls = s === 'pagato' ? 'ok' : s === 'scaduto' ? 'danger' : 'warn';
  return <span className={`badge ${cls}`}>{s}</span>;
}

export function Avatar({ c, lg }: { c: Cliente; lg?: boolean }) {
  const a = c.attivita[0];
  return (
    <div className={`avatar ${lg ? 'lg' : ''}`} style={{ background: `var(--${a.toLowerCase()}-soft)`, color: `var(--${a.toLowerCase()})` }}>
      {c.nome[0]}
      {c.cognome[0]}
    </div>
  );
}

export function Modal({ titolo, onClose, children, footer }: { titolo: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={titolo}>
        <div className="modal-head">
          <h2 style={{ margin: 0 }}>{titolo}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Chiudi">
            <X size={18} />
          </button>
        </div>
        {children}
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function FiltroAttivita({ valore, onChange }: { valore: Attivita | 'tutte'; onChange: (v: Attivita | 'tutte') => void }) {
  return (
    <div className="chips">
      <button className={`chip ${valore === 'tutte' ? 'on' : ''}`} onClick={() => onChange('tutte')}>
        Tutte
      </button>
      {(Object.keys(ATTIVITA) as Attivita[]).map((a) => (
        <button key={a} className={`chip ${valore === a ? 'on' : ''}`} onClick={() => onChange(a)}>
          <span className={`dot ${a}`} />
          {ATTIVITA[a].breve}
        </button>
      ))}
    </div>
  );
}
