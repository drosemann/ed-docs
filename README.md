# Synapse Editor

Synapse is now a dual-track editor project:

1. **Legacy core**: a stable C implementation derived from historical `ed` behavior.
2. **Modern editor**: a new **React-based terminal UI** (`tui/`) inspired by contemporary coding assistants and modal terminal editors.

## What's new

- Added a modern TUI prototype built with **React + Ink**.
- Preserved existing C editor engine and regression tests.
- Documented workflows for both legacy and modern tracks.

## Repository layout

- `*.c`, `*.h`, `main.c`, etc. — legacy line-editor implementation.
- `testsuite/` — behavior/regression tests for the C editor.
- `doc/` — manpage and texinfo documentation sources.
- `tui/` — new React terminal UI application.

## Modern TUI quick start

```bash
cd tui
npm install
npm run dev -- ../README.md
```

### TUI controls

- Move cursor: `↑/↓/←/→` or `h/j/k/l`
- Enter insert mode: `i`
- Enter command mode: `:`
- Commands: `:w`, `:q`, `:wq`
- Exit insert/command mode: `Esc`

## Legacy core build and test

### Build prerequisites

- POSIX shell
- C compiler (e.g., `gcc` or `clang`)
- `make`
- Optional docs tooling: `help2man`, `makeinfo`

### Build and test

```bash
./configure
make
make check
```

### Install legacy binaries

```bash
sudo make install
```

## Development direction

Synapse is transitioning from a pure line editor into a modern terminal editing environment while maintaining scriptable, battle-tested core behaviors. Near-term roadmap items for the TUI include:

- buffer/file switcher and command palette
- multi-pane layout
- diagnostics surface
- language-server integration
- theming and keymap profiles

## License

GNU GPLv3 (or later). See `COPYING`.
