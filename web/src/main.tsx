import React, {useEffect, useRef, useState} from 'react';
import {createRoot} from 'react-dom/client';
import './styles.css';

type DocumentRecord = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

type EditorMode = 'NORMAL' | 'INSERT' | 'COMMAND';

const STORAGE_KEY = 'ed-docs.library.v1';

function readLibrary(): {documents: DocumentRecord[]; error: string | null} {
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

function createDocument(title: string): DocumentRecord {
  return {
    id: crypto.randomUUID(),
    title: title.trim() || 'Untitled document',
    content: '',
    updatedAt: new Date().toISOString(),
  };
}

function App() {
  const [initialLibrary] = useState(readLibrary);
  const [libraryReadError, setLibraryReadError] = useState(initialLibrary.error);
  const [documents, setDocuments] = useState(initialLibrary.documents);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [mode, setMode] = useState<EditorMode>('NORMAL');
  const [command, setCommand] = useState('');
  const [status, setStatus] = useState(initialLibrary.error ? `? ${initialLibrary.error}` : 'Ready. Your documents stay in this browser.');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const commandRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const activeDocument = documents.find(document => document.id === activeId) ?? null;
  const isDirty = activeDocument !== null &&
    (draft !== activeDocument.content || draftTitle !== activeDocument.title);
  const lineCount = draft.split('\n').length;

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

  const setFailure = (message: string) => setStatus(`? ${message}`);

  const persist = (next: DocumentRecord[]) => {
    if (libraryReadError) {
      setFailure('Local data could not be loaded; refusing to overwrite it.');
      return false;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setDocuments(next);
      return true;
    } catch (error) {
      setFailure(`Could not write local documents: ${error instanceof Error ? error.message : String(error)}`);
      return false;
    }
  };

  const canLeaveEditor = () => !isDirty || window.confirm('Discard unsaved edits? Use :w to save them first.');

  const openDocument = (document: DocumentRecord) => {
    if (!canLeaveEditor()) return;
    setActiveId(document.id);
    setDraftTitle(document.title);
    setDraft(document.content);
    setMode('NORMAL');
    setStatus(`Opened ${document.title}`);
  };

  const makeDocument = (title = 'Untitled document') => {
    if (!canLeaveEditor()) return;
    const document = createDocument(title);
    if (!persist([...documents, document])) return;
    setActiveId(document.id);
    setDraftTitle(document.title);
    setDraft('');
    setMode('NORMAL');
    setStatus(`Created ${document.title}. Use :w to write changes.`);
  };

  const saveDocument = () => {
    if (!activeDocument) {
      setFailure('No document is open.');
      return false;
    }
    const title = draftTitle.trim() || 'Untitled document';
    const saved: DocumentRecord = {...activeDocument, title, content: draft, updatedAt: new Date().toISOString()};
    if (!persist(documents.map(document => document.id === saved.id ? saved : document))) return false;
    setDraftTitle(title);
    setStatus(`${lineCount} line${lineCount === 1 ? '' : 's'} written to this browser.`);
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
  }, [activeId, draft, draftTitle, documents]);

  const closeDocument = () => {
    if (!canLeaveEditor()) return;
    setActiveId(null);
    setMode('NORMAL');
    setStatus('Back to the library.');
  };

  const exportDocument = () => {
    if (!activeDocument) return;
    const safeName = (draftTitle.trim() || 'untitled').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');
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

  const deleteCurrentLine = () => {
    const {start, end} = currentLineRange();
    let from = start;
    let to = end;
    if (to < draft.length) to += 1;
    else if (from > 0) from -= 1;
    const next = draft.slice(0, from) + draft.slice(to);
    setDraft(next || '');
    requestAnimationFrame(() => editorRef.current?.setSelectionRange(Math.min(from, next.length), Math.min(from, next.length)));
    setStatus('1 line deleted.');
  };

  const runCommand = (rawCommand: string) => {
    const trimmed = rawCommand.trim();
    const [name, ...argumentParts] = trimmed.split(/\s+/);
    const argument = argumentParts.join(' ').trim();
    switch (name) {
      case 'w':
        saveDocument();
        break;
      case 'q':
        closeDocument();
        break;
      case 'wq':
        if (saveDocument()) {
          setActiveId(null);
          setMode('NORMAL');
          setStatus('Written, back to the library.');
        }
        break;
      case 'i':
        insertMode(false);
        break;
      case 'a':
        insertMode(true);
        break;
      case 'd':
        deleteCurrentLine();
        break;
      case 'p': {
        const {start, end} = currentLineRange();
        setStatus(`${draft.slice(start, end) || '(empty line)'}`);
        break;
      }
      case 'new':
        makeDocument(argument || 'Untitled document');
        break;
      case 'e': {
        const target = documents.find(document =>
          document.title.toLocaleLowerCase() === argument.toLocaleLowerCase()
        );
        if (target) openDocument(target);
        else setFailure(`No document titled "${argument}".`);
        break;
      }
      case 'help':
        setStatus('Commands: w, q, wq, a, i, d, p, new [title], e <title>, help');
        break;
      case '':
        break;
      default:
        setFailure(`Unknown command: ${trimmed}`);
    }
    setCommand('');
    setMode(current => current === 'COMMAND' ? 'NORMAL' : current);
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Escape' && mode === 'INSERT') {
      event.preventDefault();
      setMode('NORMAL');
      setStatus('NORMAL');
      editorRef.current?.focus();
      return;
    }
    if (mode !== 'NORMAL') return;
    const keyMap: Record<string, 'left' | 'right' | 'up' | 'down'> = {
      ArrowLeft: 'left', h: 'left',
      ArrowRight: 'right', l: 'right',
      ArrowUp: 'up', k: 'up',
      ArrowDown: 'down', j: 'down',
    };
    if (event.key === ':') {
      event.preventDefault();
      setMode('COMMAND');
      setCommand('');
    } else if (event.key === 'i') {
      event.preventDefault();
      insertMode(false);
    } else if (event.key === 'a') {
      event.preventDefault();
      insertMode(true);
    } else if (event.key === 'o') {
      event.preventDefault();
      const {end} = currentLineRange();
      const next = `${draft.slice(0, end)}\n${draft.slice(end)}`;
      setDraft(next);
      requestAnimationFrame(() => editorRef.current?.setSelectionRange(end + 1, end + 1));
      setMode('INSERT');
      setStatus('INSERT — press Esc to return to normal mode.');
    } else if (event.key === 'x') {
      event.preventDefault();
      const caret = event.currentTarget.selectionStart;
      if (caret < draft.length) setDraft(draft.slice(0, caret) + draft.slice(caret + 1));
    } else if (event.key === 'd') {
      event.preventDefault();
      deleteCurrentLine();
    } else if (event.key === 'p') {
      event.preventDefault();
      const {start, end} = currentLineRange();
      setStatus(draft.slice(start, end) || '(empty line)');
    } else if (event.key === 'Home' || event.key === '0') {
      event.preventDefault();
      moveCursor('start');
    } else if (event.key === 'End' || event.key === '$') {
      event.preventDefault();
      moveCursor('end');
    } else if (keyMap[event.key]) {
      event.preventDefault();
      moveCursor(keyMap[event.key]);
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
      localStorage.removeItem(STORAGE_KEY);
      setLibraryReadError(null);
      setDocuments([]);
      setStatus('Local library cleared.');
    } catch (error) {
      setFailure(`Could not clear local documents: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

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
                  <button className="button button-primary save-button" onClick={saveDocument}>Write <kbd>⌘ S</kbd></button>
                </div>
              </div>
              <div className="editor-card">
                <label className="visually-hidden" htmlFor="document-title">Document title</label>
                <input
                  id="document-title"
                  className="title-input"
                  value={draftTitle}
                  onChange={event => setDraftTitle(event.target.value)}
                  placeholder="Untitled document"
                  spellCheck={false}
                />
                <div className={`mode-label ${mode.toLowerCase()}`}>{mode}</div>
                <div className="editor-frame">
                  <div className="line-numbers" aria-hidden="true">
                    {Array.from({length: lineCount}, (_, index) => <span key={index}>{index + 1}</span>)}
                  </div>
                  <textarea
                    ref={editorRef}
                    className="document-editor"
                    aria-label="Markdown document editor"
                    value={draft}
                    onChange={event => setDraft(event.target.value)}
                    onKeyDown={handleEditorKeyDown}
                    readOnly={mode !== 'INSERT'}
                    placeholder={mode === 'INSERT' ? 'Start writing…' : 'Press i to start writing…'}
                    spellCheck
                    autoCapitalize="sentences"
                  />
                </div>
                <div className="editor-footer">
                  <span>Markdown <span className="footer-divider">·</span> {lineCount} lines</span>
                  <span>Stored in this browser</span>
                </div>
              </div>
              <form className="command-bar" onSubmit={event => {
                event.preventDefault();
                runCommand(command);
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
                  onKeyDown={event => {if (event.key === 'Escape') {setCommand(''); setMode('NORMAL'); editorRef.current?.focus();}}}
                  placeholder="Type a command — try help"
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="command-hint">Enter to run <kbd>Esc</kbd></span>
              </form>
              <div className={`status-line ${status.startsWith('?') ? 'status-error' : ''}`} role="status">
                <span className="status-prompt">{status.startsWith('?') ? '?' : '●'}</span>
                <span>{status.replace(/^\?\s?/, '')}</span>
                <span className="status-shortcuts">i insert <b>·</b> : command <b>·</b> Esc normal</span>
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
