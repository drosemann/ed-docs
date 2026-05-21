import React, {useMemo, useState} from 'react';
import {render, Box, Text, useInput, useApp} from 'ink';
import fs from 'node:fs';
import path from 'node:path';
import meow from 'meow';

type Mode = 'NORMAL' | 'INSERT' | 'COMMAND';

const loadFile = (filePath?: string): string[] => {
  if (!filePath) return [''];
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/);
    return lines.length > 0 ? lines : [''];
  } catch {
    return [''];
  }
};

const saveFile = (filePath: string | undefined, lines: string[]): string => {
  if (!filePath) return 'No file path provided.';
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
  return `Saved ${lines.length} line(s) to ${filePath}`;
};

const App = ({filePath}: {filePath?: string}) => {
  const {exit} = useApp();
  const [lines, setLines] = useState<string[]>(() => loadFile(filePath));
  const [cursorLine, setCursorLine] = useState(0);
  const [cursorCol, setCursorCol] = useState(0);
  const [mode, setMode] = useState<Mode>('NORMAL');
  const [status, setStatus] = useState('Ready');
  const [command, setCommand] = useState('');

  const currentLine = lines[cursorLine] ?? '';

  const setLine = (lineNumber: number, next: string) => {
    setLines(prev => prev.map((line, index) => (index === lineNumber ? next : line)));
  };

  useInput((input, key) => {
    if (mode === 'INSERT') {
      if (key.escape) {
        setMode('NORMAL');
        setStatus('Exited insert mode');
        return;
      }
      if (key.return) {
        setLines(prev => [...prev.slice(0, cursorLine + 1), '', ...prev.slice(cursorLine + 1)]);
        setCursorLine(prev => prev + 1);
        setCursorCol(0);
        return;
      }
      if (key.backspace || key.delete) {
        if (cursorCol > 0) {
          const next = currentLine.slice(0, cursorCol - 1) + currentLine.slice(cursorCol);
          setLine(cursorLine, next);
          setCursorCol(prev => prev - 1);
        }
        return;
      }
      if (input) {
        const next = currentLine.slice(0, cursorCol) + input + currentLine.slice(cursorCol);
        setLine(cursorLine, next);
        setCursorCol(prev => prev + input.length);
      }
      return;
    }

    if (mode === 'COMMAND') {
      if (key.escape) {
        setMode('NORMAL');
        setCommand('');
        return;
      }
      if (key.return) {
        const trimmed = command.trim();
        if (trimmed === 'q') {
          exit();
          return;
        }
        if (trimmed === 'w') {
          setStatus(saveFile(filePath, lines));
        } else if (trimmed === 'wq') {
          setStatus(saveFile(filePath, lines));
          exit();
          return;
        } else {
          setStatus(`Unknown command: :${trimmed}`);
        }
        setCommand('');
        setMode('NORMAL');
        return;
      }
      if (key.backspace || key.delete) {
        setCommand(prev => prev.slice(0, -1));
        return;
      }
      if (input) setCommand(prev => prev + input);
      return;
    }

    if (input === 'q') exit();
    if (input === 'i') {
      setMode('INSERT');
      setStatus('Insert mode');
    }
    if (input === ':') {
      setMode('COMMAND');
      setCommand('');
    }
    if (key.upArrow || input === 'k') {
      setCursorLine(prev => Math.max(0, prev - 1));
      setCursorCol(prev => Math.min(prev, (lines[Math.max(0, cursorLine - 1)] ?? '').length));
    }
    if (key.downArrow || input === 'j') {
      setCursorLine(prev => Math.min(lines.length - 1, prev + 1));
      setCursorCol(prev => Math.min(prev, (lines[Math.min(lines.length - 1, cursorLine + 1)] ?? '').length));
    }
    if (key.leftArrow || input === 'h') setCursorCol(prev => Math.max(0, prev - 1));
    if (key.rightArrow || input === 'l') setCursorCol(prev => Math.min(currentLine.length, prev + 1));
  });

  const viewport = useMemo(() => {
    const start = Math.max(0, cursorLine - 10);
    const end = Math.min(lines.length, start + 20);
    return lines.slice(start, end).map((line, idx) => {
      const ln = start + idx;
      const active = ln === cursorLine;
      return {ln, line, active};
    });
  }, [cursorLine, lines]);

  return (
    <Box flexDirection="column">
      <Box borderStyle="round" borderColor="cyan" flexDirection="column" paddingX={1}>
        <Text color="cyanBright">Synapse TUI — React + Ink</Text>
        {viewport.map(({ln, line, active}) => (
          <Text key={ln} color={active ? 'green' : undefined}>
            {String(ln + 1).padStart(4, ' ')} {active ? '▶' : ' '} {line || ' '}
          </Text>
        ))}
      </Box>
      <Box justifyContent="space-between">
        <Text>
          MODE: <Text color={mode === 'INSERT' ? 'yellow' : mode === 'COMMAND' ? 'magenta' : 'green'}>{mode}</Text>
          {'  '}Ln {cursorLine + 1}, Col {cursorCol + 1}
        </Text>
        <Text color="gray">i insert • : commands • q quit</Text>
      </Box>
      <Text>{mode === 'COMMAND' ? `:${command}` : status}</Text>
    </Box>
  );
};

const cli = meow(
  `
Usage
  $ synapse-tui [file]

Controls
  h/j/k/l or arrows   Move cursor
  i                   Insert mode
  :w, :q, :wq         Save / quit
  esc                 Leave insert/command mode
`,
  {
    importMeta: import.meta,
  }
);

render(<App filePath={cli.input[0] ? path.resolve(cli.input[0]) : undefined} />);
