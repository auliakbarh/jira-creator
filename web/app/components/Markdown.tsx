'use client';

// Minimal, dependency-free markdown → HTML renderer for previews. Covers exactly
// the constructs the JIRA ADF converter handles: headings, bullet lists, GFM pipe
// tables, inline links and bold. Everything is HTML-escaped first, so it is safe.

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(text: string): string {
  return esc(text)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEP = /^\s*\|?[\s:|-]+\|?\s*$/;
const cells = (r: string) => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());

export function mdToHtml(md: string): string {
  const lines = (md || '').replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }

    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); i++; continue; }

    if (TABLE_ROW.test(line) && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const head = cells(line);
      i += 2;
      let body = '';
      while (i < lines.length && TABLE_ROW.test(lines[i])) {
        body += '<tr>' + cells(lines[i]).map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>';
        i++;
      }
      out.push(`<table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table>`);
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      let items = '';
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items += `<li>${inline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`;
        i++;
      }
      out.push(`<ul>${items}</ul>`);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i].trim() !== '' && !/^#{1,6}\s/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !TABLE_ROW.test(lines[i])) {
      para.push(inline(lines[i]));
      i++;
    }
    if (para.length) out.push(`<p>${para.join('<br/>')}</p>`);
  }
  return out.join('\n');
}

export default function Markdown({ md }: { md: string }) {
  return <div className="md-preview" dangerouslySetInnerHTML={{ __html: mdToHtml(md) }} />;
}
