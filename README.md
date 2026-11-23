# TRAINING_SUITE – mockup F1

Gestionale per i servizi di coaching di Mattia (Virgin Active, Life Training, Verticalisthenics Community).
Specifiche: cartella `REQUISITI\` (documenti di lavoro, esclusi dal repository).

**Stato:** mockup navigabile con dati finti, solo locale. Serve a validare schermate e flussi prima di costruire il backend.
I dati stanno nel `localStorage` del browser (Impostazioni → *Ripristina dati demo*).

## Online

https://gladio70.github.io/TRAINING_SUITE_MOCKUP/ — a ogni push su `main` GitHub Actions (`.github/workflows/pages.yml`) compila il mockup e lo mette nel branch `gh-pages`, che GitHub Pages pubblica (Settings → Pages → Deploy from a branch → `gh-pages` / root).

### Aggiornamenti automatici

Ogni build pubblica `version.json` (numero da `package.json` + commit). All'apertura la app lo rilegge dal server senza cache: se la build è diversa ricarica da sola la pagina con la versione nuova (`?v=<commit>` per scavalcare la cache del telefono). Quando la app torna in primo piano dallo sfondo, invece, mostra un avviso con *Aggiorna* / *Dopo*, per non perdere un modulo compilato a metà. Il numero di versione si vede nella barra laterale, nel menu *Altro* e in Impostazioni. Codice: `src/lib/versione.ts`, `src/components/Aggiornamento.tsx`, plugin in `vite.config.ts`.

## Avvio in locale

```powershell
.\avvia.ps1
```

Apre http://localhost:5180. Node.js è portatile in `_toolchain\node` (non serve installarlo né avere permessi admin).

## Cosa copre (requisiti F1)

| Schermata | Requisiti |
|---|---|
| Oggi | DASH-01, 03, 04, 05 – widget cliccabili, avvisi per priorità, cose da fare, messaggi da inviare |
| Agenda | AGE-01, 02, 03, DASH-02 – giorno/settimana/mese, ricorrenze, esito in un tocco, ore per attività |
| Clienti | CRM-01, 02, 04 – anagrafica, storico cronologico, ricerca e filtri; CRM-03 solo descritto |
| Pacchetti | PAC-01, 02, 03 – catalogo, residue scalate dagli esiti, regole di disdetta, eccezione manuale |
| Pagamenti | PAC-04, ECO-01 – rate/acconti, stato, incassato e da incassare per attività |
| Messaggi | COM-01, 02 – modelli con campi automatici, invio con un tocco (WhatsApp/Telegram/email), registro |

Non ancora presenti: Google Calendar (AGE-04), importazione reale dai Google Sheets (CRM-03), login.

## Struttura

- `src/data/types.ts` – modello dati (provvisorio, da rivedere sui Google Sheets reali, D-08)
- `src/data/mock.ts` – dati dimostrativi generati rispetto alla data odierna
- `src/data/logic.ts` – regole: residue, stato pagamenti, avvisi, messaggi suggeriti
- `src/data/store.tsx` – archivio in memoria (sarà sostituito dalle API)
- `src/pages/*` – schermate
