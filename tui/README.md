# Synapse TUI (React)

This directory contains a modern terminal editor interface built with **React** and **Ink**.

## Goals

- Provide an approachable, modern terminal UX.
- Keep keyboard-first workflows.
- Offer a migration path from classic line-editing behavior toward a richer interactive editor.

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
npm run build
npm start -- ../README.md
```

## Current feature set

- Cursor movement (arrow keys or `h/j/k/l`)
- Insert mode (`i`, `Esc`)
- Command mode (`:`) with `:w`, `:q`, `:wq`
- Basic open/save support for a file path argument

## Notes

This is the first modern TUI slice. It intentionally focuses on core editing and mode handling to provide a concrete base for future capabilities like split panes, diagnostics, LSP integration, and command palette workflows.
