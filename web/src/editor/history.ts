import type {UndoEntry} from './types';

export function createUndoStack(limit = 100) {
  let undo: UndoEntry[] = [];
  let redo: UndoEntry[] = [];
  return {
    push(current: UndoEntry) {
      undo = [...undo.slice(-(limit - 1)), current];
      redo = [];
    },
    pushRedo(entry: UndoEntry) {
      redo = [...redo.slice(-(limit - 1)), entry];
    },
    undo(current: UndoEntry): UndoEntry | null {
      if (undo.length === 0) return null;
      const prev = undo[undo.length - 1];
      undo = undo.slice(0, -1);
      redo = [...redo, current];
      return prev;
    },
    redo(current: UndoEntry): UndoEntry | null {
      if (redo.length === 0) return null;
      const next = redo[redo.length - 1];
      redo = redo.slice(0, -1);
      undo = [...undo, current];
      return next;
    },
    clear() {
      undo = [];
      redo = [];
    },
  };
}

export type RepeatAction =
  | {op: 'x'; count: number}
  | {op: 'dd'; count: number}
  | {op: 's'; pattern: string; replacement: string; global: boolean; range: string}
  | null;
