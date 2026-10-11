# ed-docs

An offline-first writing workspace for people who like documents simple and commands explicit. ed-docs keeps your Markdown documents in this browser and brings a few `ed`/`vi` habits to a focused editor: `i`, `a`, `Esc`, `:w`, and the occasional `?`.

This is an early, single-user MVP—not a Google Docs, Microsoft 365, or Notion feature clone. There is no account, server, cloud sync, or collaboration. Your document text is written to browser storage when you run `:w`; export important work as Markdown from the editor.

## Run locally

Requirements: Node.js 20 or newer.

```bash
cd web
npm install
npm run dev
```

Vite prints the local URL. To create and check a production build:

```bash
npm run typecheck
npm run build
npm run preview
```

The production build includes a service worker that caches the app shell and assets for offline use after the first successful load. The editor does not need a network connection to read or edit documents after that.

## Using the editor

- Select **New document** to create a local Markdown document.
- Press `i` to insert at the cursor, `a` to append at the line end, or `o` to open a line below.
- Press `Esc` to return to normal mode. Navigate with arrow keys or `h`, `j`, `k`, `l`; `x` deletes a character.
- Type `:` to enter a command, then press Enter:
  - `w` — write the document to this browser's local storage.
  - `q` — return to the library (asks before discarding unsaved edits).
  - `wq` — write, then return to the library.
  - `a`, `i`, `d`, `p` — append, insert, delete, or print the current line.
  - `new [title]` — create a document; `e <title>` — open one by title.
  - `help` — show command help.
- Use **Export .md** to download a Markdown copy, or **Import .md** in the library to add one.

Browser storage is local to the browser profile and device. Clearing browser site data can delete documents; exports are the portable backup.

## Future features

Ideas under consideration—not commitments or part of the current MVP:

- Better document portability and recovery, including clear local backups.
- Optional, secure file transfer and hosted sync for a carefully chosen niche of small companies, starting with real conversations with potential customers.
- Explicit conflict copies and recovery tools instead of silently overwriting offline edits.
- Shared editing, comments, and richer document blocks if the core writing workflow proves useful.

Any sync or collaboration would remain optional; local documents and the core editor should continue to work offline.
