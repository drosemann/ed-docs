# Synapse TUI (React)

Synapse TUI is a modern terminal editor interface built with **React** and **Ink**.

## Run locally

```bash
cd tui
npm install
npm run dev -- ../README.md
```

## Build

```bash
cd tui
npm install
npm run typecheck
npm run build
npm start -- ../README.md
```

## Current feature set

- Cursor movement (arrow keys or `h/j/k/l`)
- Insert mode (`i`, `Esc`)
- Command mode (`:`) with `:w`, `:q`, `:wq`
- Basic open/save support for a file path argument

## Scope

This repo is intentionally scoped to the React TUI implementation.
