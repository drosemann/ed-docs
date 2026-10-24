# License audit ed-docs (24.10.2026)

Status: `BLOCKED — APPROVALS REQUIRED` (technical assessment, no legal advice).

## 1. Current license state

- `COPYING`: full text GNU GPLv3, no project copyright line.
- `README.md` (Lizenz section): claims GPLv3 but links to non-existent `LICENSE`.
- `web/package.json`: no `license` field. No SPDX identifiers in `web/`.
- No `CONTRIBUTING.md`, CLA, or DCO in HEAD. No submodules, no lockfiles, no fonts/binaries in `web/`.

## 2. Code origin

- `22635d8 Add Upstream ED` (Greg Nietsky, 2013): imported GNU ed C code (GPLv3+).
- `7b5c54b` (DaaanielTV, PR #3): deleted the entire C tree (~7.000 lines).
- `c43e6bc`: re-added only the `COPYING` text, no code.
- Current `web/` (React + Vite, offline-first Markdown workspace) by DaaanielTV (PR #1-#3) and Daniel Rosemann (rebrand + editor). No GNU ed code remains in HEAD per file inventory.

## 3. Dependencies (`web/package.json`, no lockfile)

- `react`, `react-dom`: MIT, runtime (bundled via Vite).
- `vite`, `@vitejs/plugin-react`: MIT, build.
- `typescript`, `@types/*`: Apache-2.0 / MIT, dev/build.
- No GPL/AGPL/LGPL among direct deps. Transitive tree unconfirmed (no lockfile): generate SBOM before any MIT release. Nothing removed or replaced.

## 4. Contributors (from `git log --all`)

- Greg Nietsky `<gregory@distrotech.co.za>`: 2013 upstream import, code since removed.
- DaaanielTV: scaffold + deletion of old code. No MIT release on file.
- Daniel Rosemann: rebrand + current editor. No MIT release on file.
- `Co-authored-by: Muse Code` / `Copilot` in several commits: bot assistance, no own rights.
- DaaanielTV and Daniel Rosemann confirmed by maintainer to be the same person (chat, 24.10.2026). No CLA/DCO; employer/contract rights unchecked.

## 5. Outreach attempt

- Draft MIT-relicense request to `gregory@distrotech.co.za` prepared (EN).
- Delivery failed 24.10.2026: `DNS Error NXDOMAIN distrotech.co.za`. Documented as failed contact, not consent.

## 6. What is still required before an MIT release

1. Written MIT approval for own contributions (version/date scope), archived.
2. Unreachable third party documented as such; no GPL code left in tree verified.
3. Fix `README` license link, add `license` field to `package.json`, add `LICENSE` (MIT) only after 1.
4. Generate lockfile + third-party notices for transitive deps.

No license files changed in this audit. Older tags stay as they were; a future MIT would apply prospectively only.
