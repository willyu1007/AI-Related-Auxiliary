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
test('clipping, canvas overflow and shared channels have explicit results', () => {
  assert.ok(check([{ ...label('text', 0, 0), clipBounds: [rect(0, 0, 20, 10)] }]).some(f => f.rule === 'text-clipping'));
  assert.ok(checkGeometry({ labels: [label('text', -10, 0)], nodes: [], edges: [], canvas: rect(0, 0, 100, 100) })
    .some(f => f.rule === 'canvas-overflow'));
  const a = { cellId: 'a', segments: [[{ x: 0, y: 0 }, { x: 40, y: 0 }]] };
  const b = { cellId: 'b', segments: [[{ x: 10, y: 0 }, { x: 60, y: 0 }]] };
  assert.equal(check([], [], [a, b])[0]?.severity, 'warning');
});
test('endpoint ancestors are legitimate containers, while unrelated nodes remain obstacles', () => {
  const edge = { cellId: 'edge', terminalAncestors: ['container'], segments: [[{ x: 0, y: 20 }, { x: 60, y: 20 }]] };
  assert.deepEqual(check([], [node('container', -10, 0)], [edge]), []);
});
test('aligned nodes with a narrow shared interior collide in either order', () => {
  const a = node('a', 0, 0), b = node('b', 30, 0);
  assert.ok(check([], [a, b]).some(f => f.rule === 'node-node'));
  assert.ok(check([], [b, a]).some(f => f.rule === 'node-node'));
  assert.deepEqual(check([], [a, node('touching', 40, 0)]), []);
});
test('sequence messages may cross lifelines but their text must stay clear', () => {
  const lifeline = { cellId: 'actor', kind: 'lifeline', segments: [[{ x: 20, y: 0 }, { x: 20, y: 100 }]] };
  const message = { cellId: 'message', segments: [[{ x: 0, y: 40 }, { x: 60, y: 40 }]] };
  assert.deepEqual(check([], [], [lifeline, message]), []);
  assert.ok(check([label('message', 5, 20)], [], [lifeline, message]).some(f => f.rule === 'edge-label'));
});
