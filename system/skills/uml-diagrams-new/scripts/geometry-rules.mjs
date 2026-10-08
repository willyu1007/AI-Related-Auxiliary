// Rectangle intersection and Liang–Barsky clipping adapted from Sunwood-ai-labs.
// See ../third-party/NOTICE.md and Sunwood-MIT.txt. Coordinates are SVG units.
const EPS = 0.5;
export function intersectionRect(a, b) {
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return right - x > EPS && bottom - y > EPS ? { x, y, width: right - x, height: bottom - y } : null;
}
function interiorLength([a, b], rect) {
  const dx = b.x - a.x, dy = b.y - a.y;
  let t0 = 0, t1 = 1;
  for (const [p, q] of [[-dx, a.x - rect.x], [dx, rect.x + rect.width - a.x],
    [-dy, a.y - rect.y], [dy, rect.y + rect.height - a.y]]) {
    if (Math.abs(p) < 1e-9) { if (q <= EPS) return 0; continue; }
    if (p < 0) t0 = Math.max(t0, q / p); else t1 = Math.min(t1, q / p);
    if (t0 >= t1) return 0;
  }
  return (t1 - t0) * Math.hypot(dx, dy);
}
const cross = (a, b) => a.x * b.y - a.y * b.x;
const subtract = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
// Unlike upstream, parameter tolerance is dimensionless, separate from pixel tolerance.
function crossing([a, b], [c, d]) {
  const r = subtract(b, a), s = subtract(d, c), denominator = cross(r, s);
  if (Math.abs(denominator) < 1e-9) return null;
  const delta = subtract(c, a), t = cross(delta, s) / denominator, u = cross(delta, r) / denominator;
  if (t <= 1e-9 || t >= 1 - 1e-9 || u <= 1e-9 || u >= 1 - 1e-9) return null;
  return { x: a.x + t * r.x, y: a.y + t * r.y };
}
const sides = polygon => polygon.map((point, i) => [point, polygon[(i + 1) % polygon.length]]);
function inside(point, polygon) {
  let result = false;
  for (const [a, b] of sides(polygon)) {
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length && Math.abs(cross(subtract(point, a), subtract(b, a))) / length < EPS &&
      point.x >= Math.min(a.x, b.x) - EPS && point.x <= Math.max(a.x, b.x) + EPS &&
      point.y >= Math.min(a.y, b.y) - EPS && point.y <= Math.max(a.y, b.y) + EPS) return false;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}
const corners = r => [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y },
  { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height }];
function polygonsOverlap(a, b) {
  if (!intersectionRect(polygonBounds(a), polygonBounds(b))) return false;
  return a.some(p => inside(p, b)) || b.some(p => inside(p, a)) ||
    sides(a).some(([p, q]) => inside({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, b)) ||
    sides(b).some(([p, q]) => inside({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }, a)) ||
    sides(a).some(sa => sides(b).some(sb => crossing(sa, sb))) ||
    inside({ x: a.reduce((n, p) => n + p.x, 0) / a.length, y: a.reduce((n, p) => n + p.y, 0) / a.length }, b);
}
function onBoundary(point, polygon) {
  return sides(polygon).some(([a, b]) => {
    const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
    if (!lengthSquared) return Math.hypot(point.x - a.x, point.y - a.y) <= EPS;
    const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
    return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy) <= EPS;
  });
}
const related = (a, b) => a.cellId === b.cellId || (a.ancestors ?? []).includes(b.cellId) || (b.ancestors ?? []).includes(a.cellId);
const polygonBounds = p => ({ x: Math.min(...p.map(v => v.x)), y: Math.min(...p.map(v => v.y)),
  width: Math.max(...p.map(v => v.x)) - Math.min(...p.map(v => v.x)), height: Math.max(...p.map(v => v.y)) - Math.min(...p.map(v => v.y)) });
const exceeds = (r, box) => r.x < box.x - EPS || r.y < box.y - EPS || r.x + r.width > box.x + box.width + EPS || r.y + r.height > box.y + box.height + EPS;
function channelContact([a, b], [c, d]) {
  const point = crossing([a, b], [c, d]);
  if (point) return point;
  const vector = subtract(b, a), length = Math.hypot(vector.x, vector.y);
  if (!length || Math.abs(cross(vector, subtract(c, a))) / length > EPS || Math.abs(cross(vector, subtract(d, a))) / length > EPS) return null;
  const axis = Math.abs(vector.x) >= Math.abs(vector.y) ? 'x' : 'y';
  const start = Math.max(Math.min(a[axis], b[axis]), Math.min(c[axis], d[axis]));
  const end = Math.min(Math.max(a[axis], b[axis]), Math.max(c[axis], d[axis]));
  if (end - start <= EPS) return null;
  const t = (start - a[axis]) / vector[axis];
  return { x: a.x + t * vector.x, y: a.y + t * vector.y, overlapLength: end - start };
}

export function checkGeometry({ labels, nodes, edges, canvas }) {
  const findings = [];
  const add = (rule, a, b, geometry, severity = 'error') => findings.push({ rule, severity,
    cellIds: [...new Set([a.cellId, b?.cellId].filter(Boolean))], texts: [a.text, b?.text].filter(Boolean), geometry });
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if ((label.clipBounds ?? []).some(box => exceeds(label.bounds, box))) add('text-clipping', label, null, label.bounds);
    for (const other of labels.slice(i + 1)) {
      const overlap = intersectionRect(label.bounds, other.bounds);
      if (overlap && label.cellId !== other.cellId) add('label-label', label, other, overlap);
    }
    for (const node of nodes) {
      if (related(label, node)) {
        if (label.cellId === node.cellId && label.contained !== false) {
          const box = polygonBounds(node.polygon);
          const r = label.bounds;
          if (exceeds(r, box) || corners(r).some(p => !inside(p, node.polygon) && !onBoundary(p, node.polygon)))
            add('text-overflow', label, node, r);
        }
      } else if (polygonsOverlap(corners(label.bounds), node.polygon)) add('label-node', label, node, label.bounds);
    }
    if (canvas) {
      const r = label.bounds;
      if (exceeds(r, canvas)) add('canvas-overflow', label, null, r);
    }
    for (const edge of edges) if (!related(label, edge) && edge.segments.some(segment => interiorLength(segment, label.bounds) > EPS))
      add('edge-label', label, edge, label.bounds);
  }
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    if (canvas && exceeds(polygonBounds(node.polygon), canvas)) add('canvas-overflow', node, null, polygonBounds(node.polygon));
    for (const other of nodes.slice(i + 1)) if (!related(node, other) && polygonsOverlap(node.polygon, other.polygon))
      add('node-node', node, other, intersectionRect(polygonBounds(node.polygon), polygonBounds(other.polygon)));
    for (const edge of edges) if (!related(node, edge) && !(edge.terminalAncestors ?? []).includes(node.cellId) && edge.source !== node.cellId && edge.target !== node.cellId &&
      edge.segments.some(([a, b]) => inside(a, node.polygon) || inside(b, node.polygon) ||
        sides(node.polygon).some(side => crossing([a, b], side)))) add('edge-node', edge, node, polygonBounds(node.polygon));
  }
  for (let i = 0; i < edges.length; i++) for (const other of edges.slice(i + 1)) {
    const edge = edges[i];
    if (edge.kind === 'lifeline' || other.kind === 'lifeline') continue;
    const point = edge.segments.flatMap(a => other.segments.map(b => channelContact(a, b))).find(Boolean);
    if (point) add('edge-crossing', edge, other, point, 'warning');
  }
  return findings;
}
