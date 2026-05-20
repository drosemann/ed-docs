# Contributing to Synapse Editor

Thanks for your interest in contributing.

## Ground rules

- Keep changes focused and minimal.
- Preserve existing behavior unless the change explicitly targets a bug or documented improvement.
- Include tests when behavior changes.
- Update documentation when interfaces or workflows change.

## Development workflow

1. Fork and create a feature branch.
2. Build locally:
   - `./configure`
   - `make`
   - `make check`
3. Commit with clear messages.
4. Open a pull request with:
   - change summary
   - test evidence
   - migration/compatibility notes (if applicable)

## Coding conventions

- Follow existing C style and naming in nearby files.
- Avoid unrelated refactors.
- Keep portability in mind for POSIX-like environments.

## Reporting issues

When filing an issue, include:

- environment (OS, compiler, shell)
- exact command(s) run
- expected vs actual behavior
- minimal reproduction input/script
