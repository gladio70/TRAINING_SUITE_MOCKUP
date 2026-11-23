import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { CalendarDays, Home, MessageSquare, MoreHorizontal, Package, Settings, Users, Wallet } from 'lucide-react';
import { useStore } from '../data/store';
import { calcolaAvvisi, messaggiSuggeriti } from '../data/logic';
import { Modal } from './ui';

const VOCI = [
  { to: '/', label: 'Oggi', icon: Home, mobile: true },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays, mobile: true },
  { to: '/clienti', label: 'Clienti', icon: Users, mobile: true },
  { to: '/pacchetti', label: 'Pacchetti', icon: Package, mobile: true },
  { to: '/pagamenti', label: 'Pagamenti', icon: Wallet, mobile: false },
  { to: '/messaggi', label: 'Messaggi', icon: MessageSquare, mobile: false },
  { to: '/impostazioni', label: 'Impostazioni', icon: Settings, mobile: false },
];

export function Layout() {
  const { db } = useStore();
  const [altro, setAltro] = useState(false);
  const loc = useLocation();
  const urgenti = calcolaAvvisi(db).filter((a) => a.priorita === 0).length;
  const daInviare = messaggiSuggeriti(db).length;
  const badge = (to: string) => (to === '/' ? urgenti : to === '/messaggi' ? daInviare : 0);
  const altroAttivo = VOCI.some((v) => !v.mobile && loc.pathname.startsWith(v.to));

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <img src="icon-192.png" alt="" />
          TRAINING_SUITE
        </div>
        {VOCI.map(({ to, label, icon: I }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <I size={18} />
            {label}
            {badge(to) > 0 && <span className="nav-badge">{badge(to)}</span>}
          </NavLink>
        ))}
        <div className="sidebar-foot">Mockup v0.1 · dati dimostrativi</div>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      <nav className="bottom-nav">
        {VOCI.filter((v) => v.mobile).map(({ to, label, icon: I }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <I size={22} />
            {label}
            {badge(to) > 0 && <span className="nav-badge">{badge(to)}</span>}
          </NavLink>
        ))}
        <button className={altroAttivo ? 'active' : ''} onClick={() => setAltro(true)}>
          <MoreHorizontal size={22} />
          Altro
          {daInviare > 0 && <span className="nav-badge">{daInviare}</span>}
        </button>
      </nav>

      {altro && (
        <Modal titolo="Altro" onClose={() => setAltro(false)}>
          <div className="list">
            {VOCI.filter((v) => !v.mobile).map(({ to, label, icon: I }) => (
              <NavLink key={to} to={to} className="item" onClick={() => setAltro(false)}>
                <I size={20} />
                <span className="grow t">{label}</span>
                {badge(to) > 0 && <span className="nav-badge">{badge(to)}</span>}
              </NavLink>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
