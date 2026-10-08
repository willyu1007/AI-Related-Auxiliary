import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareMermaid } from '../scripts/prepare-mermaid.mjs';

test('select layout before conversion, preserving direction and other configuration', async () => {
  const source = '%%{init: {"theme":"base","flowchart":{"nodeSpacing":70}}}%%\nflowchart LR\n A-->B';
  const prepared = await prepareMermaid(source, 'flowchart');
  assert.match(prepared, /"layout":"elk"/);
  assert.match(prepared, /"nodeSpacing":70/);
  assert.match(prepared, /flowchart LR\n A-->B/);
  assert.equal((prepared.match(/%%\{init:/g) ?? []).length, 1);
  for (const [type, declaration] of [['class', 'classDiagram'], ['state-machine', 'stateDiagram-v2'], ['structure', 'flowchart TB']])
    assert.match(await prepareMermaid(declaration, type), /"layout":"elk"/);
});
test('sequence retains message order and dedicated configuration', async () => {
  const source = '%%{init: {"layout":"elk","sequence":{"mirrorActors":false}}}%%\nsequenceDiagram\n participant B\n participant A\n B->>A: hello';
  const prepared = await prepareMermaid(source, 'sequence');
  assert.doesNotMatch(prepared, /"layout"/);
  assert.match(prepared, /"mirrorActors":false/);
  assert.match(prepared, /participant B\n participant A\n B->>A: hello/);
  await assert.rejects(prepareMermaid('sequenceDiagram', 'class'), /does not match/);
});
