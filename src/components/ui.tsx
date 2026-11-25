import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Plus, X, type LucideIcon } from 'lucide-react';

/**
 * Campo numerico che si può svuotare e riscrivere: mentre si scrive accetta anche il campo vuoto
 * e salva solo numeri validi; uscendo dal campo vuoto o fuori limite torna a un valore valido (min/max).
 */
export function CampoNumero({ valore, onChange, min, max, step, disabled, placeholder }: {
  valore: number | undefined;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  placeholder?: string;
}) {
  const [testo, setTesto] = useState(valore == null ? '' : String(valore));
  const [inModifica, setInModifica] = useState(false);
  // se il valore cambia da fuori (es. ripristino), il campo si allinea quando non si sta scrivendo
  useEffect(() => {
    if (!inModifica) setTesto(valore == null ? '' : String(valore));
  }, [valore, inModifica]);
  const limita = (n: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, n));
  return (
    <input
      className="field"
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      placeholder={placeholder}
      value={testo}
      onFocus={() => setInModifica(true)}
      onChange={(e) => {
        setTesto(e.target.value);
        const n = Number(e.target.value.replace(',', '.'));
        if (e.target.value.trim() !== '' && Number.isFinite(n) && n === limita(n)) onChange(n);
      }}
      onBlur={() => {
        setInModifica(false);
        const n = Number(testo.replace(',', '.'));
        const valido = testo.trim() !== '' && Number.isFinite(n) ? limita(n) : valore ?? min ?? 0;
        if (valido !== valore) onChange(valido);
        setTesto(String(valido));
      }}
    />
  );
}

/** Icona con un piccolo "+" in basso a destra, per le azioni "nuovo" che non hanno un'icona con il + già pronta */
export function IconaConPiu({ icona: Icona, size = 20 }: { icona: LucideIcon; size?: number }) {
  return (
    <span className="icona-piu">
      <Icona size={size} />
      <span className="piu">
        <Plus size={Math.round(size * 0.55)} strokeWidth={3} />
      </span>
    </span>
  );
}

/** Voci visibili nelle liste della pagina Oggi prima di "Mostra altri" */
export const VOCI_VISIBILI = 5;

/** Pulsante "Mostra altri N" / "Mostra meno" per le liste accorciate; non compare se le voci sono poche */
export function MostraAltri({ totale, aperto, onToggle, max = VOCI_VISIBILI }: { totale: number; aperto: boolean; onToggle: () => void; max?: number }) {
  if (totale <= max) return null;
  return (
    <button className="btn sm ghost mostra-altri" onClick={onToggle}>
      {aperto ? (
        <><ChevronUp size={14} /> Mostra meno</>
      ) : (
        <><ChevronDown size={14} /> Mostra altri {totale - max}</>
      )}
    </button>
  );
}
import { ATTIVITA, STATI, type Attivita, type Cliente, type ServizioCliente } from '../data/types';
import type { StatoPagamento } from '../data/logic';
import { fmtDataBreve } from '../lib/format';

/** Attività con lo stato del servizio (CRM: stati indipendenti per servizio) */
export function BadgeServizio({ s, breve }: { s: ServizioCliente; breve?: boolean }) {
  return (
    <span className={`badge ${s.attivita}`} title={s.nota}>
      <span className={`dot ${s.attivita}`} />
      {breve ? ATTIVITA[s.attivita].breve : ATTIVITA[s.attivita].nome}
      {s.stato !== 'attivo' && <b className={`stato-${STATI[s.stato].badge}`}>· {STATI[s.stato].nome.toLowerCase()}</b>}
      {s.ripresa && s.stato !== 'terminato' && <span className="muted"> · {fmtDataBreve(s.ripresa)}</span>}
    </span>
  );
}

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
  const a = c.servizi[0]?.attivita ?? 'LT';
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
