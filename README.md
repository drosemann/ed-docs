# Synapse React TUI

Synapse is now focused exclusively on a modern **React + Ink terminal UI**.

## Repository layout

- `tui/` — the React terminal UI application.
- `.gitignore` — repo ignore rules.
- `README.md` — top-level project guide.

## Quick start

```bash
cd tui
npm install
npm run dev -- ../README.md
```

## Build and run

```bash
cd tui
npm install
npm run typecheck
npm run build
npm start -- ../README.md
```

## Current controls

- Move cursor: `↑/↓/←/→` or `h/j/k/l`
- Insert mode: `i`
- Command mode: `:`
- Commands: `:w`, `:q`, `:wq`
- Exit insert/command mode: `Esc`

## Notes

This repository no longer contains the legacy `ed` C implementation. It is intentionally scoped to the React TUI only.
