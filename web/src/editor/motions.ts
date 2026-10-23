import type {ParsedCommand} from './types';

export function lineOffsets(text: string): number[] {
  const offsets = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') offsets.push(i + 1);
  }
  return offsets;
}

export function lineOfCaret(text: string, caret: number): number {
  return text.slice(0, Math.max(0, Math.min(caret, text.length))).split('\n').length - 1;
}

export function rangeToOffsets(text: string, startLine: number, endLine: number): {start: number; end: number} {
  const offsets = lineOffsets(text);
  const last = offsets.length - 1;
  const s = Math.max(0, Math.min(startLine, last));
  const e = Math.max(s, Math.min(endLine, last));
  const start = offsets[s];
  const end = e === last ? text.length : offsets[e + 1] - 1;
  return {start, end};
}

export function caretToLineCol(text: string, caret: number): {line: number; col: number} {
  const c = Math.max(0, Math.min(caret, text.length));
  const start = text.lastIndexOf('\n', c - 1) + 1;
  return {line: lineOfCaret(text, c) + 1, col: c - start + 1};
}

function parseAddressToken(token: string, current: number, last: number): number | null {
  if (token === '' || token === '.') return current;
  if (token === '$') return last;
  if (token === '%') return -2;
  const rel = /^([+-])(\d*)$/.exec(token);
  if (rel) {
    const delta = rel[2] === '' ? 1 : parseInt(rel[2], 10);
    return current + (rel[1] === '+' ? delta : -delta);
  }
  if (/^\d+$/.test(token)) return parseInt(token, 10) - 1;
  return null;
}

export function parseCommand(raw: string, currentLine: number, lastLine: number): ParsedCommand | null {
  const input = raw.trim();
  if (!input) return null;
  let rest = input;
  let range: ParsedCommand['range'] = null;
  const addrMatch = /^([.$%]|\d+|[+-]\d*)(?:\s*,\s*([.$%]|\d+|[+-]\d*))?/.exec(rest);
  if (addrMatch && addrMatch[0].trim() !== '') {
    const first = parseAddressToken(addrMatch[1], currentLine, lastLine);
    if (first !== null) {
      if (first === -2) {
        range = {startLine: 0, endLine: lastLine};
      } else if (addrMatch[2] !== undefined) {
        const second = parseAddressToken(addrMatch[2], currentLine, lastLine);
        if (second !== null && second !== -2) {
          range = {startLine: Math.min(first, second), endLine: Math.max(first, second)};
        }
      } else if (/^[.$%\d+-]/.test(input)) {
        range = {startLine: first, endLine: first};
      }
      if (range) rest = rest.slice(addrMatch[0].length).trim();
    }
  }
  if (rest.startsWith('%')) {
    range = {startLine: 0, endLine: lastLine};
    rest = rest.slice(1).trim();
  }
  const space = rest.search(/\s/);
  const name = space === -1 ? rest : rest.slice(0, space);
  const args = space === -1 ? '' : rest.slice(space).trim();
  if (!name && !range) return null;
  return {range, name, args, raw};
}

export function clampLine(n: number, last: number): number {
  return Math.max(0, Math.min(n, last));
}

const WORD_RE = /(\w+|[^\w\s]+)/g;

export function wordStarts(line: string): number[] {
  const out: number[] = [];
  WORD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WORD_RE.exec(line)) !== null) out.push(m.index);
  return out;
}

export function nextWordStart(text: string, caret: number, big: boolean, count: number): number {
  let pos = caret;
  for (let i = 0; i < count; i++) {
    const lineEnd = text.indexOf('\n', pos);
    const slice = text.slice(pos + 1, lineEnd === -1 ? text.length : lineEnd + 1);
    const re = big ? /\S+/g : WORD_RE;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    let found = -1;
    const base = pos + 1;
    while ((m = re.exec(slice)) !== null) {
      if (m.index > 0 || pos === caret && i === 0 && m.index === 0) {
        if (m.index > 0) {found = base + m.index; break;}
      }
    }
    if (found === -1) {
      const nl = text.indexOf('\n', pos + 1);
      if (nl === -1) {pos = text.length; break;}
      pos = nl + 1;
      i--;
      if (pos >= text.length) break;
      continue;
    }
    pos = found;
  }
  return Math.min(pos, text.length);
}

export function wordEnd(text: string, caret: number, count: number): number {
  let pos = caret;
  for (let i = 0; i < count; i++) {
    const slice = text.slice(pos + 1);
    WORD_RE.lastIndex = 0;
    const m = WORD_RE.exec(slice);
    if (!m) return text.length;
    pos = pos + 1 + m.index + m[0].length - 1;
  }
  return pos;
}

export function prevWordStart(text: string, caret: number, big: boolean, count: number): number {
  let pos = caret;
  for (let i = 0; i < count; i++) {
    const before = text.slice(0, Math.max(0, pos - (i === 0 && pos === caret ? 1 : 0)));
    const re = big ? /\S+/g : WORD_RE;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    let lastStart = -1;
    while ((m = re.exec(before)) !== null) lastStart = m.index;
    if (lastStart === -1) return 0;
    pos = lastStart;
  }
  return pos;
}
