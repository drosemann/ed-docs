import type {CommandContext, CommandResult} from './types';
import {parseCommand, rangeToOffsets, lineOffsets, clampLine} from './motions';

export type SaveHooks = {
  save: (filename?: string) => {ok: boolean; status: string; filename?: string};
  close: (force: boolean) => {ok: boolean; status: string};
  openByTitle: (title: string, force: boolean) => {ok: boolean; status: string};
  makeDoc: (title: string) => {ok: boolean; status: string};
};

function offsetsOfLine(text: string, line: number): {start: number; end: number} {
  const offsets = lineOffsets(text);
  const last = offsets.length - 1;
  const l = clampLine(line, last);
  return {start: offsets[l], end: l === last ? text.length : offsets[l + 1] - 1};
}

function deleteRange(text: string, start: number, end: number): {draft: string; caret: number} {
  let from = start;
  let to = end;
  if (to < text.length) to += 1;
  else if (from > 0) from -= 1;
  return {draft: text.slice(0, from) + text.slice(to), caret: Math.min(from, text.length)};
}

function unescapeDelim(s: string, delim: string): string {
  return s.split(`\\${delim}`).join(delim).split('\\\\').join('\\');
}

export function parseSubstitute(args: string): {pattern: string; replacement: string; global: boolean; confirm: boolean} | null {
  if (!args.startsWith('s')) return null;
  const delim = args[1];
  if (!delim) return null;
  const parts: string[] = [];
  let cur = '';
  let escaped = false;
  for (let i = 2; i < args.length; i++) {
    const ch = args[i];
    if (escaped) {cur += ch; escaped = false; continue;}
    if (ch === '\\') {escaped = true; cur += ch; continue;}
    if (ch === delim) {parts.push(cur); cur = '';}
    else cur += ch;
  }
  parts.push(cur);
  if (parts.length < 2) return null;
  const flags = parts[2] ?? '';
  return {
    pattern: unescapeDelim(parts[0], delim),
    replacement: unescapeDelim(parts[1], delim),
    global: flags.includes('g'),
    confirm: flags.includes('c'),
  };
}

export function applySubstitute(
  text: string,
  startLine: number,
  endLine: number,
  pattern: string,
  replacement: string,
  global: boolean,
): {draft: string; count: number} {
  if (!pattern) return {draft: text, count: 0};
  const {start, end} = rangeToOffsets(text, startLine, endLine);
  let count = 0;
  const re = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), global ? 'g' : '');
  const body = text.slice(start, end).replace(re, (...m: unknown[]) => {
    count += 1;
    let out = replacement;
    const groups = m.slice(1, -2) as string[];
    out = out.replace(/\\(\d)/g, (_, d) => groups[parseInt(d, 10) - 1] ?? '');
    out = out.replace(/&/g, m[0] as string);
    return out;
  });
  return {draft: text.slice(0, start) + body + text.slice(end), count};
}

export function searchForward(text: string, pattern: string, from: number): number {
  if (!pattern) return -1;
  const idx = text.indexOf(pattern, from + 1);
  return idx === -1 ? text.indexOf(pattern) : idx;
}

export function dispatchCommand(
  raw: string,
  ctx: CommandContext,
  hooks: SaveHooks,
): CommandResult & {switchToInsert?: boolean; jumpTo?: number; showHelp?: boolean; pendingConfirm?: PendingConfirm} {
  const lines = ctx.draft.split('\n');
  const lastLine = lines.length - 1;
  const curLine = ctx.draft.slice(0, ctx.caret).split('\n').length - 1;
  const rangeAll = {startLine: 0, endLine: lastLine};

  if (/^\/.*/.test(raw.trim()) || /^\?.*\??$/.test(raw.trim())) {
    const t = raw.trim();
    const backward = t.startsWith('?');
    const pattern = t.slice(1).replace(/\?$/, '');
    if (!pattern) return {status: '? empty pattern', error: true};
    ctx.setLastSearch(pattern);
    const idx = backward
      ? ctx.draft.lastIndexOf(pattern, ctx.caret - 1)
      : searchForward(ctx.draft, pattern, ctx.caret);
    if (idx === -1) return {status: `? Pattern not found: ${pattern}`, error: true};
    return {caret: idx, status: `/${pattern} — Ln ${ctx.draft.slice(0, idx).split('\n').length}`};
  }

  const parsed = parseCommand(raw, curLine, lastLine);
  if (!parsed) return {status: 'NORMAL'};
  if (parsed.name === '') {
    if (parsed.range) {
      const {start} = offsetsOfLine(ctx.draft, clampLine(parsed.range.startLine, lastLine));
      return {caret: start, status: `Ln ${clampLine(parsed.range.startLine, lastLine) + 1}`};
    }
    return {status: 'NORMAL'};
  }

  const range = parsed.range;
  const R = range ?? {startLine: curLine, endLine: curLine};
  const {name, args} = parsed;

  switch (name) {
    case 'w': {
      const r = hooks.save(args || undefined);
      return {status: r.status, error: !r.ok, downloadAs: r.filename};
    }
    case 'q':
      if (args === '!') return hooks.close(true);
      return hooks.close(false);
    case 'q!':
      return hooks.close(true);
    case 'wq':
    case 'x': {
      const r = hooks.save(undefined);
      if (!r.ok) return {status: r.status, error: true};
      const c = hooks.close(true);
      return {status: `Written. ${c.status}`, closeEditor: true};
    }
    case 'e': {
      if (args === '!') {
        return {status: 'Reloaded. Unsaved edits discarded.', error: false, reload: true} as CommandResult & {reload: boolean} as never;
      }
      if (args.endsWith('!')) {
        const r = hooks.openByTitle(args.slice(0, -1).trim(), true);
        return {status: r.status, error: !r.ok};
      }
      if (!args) return {status: '? No title. Try e <title>', error: true};
      const r = hooks.openByTitle(args, false);
      return {status: r.status, error: !r.ok};
    }
    case 'e!':
      return {status: 'Reloaded. Unsaved edits discarded.', reload: true} as never;
    case 'new': {
      const r = hooks.makeDoc(args || 'Untitled document');
      return {status: r.status, error: !r.ok};
    }
    case 'p': {
      const {start, end} = rangeToOffsets(ctx.draft, R.startLine, R.endLine);
      const body = ctx.draft.slice(start, end);
      const span = R.endLine - R.startLine + 1;
      return {status: span > 1 ? `(${span} lines) ${body.slice(0, 160)}${body.length > 160 ? '…' : ''}` : (body || '(empty line)')};
    }
    case 'd': {
      const {start, end} = rangeToOffsets(ctx.draft, R.startLine, R.endLine);
      ctx.pushUndo({draft: ctx.draft, caret: ctx.caret});
      const {draft, caret} = deleteRange(ctx.draft, start, end);
      return {draft, caret, status: `${R.endLine - R.startLine + 1} line(s) deleted.`};
    }
    case 'a':
    case 'i':
      return {status: 'INSERT — press Esc to return to normal mode.', switchToInsert: true};
    case 's': {
      const first = args[0] ?? '';
      const attempt = parseSubstitute(first === '/' || (first && !/[a-zA-Z]/.test(first)) ? `s${args}` : `s/${args}`);
      if (!attempt) return {status: '? Bad substitute. Try s/old/new/g', error: true};
      const pat = attempt.pattern || ctx.lastSearch;
      if (!pat) return {status: '? No previous pattern', error: true};
      ctx.setLastSearch(pat);
      const rr = range ?? {startLine: curLine, endLine: curLine};
      const {draft, count} = applySubstitute(ctx.draft, rr.startLine, rr.endLine, pat, attempt.replacement, attempt.global);
      if (attempt.confirm) {
        return {pendingConfirm: {pattern: pat, replacement: attempt.replacement, global: attempt.global, range: rr, matches: count}, status: `${count} match(es). Confirm each with y/n.`};
      }
      if (count === 0) return {status: `? Pattern not found: ${pat}`, error: true};
      ctx.pushUndo({draft: ctx.draft, caret: ctx.caret});
      return {draft, status: `${count} substitution(s).`};
    }
    case 'g':
    case 'goto': {
      const n = parseInt(args, 10);
      if (Number.isNaN(n)) return {status: '? Bad line number', error: true};
      const {start} = offsetsOfLine(ctx.draft, clampLine(n - 1, lastLine));
      return {caret: start, status: `Ln ${clampLine(n - 1, lastLine) + 1}`};
    }
    case 'help':
      return {status: 'Commands: :N, :a,b p/d, w [file], q[!], wq, e[!] <title>, new [t], s/o/gc, /pat, help', showHelp: true};
    case '%':
      return {status: lines.join('\n').slice(0, 160) || '(empty)', error: false};
    default:
      if (/^\d+$/.test(name) && !args) {
        const {start} = offsetsOfLine(ctx.draft, clampLine(parseInt(name, 10) - 1, lastLine));
        return {caret: start, status: `Ln ${clampLine(parseInt(name, 10) - 1, lastLine) + 1}`};
      }
      void rangeAll;
      return {status: `? Unknown command: ${raw.trim()}`, error: true};
  }
}

export type PendingConfirm = {
  pattern: string;
  replacement: string;
  global: boolean;
  range: {startLine: number; endLine: number};
  matches: number;
};
