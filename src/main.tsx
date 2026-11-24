import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider } from './data/store';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Agenda } from './pages/Agenda';
import { Clienti } from './pages/Clienti';
import { ClienteDettaglio } from './pages/ClienteDettaglio';
import { Pacchetti } from './pages/Pacchetti';
import { Pagamenti } from './pages/Pagamenti';
import { Messaggi } from './pages/Messaggi';
import { Impostazioni } from './pages/Impostazioni';
import { Community } from './pages/Community';
import { Economia } from './pages/Economia';
import './styles.css';
import { avviaRilevamentoInstallazione } from './lib/installazione';

// Proposta di installazione del browser: va catturata subito, prima che arrivi l'evento
avviaRilevamentoInstallazione();

// Service worker: rende l'app installabile (Android) e apribile senza rete. Solo nella versione pubblicata.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* senza service worker l'app funziona comunque nel browser */
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="agenda" element={<Agenda />} />
            <Route path="clienti" element={<Clienti />} />
            <Route path="clienti/:id" element={<ClienteDettaglio />} />
            <Route path="pacchetti" element={<Pacchetti />} />
            <Route path="community" element={<Community />} />
            <Route path="pagamenti" element={<Pagamenti />} />
            <Route path="economia" element={<Economia />} />
            <Route path="messaggi" element={<Messaggi />} />
            <Route path="impostazioni" element={<Impostazioni />} />
            <Route path="*" element={<Dashboard />} />
          </Route>
        </Routes>
      </HashRouter>
    </StoreProvider>
  </StrictMode>,
);
