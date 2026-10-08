import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { pathToFileURL } from 'node:url';

/** Preserve source semantics while selecting layout before draw.io conversion. */
export async function prepareMermaid(source, type) {
  const declarations = { flowchart: /^(flowchart|graph)\b/m, class: /^classDiagram\b/m,
    sequence: /^sequenceDiagram\b/m, 'state-machine': /^stateDiagram(?:-v2)?\b/m, structure: /^(flowchart|graph)\b/m };
  if (!declarations[type]?.test(source)) throw new Error(`Source declaration does not match DiagramType ${type}`);
  if (/^\s*---/.test(source)) throw new Error('Move YAML front-matter configuration to a JSON %%{init: ...}%% directive before using this wrapper.');
  const directives = [...source.matchAll(/%%\{init:\s*([\s\S]*?)\}%%/g)];
  if (directives.length > 1) throw new Error('Use one JSON Mermaid init directive.');
  const config = directives.length ? JSON.parse(directives[0][1]) : {};
  const preset = JSON.parse(await readFile(new URL(`../generation/${type}.json`, import.meta.url), 'utf8'));
  if (type === 'sequence') {
    delete config.layout;
    // Sequence owns its participant/message layout; preserve its own settings.
  } else {
    config.layout = preset.layout;
    if (preset.flowchart) config.flowchart = { ...config.flowchart, ...preset.flowchart };
  }
  const body = source.replace(/%%\{init:\s*[\s\S]*?\}%%/g, '').trimStart();
  return `%%{init: ${JSON.stringify(config)}}%%\n${body}`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { values } = parseArgs({ options: Object.fromEntries(['input', 'output', 'type'].map(key => [key, { type: 'string' }])) });
    if (!values.input || !values.output || !values.type) throw new Error('Required: --input source.mmd --output prepared.mmd --type diagram-type');
    await writeFile(values.output, await prepareMermaid(await readFile(values.input, 'utf8'), values.type));
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
}
