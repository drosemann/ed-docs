export type EditorMode = 'NORMAL' | 'INSERT' | 'COMMAND';

export type DocumentRecord = {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
};

export type LineRange = {startLine: number; endLine: number};

export type ParsedCommand = {
  range: LineRange | null;
  name: string;
  args: string;
  raw: string;
};

export type UndoEntry = {draft: string; caret: number};

export type CommandResult = {
  draft?: string;
  caret?: number | null;
  status: string;
  error?: boolean;
  closeEditor?: boolean;
  downloadAs?: string;
};

export type CommandContext = {
  draft: string;
  caret: number;
  draftTitle: string;
  lastSearch: string;
  setLastSearch: (pattern: string) => void;
  pushUndo: (entry: UndoEntry) => void;
};
