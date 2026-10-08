import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { measureSvg } from './measure-svg.mjs';
import { checkGeometry } from './geometry-rules.mjs';

try {
  const { values } = parseArgs({ options: Object.fromEntries(['drawio', 'svg', 'report', 'preview', 'browser'].map(key => [key, { type: 'string' }])) });
  if (!values.drawio || !values.svg) throw new Error('Required: --drawio file.drawio --svg freshly-exported.svg [--browser executable]');
  const normalize = path => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path);
  const inputs = [values.drawio, values.svg].map(normalize);
  const outputs = [values.report, values.preview].filter(Boolean).map(normalize);
  if (outputs.some(path => inputs.includes(path)) || new Set(outputs).size !== outputs.length)
    throw new Error('Report/preview paths must be distinct and must not overwrite either input.');
  const measured = await measureSvg(values.svg, values.drawio, values);
  const findings = checkGeometry(measured).map(f => ({ page: measured.page, ...f }));
  const report = { schemaVersion: 1, page: measured.page, coverage: measured.gaps.length ? 'incomplete' : 'complete',
    gaps: measured.gaps, measurement: measured.measurement, counts: { labels: measured.labels.length, nodes: measured.nodes.length, edges: measured.edges.length }, findings };
  const json = JSON.stringify(report, null, 2);
  if (values.report) await writeFile(values.report, json + '\n'); else process.stdout.write(json + '\n');
  if (values.preview) {
    const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
    const svg = await readFile(values.svg, 'utf8');
    const marks = findings.map(f => {
      const g = f.geometry; if (!g) return '';
      return `<rect x="${g.x}" y="${g.y}" width="${g.width ?? 8}" height="${g.height ?? 8}" fill="none" stroke="${f.severity === 'error' ? 'red' : 'orange'}"><title>${escape(f.rule + ': ' + f.cellIds.join(', '))}</title></rect>`;
    }).join('');
    await writeFile(values.preview, svg.replace('</svg>', `<g pointer-events="none">${marks}</g></svg>`));
  }
  process.exitCode = measured.gaps.length ? 2 : findings.some(f => f.severity === 'error') ? 1 : 0;
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 2;
}
