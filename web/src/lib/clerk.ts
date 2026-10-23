import type {Settings} from './storage';

const MILD_W = [
  'written. took you long enough.',
  'saved. the paper thanks you.',
  'done. try not to lose it this time.',
];
const FULL_W = [
  'finally. {n} lines saved. i waited.',
  'written. {n} lines. Pulitzer material? no.',
  'saved at last. the disk sighed.',
  '{n} lines. bold of you to call it done.',
];
const MILD_ERR = ['? never heard of it. try help.', '? no. try again.'];
const FULL_ERR = [
  '? {cmd} — never heard of it. try help.',
  '? bold. wrong, but bold.',
  '? the manual is right there. :help.',
];

let counter = 0;
function pick(list: string[]): string {
  counter += 1;
  return list[counter % list.length];
}

function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export function clerkWrite(lines: number, settings: Settings): string {
  if (settings.clerk === 'off') return `${lines} line${lines === 1 ? '' : 's'} written to this browser.`;
  if (settings.clerk === 'full') return fill(pick(FULL_W), {n: String(lines)});
  return `${lines} line${lines === 1 ? '' : 's'} written. ${pick(MILD_W)}`;
}

export function clerkError(message: string, settings: Settings): string {
  if (settings.clerk === 'off') return message;
  const base = message.replace(/^\?\s?/, '');
  if (settings.clerk === 'full') {
    if (/Unknown command/.test(base)) {
      const cmd = base.replace('Unknown command: ', '');
      return fill(pick(FULL_ERR), {cmd});
    }
    return `? ${base}`;
  }
  if (/Unknown command|Pattern not found|Bad /.test(base)) return pick(MILD_ERR);
  return `? ${base}`;
}

export function clerkQuitDirty(settings: Settings): string {
  if (settings.clerk === 'off') return 'Unsaved edits. Use :w first or :q! to discard.';
  return '? unsaved. :w first. or don\'t. lose it. see if i care.';
}

export function clerkEmpty(settings: Settings): string {
  if (settings.clerk === 'off') return '0 lines written to this browser.';
  return '? wrote nothing. bold strategy.';
}
