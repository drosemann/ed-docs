import React, {useEffect, useMemo, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';
import type {DocumentRecord, EditorMode} from './editor/types';
import {createUndoStack, type RepeatAction} from './editor/history';
import {
  caretToLineCol, lineOffsets, nextWordStart, prevWordStart, wordEnd,
} from './editor/motions';
import {applySubstitute, dispatchCommand, type PendingConfirm} from './editor/commands';
import {
  clearLibrary, createDocument, pushSnapshot, pushTape, readAch, readGolf, readLibrary,
  readSettings, readSnapshots, readTape, writeAch, writeGolf, writeLibrary, writeSettings,
  type Settings,
} from './lib/storage';
import {clerkEmpty, clerkError, clerkQuitDirty, clerkWrite} from './lib/clerk';
import {kaChunk, softTick} from './lib/sound';
import {golfScore, golfVerdict} from './lib/golf';
import {ACHIEVEMENTS, checkAchievements} from './lib/achievements';
import {docStats, renderMarkdown} from './lib/markdown';

type Overlay = null | 'help' | 'tape' | 'achievements' | 'snapshots' | 'preview-help';

function sanitizeFilename(name: string): string {
  return (name.trim() || 'untitled').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');
}

function App() {
  const [initialLibrary] = useState(readLibrary);
  const [initialSettings] = useState(readSettings);
  const [libraryReadError, setLibraryReadError] = useState(initialLibrary.error);
  const [documents, setDocuments] = useState(initialLibrary.documents);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<EditorMode>('NORMAL');
  const [command, setCommand] = useState('');
  const [status, setStatus] = useState(initialLibrary.error ? `? ${initialLibrary.error}` : 'Ready. Your documents stay in this browser.');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [tapeIndex, setTapeIndex] = useState(0);
  const [tape, setTape] = useState<string[]>(() => readTape());
  const [preview, setPreview] = useState(false);
  const [writing, setWriting] = useState(false);
  const [lastSearch, setLastSearch] = useState('');
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [confirmDraft, setConfirmDraft] = useState('');
  const [confirmPos, setConfirmPos] = useState(0);
  const [pendingReplace, setPendingReplace] = useState(false);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const commandRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const undoRef = useRef(createUndoStack());
  const registerRef = useRef<{unnamed: string}>({unnamed: ''});
  const pendingOpRef = useRef<{op: 'd' | 'y' | 'g'; count: string} | null>(null);
  const countRef = useRef('');
  const lastRepeat = useRef<RepeatAction>(null);
  const keysRef = useRef(0);
  const cmdsRef = useRef(0);
  const hjklStreak = useRef(0);
  const achRef = useRef(readAch());
  const gcConfirms = useRef(0);
  const golfBestRef = useRef(0);

  const activeDocument = documents.find(document => document.id === activeId) ?? null;
  const isDirty = activeDocument !== null &&
    (draft !== activeDocument.content || draftTitle !== activeDocument.title);
  const stats = useMemo(() => docStats(draft), [draft]);
  const lineCount = draft.split('\n').length;
  const caretInfo = caretToLineCol(draft, editorRef.current?.selectionStart ?? 0);

  useEffect(() => {
    document.body.classList.toggle('gloom', settings.gloom);
  }, [settings.gloom]);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(() => setOfflineReady(true))
        .catch(error => setOfflineError(error instanceof Error ? error.message : String(error)));
    } else {
      setOfflineError('This browser does not support offline app caching.');
    }
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    if (mode === 'COMMAND') commandRef.current?.focus();
  }, [mode]);

  const setFailure = (message: string) => setStatus(clerkError(message.startsWith('?') ? message : `? ${message}`, settings));

  const updateSettings = (next: Settings) => {
    setSettings(next);
    writeSettings(next);
  };

  const awardCheck = (extra?: {golfBest?: number}) => {
    const ach = achRef.current;
    const fresh = checkAchievements({
      unlocked: ach.unlocked,
      colonCommands: ach.colonCommands,
      xDeletes: ach.xDeletes,
      mouseFreeStreak: ach.mouseFreeStreak,
      gcConfirms: gcConfirms.current,
      golfBest: extra?.golfBest ?? golfBestRef.current,
      hour: new Date().getHours(),
    });
    if (fresh.length > 0) {
      const titles = fresh.map(id => ACHIEVEMENTS.find(a => a.id === id)?.title ?? id).join(', ');
      achRef.current = {...ach, unlocked: [...ach.unlocked, ...fresh]};
      writeAch(achRef.current);
      setStatus(prev => `${prev} ★ ${titles}`);
    }
  };

  const persist = (next: DocumentRecord[]) => {
    if (libraryReadError) {
      setFailure('Local data could not be loaded; refusing to overwrite it.');
      return false;
    }
    try {
      if (!writeLibrary(next)) throw new Error('quota or permission');
      setDocuments(next);
      return true;
    } catch (error) {
      setFailure(`Could not write local documents: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };

  const canLeaveEditor = (force = false) => {
    if (force) return true;
    if (!isDirty) return true;
    if (window.confirm('Discard unsaved edits? Use :w to save them first.')) return true;
    setStatus(clerkQuitDirty(settings));
    return false;
  };

  const openDocument = (document: DocumentRecord) => {
    if (!canLeaveEditor()) return;
    undoRef.current.clear();
    keysRef.current = 0;
    cmdsRef.current = 0;
    golfBestRef.current = readGolf(document.id).best;
    setActiveId(document.id);
    setDraftTitle(document.title);
    setDraft(document.content);
    setMode('NORMAL');
    setConfirm(null);
    setStatus(`Opened ${document.title}`);
  };

  const makeDocument = (title = 'Untitled document') => {
    if (!canLeaveEditor()) return;
    const document = createDocument(title);
    if (!persist([...documents, document])) return;
    undoRef.current.clear();
    keysRef.current = 0;
    cmdsRef.current = 0;
    setActiveId(document.id);
    setDraftTitle(document.title);
    setDraft('');
    setMode('NORMAL');
    setStatus(`Created ${document.title}. Use :w to write changes.`);
  };

  const saveDocument = (filename?: string) => {
    if (!activeDocument || !activeId) {
      setFailure('No document is open.');
      return false;
    }
    const title = draftTitle.trim() || 'Untitled document';
    const saved: DocumentRecord = {...activeDocument, title, content: draft, updatedAt: new Date().toISOString()};
    if (!persist(documents.map(document => document.id === saved.id ? saved : document))) return false;
    setDraftTitle(title);
    pushSnapshot(activeId, draft);
    const keys = keysRef.current;
    const cmds = cmdsRef.current;
    const score = golfScore(draft.length, keys, cmds);
    const prev = readGolf(activeId);
    const best = Math.max(prev.best, score);
    golfBestRef.current = best;
    writeGolf(activeId, {keys, commands: cmds, best});
    const golfBit = keys > 0 ? ` ⛳ ${score} (best ${best}). ${golfVerdict(score)}` : '';
    if (draft.trim() === '') setStatus(clerkEmpty(settings));
    else setStatus(`${clerkWrite(lineCount, settings)}${golfBit}`);
    setWriting(true);
    window.setTimeout(() => setWriting(false), 500);
    if (settings.sound) kaChunk();
    const hour = new Date().getHours();
    if (hour === 0 || hour >= 22 || hour < 5) awardCheck({golfBest: best});
    else awardCheck({golfBest: best});
    if (filename) {
      const blob = new Blob([draft], {type: 'text/markdown;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = `${sanitizeFilename(filename)}.md`;
      link.click();
      URL.revokeObjectURL(url);
    }
    return true;
  };

  useEffect(() => {
    const handleSaveShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        saveDocument();
      }
    };
    window.addEventListener('keydown', handleSaveShortcut);
    return () => window.removeEventListener('keydown', handleSaveShortcut);
     
  });

  const closeDocument = (force = false) => {
    if (!canLeaveEditor(force)) return;
    setActiveId(null);
    setMode('NORMAL');
    setConfirm(null);
    setOverlay(null);
    setStatus('Back to the library.');
  };

  const exportDocument = () => {
    if (!activeDocument) return;
    const safeName = sanitizeFilename(draftTitle);
    const blob = new Blob([draft], {type: 'text/markdown;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = url;
    link.download = `${safeName}.md`;
    link.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${safeName}.md`);
  };

  const currentLineRange = () => {
    const text = draft;
    const caret = editorRef.current?.selectionStart ?? 0;
    const start = text.lastIndexOf('\n', caret - 1) + 1;
    const nextBreak = text.indexOf('\n', caret);
    return {start, end: nextBreak === -1 ? text.length : nextBreak, caret};
  };

  const focusEditor = (caret?: number | null) => {
    requestAnimationFrame(() => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      if (caret !== undefined && caret !== null) {
        const atEnd = caret >= draft.length && draft.length > 0;
        editor.setSelectionRange(atEnd ? caret : caret, atEnd ? caret : Math.min(caret + 1, draft.length));
        if (!atEnd) {
          window.setTimeout(() => {
            if (document.activeElement === editor) editor.setSelectionRange(caret, caret);
          }, 60);
        }
      }
    });
  };

  const pushUndo = (caret?: number) => {
    undoRef.current.push({draft, caret: caret ?? editorRef.current?.selectionStart ?? 0});
  };

  const insertMode = (append: boolean) => {
    const editor = editorRef.current;
    if (append && editor) editor.setSelectionRange(currentLineRange().end, currentLineRange().end);
    setMode('INSERT');
    setStatus('INSERT — press Esc to return to normal mode.');
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const moveCursor = (direction: 'left' | 'right' | 'up' | 'down' | 'start' | 'end') => {
    const editor = editorRef.current;
    if (!editor) return;
    const text = draft;
    const caret = editor.selectionStart;
    const {start, end} = currentLineRange();
    let next = caret;
    if (direction === 'left') next = Math.max(0, caret - 1);
    if (direction === 'right') next = Math.min(text.length, caret + 1);
    if (direction === 'start') next = start;
    if (direction === 'end') next = end;
    if (direction === 'up' || direction === 'down') {
      const lines = text.split('\n');
      const currentLine = text.slice(0, caret).split('\n').length - 1;
      const column = caret - start;
      const targetLine = Math.max(0, Math.min(lines.length - 1, currentLine + (direction === 'up' ? -1 : 1)));
      const targetStart = lines.slice(0, targetLine).reduce((length, line) => length + line.length + 1, 0);
      next = targetStart + Math.min(column, lines[targetLine].length);
    }
    editor.setSelectionRange(next, next);
  };

  const deleteCurrentLine = (count = 1) => {
    const text = draft;
    const caret = editorRef.current?.selectionStart ?? 0;
    const firstLine = text.slice(0, caret).split('\n').length - 1;
    const offsets = lineOffsets(text);
    const last = offsets.length - 1;
    const fromLine = Math.max(0, Math.min(firstLine, last));
    const toLine = Math.max(fromLine, Math.min(firstLine + count - 1, last));
    const from = offsets[fromLine];
    let to = toLine === last ? text.length : offsets[toLine + 1] - 1;
    let f = from;
    if (to < text.length) to += 1;
    else if (f > 0) f -= 1;
    pushUndo(caret);
    registerRef.current.unnamed = text.slice(from, toLine === last ? text.length : offsets[toLine + 1] - 1);
    const next = text.slice(0, f) + text.slice(to);
    setDraft(next || '');
    focusEditor(Math.min(f, next.length));
    setStatus(`${toLine - fromLine + 1} line(s) deleted.`);
  };

  const yankLine = (count = 1) => {
    const text = draft;
    const caret = editorRef.current?.selectionStart ?? 0;
    const firstLine = text.slice(0, caret).split('\n').length - 1;
    const offsets = lineOffsets(text);
    const last = offsets.length - 1;
    const toLine = Math.min(firstLine + count - 1, last);
    registerRef.current.unnamed = text.slice(offsets[firstLine], toLine === last ? text.length : offsets[toLine + 1] - 1);
    setStatus(`${toLine - firstLine + 1} line(s) yanked.`);
  };

  const pasteRegister = (before: boolean) => {
    const clip = registerRef.current.unnamed;
    if (!clip) {
      setFailure('Register is empty. Yank something first.');
      return;
    }
    const editor = editorRef.current;
    const caret = editor?.selectionStart ?? 0;
    pushUndo(caret);
    if (before) {
      const start = currentLineRange().start;
      const next = `${draft.slice(0, start)}${clip}\n${draft.slice(start)}`;
      setDraft(next);
      focusEditor(start);
    } else {
      const {end} = currentLineRange();
      const next = `${draft.slice(0, end)}\n${clip}${draft.slice(end)}`;
      setDraft(next);
      focusEditor(end + 1);
    }
    setStatus('Pasted.');
  };

  const runCommand = (rawCommand: string) => {
    const trimmed = rawCommand.trim();
    if (trimmed === '') {
      setMode('NORMAL');
      return;
    }
    if (trimmed === 'q:') {
      setTape(readTape());
      setTapeIndex(Math.max(0, readTape().length - 1));
      setOverlay('tape');
      setMode('NORMAL');
      setCommand('');
      return;
    }
    const editor = editorRef.current;
    const caret = editor?.selectionStart ?? 0;
    const ctx = {
      draft,
      caret,
      draftTitle,
      lastSearch,
      setLastSearch: (p: string) => setLastSearch(p),
      pushUndo: (entry: {draft: string; caret: number}) => undoRef.current.push(entry),
    };
    const result = dispatchCommand(trimmed, ctx, {
      save: (filename?: string) => {
        const ok = saveDocument(filename);
        return {ok, status: ok ? status : status, filename};
      },
      close: (force: boolean) => {
        if (!force && isDirty) {
          setStatus(clerkQuitDirty(settings));
          return {ok: false, status: 'dirty'};
        }
        setActiveId(null);
        setMode('NORMAL');
        setOverlay(null);
        setStatus(force && isDirty ? 'Quit without saving. The clerk saw nothing.' : 'Back to the library.');
        return {ok: true, status: 'closed'};
      },
      openByTitle: (title: string, force: boolean) => {
        const target = documents.find(document =>
          document.title.toLocaleLowerCase() === title.toLocaleLowerCase()
        );
        if (!target) return {ok: false, status: `? No document titled "${title}".`};
        if (!force && isDirty && !window.confirm('Discard unsaved edits?')) {
          return {ok: false, status: clerkQuitDirty(settings)};
        }
        undoRef.current.clear();
        setActiveId(target.id);
        setDraftTitle(target.title);
        setDraft(target.content);
        setMode('NORMAL');
        return {ok: true, status: `Opened ${target.title}`};
      },
      makeDoc: (title: string) => {
        if (isDirty && !window.confirm('Discard unsaved edits?')) {
          return {ok: false, status: clerkQuitDirty(settings)};
        }
        const document = createDocument(title);
        const next = [...documents, document];
        if (!writeLibrary(next)) return {ok: false, status: '? Could not write local documents.'};
        setDocuments(next);
        undoRef.current.clear();
        setActiveId(document.id);
        setDraftTitle(document.title);
        setDraft('');
        setMode('NORMAL');
        return {ok: true, status: `Created ${document.title}. Use :w to write changes.`};
      },
    });

    const nextTape = pushTape(trimmed);
    setTape(nextTape);
    achRef.current = {...achRef.current, colonCommands: achRef.current.colonCommands + 1};
    writeAch(achRef.current);
    cmdsRef.current += 1;
    awardCheck();

    if ('reload' in result && (result as {reload?: boolean}).reload) {
      if (activeDocument) {
        undoRef.current.clear();
        setDraft(activeDocument.content);
        setDraftTitle(activeDocument.title);
        setMode('NORMAL');
        setStatus('Reloaded. Unsaved edits discarded.');
      }
      setCommand('');
      return;
    }
    if (result.downloadAs !== undefined && result.downloadAs) {
      setCommand('');
      setMode('NORMAL');
      focusEditor();
      return;
    }
    if (result.draft !== undefined) setDraft(result.draft);
    if (result.caret !== undefined && result.caret !== null) {
      const c = result.caret;
      focusEditor(c);
    }
    if ('pendingConfirm' in result && result.pendingConfirm) {
      const pc = result.pendingConfirm;
      setConfirm(pc);
      setConfirmPos(0);
      const {draft: previewDraft} = applySubstitute(draft, pc.range.startLine, pc.range.endLine, pc.pattern, pc.replacement, pc.global);
      setConfirmDraft(previewDraft);
      setMode('NORMAL');
      setStatus(`Confirm ${pc.matches} match(es): y replace, n skip, a all, q stop.`);
      setCommand('');
      return;
    }
    if (result.switchToInsert) {
      insertMode(false);
      setCommand('');
      return;
    }
    if (result.showHelp) {
      setOverlay('help');
      setStatus(result.status);
      setCommand('');
      setMode('NORMAL');
      focusEditor();
      return;
    }
    if (result.closeEditor) {
      setCommand('');
      return;
    }
    if (result.error) setFailure(result.status);
    else setStatus(result.status === 'NORMAL' ? 'NORMAL' : result.status);
    setCommand('');
    setMode(current => current === 'COMMAND' ? 'NORMAL' : current);
    if (result.caret === undefined) focusEditor();
  };

  const runSetCommand = (args: string) => {
    const a = args.trim();
    if (a === 'sound') updateSettings({...settings, sound: true});
    else if (a === 'nosound') updateSettings({...settings, sound: false});
    else if (a === 'gloom' || a === 'candle') updateSettings({...settings, gloom: true});
    else if (a === 'nogloom' || a === 'nocandle') updateSettings({...settings, gloom: false});
    else if (a.startsWith('clerk=')) {
      const v = a.slice(6);
      if (v === 'off' || v === 'mild' || v === 'full') updateSettings({...settings, clerk: v});
      else {setFailure('? clerk is off, mild, or full.'); return;}
    }
    else if (a === '') setStatus(`set: sound=${settings.sound ? 'on' : 'off'} gloom=${settings.gloom ? 'on' : 'off'} clerk=${settings.clerk}`);
    else {setFailure(`? Unknown option: ${a}`); return;}
    setStatus(`set ${a || 'shown'}.`);
  };

  const runGolfCommand = () => {
    if (!activeId) {setFailure('No document is open.'); return;}
    const rec = readGolf(activeId);
    const score = golfScore(draft.length, Math.max(1, keysRef.current), cmdsRef.current);
    setStatus(`⛳ this session ${score} (best ${Math.max(rec.best, score)}). ${golfVerdict(score)}`);
  };

  const runHistoryCommand = () => {
    setOverlay('snapshots');
    setStatus('Snapshots live below the editor. :restore <n> brings one back.');
  };

  const runRestoreCommand = (args: string) => {
    if (!activeId) {setFailure('No document is open.'); return;}
    const snaps = readSnapshots(activeId);
    const n = parseInt(args, 10);
    if (Number.isNaN(n) || n < 1 || n > snaps.length) {
      setFailure(`? Pick 1–${snaps.length || 0}. See :history.`);
      return;
    }
    const snap = snaps[n - 1];
    if (isDirty && !window.confirm(`Replace current draft with snapshot ${n}?`)) return;
    pushUndo();
    setDraft(snap.content);
    setStatus(`Restored snapshot ${n} from ${new Date(snap.ts).toLocaleString()}.`);
  };

  const runAchievementsCommand = () => {
    setOverlay('achievements');
    setStatus('The trophy shelf. The clerk polished it. Briefly.');
  };

  const runPreviewCommand = (args: string) => {
    const a = args.trim().toLowerCase();
    if (a === 'off' || a === 'no' || a === '!' ) setPreview(false);
    else if (a === '' ) setPreview(p => !p);
    else setPreview(true);
    setStatus(preview ? 'Preview off. Raw markdown, like nature intended.' : 'Preview on. Look at you, formatting.');
  };

  const runExCommand = (rawCommand: string) => {
    const trimmed = rawCommand.trim();
    const space = trimmed.search(/\s/);
    const head = space === -1 ? trimmed : trimmed.slice(0, space);
    const rest = space === -1 ? '' : trimmed.slice(space).trim();
    switch (head) {
      case 'set': runSetCommand(rest); break;
      case 'golf': runGolfCommand(); break;
      case 'history':
      case 'snapshots': runHistoryCommand(); break;
      case 'restore': runRestoreCommand(rest); break;
      case 'achievements': runAchievementsCommand(); break;
      case 'preview': runPreviewCommand(rest); break;
      case 'gloom':
      case 'candle':
        updateSettings({...settings, gloom: rest === 'off' || rest === 'no' ? false : true});
        setStatus(settings.gloom ? 'Candle blown out.' : 'Candle lit. Only this line matters now.');
        break;
      case 'wq':
        if (saveDocument()) {
          const ach = achRef.current;
          if (!ach.unlocked.includes('first-wq')) {
            achRef.current = {...ach, unlocked: [...ach.unlocked, 'first-wq']};
            writeAch(achRef.current);
            setStatus('Written, back to the library. ★ First :wq');
          }
          closeDocument(true);
        }
        break;
      default: runCommand(rawCommand);
    }
    const t = pushTape(trimmed);
    setTape(t);
  };

  const stepConfirm = (decision: 'y' | 'n' | 'a' | 'q') => {
    if (!confirm) return;
    if (decision === 'q') {
      setConfirm(null);
      setStatus('Substitute stopped. The rest live to see another day.');
      focusEditor();
      return;
    }
    const base = confirmDraft || draft;
    if (decision === 'a') {
      const head = base.slice(0, confirmPos);
      const tail = base.slice(confirmPos);
      const {draft: doneTail} = applySubstitute(tail, 0, Math.max(0, tail.split('\n').length - 1), confirm.pattern, confirm.replacement, true);
      pushUndo();
      setDraft(head + doneTail);
      gcConfirms.current += confirm.matches;
      awardCheck();
      setConfirm(null);
      setStatus('All remaining matches replaced.');
      focusEditor();
      return;
    }
    const idx = base.indexOf(confirm.pattern, confirmPos);
    if (idx === -1) {
      pushUndo();
      setDraft(base);
      setConfirm(null);
      setStatus('Substitute finished.');
      focusEditor();
      return;
    }
    if (decision === 'y') {
      gcConfirms.current += 1;
      const next = base.slice(0, idx) + confirm.replacement + base.slice(idx + confirm.pattern.length);
      setConfirmDraft(next);
      setConfirmPos(idx + confirm.replacement.length);
      setStatus('Replaced. y/n/a/q for the next.');
    } else {
      setConfirmDraft(base);
      setConfirmPos(idx + confirm.pattern.length);
      setStatus('Skipped. y/n/a/q for the next.');
    }
    awardCheck();
  };

  const repeatLast = () => {
    const r = lastRepeat.current;
    if (!r) {
      setFailure('Nothing to repeat yet.');
      return;
    }
    const editor = editorRef.current;
    const caret = editor?.selectionStart ?? 0;
    if (r.op === 'x') {
      if (caret < draft.length) {
        pushUndo(caret);
        setDraft(draft.slice(0, caret) + draft.slice(caret + r.count));
      }
    } else if (r.op === 'dd') {
      deleteCurrentLine(r.count);
    }
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    keysRef.current += 1;
    achRef.current = {...achRef.current, mouseFreeStreak: achRef.current.mouseFreeStreak + 1};

    if (confirm) {
      const k = event.key.toLowerCase();
      if (k === 'y' || k === 'n' || k === 'a' || k === 'q' || event.key === 'Escape') {
        event.preventDefault();
        if (event.key === 'Escape') stepConfirm('q');
        else stepConfirm(k as 'y' | 'n' | 'a' | 'q');
      }
      return;
    }

    if (event.key === 'Escape' && mode === 'INSERT') {
      event.preventDefault();
      pushUndo();
      setMode('NORMAL');
      setStatus('NORMAL');
      focusEditor(editorRef.current?.selectionStart ?? 0);
      return;
    }
    if (mode !== 'NORMAL') return;

    const editor = event.currentTarget;
    const caret = editor.selectionStart;
    const count = countRef.current === '' ? 1 : parseInt(countRef.current, 10);

    if (pendingOpRef.current) {
      const pending = pendingOpRef.current;
      if (event.key === 'Escape') {
        pendingOpRef.current = null;
        countRef.current = '';
        event.preventDefault();
        return;
      }
      if (pending.op === 'g' && (event.key === 'g')) {
        event.preventDefault();
        pendingOpRef.current = null;
        const n = countRef.current === '' ? 1 : parseInt(countRef.current, 10);
        countRef.current = '';
        const lines = draft.split('\n');
        const offs = lineOffsets(draft);
        const target = n === 1 && countRef.current === '' ? 0 : Math.max(0, Math.min(n - 1, lines.length - 1));
        editor.setSelectionRange(offs[target], offs[target]);
        setStatus(`Ln ${target + 1}`);
        return;
      }
      if (pending.op === 'd' && event.key === 'd') {
        event.preventDefault();
        pendingOpRef.current = null;
        countRef.current = '';
        lastRepeat.current = {op: 'dd', count};
        deleteCurrentLine(count);
        return;
      }
      if (pending.op === 'y' && event.key === 'y') {
        event.preventDefault();
        pendingOpRef.current = null;
        countRef.current = '';
        yankLine(count);
        return;
      }
      pendingOpRef.current = null;
      countRef.current = '';
    }

    if (/^[1-9]$/.test(event.key)) {
      countRef.current += event.key;
      event.preventDefault();
      return;
    }

    const consumeCount = () => {
      const c = countRef.current === '' ? 1 : parseInt(countRef.current, 10);
      countRef.current = '';
      return c;
    };

    const keyMap: Record<string, 'left' | 'right' | 'up' | 'down'> = {
      ArrowLeft: 'left', h: 'left',
      ArrowRight: 'right', l: 'right',
      ArrowUp: 'up', k: 'up',
      ArrowDown: 'down', j: 'down',
    };
    if (event.key === 'h' || event.key === 'j' || event.key === 'k' || event.key === 'l') {
      hjklStreak.current += 1;
    } else {
      hjklStreak.current = 0;
    }

    if (event.key === ':') {
      event.preventDefault();
      consumeCount();
      setMode('COMMAND');
      setCommand('');
    } else if (event.key === 'i') {
      event.preventDefault();
      consumeCount();
      insertMode(false);
    } else if (event.key === 'I') {
      event.preventDefault();
      consumeCount();
      moveCursor('start');
      insertMode(false);
    } else if (event.key === 'a') {
      event.preventDefault();
      consumeCount();
      insertMode(true);
    } else if (event.key === 'A') {
      event.preventDefault();
      consumeCount();
      moveCursor('end');
      insertMode(true);
    } else if (event.key === 'o') {
      event.preventDefault();
      consumeCount();
      pushUndo(caret);
      const {end} = currentLineRange();
      const next = `${draft.slice(0, end)}\n${draft.slice(end)}`;
      setDraft(next);
      requestAnimationFrame(() => editorRef.current?.setSelectionRange(end + 1, end + 1));
      setMode('INSERT');
      setStatus('INSERT — press Esc to return to normal mode.');
    } else if (event.key === 'O') {
      event.preventDefault();
      consumeCount();
      pushUndo(caret);
      const {start} = currentLineRange();
      const next = `${draft.slice(0, start)}\n${draft.slice(start)}`;
      setDraft(next);
      requestAnimationFrame(() => editorRef.current?.setSelectionRange(start, start));
      setMode('INSERT');
      setStatus('INSERT — press Esc to return to normal mode.');
    } else if (event.key === 'x') {
      event.preventDefault();
      const c = consumeCount();
      if (caret < draft.length) {
        pushUndo(caret);
        setDraft(draft.slice(0, caret) + draft.slice(caret + c));
        lastRepeat.current = {op: 'x', count: c};
        achRef.current = {...achRef.current, xDeletes: achRef.current.xDeletes + c};
        writeAch(achRef.current);
        awardCheck();
        if (settings.sound) softTick();
      }
    } else if (event.key === 'd') {
      event.preventDefault();
      if (countRef.current !== '') {deleteCurrentLine(consumeCount()); lastRepeat.current = {op: 'dd', count: 1};}
      else pendingOpRef.current = {op: 'd', count: ''};
    } else if (event.key === 'y') {
      event.preventDefault();
      consumeCount();
      pendingOpRef.current = {op: 'y', count: ''};
    } else if (event.key === 'g') {
      event.preventDefault();
      consumeCount();
      pendingOpRef.current = {op: 'g', count: ''};
    } else if (event.key === 'G') {
      event.preventDefault();
      const lines = draft.split('\n');
      const offs = lineOffsets(draft);
      const hasCount = countRef.current !== '';
      const n = hasCount ? parseInt(countRef.current, 10) : lines.length;
      countRef.current = '';
      const target = Math.max(0, Math.min(n - 1, lines.length - 1));
      editor.setSelectionRange(offs[target], offs[target]);
      setStatus(`Ln ${target + 1}`);
    } else if (event.key === 'p') {
      event.preventDefault();
      consumeCount();
      const {start, end} = currentLineRange();
      if (countRef.current === '' && event.shiftKey === false) {
        pasteRegister(false);
      } else {
        setStatus(draft.slice(start, end) || '(empty line)');
      }
    } else if (event.key === 'P') {
      event.preventDefault();
      consumeCount();
      pasteRegister(true);
    } else if (event.key === 'u') {
      event.preventDefault();
      consumeCount();
      const prev = undoRef.current.undo({draft, caret});
      if (!prev) setFailure('Nothing to undo.');
      else {
        setDraft(prev.draft);
        focusEditor(prev.caret);
        setStatus('Undone.');
      }
    } else if (event.key === 'r' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      consumeCount();
      const nxt = undoRef.current.redo({draft, caret});
      if (!nxt) setFailure('Nothing to redo.');
      else {
        setDraft(nxt.draft);
        focusEditor(nxt.caret);
        setStatus('Redone.');
      }
    } else if (event.key === 'w' || event.key === 'W') {
      event.preventDefault();
      const c = consumeCount();
      editor.setSelectionRange(nextWordStart(draft, caret, event.key === 'W', c), nextWordStart(draft, caret, event.key === 'W', c));
    } else if (event.key === 'b' || event.key === 'B') {
      event.preventDefault();
      const c = consumeCount();
      editor.setSelectionRange(prevWordStart(draft, caret, event.key === 'B', c), prevWordStart(draft, caret, event.key === 'B', c));
    } else if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      const c = consumeCount();
      void event.key;
      const pos = wordEnd(draft, caret, c);
      editor.setSelectionRange(pos, pos);
    } else if (event.key === 'J') {
      event.preventDefault();
      consumeCount();
      const {end} = currentLineRange();
      if (end < draft.length) {
        pushUndo(caret);
        const next = draft.slice(0, end) + ' ' + draft.slice(end + 1).replace(/^\s+/, '');
        setDraft(next);
        focusEditor(end);
        setStatus('Joined.');
      }
    } else if (event.key === 'D') {
      event.preventDefault();
      consumeCount();
      const {end} = currentLineRange();
      pushUndo(caret);
      registerRef.current.unnamed = draft.slice(caret, end);
      setDraft(draft.slice(0, caret) + draft.slice(end));
      focusEditor(caret);
      setStatus('Deleted to end of line.');
    } else if (event.key === 'C') {
      event.preventDefault();
      consumeCount();
      const {end} = currentLineRange();
      pushUndo(caret);
      registerRef.current.unnamed = draft.slice(caret, end);
      setDraft(draft.slice(0, caret) + draft.slice(end));
      setMode('INSERT');
      setStatus('INSERT — press Esc to return to normal mode.');
      requestAnimationFrame(() => editorRef.current?.focus());
    } else if (event.key === 'r' || event.key === '~') {
      if (event.key === '~') {
        event.preventDefault();
        const c = consumeCount();
        if (caret < draft.length) {
          pushUndo(caret);
          const ch = draft[caret];
          const flipped = ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase();
          setDraft(draft.slice(0, caret) + flipped + draft.slice(caret + 1));
          editor.setSelectionRange(Math.min(caret + c, draft.length), Math.min(caret + c, draft.length));
        }
      } else {
        event.preventDefault();
        consumeCount();
        setPendingReplace(true);
        setStatus('r? type a character to replace.');
      }
    } else if (pendingReplace && event.key.length === 1) {
      event.preventDefault();
      setPendingReplace(false);
      consumeCount();
      if (caret < draft.length) {
        pushUndo(caret);
        setDraft(draft.slice(0, caret) + event.key + draft.slice(caret + 1));
        setStatus(`Replaced with ${event.key}.`);
      }
    } else if (event.key === '.') {
      event.preventDefault();
      consumeCount();
      repeatLast();
    } else if (event.key === 'n' || event.key === 'N') {
      event.preventDefault();
      consumeCount();
      if (!lastSearch) setFailure('No previous search.');
      else {
        const idx = event.key === 'n'
          ? draft.indexOf(lastSearch, caret + 1)
          : draft.lastIndexOf(lastSearch, caret - 1);
        if (idx === -1) setFailure(`? Pattern not found: ${lastSearch}`);
        else {
          editor.setSelectionRange(idx, idx);
          setStatus(`Ln ${draft.slice(0, idx).split('\n').length}`);
        }
      }
    } else if (event.key === '/' ) {
      event.preventDefault();
      consumeCount();
      setMode('COMMAND');
      setCommand('/');
    } else if (event.key === '>') {
      event.preventDefault();
      consumeCount();
      const {start, end} = currentLineRange();
      pushUndo(caret);
      setDraft(`${draft.slice(0, start)}  ${draft.slice(start, end)}${draft.slice(end)}`);
    } else if (event.key === '<') {
      event.preventDefault();
      consumeCount();
      const {start, end} = currentLineRange();
      pushUndo(caret);
      const line = draft.slice(start, end).replace(/^  /, '');
      setDraft(draft.slice(0, start) + line + draft.slice(end));
    } else if (event.key === 'Home' || event.key === '0') {
      event.preventDefault();
      consumeCount();
      moveCursor('start');
    } else if (event.key === 'End' || event.key === '$') {
      event.preventDefault();
      consumeCount();
      moveCursor('end');
    } else if (keyMap[event.key]) {
      event.preventDefault();
      consumeCount();
      moveCursor(keyMap[event.key]);
    } else {
      countRef.current = '';
      pendingOpRef.current = null;
    }
  };

  const importMarkdown = async (file: File | undefined) => {
    if (!file) return;
    if (!canLeaveEditor()) {
      if (importRef.current) importRef.current.value = '';
      return;
    }
    try {
      const content = await file.text();
      const title = file.name.replace(/\.(md|markdown)$/i, '') || 'Imported document';
      const imported = {...createDocument(title), content};
      if (persist([...documents, imported])) {
        undoRef.current.clear();
        setActiveId(imported.id);
        setDraftTitle(imported.title);
        setDraft(imported.content);
        setMode('NORMAL');
        setStatus(`Imported ${file.name}`);
      }
    } catch (error) {
      const message = `Could not import ${file.name}: ${error instanceof Error ? error.message : String(error)}`;
      setFailure(message);
    } finally {
      if (importRef.current) importRef.current.value = '';
    }
  };

  const removeDocument = (document: DocumentRecord) => {
    if (activeId === document.id && !canLeaveEditor()) return;
    if (!window.confirm(`Delete "${document.title}" from this browser?`)) return;
    const next = documents.filter(item => item.id !== document.id);
    if (!persist(next)) return;
    if (activeId === document.id) setActiveId(null);
    setStatus(`Deleted ${document.title}`);
  };

  const resetUnreadableLibrary = () => {
    if (!window.confirm('The saved library cannot be read. Clear it from this browser? This cannot be undone.')) return;
    try {
      clearLibrary();
      setLibraryReadError(null);
      setDocuments([]);
      setStatus('Local library cleared.');
    } catch (error) {
      setFailure(`Could not clear local documents: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const replayTape = (entry: string) => {
    setOverlay(null);
    setTimeout(() => runExCommand(entry.replace(/^:/, '')), 0);
  };

  const snaps = activeId ? readSnapshots(activeId) : [];
  const ach = achRef.current;

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={event => {event.preventDefault(); if (canLeaveEditor()) setActiveId(null);}}>
          <span className="brand-mark">e</span>
          <span>ed-docs</span>
        </a>
        <div className="topbar-right">
          <span className={`connection ${isOnline ? 'is-online' : 'is-offline'}`}>
            <span className="connection-dot" />
            {isOnline ? 'Online' : 'Offline'}
          </span>
          <span className={`offline-ready ${offlineReady ? 'ready' : ''}`} title={offlineError ?? 'App cache status'}>
            {offlineReady ? 'Offline ready' : offlineError ? 'Offline unavailable' : 'Preparing offline'}
          </span>
          {activeDocument && (
            <button className="button button-light" onClick={exportDocument}>Export .md</button>
          )}
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar">
          <div className="sidebar-heading">
            <div>
              <p className="eyebrow">YOUR SPACE</p>
              <h1>Documents</h1>
            </div>
            <span className="doc-count">{documents.length}</span>
          </div>
          {libraryReadError && (
            <div className="storage-error" role="alert">
              <p>{status.replace(/^\?\s?/, '')}</p>
              <button className="button button-outline" onClick={resetUnreadableLibrary}>Clear unreadable data</button>
            </div>
          )}
          {!libraryReadError && status.startsWith('?') && <p className="storage-error" role="alert">{status}</p>}
          <button className="button button-primary new-document" onClick={() => makeDocument()}>
            <span aria-hidden="true">+</span> New document
          </button>
          <button className="button button-outline import-button" onClick={() => importRef.current?.click()}>
            Import Markdown
          </button>
          <input
            ref={importRef}
            className="visually-hidden"
            type="file"
            accept=".md,.markdown,text/markdown,text/plain"
            onChange={event => void importMarkdown(event.currentTarget.files?.[0])}
          />
          <nav className="document-list" aria-label="Documents">
            {documents.length === 0 ? (
              <p className="empty-list">Your library is empty. Start with a new document or import a Markdown file.</p>
            ) : documents.map(document => (
              <div className={`document-row ${document.id === activeId ? 'selected' : ''}`} key={document.id}>
                <button className="document-link" onClick={() => openDocument(document)}>
                  <span className="document-icon" aria-hidden="true">M↓</span>
                  <span className="document-details">
                    <span className="document-title">{document.title}</span>
                    <span className="document-date">{new Date(document.updatedAt).toLocaleDateString()}</span>
                  </span>
                </button>
                <button
                  className="delete-document"
                  aria-label={`Delete ${document.title}`}
                  title="Delete document"
                  onClick={() => removeDocument(document)}
                >×</button>
              </div>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="note-icon" aria-hidden="true">⌘</span>
            <p>Local by default.<br />No account. No sync. No surprises.</p>
          </div>
          {ach.unlocked.length > 0 && (
            <div className="sidebar-trophies" title={ach.unlocked.join(', ')}>
              ★ {ach.unlocked.length} {ach.unlocked.length === 1 ? 'trophy' : 'trophies'}
            </div>
          )}
        </aside>

        <section className="editor-area">
          {activeDocument ? (
            <>
              <div className="editor-toolbar">
                <div className="breadcrumb"><span>Documents</span><span className="crumb-divider">/</span><span>{draftTitle || 'Untitled document'}</span></div>
                <div className="document-actions">
                  <span className={`save-state ${isDirty ? 'dirty' : ''}`} aria-live="polite">
                    <span className="save-dot" />{isDirty ? 'Unsaved changes' : 'Saved'}
                  </span>
                  <button className="button button-outline preview-toggle" onClick={() => setPreview(p => !p)}>{preview ? 'Edit' : 'Preview'}</button>
                  <button className="button button-primary save-button" onClick={() => saveDocument()}>Write <kbd>⌘ S</kbd></button>
                </div>
              </div>
              <div className={`editor-card ${writing ? 'is-writing' : ''}`}>
                {writing && <div className="written-stamp" aria-hidden="true">WRITTEN</div>}
                <label className="visually-hidden" htmlFor="document-title">Document title</label>
                <input
                  id="document-title"
                  className="title-input"
                  value={draftTitle}
                  onChange={event => setDraftTitle(event.target.value)}
                  placeholder="Untitled document"
                  spellCheck={false}
                />
                <div className={`mode-label ${mode.toLowerCase()}`}>{confirm ? 'CONFIRM' : mode}{confirm ? ' — y/n/a/q' : ''}</div>
                {preview ? (
                  <div className="preview-pane" dangerouslySetInnerHTML={{__html: renderMarkdown(draft) || '<p class="md-empty">Nothing to preview yet.</p>'}} />
                ) : (
                <div className="editor-frame">
                  <div className="line-numbers" aria-hidden="true">
                    {Array.from({length: lineCount}, (_, index) => <span key={index}>{index + 1}</span>)}
                  </div>
                  <textarea
                    ref={editorRef}
                    className="document-editor"
                    aria-label="Markdown document editor"
                    value={confirm && confirmDraft ? confirmDraft : draft}
                    onChange={event => {if (!confirm) setDraft(event.target.value);}}
                    onKeyDown={handleEditorKeyDown}
                    onMouseDown={() => {achRef.current = {...achRef.current, mouseFreeStreak: 0};}}
                    readOnly={mode !== 'INSERT'}
                    placeholder={mode === 'INSERT' ? 'Start writing…' : 'Press i to start writing…'}
                    spellCheck
                    autoCapitalize="sentences"
                  />
                </div>
                )}
                <div className="editor-footer">
                  <span>Markdown <span className="footer-divider">·</span> {lineCount} lines <span className="footer-divider">·</span> {stats.words} words <span className="footer-divider">·</span> ~{stats.minutes} min <span className="footer-divider">·</span> Ln {caretInfo.line}, Col {caretInfo.col}</span>
                  <span>Stored in this browser</span>
                </div>
              </div>
              {overlay === 'help' && (
                <div className="overlay-card" role="dialog" aria-label="Command help">
                  <div className="overlay-head"><strong>:help</strong><button className="button button-outline overlay-close" onClick={() => {setOverlay(null); focusEditor();}}>Close <kbd>Esc</kbd></button></div>
                  <div className="overlay-grid">
                    <div><h4>Addresses</h4><p><code>:3</code> goto line · <code>:1,5p</code> print · <code>:%d</code> all · <code>.,$</code> here to end</p></div>
                    <div><h4>Write &amp; quit</h4><p><code>:w [file]</code> save · <code>:q[!]</code> quit · <code>:wq</code> both · <code>:e[!] t</code> open</p></div>
                    <div><h4>Substitute</h4><p><code>:s/a/b/g</code> · <code>:%s/a/b/gc</code> confirm · <code>/pat</code> <code>n/N</code></p></div>
                    <div><h4>Normal</h4><p><code>w b e</code> words · <code>gg G</code> top/bottom · <code>A I O</code> · <code>r ~ J D C</code> · <code>yy p P u .</code> · <code>q:</code> tape</p></div>
                    <div><h4>View</h4><p><code>:preview</code> toggle · <code>:history</code> <code>:restore N</code> · <code>:golf</code> score</p></div>
                    <div><h4>Fun</h4><p><code>:gloom</code> candle mode · <code>:achievements</code> trophies · <code>:set sound|clerk=off|mild|full</code></p></div>
                  </div>
                </div>
              )}
              {overlay === 'tape' && (
                <div className="overlay-card" role="dialog" aria-label="Command tape">
                  <div className="overlay-head"><strong>q: command tape</strong><button className="button button-outline overlay-close" onClick={() => {setOverlay(null); focusEditor();}}>Close <kbd>Esc</kbd></button></div>
                  {tape.length === 0 ? <p className="overlay-empty">No commands yet. Run something with : first.</p> : (
                  <ul className="tape-list">
                    {tape.map((entry, i) => (
                      <li key={`${i}-${entry}`} className={i === tapeIndex ? 'tape-selected' : ''}>
                        <button onClick={() => replayTape(entry)} onMouseEnter={() => setTapeIndex(i)}>
                          <span className="tape-num">{i + 1}</span><code>:{entry}</code>
                        </button>
                      </li>
                    ))}
                  </ul>
                  )}
                </div>
              )}
              {overlay === 'achievements' && (
                <div className="overlay-card" role="dialog" aria-label="Achievements">
                  <div className="overlay-head"><strong>Achievements</strong><button className="button button-outline overlay-close" onClick={() => {setOverlay(null); focusEditor();}}>Close <kbd>Esc</kbd></button></div>
                  <ul className="ach-list">
                    {ACHIEVEMENTS.map(a => (
                      <li key={a.id} className={ach.unlocked.includes(a.id) ? 'ach-unlocked' : 'ach-locked'}>
                        <span aria-hidden="true">{ach.unlocked.includes(a.id) ? '★' : '☆'}</span>
                        <span><strong>{a.title}</strong> — {a.desc}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {overlay === 'snapshots' && (
                <div className="overlay-card" role="dialog" aria-label="Snapshots">
                  <div className="overlay-head"><strong>:history — snapshots on every :w</strong><button className="button button-outline overlay-close" onClick={() => {setOverlay(null); focusEditor();}}>Close <kbd>Esc</kbd></button></div>
                  {snaps.length === 0 ? <p className="overlay-empty">No snapshots yet. :w first.</p> : (
                  <ul className="snap-list">
                    {snaps.map((s, i) => (
                      <li key={`${s.ts}-${i}`}>
                        <button onClick={() => runRestoreCommand(String(i + 1))}>
                          <span className="tape-num">{i + 1}</span>
                          <span>{new Date(s.ts).toLocaleString()} — {s.lines} lines</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  )}
                </div>
              )}
              <form className="command-bar" onSubmit={event => {
                event.preventDefault();
                if (overlay === 'tape' && tape[tapeIndex]) {
                  replayTape(tape[tapeIndex]);
                } else if (command.startsWith('/')) {
                  runCommand(command);
                } else {
                  runExCommand(command.replace(/^:/, ''));
                }
                requestAnimationFrame(() => editorRef.current?.focus());
              }}>
                <label htmlFor="command-input" className="command-prefix">{mode === 'COMMAND' ? ':' : '>'}</label>
                <input
                  ref={commandRef}
                  id="command-input"
                  value={command}
                  onFocus={() => {if (mode !== 'COMMAND') setMode('COMMAND');}}
                  onBlur={() => {if (mode === 'COMMAND') setMode('NORMAL');}}
                  onChange={event => setCommand(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === 'Escape') {setCommand(''); setMode('NORMAL'); setOverlay(null); editorRef.current?.focus();}
                    if (overlay === 'tape' && event.key === 'ArrowUp') {event.preventDefault(); setTapeIndex(i => Math.max(0, i - 1));}
                    if (overlay === 'tape' && event.key === 'ArrowDown') {event.preventDefault(); setTapeIndex(i => Math.min(tape.length - 1, i + 1));}
                  }}
                  placeholder="Type a command — try help"
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="command-hint">Enter to run <kbd>Esc</kbd></span>
              </form>
              <div className={`status-line ${status.startsWith('?') ? 'status-error' : ''}`} role="status">
                <span className="status-prompt">{status.startsWith('?') ? '?' : status.startsWith('★') || status.includes('★') ? '★' : '●'}</span>
                <span>{status.replace(/^\?\s?/, '')}</span>
                <span className="status-shortcuts">i insert <b>·</b> : command <b>·</b> q: tape <b>·</b> Esc normal</span>
              </div>
            </>
          ) : (
            <div className="welcome">
              <div className="welcome-card">
                <div className="welcome-symbol">e<span>.</span></div>
                <p className="eyebrow">A QUIETER KIND OF DOCUMENT</p>
                <h2>Just you and the page.</h2>
                <p className="welcome-copy">Write in Markdown. Work offline. Save when you mean it. Your documents stay in this browser unless you export them.</p>
                <button className="button button-primary welcome-button" onClick={() => makeDocument()}>
                  <span aria-hidden="true">+</span> Create your first document
                </button>
                <div className="welcome-prompt"><kbd>i</kbd> to insert <span>·</span> <kbd>Esc</kbd> to stop <span>·</span> <kbd>:w</kbd> to write</div>
              </div>
            </div>
          )}
        </section>
      </div>
      <footer className="app-footer">
        <span>ed-docs <span className="footer-divider">·</span> offline-first, intentionally small</span>
        <span>{offlineError ? 'Offline cache unavailable' : offlineReady ? 'App shell cached for offline use' : 'Offline cache initializing'}</span>
      </footer>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
