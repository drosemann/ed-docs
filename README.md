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

#### Vim-Gaps to close (quick wins)
- Ex addresses: `:3`, `:10,20d`, `:%p`, `w filename`, `:e!`
- `u` undo, `yy / dd / p` yank-paste, `/search`, `.` repeat
- Word motions (`w, b, e`), `gg / G`, `A / I / O`, `r` replace, `~` case-flip
- Make selection feel alive in NORMAL mode (currently readOnly textarea)
- Word count, reading time, markdown preview (`:preview`)
- `:history` / snapshots instead of just a dirty flag

#### Fun / niche – deliberately not generic
1. **ed-the-grumpy-clerk:** editor talks back in real `ed` style. `?` on every error, sarcastic `:help`, passive-aggressive `:w` ("finally. 42 lines saved.").
2. **`:w` ritual:** `:w` with typewriter ka-chunk, paper shake, "WRITTEN" stamp. `:q` without `:w` makes the page crumple-shake. Save as ceremony.
3. **Vim-golf score:** keystroke efficiency per doc. `h,j,k,l` spam lowers it, `:` commands raise it. Local leaderboard – no prose editor does this.
4. **`:s/old/new/g` as star:** ex search-replace with live preview + `gc` confirm mode. Most web editors hide this.
5. **Distraction seance (`:gloom` / `:candle`):** dark paper + candle flicker via CSS, only current line lit, typewriter sounds.
6. **`q:` tape:** last 20 `:` commands as a replayable tape, replay with Enter.
7. **Achievements, ed-style:** "First `:wq`", "100 lines without mouse", "1000 chars deleted with `x`". Stored locally as fortune stamps.

### New ex commands (implemented)

- Addresses: `:3`, `:1,5p`, `:%d`, `.,$` ranges, `w [file]`, `q[!]`, `wq`, `e[!] <title>`, `new [title]`
- Substitute: `:s/old/new/g`, `:%s/old/new/gc` (confirm with y/n/a/q), `/pattern` + `n`/`N`
- Normal: `w b e`, `gg G`, `A I O`, `r ~ J D C`, `>>`/`<<`, `yy p P`, `u`, `Ctrl-r`, `.`, `q:` tape
- View: `:preview`, `:history`, `:restore N`, `:golf`, `:gloom` / `:candle`
- Fun: `:achievements`, `:set sound|nosound|clerk=off|mild|full|gloom`
- Snapshots are written to the browser on every `:w` (max 20 per doc). Undo is per open doc (max 100).

### Lizenz

GNU GPLv3 – siehe [LICENSE](LICENSE). Ursprünglich MIT 2026, am 11.10.2026 zurück auf original GPL restored.
