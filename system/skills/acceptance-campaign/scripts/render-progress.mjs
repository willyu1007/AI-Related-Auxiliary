#!/usr/bin/env node
/**
 * render-progress.mjs
 *
 * Render an acceptance campaign's progress.md into a script-free index.html beside it. The format
 * is defined in ../references/progress-format.md; anything outside it is an error, and nothing is
 * written until the file is clean. Counts are always computed from the rows. Page labels are
 * Chinese when the title contains Chinese, otherwise English. The page is for people: it shows only
 * `Updated` from the header and omits the Lane section and the Evidence column, and it warns when a
 * cell it shows carries something that looks like a commit hash.
 *
 * Usage:
 *   node render-progress.mjs <progress.md> [--out <file.html>]
 *
 * Exit codes: 0 rendered, 1 format errors, 2 usage.
 */

import fs from 'node:fs';
import path from 'node:path';

const STATUSES = ['passed', 'partial', 'failed', 'blocked', 'not-tested'];
const KINDS = ['defect', 'design', 'gap', 'environment', 'ruling'];
const FINDING_STATES = ['open', 'fixing', 'verified', 'deferred'];
const LEGACY_FINDINGS = ['ID', 'Severity', 'Kind', 'Summary', 'Disposition', 'Rows'];
const SEVERITIES = ['P1', 'P2', 'P3', '-'];
const COLUMNS = {
  Rows: ['ID', 'Group', 'Item', 'Acceptance', 'Status', 'Qualification', 'Remaining', 'Evidence'],
  Rulings: ['ID', 'Date', 'Decision', 'Rows'],
  Handoff: ['ID', 'Item', 'Needs', 'Gate', 'Rows'],
  Findings: ['ID', 'Severity', 'Kind', 'State', 'Summary', 'Disposition', 'Rows'],
  Blockers: ['ID', 'Item', 'Unlock', 'Owner', 'Since', 'Rows'],
};
const TEXT_SECTIONS = ['Summary', 'Lane', 'Next'];
/** Lane facts a fresh coordinator needs to resume; each is a required `- Label:` bullet. */
const LANE_FACTS = ['Runbook', 'Loaded', 'Slots', 'Partitions', 'Switches', 'Time zone', 'Objects', 'Pending', 'Units', 'Off limits'];
const UPDATED_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}( [+-]\d{2}:\d{2})?$/;
const COUNT_IN_NAME_RE = /\d+\s*(项|行|条|rows?\b|items?\b)/i;
const QUALIFICATION_TAGS = 4;
const QUALIFICATION_TAG_LENGTH = 16;
const HASH_RE = /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b/;
/** Cells and sections the page shows, per table; hashes there are flagged for people-first wording. */
const SHOWN = {
  Rows: ['Item', 'Acceptance', 'Qualification', 'Remaining'],
  Rulings: ['Decision'],
  Handoff: ['Item', 'Needs', 'Gate'],
  Findings: ['Summary', 'Disposition'],
  Blockers: ['Item', 'Unlock'],
};

const LABELS = {
  en: {
    passed: 'passed', partial: 'partial', failed: 'failed', blocked: 'blocked',
    'not-tested': 'not tested', defect: 'defect', design: 'design', gap: 'gap',
    environment: 'environment', ruling: 'ruling', ungrouped: 'Ungrouped', Content: 'Summary', of: (n, t) => `${n} / ${t} passed`,
    open: 'open', fixing: 'fixing', verified: 'verified', deferred: 'deferred',
  },
  zh: {
    passed: '通过', partial: '部分通过', failed: '失败', blocked: '阻塞', 'not-tested': '未测',
    defect: '缺陷', design: '设计', gap: '产品缺口', environment: '环境', ruling: '待裁定', ungrouped: '未分组',
    of: (n, t) => `${n} / ${t} 通过`,
    Summary: '概况', Next: '下一步', Lane: '车道', Rulings: '裁定', Handoff: '交接包', Findings: '发现',
    Blockers: '阻塞', ID: '编号', Item: '项目', Status: '状态', Qualification: '证据资格', Remaining: '余项',
    Date: '日期', Decision: '裁定', Rows: '涉及行', Needs: '需要', Gate: '上线门禁', Severity: '级别',
    Kind: '归属', Disposition: '去向', Unlock: '解锁条件', Owner: '负责方', Since: '起始',
    Updated: '更新', Baseline: '基线', Content: '内容', State: '状态',
    open: '待处理', fixing: '修复中', verified: '已复验', deferred: '延后',
  },
};

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

/** Lower-cased header cells of a section's first table line, joined by `|`. */
function headerOf(section) {
  const first = section.body.find((l) => l.text.trim());
  return first ? splitRow(first.text).join('|').toLowerCase() : '';
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
  const doc = { title: '', meta: [], ledgers: [], tables: {}, text: {}, notes: [] };
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
  const updated = doc.meta.find(([key]) => key === 'Updated');
  if (!updated) errors.push('header: "Updated:" is required');
  else if (!UPDATED_RE.test(updated[1])) errors.push(`header: "Updated: ${updated[1]}" must be YYYY-MM-DD HH:MM with an optional ±HH:MM offset`);
  if (!doc.meta.some(([key]) => key === 'Tasks')) errors.push('header: "Tasks:" is required (the repository task each ledger maps to)');
  if (!doc.meta.some(([key]) => key === 'Coordinator')) errors.push('header: "Coordinator:" is required (the coordinating session and since when)');

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
    } else if (section.name === 'Findings' && headerOf(section) === LEGACY_FINDINGS.join('|').toLowerCase()) {
      doc.tables.Findings = parseTable(section, LEGACY_FINDINGS, errors).map((r) => ({ ...r, State: 'open' }));
      doc.notes.push(`"## Findings" (line ${section.line}) has no State column; every finding shows as open until you add it`);
    } else if (COLUMNS[section.name] && section.name !== 'Rows') {
      doc.tables[section.name] = parseTable(section, COLUMNS[section.name], errors);
    } else if (TEXT_SECTIONS.includes(section.name)) {
      doc.text[section.name] = section.body;
    } else {
      errors.push(`line ${section.line}: unknown section "## ${section.name}"`);
    }
  }
  if (!doc.ledgers.length) errors.push('at least one "## Rows: <ledger name>" section is required');
  if (!doc.text.Lane) errors.push('the "## Lane" section is required');
  return { doc, errors };
}

const qualificationTags = (cell) => (cell === '-' ? [] : cell.split(';').map((t) => t.trim()).filter(Boolean));

/** Warn where a shown cell reads like machine data (a commit hash) rather than prose for people. */
function lintForPeople(doc) {
  const warnings = [];
  const check = (value, line, column) => {
    const hit = value.match(HASH_RE);
    if (hit) warnings.push(`line ${line}${column ? ` (${column})` : ''}: "${hit[0]}" looks like a commit hash; the page is for people`);
  };
  for (const ledger of doc.ledgers) for (const row of ledger.rows) for (const c of SHOWN.Rows) check(row[c], row.line, c);
  for (const [name, records] of Object.entries(doc.tables)) for (const rec of records) for (const c of SHOWN[name]) check(rec[c], rec.line, c);
  for (const name of ['Summary', 'Next']) for (const l of doc.text[name] ?? []) check(l.text, l.line);
  for (const ledger of doc.ledgers) {
    if (COUNT_IN_NAME_RE.test(ledger.name)) warnings.push(`ledger "${ledger.name}" carries a count in its name; the page computes counts`);
  }
  return warnings;
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
      if (!row.Acceptance || row.Acceptance === '-') {
        errors.push(`line ${row.line}: "${row.ID}" needs an Acceptance condition`);
      }
      if (row.Status !== 'passed' && (!row.Remaining || row.Remaining === '-')) {
        errors.push(`line ${row.line}: "${row.ID}" is ${row.Status}, so Remaining must say what is left`);
      }
      const tags = qualificationTags(row.Qualification);
      if ((row.Status === 'passed' || row.Status === 'partial') && !tags.length) {
        errors.push(`line ${row.line}: "${row.ID}" is ${row.Status}, so Qualification must say what was established`);
      }
      if (row.Status === 'not-tested' && tags.length) {
        errors.push(`line ${row.line}: "${row.ID}" is not-tested, so Qualification must be "-"; put required qualification in Acceptance`);
      }
      if (tags.length > QUALIFICATION_TAGS || tags.some((t) => [...t].length > QUALIFICATION_TAG_LENGTH)) {
        errors.push(`line ${row.line}: Qualification takes at most ${QUALIFICATION_TAGS} tags of at most ${QUALIFICATION_TAG_LENGTH} characters, separated by ";"`);
      }
    }
  }
  const switches = doc.text.Lane?.find((l) => l.text.trim().startsWith('- Switches:'));
  if (switches && !/=|:\s*none\s*$/.test(switches.text.replace(/^\s*- Switches:/, ':'))) {
    errors.push(`line ${switches.line}: write each switch as name=value, or "none"`);
  }
  for (const fact of LANE_FACTS) {
    if (doc.text.Lane && !doc.text.Lane.some((l) => l.text.trim().startsWith(`- ${fact}:`))) {
      errors.push(`"## Lane" needs a "- ${fact}:" bullet (write "none" if empty)`);
    }
  }
  for (const [name, records] of Object.entries(doc.tables)) {
    for (const record of records) {
      claim(record.ID, record.line);
      if (name === 'Findings') {
        if (!KINDS.includes(record.Kind)) errors.push(`line ${record.line}: kind "${record.Kind}" is not one of ${KINDS.join(', ')}`);
        if (!SEVERITIES.includes(record.Severity)) errors.push(`line ${record.line}: severity "${record.Severity}" is not one of ${SEVERITIES.join(', ')}`);
        if (!FINDING_STATES.includes(record.State)) errors.push(`line ${record.line}: state "${record.State}" is not one of ${FINDING_STATES.join(', ')}`);
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

function countStatuses(rows) {
  return Object.fromEntries(STATUSES.map((s) => [s, rows.filter((r) => r.Status === s).length]));
}

/** Build the page for one parsed document; `t` maps a label key to its display text. */
function render(doc, inline, lang) {
  const dict = LABELS[lang];
  const t = (key) => dict[key] ?? key;
  const chip = (status) => `<span class="chip s-${status}">${t(status)}</span>`;
  const refLinks = (cell) =>
    cell === '-' ? '—' : cell.split(',').map((id) => `<a href="#${anchor(id.trim())}">${escapeHtml(id.trim())}</a>`).join(', ');

  const handoffByRow = new Map();
  for (const rec of doc.tables.Handoff ?? []) {
    if (rec.Rows === '-') continue;
    for (const id of rec.Rows.split(',').map((s) => s.trim())) {
      handoffByRow.set(id, [...(handoffByRow.get(id) ?? []), rec.ID]);
    }
  }
  const handoffTag = (rowId) => {
    const ids = handoffByRow.get(rowId);
    if (!ids) return '';
    const links = ids.map((id) => `<a href="#${anchor(id)}">${escapeHtml(id)}</a>`).join(', ');
    return `<div class="muted">${t('Handoff')} ${links}</div>`;
  };

  const card = (ledger, index) => {
    const counts = countStatuses(ledger.rows);
    const total = ledger.rows.length;
    const bar = STATUSES.filter((s) => counts[s])
      .map((s) => `<span class="s-${s}" style="width:${((counts[s] / total) * 100).toFixed(2)}%"></span>`)
      .join('');
    const legend = STATUSES.filter((s) => counts[s]).map((s) => `${counts[s]} ${t(s)}`).join(' · ');
    return `<a class="card" href="#ledger-${index}"><strong>${escapeHtml(ledger.name)}</strong>
<span class="big">${counts.passed}<small> / ${total}</small></span>
<span class="bar">${bar}</span><span class="muted">${legend}</span></a>`;
  };

  const ledgerSection = (ledger, index) => {
    const groups = new Map();
    for (const row of ledger.rows) {
      if (!groups.has(row.Group)) groups.set(row.Group, []);
      groups.get(row.Group).push(row);
    }
    const body = [...groups].map(([group, rows]) => {
      const passed = rows.filter((r) => r.Status === 'passed').length;
      const open = rows.some((r) => r.Status !== 'passed') ? ' open' : '';
      const trs = rows.map((r) => `<tr id="${anchor(r.ID)}" class="r-${r.Status}">
<td data-label="${t('ID')}" class="id">${escapeHtml(r.ID)}</td>
<td data-label="${t('Item')}" class="item">${inline(r.Item, r.line)}${r.Acceptance === '-' ? '' : `<div class="muted">${inline(r.Acceptance, r.line)}</div>`}</td>
<td data-label="${t('Status')}">${chip(r.Status)}${handoffTag(r.ID)}</td>
<td data-label="${t('Qualification')}">${qualificationTags(r.Qualification).map((q) => `<span class="tag">${escapeHtml(q)}</span>`).join('')}</td>
<td data-label="${t('Remaining')}" class="remaining">${r.Remaining === '-' ? '' : inline(r.Remaining, r.line)}</td></tr>`).join('\n');
      return `<details${open}><summary>${escapeHtml(group || t('ungrouped'))} <span class="muted">${t('of')(passed, rows.length)}</span></summary>
<table class="rows"><thead><tr><th>${t('ID')}</th><th>${t('Item')}</th><th>${t('Status')}</th><th>${t('Qualification')}</th><th>${t('Remaining')}</th></tr></thead>
<tbody>${trs}</tbody></table></details>`;
    });
    return `<section id="ledger-${index}"><h2>${escapeHtml(ledger.name)}</h2>${body.join('\n')}</section>`;
  };

  const findingsSection = (list) => {
    const columns = COLUMNS.Findings;
    const label = (c) => (c === 'Summary' ? t('Content') : t(c));
    const head = `<thead><tr>${columns.map((c) => `<th>${label(c)}</th>`).join('')}</tr></thead>`;
    const row = (rec) => `<tr id="${anchor(rec.ID)}">${columns.map((c) => {
      const value = rec[c];
      let html;
      if (c === 'Rows') html = refLinks(value);
      else if (c === 'State') html = `<span class="chip f-${value}">${escapeHtml(t(value))}</span>`;
      else if (c === 'Severity' || c === 'Kind') {
        const cls = rec.State === 'open' ? `k-${escapeHtml(value)}` : 'k-muted';
        html = value === '-' ? '—' : `<span class="chip ${cls}">${escapeHtml(t(value))}</span>`;
      } else html = inline(value, rec.line);
      const cls = c === 'ID' || c === 'Severity' || c === 'Kind' || c === 'State' ? ' class="id"' : '';
      return `<td data-label="${label(c)}"${cls}>${html}</td>`;
    }).join('')}</tr>`;
    const groups = FINDING_STATES.map((s) => [s, list.filter((r) => r.State === s)]).filter(([, rows]) => rows.length);
    const body = groups.map(([s, rows]) => {
      const open = s === 'open' || s === 'fixing' ? ' open' : '';
      return `<details id="findings-${s}"${open}><summary>${escapeHtml(t(s))} <span class="muted">${rows.length}</span></summary>
<table class="rows">${head}<tbody>${rows.map(row).join('\n')}</tbody></table></details>`;
    });
    return `<section id="findings"><h2>${t('Findings')}</h2>${body.join('\n')}</section>`;
  };

  const records = (name) => {
    const list = doc.tables[name];
    if (!list) return '';
    if (name === 'Findings') return findingsSection(list);
    const columns = COLUMNS[name];
    const label = (c) => (c === 'Summary' ? t('Content') : t(c));
    const head = columns.map((c) => `<th>${label(c)}</th>`).join('');
    const body = list.map((rec) => `<tr id="${anchor(rec.ID)}">${columns.map((c) => {
      const value = rec[c];
      let html;
      if (c === 'Rows') html = refLinks(value);
      else if (c === 'Severity' || c === 'Kind') html = value === '-' ? '—' : `<span class="chip k-${escapeHtml(value)}">${escapeHtml(t(value))}</span>`;
      else html = inline(value, rec.line);
      const cls = c === 'ID' || c === 'Date' || c === 'Since' || c === 'Severity' || c === 'Kind' ? ' class="id"' : '';
      return `<td data-label="${label(c)}"${cls}>${html}</td>`;
    }).join('')}</tr>`).join('\n');
    return `<section id="${name.toLowerCase()}"><h2>${t(name)} <span class="muted">${list.length}</span></h2>
<table class="rows"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></section>`;
  };

  const text = (name) =>
    doc.text[name] ? `<section id="${name.toLowerCase()}"><h2>${t(name)}</h2>${renderText(doc.text[name], inline)}</section>` : '';
  const meta = doc.meta.filter(([k]) => k === 'Updated').map(([k, v]) => `<span>${escapeHtml(t(k))}: ${inline(v, 0)}</span>`).join('');
  const tallies = ['Blockers', 'Findings', 'Handoff', 'Rulings']
    .filter((name) => doc.tables[name])
    .map((name) => {
      if (name !== 'Findings') return `<a class="chip" href="#${name.toLowerCase()}">${t(name)} ${doc.tables[name].length}</a>`;
      return FINDING_STATES.map((s) => [s, doc.tables.Findings.filter((r) => r.State === s).length])
        .filter(([, n]) => n)
        .map(([s, n]) => `<a class="chip f-${s}" href="#findings-${s}">${t('Findings')} · ${escapeHtml(t(s))} ${n}</a>`)
        .join('');
    })
    .join('');

  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(doc.title)}</title><style>${CSS}</style></head>
<body><main>
<h1>${escapeHtml(doc.title)}</h1><div class="meta">${meta}</div>
<div class="cards">${doc.ledgers.map(card).join('\n')}</div>
<div class="chips">${tallies}</div>
${text('Summary')}${text('Next')}${records('Blockers')}
${doc.ledgers.map(ledgerSection).join('\n')}
${records('Findings')}${records('Handoff')}${records('Rulings')}
</main></body></html>
`;
}

const CSS = `
:root{--bg:#fafaf9;--fg:#1c1917;--muted:#78716c;--line:#e7e5e4;--card:#fff;--tag:#f5f5f4;--link:#1d4ed8;
--passed:#15803d;--partial:#b45309;--failed:#b91c1c;--blocked:#7c3aed;--not-tested:#a8a29e}
@media (prefers-color-scheme:dark){:root{--bg:#1c1917;--fg:#e7e5e4;--muted:#a8a29e;--line:#44403c;--card:#292524;--tag:#3a3532;--link:#93c5fd;
--passed:#4ade80;--partial:#fbbf24;--failed:#f87171;--blocked:#c4b5fd;--not-tested:#78716c}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.55 system-ui,-apple-system,"PingFang SC","Noto Sans CJK SC",sans-serif}
main{max-width:1180px;margin:0 auto;padding:24px 16px 64px}h1{font-size:22px;margin:0 0 4px}h2{font-size:17px;margin:32px 0 10px}
a{color:var(--link)}.muted{color:var(--muted);font-size:12px}.meta{display:flex;flex-wrap:wrap;gap:4px 16px;color:var(--muted)}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin:16px 0}
.card{display:flex;flex-direction:column;gap:6px;padding:12px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:inherit;text-decoration:none}
.big{font-size:24px;font-weight:600}.big small{font-size:14px;font-weight:400;color:var(--muted)}
.bar{display:flex;height:8px;border-radius:4px;overflow:hidden;background:var(--line)}.bar span{display:block}
.chips{display:flex;flex-wrap:wrap;gap:8px}.chip{display:inline-block;padding:0 8px;border-radius:10px;font-size:12px;border:1px solid currentColor;white-space:nowrap}
.tag{display:inline-block;margin:0 4px 4px 0;padding:0 6px;border-radius:4px;background:var(--tag);font-size:12px;white-space:nowrap}
.s-passed{color:var(--passed);background:var(--passed)}.s-partial{color:var(--partial);background:var(--partial)}
.s-failed{color:var(--failed);background:var(--failed)}.s-blocked{color:var(--blocked);background:var(--blocked)}.s-not-tested{color:var(--not-tested);background:var(--not-tested)}
.chip.s-passed,.chip.s-partial,.chip.s-failed,.chip.s-blocked,.chip.s-not-tested{background:none}
.k-P1,.k-defect{color:var(--failed)}.k-P2,.k-gap{color:var(--partial)}.k-P3,.k-design,.k-environment,.k-ruling,.k-muted{color:var(--muted)}
.f-open{color:var(--failed)}.f-fixing{color:var(--link)}.f-verified,.f-deferred{color:var(--muted)}
details{border:1px solid var(--line);border-radius:8px;background:var(--card);margin:8px 0}summary{padding:8px 12px;cursor:pointer;font-weight:600}
table{width:100%;border-collapse:collapse}th,td{text-align:left;vertical-align:top;padding:6px 10px;border-top:1px solid var(--line);overflow-wrap:break-word}
th{font-size:12px;color:var(--muted);font-weight:500;white-space:nowrap}td.id{white-space:nowrap;font-weight:600}td.item{min-width:200px;width:30%}td.remaining{width:35%}
tr.r-failed td:first-child{box-shadow:inset 3px 0 var(--failed)}tr.r-blocked td:first-child{box-shadow:inset 3px 0 var(--blocked)}
section>table{background:var(--card);border:1px solid var(--line);border-radius:8px}code{font-size:12px}
@media (max-width:640px){table.rows,table.rows tbody{display:block}table.rows thead{display:none}table.rows tr{display:block;border-top:1px solid var(--line);padding:6px 0}
table.rows td{display:block;border:0;padding:2px 12px;width:auto;min-width:0;overflow-wrap:anywhere;white-space:normal}
table.rows td::before{content:attr(data-label);display:block;font-size:11px;font-weight:400;color:var(--muted)}table.rows td:empty{display:none}}
`;

const args = parseArgs(process.argv.slice(2));
const input = path.resolve(args.input);
if (!fs.existsSync(input)) usage(`not found: ${input}`);
const { doc, errors } = parse(fs.readFileSync(input, 'utf8'));
validate(doc, errors);
const lang = /[㐀-鿿]/.test(doc.title) ? 'zh' : 'en';
const inline = makeInline(path.dirname(input), errors);
for (const ledger of doc.ledgers) for (const row of ledger.rows) if (row.Evidence !== '-') inline(row.Evidence, row.line);
for (const l of doc.text.Lane ?? []) inline(l.text, l.line);
const html = render(doc, inline, lang);
if (errors.length) {
  console.error(`${path.basename(input)}: ${errors.length} error(s); nothing written`);
  for (const e of errors) console.error(`  ${e}`);
  console.error('Format: references/progress-format.md');
  process.exit(1);
}
for (const w of [...doc.notes, ...lintForPeople(doc)]) console.error(`warning: ${w}`);
const out = path.resolve(args.out || path.join(path.dirname(input), 'index.html'));
fs.writeFileSync(out, html);
const tally = doc.ledgers.map((l) => {
  const counts = countStatuses(l.rows);
  return `${l.name}: ${STATUSES.filter((s) => counts[s]).map((s) => `${counts[s]} ${s}`).join(', ')}`;
});
console.log(`rendered ${out}: ${tally.join('; ')}`);
