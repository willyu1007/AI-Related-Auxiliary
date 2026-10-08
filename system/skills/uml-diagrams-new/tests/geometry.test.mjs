import test from 'node:test';
import assert from 'node:assert/strict';
import { checkGeometry } from '../scripts/geometry-rules.mjs';

const rect = (x, y, width, height) => ({ x, y, width, height });
const label = (cellId, x, y) => ({ cellId, text: cellId, bounds: rect(x, y, 30, 10), ancestors: [] });
const node = (cellId, x, y, parent) => ({ cellId, ancestors: parent ? [parent] : [],
  polygon: [{ x, y }, { x: x + 40, y }, { x: x + 40, y: y + 40 }, { x, y: y + 40 }] });
const check = (labels = [], nodes = [], edges = []) => checkGeometry({ labels, nodes, edges });

test('ordinary edge labels collide; moving a label clears the collision', () => {
  assert.equal(check([label('13', 20, 30), label('9', 35, 32)])[0]?.rule, 'label-label');
  assert.deepEqual(check([label('13', 20, 30), label('9', 55, 32)]), []);
});
test('own labels and container ancestry are legitimate', () => {
  const own = { ...label('child', 5, 5), ancestors: ['parent'] };
  assert.deepEqual(check([own], [node('child', 0, 0, 'parent'), node('parent', -1, -1)]), []);
});
test('unrelated label-node, node-node and edge-node collisions are errors', () => {
  assert.ok(check([label('label', 10, 10)], [node('box', 0, 0)]).some(f => f.rule === 'label-node'));
  assert.ok(check([], [node('a', 0, 0), node('b', 20, 20)]).some(f => f.rule === 'node-node'));
  const edge = { cellId: 'edge', ancestors: [], segments: [[{ x: -10, y: 20 }, { x: 50, y: 20 }]] };
  assert.ok(check([], [node('box', 0, 0)], [edge]).some(f => f.rule === 'edge-node'));
  assert.deepEqual(check([], [node('box', 0, 0)], [{ ...edge, target: 'box' }]), []);
});
test('edge-label ignores its own label; unrelated crossings are warnings', () => {
  const edge = { cellId: 'a', ancestors: [], segments: [[{ x: 0, y: 5 }, { x: 50, y: 5 }]] };
  assert.deepEqual(check([label('a', 10, 0)], [], [edge]), []);
  assert.ok(check([label('b', 10, 0)], [], [edge]).some(f => f.rule === 'edge-label'));
  const crossing = { cellId: 'b', segments: [[{ x: 25, y: -10 }, { x: 25, y: 20 }]] };
  assert.equal(check([], [], [edge, crossing])[0]?.severity, 'warning');
});
test('diamond empty corners are not obstacles; text overflow is detected', () => {
  const diamond = { cellId: 'd', ancestors: [], polygon: [{ x: 20, y: 0 }, { x: 40, y: 20 }, { x: 20, y: 40 }, { x: 0, y: 20 }] };
  assert.deepEqual(check([{ ...label('corner', 0, 0), bounds: rect(0, 0, 4, 4) }], [diamond]), []);
  assert.ok(check([label('box', 20, 10)], [node('box', 0, 0)]).some(f => f.rule === 'text-overflow'));
});
