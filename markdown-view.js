// Source-preserving Markdown presentation. Every source character remains in
// DOM textContent, including hidden syntax. Existing UTF-16 selection/search
// offsets therefore refer to exactly the stored immutable Markdown version.
// Input is an already escaped/annotated DOM: raw HTML is never executed.
export function formatMarkdown(container) {
  const source = container.textContent;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = []; let offset = 0;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    nodes.push({node, start: offset, end: offset + node.length}); offset += node.length;
  }
  if (!nodes.length) return;
  function slice(start, end) {
    const fragment = document.createDocumentFragment();
    if (end <= start) return fragment;
    const a = nodes.find(n => n.end > start);
    const b = nodes.find(n => n.end >= end);
    const range = document.createRange();
    range.setStart(a.node, start - a.start); range.setEnd(b.node, end - b.start);
    return range.cloneContents();
  }
  function append(parent, start, end, tag = 'span', hidden = false) {
    const node = document.createElement(tag);
    if (hidden) node.className = 'md-syntax';
    node.append(slice(start, end)); parent.append(node);
  }
  function inline(parent, start, end) {
    const text = source.slice(start, end);
    const pattern = /!\[[^\]]*\]\([^)]*\)|\[([^\]]+)\]\([^)]*\)|\*\*([^*]+)\*\*|__([^_]+)__|`([^`]+)`/g;
    let pos = 0;
    for (const m of text.matchAll(pattern)) {
      append(parent, start + pos, start + m.index);
      const at = start + m.index;
      if (m[0].startsWith('!')) append(parent, at, at + m[0].length, 'span', true);
      else if (m[1]) {
        append(parent, at, at + 1, 'span', true);
        append(parent, at + 1, at + 1 + m[1].length);
        append(parent, at + 1 + m[1].length, at + m[0].length, 'span', true);
      } else {
        const width = m[4] ? 1 : 2;
        append(parent, at, at + width, 'span', true);
        append(parent, at + width, at + m[0].length - width, m[4] ? 'code' : 'strong');
        append(parent, at + m[0].length - width, at + m[0].length, 'span', true);
      }
      pos = m.index + m[0].length;
    }
    append(parent, start + pos, end);
  }
  const result = document.createDocumentFragment();
  for (const match of source.matchAll(/[^\n]*\n|[^\n]+$/g)) {
    const line = match[0]; const start = match.index;
    const row = document.createElement('div'); row.className = 'md-line';
    const heading = line.match(/^(#{1,6})\s+/);
    const separator = /^\s*\|?[\s:|-]+\|[\s:|-]*\r?\n?$/.test(line);
    if (separator || /^\s*---+\s*$/.test(line)) {
      row.classList.add('md-divider'); append(row, start, start + line.length, 'span', true);
    } else if (/^\s*\|.*\|\s*$/.test(line)) {
      row.classList.add('md-table-row');
      const bars = [...line.matchAll(/\|/g)].map(m => m.index);
      append(row, start, start + bars[0] + 1, 'span', true);
      for (let i = 0; i < bars.length - 1; i++) {
        const cell = document.createElement('div'); cell.className = 'md-cell';
        inline(cell, start + bars[i] + 1, start + bars[i + 1]); row.append(cell);
        append(row, start + bars[i + 1], start + bars[i + 1] + 1, 'span', true);
      }
      append(row, start + bars.at(-1) + 1, start + line.length, 'span', true);
    } else if (heading) {
      row.classList.add('md-heading', `md-h${heading[1].length}`);
      append(row, start, start + heading[0].length, 'span', true);
      inline(row, start + heading[0].length, start + line.length);
    } else inline(row, start, start + line.length);
    result.append(row);
  }
  // A failed invariant must never silently shift annotations.
  if (result.textContent !== source) throw new Error('Markdown text position mismatch');
  container.replaceChildren(result); container.classList.add('markdown-view');
}

export function markdownNerText(source) {
  // Mask destinations/images without changing UTF-16 offsets. A non-whitespace
  // delimiter prevents matches from crossing into a different table cell.
  return source.replace(/!\[[^\]]*\]\([^)]*\)|\]\([^)]*\)|<[^>]*>/g,
    value => '\u0000'.repeat(value.length));
}
