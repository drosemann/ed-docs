# ed-docs

> Offline-first writing workspace für Leute die Dokumente simpel und Commands explizit mögen. Markdown im Browser, ein paar ed/vi Habits: `i`, `a`, `Esc`, `:w` und das gelegentliche `?`.

Kein Google Docs, kein Microsoft 365, kein Notion Clone. Kein Account, kein Server, kein Cloud Sync, keine Collaboration. Dein Text liegt nur in diesem Browser – `:w` schreibt nach `localStorage`, Export als `.md` ist das Backup.

**Ziel:** Mal ~80% Feature Parity mit Word Online / Google Docs wenn genug Token Budget da ist – aber mit lustigen ed/vi Quirks.

### Entstehung

Startet eigentlich 2013 mit `Add Upstream ED` von gregnietsky. Dann lag es Jahre.

Mai 2026 komplett modernisiert via Codex – PR #1 `tidy-up-repository-for-open-source-use`, ausversehen zweite LICENSE dazu, PR #2 `redesign-editor-with-modern-tui-using-react` mit modernem React TUI Scaffold, PR #3 `remove-everything-except-react-tui` – alles alte ed Zeug raus, nur React TUI behalten.

Am 11.10.2026 dann Rebrand: `Synapse` → `ed-docs` als offline-first ed-docs + `Restore original GNU GPL license`. So wie es jetzt ist.

### Was ist das?

Single-User MVP. Fokussierter Editor, keine Ablenkung. Du arbeitest lokal, der Service Worker cached App Shell + Assets nach dem ersten Load – danach brauchst du kein Internet mehr zum Lesen/Schreiben.

Browser Storage ist lokal zum Browser Profil + Device. Wer Site-Daten löscht, löscht Dokumente – deshalb Exports als portables Backup.

### Features / Zweck

- **Offline-First** – Service Worker cached nach erstem Load, danach voll offline nutzbar
- **ed/vi Vibes** – `i` insert am Cursor, `a` append am Zeilenende, `o` neue Zeile drunter, `Esc` zurück in Normal Mode
- **Navigation** – Pfeiltasten oder `h,j,k,l`, `x` löscht Zeichen
- **Commands** – `:` + Enter, wie man es kennt
- **Kein Backend** – alles in `web/`, Vite, Node 20+
- **Markdown nativ** – New, Open by Title, Export/Import .md

### Installation

**Voraussetzungen:**
- Node.js 20+
- npm

```bash
git clone <dein-fork>
cd ed-docs
cd web
npm install
```

### Nutzung

**Dev starten:**
```bash
cd web
npm run dev
```
Vite zeigt die lokale URL.

**Prod Build checken:**
```bash
npm run typecheck
npm run build
npm run preview
```

### Editor Bedienung

**Neues Dokument:** `New document` in der Library

**Modes:**
- `i` – insert am Cursor
- `a` – append am Zeilenende
- `o` – Zeile drunter öffnen
- `Esc` – zurück in Normal Mode

**Commands (`:` + Enter):**
- `w` – Dokument in Browser localStorage schreiben
- `q` – zurück zur Library (fragt bei ungespeicherten Änderungen)
- `wq` – write, dann zurück zur Library
- `a, i, d, p` – append, insert, delete, print current line
- `new [title]` – neues Dokument
- `e <title>` – Dokument nach Titel öffnen
- `help` – Command Hilfe

**Import/Export:**
- `Export .md` lädt Markdown Kopie runter
- `Import .md` in der Library fügt eine hinzu

### Konfiguration

Keine `.env` nötig – alles lokal. Wenn du Asset Pfade änderst, in `web/` Vite Config + Editor Referenzen prüfen.

Prod Build enthält Service Worker der App Shell + Assets cached.

### Build / Run

- **Dev:** `npm run dev`
- **Typecheck:** `npm run typecheck`
- **Build:** `npm run build`
- **Preview:** `npm run preview`

Keine kompilierten Artifacts im Repo – lokal regenerieren.

### Troubleshooting

- **Dokumente weg:** Browser Site-Daten gelöscht? `localStorage` ist weg – deshalb regelmäßig `Export .md`
- **Offline geht nicht:** Erst einmal online laden damit Service Worker cachen kann
- **Build Fehler:** Node Version >=20? `npm install` neu?
- **Tastatur reagiert nicht:** In Editor fokussiert? `Esc` und nochmal `i`

### Zukunft – Kein Versprechen, nur Ideen

- Bessere Portability + klare lokale Backups
- Optionaler, sicherer File Transfer und gehosteter Sync für kleine Nische (erst Gespräche mit echten Kunden)
- Explizite Conflict Copies + Recovery statt silent overwrite bei offline edits
- Shared Editing, Comments, reichere Blöcke wenn Core Workflow sich beweist

Jeglicher Sync / Collaboration bleibt optional – lokale Docs + Core Editor sollen immer offline funktionieren.

### Lizenz

GNU GPLv3 – siehe [LICENSE](LICENSE). Ursprünglich MIT 2026, am 11.10.2026 zurück auf original GPL restored.
