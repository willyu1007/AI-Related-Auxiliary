import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { measureSvg } from '../scripts/measure-svg.mjs';
import { checkGeometry } from '../scripts/geometry-rules.mjs';

test('real foreignObject text, UserObject IDs, transforms and remeasurement', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'uml-geometry-test-'));
  try {
    const xml = '<mxfile><diagram name="probe"><mxGraphModel><root><mxCell id="1"/><UserObject id="13" label="First label"><mxCell parent="1" edge="1"/></UserObject><mxCell id="9" parent="1" edge="1" value="Second label"/></root></mxGraphModel></diagram></mxfile>';
    const drawio = join(directory, 'probe.drawio'), svg = join(directory, 'probe.svg');
    await writeFile(drawio, xml);
    const embedded = xml.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
    const source = offset => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="http://www.w3.org/1999/xhtml" content="${embedded}" width="400" height="200" viewBox="0 0 400 200"><g transform="translate(10,20)"><g data-cell-id="13"><path d="M0 100 L200 100" fill="none" stroke="black"/><foreignObject x="0" y="0" width="100%" height="100%"><x:div style="font:20px Arial;display:inline-block">First label</x:div></foreignObject></g><g data-cell-id="9"><path d="M0 120 L200 120" fill="none" stroke="black"/><foreignObject x="${offset}" y="0" width="100%" height="100%"><x:div style="font:20px Arial;display:inline-block">Second label</x:div></foreignObject></g></g></svg>`;
    await writeFile(svg, source(30));
    const options = { browser: process.env.GEOMETRY_BROWSER };
    const measured = await measureSvg(svg, drawio, options);
    assert.deepEqual(measured.gaps, []);
    assert.equal(measured.labels[0].bounds.x, 10);
    assert.ok(measured.labels[0].bounds.width < 200, 'measure text, not foreignObject width');
    assert.deepEqual(checkGeometry(measured).find(f => f.rule === 'label-label')?.cellIds, ['13', '9']);
    const runCli = extra => spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/check-diagram-geometry.mjs', import.meta.url)),
      '--drawio', drawio, '--svg', svg, ...(options.browser ? ['--browser', options.browser] : []), ...extra], { encoding: 'utf8', timeout: 30000 });
    const reportPath = join(directory, 'report.json'), previewPath = join(directory, 'marked.svg');
    assert.equal(runCli(['--report', reportPath, '--preview', previewPath]).status, 1);
    assert.equal(JSON.parse(await readFile(reportPath, 'utf8')).coverage, 'complete');
    assert.match(await readFile(previewPath, 'utf8'), /label-label: 13, 9/);
    assert.equal(await readFile(drawio, 'utf8'), xml, 'CLI input is read-only');
    assert.equal(runCli(['--report', drawio]).status, 2);
    assert.equal(await readFile(drawio, 'utf8'), xml);
    await writeFile(svg, source(180));
    assert.deepEqual(checkGeometry(await measureSvg(svg, drawio, options)), []);
    assert.equal(runCli([]).status, 0);
    await writeFile(drawio, xml.replace('edge="1" value="Second label"', 'vertex="1" style="shape=unknown" value="Second label"'));
    assert.ok((await measureSvg(svg, drawio, options)).gaps.some(g => g.reason === 'unsupported-shape'));
    assert.ok((await measureSvg(svg, drawio, options)).gaps.some(g => g.reason === 'stale-or-mismatched-svg'));
    assert.equal(runCli([]).status, 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('SVG clipping and unavailable fonts cannot produce complete coverage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'uml-clipping-test-'));
  try {
    const xml = '<mxfile><diagram><mxGraphModel><root><mxCell id="a" vertex="1" style="text;fillColor=none" value="This text is clipped"/></root></mxGraphModel></diagram></mxfile>';
    const embedded = xml.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
    const drawio = join(directory, 'probe.drawio'), svg = join(directory, 'probe.svg');
    await writeFile(drawio, xml);
    const source = `<svg xmlns="http://www.w3.org/2000/svg" content="${embedded}" width="400" height="100" viewBox="0 0 400 100"><defs><clipPath id="cut"><rect width="10" height="100"/></clipPath></defs><g data-cell-id="a" clip-path="url(#cut)"><text x="0" y="40" font-size="20" font-family="Arial"><tspan font-family="DefinitelyMissingGeometryFont">This text is clipped</tspan></text></g></svg>`;
    await writeFile(svg, source);
    const measured = await measureSvg(svg, drawio, { browser: process.env.GEOMETRY_BROWSER });
    assert.ok(checkGeometry(measured).some(f => f.rule === 'text-clipping'));
    assert.ok(measured.gaps.some(g => g.reason === 'unavailable-font'));
    await writeFile(svg, source.replace('<rect width="10" height="100"/>', '<ellipse cx="5" cy="50" rx="5" ry="50"/>'));
    assert.ok((await measureSvg(svg, drawio, { browser: process.env.GEOMETRY_BROWSER })).gaps
      .some(g => g.reason === 'unsupported-svg-clipping-or-filter'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('actual ellipse and rounded rectangle outlines exclude empty corners', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'uml-outline-test-'));
  try {
    const xml = '<mxfile><diagram><mxGraphModel><root><mxCell id="e" vertex="1" style="shape=ellipse"/><mxCell id="r" vertex="1" style="rounded=1"/></root></mxGraphModel></diagram></mxfile>';
    const embedded = xml.replaceAll('<', '&lt;').replaceAll('"', '&quot;');
    const drawio = join(directory, 'probe.drawio'), svg = join(directory, 'probe.svg');
    await writeFile(drawio, xml);
    await writeFile(svg, `<svg xmlns="http://www.w3.org/2000/svg" content="${embedded}" width="400" height="200" viewBox="0 0 400 200"><g data-cell-id="e"><ellipse cx="60" cy="60" rx="40" ry="40" fill="white" stroke="black"/></g><g data-cell-id="r"><rect x="150" y="20" width="80" height="80" rx="20" fill="white" stroke="black"/></g></svg>`);
    const measured = await measureSvg(svg, drawio, { browser: process.env.GEOMETRY_BROWSER });
    assert.deepEqual(measured.gaps, []);
    const at = (x, y) => ({ cellId: 'label', text: 'x', bounds: { x, y, width: 2, height: 2 } });
    assert.deepEqual(checkGeometry({ ...measured, labels: [at(20, 20), at(150, 20)] }), []);
    assert.ok(checkGeometry({ ...measured, labels: [at(58, 58)] }).some(f => f.rule === 'label-node'));
    const source = await readFile(svg, 'utf8');
    await writeFile(svg, source.replace('<g data-cell-id="r"><rect', '<defs><clipPath id="cut"><rect width="10" height="200"/></clipPath></defs><g data-cell-id="r"><rect clip-path="url(#cut)"'));
    assert.ok((await measureSvg(svg, drawio, { browser: process.env.GEOMETRY_BROWSER })).gaps
      .some(g => g.reason === 'clipped-shape-or-edge'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
