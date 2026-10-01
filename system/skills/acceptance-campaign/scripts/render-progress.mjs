#!/usr/bin/env node
/**
 * render-progress.mjs
 *
 * Render an acceptance campaign's progress.md into a script-free index.html beside it. The format
 * is defined in ../references/progress-format.md; anything outside it is an error, and nothing is
 * written until the file is clean. Counts are always computed from the rows.
 *
 * Usage:
 *   node render-progress.mjs <progress.md> [--out <file.html>]
 *
 * Exit codes: 0 rendered, 1 format errors, 2 usage.
 */

import fs from 'node:fs';
import path from 'node:path';

const STATUSES = ['passed', 'partial', 'testing', 'failed', 'blocked', 'not-tested'];
const KINDS = ['defect', 'design', 'gap', 'environment', 'ruling'];
const SEVERITIES = ['P1', 'P2', 'P3', '-'];
const COLUMNS = {
  Rows: ['ID', 'Group', 'Item', 'Acceptance', 'Status', 'Qualification', 'Remaining', 'Evidence'],
  Rulings: ['ID', 'Date', 'Decision', 'Rows'],
  Handoff: ['ID', 'Item', 'Needs', 'Gate', 'Rows'],
  Findings: ['ID', 'Severity', 'Kind', 'Summary', 'Disposition', 'Rows'],
  Blockers: ['ID', 'Item', 'Unlock', 'Owner', 'Since'],
};
const TEXT_SECTIONS = ['Summary', 'Lane', 'Next'];

function usage(message) {
  if (message) console.error(message);
  console.error('Usage: node render-progress.mjs <progress.md> [--out <file.html>]');
  process.exit(2);
}

function parseArgs(argv) {
  const args = { input: '', out: '' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--out') args.out = argv[++i] ?? usage('--out needs a path');
    else if (argv[i] === '-h' || argv[i] === '--help') usage();
    else if (!args.input) args.input = argv[i];
    else usage(`unexpected argument: ${argv[i]}`);
  }
  if (!args.input) usage();
  return args;
}

/** Split a markdown table line into trimmed cells, honoring `\|` escapes. */
function splitRow(line) {
  const inner = line.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '');
  return inner.split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, '|').trim());
}

/** Parse a section body as one table with the expected columns; records keep their line. */
function parseTable(section, columns, errors) {
  const lines = section.body.filter((l) => l.text.trim());
  const where = `"## ${section.name}" (line ${section.line})`;
  if (lines.length < 2) {
    errors.push(`${where}: expected a table with columns ${columns.join(' | ')}`);
    return [];
  }
  for (const l of lines) {
    if (!l.text.trim().startsWith('|')) errors.push(`line ${l.line}: only the table may appear in ${where}`);
  }
  const header = splitRow(lines[0].text);
  if (header.join('|').toLowerCase() !== columns.join('|').toLowerCase()) {
    errors.push(`line ${lines[0].line}: columns must be ${columns.join(' | ')}`);
    return [];
  }
  if (!splitRow(lines[1].text).every((c) => /^:?-{3,}:?$/.test(c))) {
    errors.push(`line ${lines[1].line}: expected the table separator row`);
  }
  const records = [];
  for (const l of lines.slice(2)) {
    if (!l.text.trim().startsWith('|')) continue;
    const cells = splitRow(l.text);
    if (cells.length !== columns.length) {
      errors.push(`line ${l.line}: expected ${columns.length} cells, found ${cells.length}`);
      continue;
    }
    records.push({ line: l.line, ...Object.fromEntries(columns.map((c, i) => [c, cells[i]])) });
  }
  return records;
}

function parse(source) {
  const errors = [];
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const doc = { title: '', meta: [], ledgers: [], tables: {}, text: {} };
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  const title = lines[i]?.match(/^# (.+)$/);
  if (title) {
    doc.title = title[1].trim();
    i++;
  } else {
    errors.push(`line ${i + 1}: the file must start with "# <title>"`);
  }
  for (; i < lines.length && !lines[i].startsWith('## '); i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const kv = line.match(/^([A-Za-z][\w -]*):\s*(.+)$/);
    if (kv) doc.meta.push([kv[1].trim(), kv[2].trim()]);
    else errors.push(`line ${i + 1}: the header takes only "Key: value" lines`);
  }
  if (!doc.meta.some(([key]) => key === 'Updated')) errors.push('header: "Updated:" is required');

  const sections = [];
  for (; i < lines.length; i++) {
    const heading = lines[i].match(/^## (.+)$/);
    if (heading) sections.push({ name: heading[1].trim(), line: i + 1, body: [] });
    else if (/^#{1,6} /.test(lines[i])) errors.push(`line ${i + 1}: only "##" headings may follow the title`);
    else sections.at(-1)?.body.push({ text: lines[i], line: i + 1 });
  }

  const seen = new Set();
  for (const section of sections) {
    const ledger = section.name.match(/^Rows:\s*(.+)$/);
    const key = ledger ? `Rows: ${ledger[1].trim()}` : section.name;
    if (seen.has(key)) errors.push(`line ${section.line}: "## ${section.name}" appears twice`);
    seen.add(key);
    if (ledger) {
      doc.ledgers.push({ name: ledger[1].trim(), rows: parseTable(section, COLUMNS.Rows, errors) });
    } else if (COLUMNS[section.name] && section.name !== 'Rows') {
      doc.tables[section.name] = parseTable(section, COLUMNS[section.name], errors);
    } else if (TEXT_SECTIONS.includes(section.name)) {
      doc.text[section.name] = section.body;
    } else {
      errors.push(`line ${section.line}: unknown section "## ${section.name}"`);
    }
  }
  if (!doc.ledgers.length) errors.push('at least one "## Rows: <ledger name>" section is required');
  return { doc, errors };
}

function validate(doc, errors) {
  const ids = new Map();
  const claim = (id, line) => {
    if (!id) errors.push(`line ${line}: ID is empty`);
    else if (ids.has(id)) errors.push(`line ${line}: ID "${id}" is already used on line ${ids.get(id)}`);
    else ids.set(id, line);
  };
  const rowIds = new Set();
  for (const ledger of doc.ledgers) {
    for (const row of ledger.rows) {
      claim(row.ID, row.line);
      rowIds.add(row.ID);
      if (!STATUSES.includes(row.Status)) {
        errors.push(`line ${row.line}: status "${row.Status}" is not one of ${STATUSES.join(', ')}`);
      }
      if (row.Status !== 'passed' && (!row.Remaining || row.Remaining === '-')) {
        errors.push(`line ${row.line}: "${row.ID}" is ${row.Status}, so Remaining must say what is left`);
      }
    }
  }
  for (const [name, records] of Object.entries(doc.tables)) {
    for (const record of records) {
      claim(record.ID, record.line);
      if (name === 'Findings') {
        if (!KINDS.includes(record.Kind)) errors.push(`line ${record.line}: kind "${record.Kind}" is not one of ${KINDS.join(', ')}`);
        if (!SEVERITIES.includes(record.Severity)) errors.push(`line ${record.line}: severity "${record.Severity}" is not one of ${SEVERITIES.join(', ')}`);
      }
      if ('Rows' in record && record.Rows !== '-') {
        for (const ref of record.Rows.split(',').map((s) => s.trim())) {
          if (!rowIds.has(ref)) errors.push(`line ${record.line}: row "${ref}" does not exist in any ledger`);
        }
      }
    }
  }
}

const escapeHtml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const anchor = (id) => `row-${id.replace(/[^A-Za-z0-9_-]/g, '-')}`;

/** Render inline markdown (links, code, bold); relative links must exist beside progress.md. */
function makeInline(baseDir, errors) {
  return function inline(text, line) {
    const tokens = [];
    const hold = (html) => `\u0000${tokens.push(html) - 1}\u0000`;
    let s = text.replace(/`([^`]+)`/g, (_, code) => hold(`<code>${escapeHtml(code)}</code>`));
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => {
      if (!/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('#')) {
        const target = path.resolve(baseDir, decodeURI(href.split(/[?#]/)[0]));
        if (!fs.existsSync(target)) errors.push(`line ${line}: link target "${href}" does not exist`);
      }
      return hold(`<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`);
    });
    s = escapeHtml(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    return s.replace(/\u0000(\d+)\u0000/g, (_, n) => tokens[Number(n)]);
  };
}

/** Render a free-text section: paragraphs, "-" bullets, and "1." lists. */
function renderText(body, inline) {
  const out = [];
  let list = null;
  let para = [];
  const flushPara = () => {
    if (para.length) out.push(`<p>${para.map((l) => inline(l.text.trim(), l.line)).join(' ')}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`<${list.tag}>${list.items.join('')}</${list.tag}>`);
    list = null;
  };
  for (const l of body) {
    const trimmed = l.text.trim();
    const item = trimmed.match(/^(?:(-)|\d+\.)\s+(.+)$/);
    if (!trimmed) {
      flushPara();
      flushList();
    } else if (item) {
      flushPara();
      const tag = item[1] ? 'ul' : 'ol';
      if (list?.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push(`<li>${inline(item[2], l.line)}</li>`);
    } else {
      flushList();
      para.push(l);
    }
  }
  flushPara();
  flushList();
  return out.join('\n');
}

const statusChip = (status) => `<span class="chip s-${status}">${status}</span>`;
const refLinks = (cell) =>
  cell === '-' ? '—' : cell.split(',').map((id) => `<a href="#${anchor(id.trim())}">${escapeHtml(id.trim())}</a>`).join(', ');

function countStatuses(rows) {
  return Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => r.Status === s).length]));
}

function renderLedgerCard(ledger, index) {
  const counts = countStatuses(ledger.rows);
  const total = ledger.rows.length;
  const bar = STATUSES.filter((s) => counts[s])
    .map((s) => `<span class="s-${s}" style="width:${((counts[s] / total) * 100).toFixed(2)}%"></span>`)
    .join('');
  const legend = STATUSES.filter((s) => counts[s]).map((s) => `${counts[s]} ${s}`).join(' · ');
  return `<a class="card" href="#ledger-${index}"><strong>${escapeHtml(ledger.name)}</strong>
<span class="big">${counts.passed}<small> / ${total} passed</small></span>
<span class="bar">${bar}</span><span class="muted">${legend}</span></a>`;
}

function renderLedger(ledger, index, inline) {
  const groups = new Map();
  for (const row of ledger.rows) {
    if (!groups.has(row.Group)) groups.set(row.Group, []);
    groups.get(row.Group).push(row);
  }
  const body = [...groups].map(([group, rows]) => {
    const counts = countStatuses(rows);
    const open = rows.some((r) => r.Status !== 'passed') ? ' open' : '';
    const trs = rows.map((r) => `<tr id="${anchor(r.ID)}" class="r-${r.Status}">
<td data-label="ID"><strong>${escapeHtml(r.ID)}</strong></td>
<td data-label="Item">${inline(r.Item, r.line)}<div class="muted">${inline(r.Acceptance, r.line)}</div></td>
<td data-label="Status">${statusChip(r.Status)}</td>
<td data-label="Qualification">${inline(r.Qualification, r.line)}</td>
<td data-label="Remaining">${r.Remaining === '-' ? '' : inline(r.Remaining, r.line)}</td>
<td data-label="Evidence">${r.Evidence === '-' ? '' : inline(r.Evidence, r.line)}</td></tr>`).join('\n');
    return `<details${open}><summary>${escapeHtml(group || 'Ungrouped')} <span class="muted">${counts.passed}/${rows.length} passed</span></summary>
<table class="rows"><thead><tr><th>ID</th><th>Item</th><th>Status</th><th>Qualification</th><th>Remaining</th><th>Evidence</th></tr></thead>
<tbody>${trs}</tbody></table></details>`;
  });
  return `<section id="ledger-${index}"><h2>${escapeHtml(ledger.name)}</h2>${body.join('\n')}</section>`;
}

function renderRecords(name, records, inline) {
  const columns = COLUMNS[name];
  const head = columns.map((c) => `<th>${c}</th>`).join('');
  const body = records.map((rec) => `<tr>${columns.map((c) => {
    const value = rec[c];
    let html;
    if (c === 'Rows') html = refLinks(value);
    else if (c === 'Severity' || c === 'Kind') html = `<span class="chip k-${escapeHtml(value)}">${escapeHtml(value)}</span>`;
    else html = inline(value, rec.line);
    return `<td data-label="${c}">${html}</td>`;
  }).join('')}</tr>`).join('\n');
  return `<section id="${name.toLowerCase()}"><h2>${name} <span class="muted">${records.length}</span></h2>
<table class="rows"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
}

const CSS = `
:root{--bg:#fafaf9;--fg:#1c1917;--muted:#78716c;--line:#e7e5e4;--card:#fff;--link:#1d4ed8;
--passed:#15803d;--partial:#b45309;--testing:#2563eb;--failed:#b91c1c;--blocked:#7c3aed;--not-tested:#a8a29e}
@media (prefers-color-scheme:dark){:root{--bg:#1c1917;--fg:#e7e5e4;--muted:#a8a29e;--line:#44403c;--card:#292524;--link:#93c5fd;
--passed:#4ade80;--partial:#fbbf24;--testing:#60a5fa;--failed:#f87171;--blocked:#c4b5fd;--not-tested:#78716c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,-apple-system,"PingFang SC","Noto Sans CJK SC",sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 16px 64px}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:32px 0 10px}
a{color:var(--link)}.muted{color:var(--muted);font-size:12px}.meta{display:flex;flex-wrap:wrap;gap:4px 16px;color:var(--muted)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin:16px 0}
.card{display:flex;flex-direction:column;gap:6px;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:inherit;text-decoration:none}
.big{font-size:24px;font-weight:600}.big small{font-size:13px;font-weight:400;color:var(--muted)}
.bar{display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--line)}.bar span{display:block}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{display:inline-block;padding:0 8px;border-radius:10px;font-size:12px;border:1px solid currentColor;white-space:nowrap}
.s-passed{color:var(--passed);background:var(--passed)}.s-partial{color:var(--partial);background:var(--partial)}.s-testing{color:var(--testing);background:var(--testing)}
.s-failed{color:var(--failed);background:var(--failed)}.s-blocked{color:var(--blocked);background:var(--blocked)}.s-not-tested{color:var(--not-tested);background:var(--not-tested)}
.chip.s-passed,.chip.s-partial,.chip.s-testing,.chip.s-failed,.chip.s-blocked,.chip.s-not-tested{background:none}
.k-P1,.k-defect{color:var(--failed)}.k-P2,.k-gap{color:var(--partial)}.k-P3,.k-design,.k-environment,.k-ruling{color:var(--muted)}
details{border:1px solid var(--line);border-radius:8px;background:var(--card);margin:8px 0}summary{padding:8px 12px;cursor:pointer;font-weight:600}
table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:6px 10px;border-top:1px solid var(--line);overflow-wrap:anywhere}
td[data-label=ID]{white-space:nowrap;overflow-wrap:normal}td[data-label=Item]{min-width:180px}td[data-label=Remaining]{min-width:160px}
th{font-size:12px;color:var(--muted);font-weight:500}tr.r-failed td:first-child{box-shadow:inset 3px 0 var(--failed)}tr.r-blocked td:first-child{box-shadow:inset 3px 0 var(--blocked)}
section>table{background:var(--card);border:1px solid var(--line);border-radius:8px}code{font-size:12px}
@media (max-width:640px){table.rows,table.rows tbody{display:block}table.rows thead{display:none}table.rows tr{display:block;border-top:1px solid var(--line);padding:6px 0}
table.rows td{display:block;border:0;padding:2px 12px;min-width:0}table.rows td::before{content:attr(data-label);display:block;font-size:11px;color:var(--muted)}}
`;

function render(doc, inline) {
  const lang = /[㐀-鿿]/.test(doc.title) ? 'zh' : 'en';
  const meta = doc.meta.map(([k, v]) => `<span>${escapeHtml(k)}: ${inline(v, 0)}</span>`).join('');
  const tallies = ['Rulings', 'Handoff', 'Findings', 'Blockers']
    .filter((name) => doc.tables[name])
    .map((name) => `<a class="chip" href="#${name.toLowerCase()}">${name} ${doc.tables[name].length}</a>`)
    .join('');
  const text = (name) => doc.text[name] ? `<section id="${name.toLowerCase()}"><h2>${name}</h2>${renderText(doc.text[name], inline)}</section>` : '';
  const records = (name) => doc.tables[name] ? renderRecords(name, doc.tables[name], inline) : '';
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(doc.title)}</title><style>${CSS}</style></head>
<body><main>
<h1>${escapeHtml(doc.title)}</h1><div class="meta">${meta}</div>
<div class="cards">${doc.ledgers.map(renderLedgerCard).join('\n')}</div>
<div class="chips">${tallies}</div>
${text('Summary')}${text('Next')}${records('Blockers')}
${doc.ledgers.map((l, i) => renderLedger(l, i, inline)).join('\n')}
${records('Findings')}${records('Handoff')}${records('Rulings')}${text('Lane')}
</main></body></html>
`;
}

const args = parseArgs(process.argv.slice(2));
const input = path.resolve(args.input);
if (!fs.existsSync(input)) usage(`not found: ${input}`);
const { doc, errors } = parse(fs.readFileSync(input, 'utf8'));
validate(doc, errors);
const html = render(doc, makeInline(path.dirname(input), errors));
if (errors.length) {
  console.error(`${path.basename(input)}: ${errors.length} error(s); nothing written`);
  for (const e of errors) console.error(`  ${e}`);
  console.error('Format: references/progress-format.md');
  process.exit(1);
}
const out = path.resolve(args.out || path.join(path.dirname(input), 'index.html'));
fs.writeFileSync(out, html);
const tally = doc.ledgers.map((l) => {
  const c = countStatuses(l.rows);
  return `${l.name} ${c.passed}/${l.rows.length} passed`;
});
console.log(`rendered ${out}: ${tally.join('; ')}`);
