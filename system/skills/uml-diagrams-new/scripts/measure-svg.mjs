import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

/** Measure rendered text and outlines in the root SVG coordinate system. */
export async function measureSvg(svgPath, drawioPath, { browser: executablePath } = {}) {
  const { chromium } = require('playwright');
  const [svgSource, drawioSource] = await Promise.all([readFile(svgPath, 'utf8'), readFile(drawioPath, 'utf8')]);
  const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, colorScheme: 'light' });
    await page.route('**/*', route => route.abort());
    await page.setContent('<!doctype html><html><body style="margin:0"></body></html>');
    return await page.evaluate(async ({ svgSource, drawioSource }) => {
      const parser = new DOMParser();
      const parse = source => {
        const doc = parser.parseFromString(source, 'application/xml');
        if (doc.querySelector('parsererror')) throw new Error('Invalid XML/SVG');
        return doc;
      };
      const drawio = parse(drawioSource), svgDoc = parse(svgSource);
      if (svgDoc.documentElement.localName !== 'svg') throw new Error('Expected SVG');
      const gaps = [];
      const signature = doc => [...doc.querySelectorAll('mxCell')].map(cell => {
        const owner = cell.parentElement;
        const canonical = el => ({ tag: el.localName,
          attributes: [...el.attributes].map(a => [a.name, a.value]).sort(([a], [b]) => a.localeCompare(b)),
          children: [...el.children].map(canonical) });
        return { id: cell.getAttribute('id') ?? owner?.getAttribute('id'), label: owner?.getAttribute('label'), cell: canonical(cell) };
      });
      const embedded = svgDoc.documentElement.getAttribute('content');
      if (!embedded) gaps.push({ reason: 'unverified-svg-source', detail: 'Export SVG with draw.io -e to verify freshness.' });
      else {
        const embeddedDoc = parse(embedded);
        if (JSON.stringify(signature(embeddedDoc)) !== JSON.stringify(signature(drawio)))
          gaps.push({ reason: 'stale-or-mismatched-svg', detail: 'Re-export SVG after every draw.io edit.' });
      }
      const diagrams = [...drawio.querySelectorAll('diagram')];
      if (diagrams.length > 1) gaps.push({ reason: 'multiple-pages', detail: 'Supply one uncompressed draw.io page per SVG.' });
      const root = diagrams[0] ?? drawio;
      const cells = new Map();
      for (const cell of root.querySelectorAll('mxCell')) {
        const wrapper = cell.parentElement;
        const id = cell.getAttribute('id') ?? wrapper?.getAttribute('id');
        if (!id) continue;
        const style = Object.fromEntries((cell.getAttribute('style') ?? '').split(';').filter(Boolean).map(s => {
          const at = s.indexOf('='); return at < 0 ? [s, '1'] : [s.slice(0, at), s.slice(at + 1)];
        }));
        cells.set(id, { cellId: id, parent: cell.getAttribute('parent'), source: cell.getAttribute('source'),
          target: cell.getAttribute('target'), edge: cell.getAttribute('edge') === '1', vertex: cell.getAttribute('vertex') === '1',
          text: cell.getAttribute('value') ?? wrapper?.getAttribute('label') ?? '', style });
      }
      if (![...cells.values()].some(c => c.edge || c.vertex)) throw new Error('Uncompressed mxGraphModel required');
      const svg = document.importNode(svgDoc.documentElement, true);
      for (const el of svg.querySelectorAll('*')) {
        if (['script', 'iframe'].includes(el.localName)) el.remove();
        for (const attr of [...el.attributes]) if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name);
      }
      document.body.append(svg);
      await document.fonts.ready;
      const matrix = svg.getScreenCTM().inverse();
      const point = (x, y) => { const p = new DOMPoint(x, y).matrixTransform(matrix); return { x: p.x, y: p.y }; };
      const bounds = r => {
        const a = point(r.left, r.top), b = point(r.right, r.bottom);
        return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
      };
      const ancestors = cell => {
        const ids = []; let parent = cell.parent;
        while (parent && !ids.includes(parent)) { ids.push(parent); parent = cells.get(parent)?.parent; }
        return ids;
      };
      const labels = [], nodes = [], edges = [], seen = new Set();
      const fonts = new Map();
      const registerFont = (element, cellId) => {
        const family = getComputedStyle(element).fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, '');
        if (!fonts.has(family)) fonts.set(family, []);
        fonts.get(family).push(cellId);
      };
      // draw.io class members use SVG rectangular clipPaths; other clips stay gaps.
      const clippingBounds = (element, cellId) => {
        const result = [];
        for (let ancestor = element; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          if (style.maskImage !== 'none' || style.filter !== 'none')
            gaps.push({ cellId, reason: 'unsupported-svg-clipping-or-filter' });
          if (style.clipPath === 'none') continue;
          const id = style.clipPath.match(/#([^"')]+)["']?\)$/)?.[1];
          const clip = id ? document.getElementById(id) : null;
          const shape = clip?.children[0];
          const transform = typeof ancestor.getScreenCTM === 'function' ? matrix.multiply(ancestor.getScreenCTM()) : null;
          if (clip?.localName === 'clipPath' && clip.children.length === 1 && shape.localName === 'rect' &&
            !clip.hasAttribute('transform') && !shape.hasAttribute('transform') && !shape.hasAttribute('rx') &&
            (!clip.hasAttribute('clipPathUnits') || clip.getAttribute('clipPathUnits') === 'userSpaceOnUse') &&
            transform && Math.abs(transform.b) < 1e-9 && Math.abs(transform.c) < 1e-9) {
            const a = new DOMPoint(shape.x.baseVal.value, shape.y.baseVal.value).matrixTransform(transform);
            const b = new DOMPoint(shape.x.baseVal.value + shape.width.baseVal.value, shape.y.baseVal.value + shape.height.baseVal.value).matrixTransform(transform);
            result.push({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y) });
          } else gaps.push({ cellId, reason: 'unsupported-svg-clipping-or-filter', detail: style.clipPath });
        }
        return result;
      };
      // SVGGeometryElement exposes the actual exported outlines, including curves.
      const outline = shape => {
        const transform = matrix.multiply(shape.getScreenCTM());
        const length = shape.getTotalLength(), count = Math.max(4, Math.ceil(length / 0.5));
        const points = [];
        for (let i = 0; i <= count; i++) {
          const p = shape.getPointAtLength(length * i / count).matrixTransform(transform);
          const next = { x: p.x, y: p.y };
          if (points.length >= 2) {
            const a = points.at(-2), b = points.at(-1);
            const area = Math.abs((b.x - a.x) * (next.y - b.y) - (b.y - a.y) * (next.x - b.x));
            if (area < 1e-6) points.pop();
          }
          points.push(next);
        }
        return points;
      };
      for (const group of svg.querySelectorAll('g[data-cell-id]')) {
        const id = group.getAttribute('data-cell-id'), cell = cells.get(id);
        if (!cell || (!cell.edge && !cell.vertex)) continue;
        seen.add(id);
        const groupClips = clippingBounds(group, id);
        if (groupClips.length && (cell.edge || cell.style.text !== '1'))
          gaps.push({ cellId: id, reason: 'clipped-shape-or-edge', detail: 'Text clipping is supported; clipped paths/outlines are not.' });
        const base = { cellId: id, ancestors: ancestors(cell), text: cell.text, source: cell.source, target: cell.target,
          terminalAncestors: [cell.source, cell.target].flatMap(terminal => cells.has(terminal) ? ancestors(cells.get(terminal)) : []) };
        const owned = el => el.closest('[data-cell-id]') === group;
        for (const foreign of [...group.querySelectorAll('foreignObject')].filter(owned)) {
          const walker = document.createTreeWalker(foreign, NodeFilter.SHOW_TEXT);
          while (walker.nextNode()) {
            const text = walker.currentNode;
            if (!text.textContent.trim()) continue;
            registerFont(text.parentElement, id);
            const range = document.createRange(); range.selectNodeContents(text);
            const clipBounds = clippingBounds(text.parentElement, id);
            for (let ancestor = text.parentElement; ancestor; ancestor = ancestor.parentElement) {
              const style = getComputedStyle(ancestor);
              if (ancestor === foreign) break;
              if (['hidden', 'clip'].includes(style.overflow)) clipBounds.push(bounds(ancestor.getBoundingClientRect()));
            }
            for (const rect of range.getClientRects()) if (rect.width > 0 && rect.height > 0)
              labels.push({ ...base, text: text.textContent.trim(), bounds: bounds(rect), clipBounds,
                contained: cell.vertex && cell.style.labelPosition === undefined });
          }
        }
        for (const text of [...group.querySelectorAll('text')].filter(owned)) {
          if (text.closest('foreignObject') || text.closest('switch')?.querySelector('foreignObject')) continue;
          const rect = text.getBoundingClientRect();
          if (rect.width && rect.height) {
            const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
            while (walker.nextNode()) if (walker.currentNode.textContent.trim()) registerFont(walker.currentNode.parentElement, id);
            labels.push({ ...base, text: text.textContent.trim(), bounds: bounds(rect), clipBounds: clippingBounds(text, id), contained: cell.vertex });
          }
        }
        const shapes = [...group.querySelectorAll('path,rect,ellipse,circle,polygon,polyline')].filter(owned)
          .filter(s => !s.closest('foreignObject') && typeof s.getTotalLength === 'function');
        for (const shape of shapes) if (clippingBounds(shape, id).length)
          gaps.push({ cellId: id, reason: 'clipped-shape-or-edge' });
        if (cell.edge) {
          const paths = shapes.filter(s => getComputedStyle(s).fill === 'none' && getComputedStyle(s).stroke !== 'none');
          const segments = paths.flatMap(s => { const p = outline(s); return p.slice(1).map((v, i) => [p[i], v]); });
          if (!segments.length) gaps.push({ cellId: id, reason: 'missing-edge-path' });
          else edges.push({ ...base, segments });
        } else {
          if (cell.style.shape === 'umlLifeline') {
            const segments = shapes.filter(s => getComputedStyle(s).fill === 'none' && getComputedStyle(s).stroke !== 'none')
              .flatMap(s => { const p = outline(s); return p.slice(1).map((v, i) => [p[i], v]); });
            if (segments.length) edges.push({ ...base, kind: 'lifeline', segments });
            else gaps.push({ cellId: id, reason: 'missing-lifeline-path' });
          }
          const supported = !cell.style.shape || ['rectangle', 'rhombus', 'ellipse', 'swimlane', 'umlLifeline', 'group',
            'cylinder3', 'mxgraph.flowchart.start_1', 'mxgraph.flowchart.on-page_reference'].includes(cell.style.shape);
          if (!supported) gaps.push({ cellId: id, reason: 'unsupported-shape', detail: cell.style.shape });
          const filled = shapes.filter(s => getComputedStyle(s).fill !== 'none' && getComputedStyle(s).fill !== 'transparent');
          if (supported && filled.length) {
            // Lifeline obstacle is its header, not the entire participant column.
            const candidates = cell.style.shape === 'umlLifeline' ? filled.slice(0, 1) : filled;
            if (cell.style.swimlane === '1' || cell.style.shape === 'swimlane') {
              const polygons = candidates.flatMap(outline);
              const x = Math.min(...polygons.map(p => p.x)), y = Math.min(...polygons.map(p => p.y));
              const right = Math.max(...polygons.map(p => p.x)), bottom = Math.max(...polygons.map(p => p.y));
              nodes.push({ ...base, polygon: [{ x, y }, { x: right, y }, { x: right, y: bottom }, { x, y: bottom }] });
            } else {
              const largest = candidates.sort((a, b) => b.getBBox().width * b.getBBox().height - a.getBBox().width * a.getBBox().height)[0];
              nodes.push({ ...base, polygon: outline(largest) });
            }
          } else if (supported && cell.style.shape !== 'group' && cell.style.text !== '1' && cell.style.edgeLabel !== '1' && cell.style.fillColor !== 'none')
            gaps.push({ cellId: id, reason: 'missing-node-outline' });
        }
        if (cell.text && !labels.some(l => l.cellId === id) && cell.style.noLabel !== '1')
          gaps.push({ cellId: id, reason: 'missing-visible-text', detail: cell.text });
      }
      for (const cell of cells.values()) if ((cell.edge || cell.vertex) && !seen.has(cell.cellId))
        gaps.push({ cellId: cell.cellId, reason: 'missing-svg-cell' });
      const genericFonts = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace'];
      for (const [family, ids] of fonts) {
        if (genericFonts.includes(family.toLowerCase())) continue;
        try { await new FontFace('__geometry_font_probe', `local(${JSON.stringify(family)})`).load(); }
        catch { gaps.push({ reason: 'unavailable-font', cellIds: [...new Set(ids)], detail: family }); }
      }
      const view = svg.viewBox.baseVal;
      return { page: diagrams[0]?.getAttribute('name') ?? '1', labels, nodes, edges, gaps,
        canvas: { x: view.x, y: view.y, width: view.width, height: view.height },
        measurement: { text: 'browser Range/client rectangles after fonts.ready', fonts: [...fonts.keys()],
          fontAvailability: 'local FontFace load', outlineStep: 0.5 } };
    }, { svgSource, drawioSource });
  } finally { await browser.close(); }
}
