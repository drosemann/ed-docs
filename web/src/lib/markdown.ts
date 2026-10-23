function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|\W)\*([^*\n]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>');
  return out;
}

export function renderMarkdown(src: string): string {
  const lines = src.split('\n');
  const html: string[] = [];
  let inCode = false;
  let listOpen = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      html.push(inCode ? '</pre>' : '<pre>');
      inCode = !inCode;
      continue;
    }
    if (inCode) {
      html.push(escapeHtml(line));
      continue;
    }
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      if (listOpen) {html.push('</ul>'); listOpen = false;}
      html.push(`<h${h[1].length} class="md-h">${inline(h[2])}</h${h[1].length}>`);
      continue;
    }
    if (/^\s*---\s*$/.test(line)) {
      if (listOpen) {html.push('</ul>'); listOpen = false;}
      html.push('<hr/>');
      continue;
    }
    if (/^&gt;/.test(escapeHtml(line)) || /^>/.test(line)) {
      if (listOpen) {html.push('</ul>'); listOpen = false;}
      html.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`);
      continue;
    }
    const li = /^(\s*)[-*]\s+(.*)$/.exec(line);
    if (li) {
      if (!listOpen) {html.push('<ul>'); listOpen = true;}
      html.push(`<li>${inline(li[2])}</li>`);
      continue;
    }
    if (listOpen) {html.push('</ul>'); listOpen = false;}
    if (line.trim() === '') {
      html.push('<div class="md-gap"></div>');
      continue;
    }
    html.push(`<p>${inline(line)}</p>`);
  }
  if (listOpen) html.push('</ul>');
  if (inCode) html.push('</pre>');
  return html.join('\n');
}

export function docStats(text: string): {words: number; chars: number; minutes: number} {
  const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
  return {words, chars: text.length, minutes: Math.max(1, Math.ceil(words / 200))};
}
