import type {DocumentRecord} from '../editor/types';

export const STORAGE_KEY = 'ed-docs.library.v1';
const SETTINGS_KEY = 'ed-docs.settings.v1';
const HISTORY_KEY = 'ed-docs.history.v1';
const GOLF_KEY = 'ed-docs.golf.v1';
const ACH_KEY = 'ed-docs.achievements.v1';

export type Settings = {
  sound: boolean;
  gloom: boolean;
  clerk: 'off' | 'mild' | 'full';
};

export const DEFAULT_SETTINGS: Settings = {sound: false, gloom: false, clerk: 'mild'};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readLibrary(): {documents: DocumentRecord[]; error: string | null} {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {documents: [], error: null};
    const value: unknown = JSON.parse(stored);
    if (!Array.isArray(value) || !value.every(document =>
      document &&
      typeof document.id === 'string' &&
      typeof document.title === 'string' &&
      typeof document.content === 'string' &&
      typeof document.updatedAt === 'string'
    )) {
      throw new Error('The saved document library has an unexpected format.');
    }
    return {documents: value as DocumentRecord[], error: null};
  } catch (error) {
    return {
      documents: [],
      error: `Could not read local documents: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export function writeLibrary(documents: DocumentRecord[]): boolean {
  return writeJson(STORAGE_KEY, documents);
}

export function clearLibrary(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

export function createDocument(title: string): DocumentRecord {
  return {
    id: crypto.randomUUID(),
    title: title.trim() || 'Untitled document',
    content: '',
    updatedAt: new Date().toISOString(),
  };
}

export function readSettings(): Settings {
  const raw = readJson<Partial<Settings>>(SETTINGS_KEY, {});
  const clerk = raw.clerk === 'off' || raw.clerk === 'full' ? raw.clerk : 'mild';
  return {sound: raw.sound === true, gloom: raw.gloom === true, clerk};
}

export function writeSettings(settings: Settings): boolean {
  return writeJson(SETTINGS_KEY, settings);
}

export function readTape(): string[] {
  const raw = readJson<unknown>(HISTORY_KEY, {});
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  if (raw && typeof raw === 'object') {
    const tape = (raw as {tape?: unknown}).tape;
    if (Array.isArray(tape)) return tape.filter((x): x is string => typeof x === 'string');
  }
  return [];
}

export function pushTape(entry: string): string[] {
  const tape = readTape();
  if (tape[tape.length - 1] !== entry) tape.push(entry);
  const trimmed = tape.slice(-50);
  writeJson(HISTORY_KEY, {tape: trimmed});
  return trimmed;
}

export type Snapshot = {ts: string; content: string; lines: number};

export function readSnapshots(docId: string): Snapshot[] {
  const raw = readJson<Record<string, Snapshot[]>>(HISTORY_KEY + '.snapshots', {});
  return Array.isArray(raw[docId]) ? raw[docId] : [];
}

export function pushSnapshot(docId: string, content: string): void {
  const raw = readJson<Record<string, Snapshot[]>>(HISTORY_KEY + '.snapshots', {});
  const list = [...(Array.isArray(raw[docId]) ? raw[docId] : []), {
    ts: new Date().toISOString(),
    content,
    lines: content.split('\n').length,
  }].slice(-20);
  writeJson(HISTORY_KEY + '.snapshots', {...raw, [docId]: list});
}

export type GolfRecord = {keys: number; commands: number; best: number};
export function readGolf(docId: string): GolfRecord {
  const raw = readJson<Record<string, GolfRecord>>(GOLF_KEY, {});
  return raw[docId] ?? {keys: 0, commands: 0, best: 0};
}
export function writeGolf(docId: string, record: GolfRecord): void {
  const raw = readJson<Record<string, GolfRecord>>(GOLF_KEY, {});
  writeJson(GOLF_KEY, {...raw, [docId]: record});
}

export type AchState = {unlocked: string[]; xDeletes: number; colonCommands: number; mouseFreeStreak: number};
export function readAch(): AchState {
  return readJson<AchState>(ACH_KEY, {unlocked: [], xDeletes: 0, colonCommands: 0, mouseFreeStreak: 0});
}
export function writeAch(state: AchState): void {
  writeJson(ACH_KEY, state);
}
