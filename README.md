# Synapse Editor

Synapse Editor is a modernization-focused fork of the historical `ed` codebase (fork source: Distrotech/ed). It currently preserves `ed` behavior and command compatibility while the project is incrementally prepared for a future terminal UI (TUI) editor roadmap.

## Project overview

This repository contains the C implementation, manual sources, and tests for a classic line editor runtime. The near-term objective is repository hygiene, maintainability, and contributor readiness; long-term objective is a modern TUI editing experience built from a stable core.

## Features / purpose

- Compatible with traditional `ed` workflows and scripts.
- Includes restricted mode (`red`) behavior.
- Includes a regression-style testsuite for command behavior.
- Provides manpage and texinfo documentation sources.

## Installation

### Build prerequisites

- POSIX shell
- C compiler (e.g., `gcc` or `clang`)
- `make`
- Optional docs tooling: `help2man`, `makeinfo`

### Build and install

```bash
./configure
make
sudo make install
```

## Usage

Run the editor:

```bash
ed [options] [file]
```

Run in restricted mode:

```bash
red [file]
```

Get built-in help:

```bash
ed --help
```

## Development setup

```bash
git clone <your-fork-url>
cd synapse
./configure
make
make check
```

## Configuration

`./configure --help` lists supported configuration flags (install prefixes, compiler flags, and related options). The generated `Makefile` reflects those values.

## Build / run instructions

- Build binary: `make`
- Run tests: `make check`
- Clean outputs: `make clean`
- Full clean: `make distclean`

### Regenerating documentation artifacts

Generated documentation outputs (such as `doc/ed.info`) are intentionally not committed. Regenerate locally when needed:

```bash
make info
make man
```

## Troubleshooting

- If `make check` fails, ensure you built from a clean tree (`make clean && make`).
- If docs targets fail, install `makeinfo` and `help2man`, or skip doc generation.
- If `./configure` cannot find a compiler, set one explicitly: `CC=gcc ./configure`.

## License

This project is distributed under GNU GPLv3 (or later). See `LICENSE`.

## Project status

This codebase is in transition from legacy line-editor packaging to a cleaner open-source project structure suitable for collaborative modernization.
