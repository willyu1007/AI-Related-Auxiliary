import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
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
    await writeFile(svg, source(180));
    assert.deepEqual(checkGeometry(await measureSvg(svg, drawio, options)), []);
    await writeFile(drawio, xml.replace('edge="1" value="Second label"', 'vertex="1" style="shape=unknown" value="Second label"'));
    assert.ok((await measureSvg(svg, drawio, options)).gaps.some(g => g.reason === 'unsupported-shape'));
    assert.ok((await measureSvg(svg, drawio, options)).gaps.some(g => g.reason === 'stale-or-mismatched-svg'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
