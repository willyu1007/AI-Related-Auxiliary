import crypto from 'node:crypto';

export const NORMALIZED_DB_SCHEMA_VERSION = 'normalized-db-schema-v2';
export const PRISMA_SOURCE_PATH = 'prisma/schema.prisma';

const SCALAR_TYPES = new Set([
  'String', 'Boolean', 'Int', 'BigInt', 'Float', 'Decimal',
  'DateTime', 'Json', 'Bytes', 'Unsupported'
]);

function sortBy(values, key) {
  return [...values].sort((a, b) => String(key(a)).localeCompare(String(key(b))));
}

function unique(values) {
  return [...new Set(values)];
}

export function checksumSha256(text) {
  return crypto.createHash('sha256').update(String(text), 'utf8').digest('hex');
}

export function stableStringify(value, space = 0) {
  function normalize(item) {
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === 'object') {
      return Object.fromEntries(
        Object.keys(item).sort().map((key) => [key, normalize(item[key])])
      );
    }
    return item;
  }
  return JSON.stringify(normalize(value), null, space);
}

export function withoutUpdatedAt(contract) {
  if (!contract || typeof contract !== 'object') return contract;
  const copy = structuredClone(contract);
  delete copy.updatedAt;
  return copy;
}

function stripComments(text) {
  let out = '';
  let quote = null;
  let blockComment = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        out += '  ';
        i += 1;
      } else {
        out += ch === '\n' ? '\n' : ' ';
      }
      continue;
    }
    if (!quote && ch === '/' && next === '*') {
      blockComment = true;
      out += '  ';
      i += 1;
      continue;
    }
    if (!quote && ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') {
        out += ' ';
        i += 1;
      }
      if (i < text.length) out += '\n';
      continue;
    }
    if (quote) {
      out += ch;
      if (ch === '\\') {
        if (i + 1 < text.length) out += text[++i];
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    out += ch;
  }
  return out;
}

function extractBlocks(text) {
  const blocks = [];
  const startRe = /\b(datasource|generator|model|enum|view|type)\s+([A-Za-z_]\w*)\s*\{/g;
  let match;
  while ((match = startRe.exec(text)) !== null) {
    const open = startRe.lastIndex - 1;
    let depth = 1;
    let quote = null;
    let close = -1;
    for (let i = open + 1; i < text.length; i += 1) {
      const ch = text[i];
      if (quote) {
        if (ch === '\\') i += 1;
        else if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          close = i;
          break;
        }
      }
    }
    if (close === -1) {
      blocks.push({ kind: match[1], name: match[2], body: text.slice(open + 1), unclosed: true });
      break;
    }
    blocks.push({ kind: match[1], name: match[2], body: text.slice(open + 1, close), unclosed: false });
    startRe.lastIndex = close + 1;
  }
  return blocks;
}

function stringList(raw) {
  return [...String(raw || '').matchAll(/"((?:\\.|[^"])*)"/g)].map((m) => m[1]);
}

function fieldList(raw) {
  return String(raw || '').split(',').map((item) => item.trim())
    .filter(Boolean).map((item) => item.split('(')[0].trim());
}

function attributes(text) {
  const result = [];
  for (let i = 0; i < text.length;) {
    while (i < text.length && /\s/.test(text[i])) i += 1;
    if (i >= text.length) break;
    if (text[i] !== '@') return { tokens: result, remainder: text.slice(i).trim() };
    const start = i++;
    let depth = 0;
    let quote = null;
    while (i < text.length) {
      const ch = text[i];
      if (quote) {
        if (ch === '\\') i += 2;
        else {
          if (ch === quote) quote = null;
          i += 1;
        }
        continue;
      }
      if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '(') depth += 1;
      else if (ch === ')') depth = Math.max(0, depth - 1);
      else if (depth === 0 && /\s/.test(ch)) break;
      i += 1;
    }
    result.push(text.slice(start, i));
  }
  return { tokens: result, remainder: '' };
}

function argument(token, name) {
  const keyed = token.match(new RegExp(`${name}\\s*:\\s*\\[([^\\]]*)\\]`));
  return keyed ? fieldList(keyed[1]) : [];
}

function relationFrom(token) {
  const body = token.match(/^@relation(?:\((.*)\))?$/)?.[1] || '';
  const keyedName = body.match(/\bname\s*:\s*"([^"]+)"/)?.[1];
  const positionalName = body.match(/^\s*"([^"]+)"/)?.[1];
  return {
    name: keyedName || positionalName || null,
    fields: argument(token, 'fields'),
    references: argument(token, 'references')
  };
}

function modelAttributes(lines, modelName, warnings) {
  const result = { dbName: null, schema: null, indexes: [] };
  for (const line of lines) {
    const map = line.match(/^@@map\(\s*"([^"]+)"\s*\)$/);
    if (map) {
      result.dbName = map[1];
      continue;
    }
    const schema = line.match(/^@@schema\(\s*"([^"]+)"\s*\)$/);
    if (schema) {
      result.schema = schema[1];
      continue;
    }
    const index = line.match(/^@@(id|unique|index)\s*\(\s*\[([^\]]*)\]([\s\S]*)\)$/);
    if (index) {
      result.indexes.push({
        type: index[1] === 'id' ? 'primary' : index[1],
        fields: fieldList(index[2]),
        name: index[3].match(/\bname\s*:\s*"([^"]+)"/)?.[1] || null,
        map: index[3].match(/\bmap\s*:\s*"([^"]+)"/)?.[1] || null
      });
      continue;
    }
    warnings.push(`Model ${modelName}: unsupported model attribute "${line}".`);
  }
  result.indexes = sortBy(
    result.indexes,
    (item) => `${item.type}:${item.fields.join(',')}:${item.name || ''}:${item.map || ''}`
  );
  return result;
}

function parseDatasource(block) {
  const provider = block?.body.match(/\bprovider\s*=\s*"([^"]+)"/)?.[1] || null;
  const schemasRaw = block?.body.match(/\bschemas\s*=\s*\[([^\]]*)\]/)?.[1] || '';
  return { provider, schemas: sortBy(unique(stringList(schemasRaw)), (value) => value) };
}

function dialect(provider) {
  const value = String(provider || '').toLowerCase();
  if (value.includes('postgres')) return 'postgresql';
  if (value.includes('mysql')) return 'mysql';
  if (value.includes('sqlite')) return 'sqlite';
  if (value.includes('sqlserver')) return 'sqlserver';
  if (value.includes('mongodb')) return 'mongodb';
  return value || 'generic';
}

function parseEnums(blocks, warnings) {
  return sortBy(blocks.map((block) => {
    const values = [];
    let dbName = null;
    for (const raw of block.body.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const map = line.match(/^@@map\(\s*"([^"]+)"\s*\)$/);
      if (map) {
        dbName = map[1];
        continue;
      }
      const value = line.match(/^([A-Za-z_]\w*)(?:\s+@map\(\s*"([^"]+)"\s*\))?$/);
      if (value) values.push({ name: value[1], dbName: value[2] || null });
      else warnings.push(`Enum ${block.name}: could not safely parse "${line}".`);
    }
    return { name: block.name, dbName, values: sortBy(values, (value) => value.name) };
  }), (item) => item.name);
}

function parseModels(blocks, enumNames, warnings) {
  const modelNames = new Set(blocks.map((block) => block.name));
  return sortBy(blocks.map((block) => {
    const fieldLines = [];
    const attributeLines = [];
    for (const raw of block.body.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('@@')) attributeLines.push(line);
      else fieldLines.push(line);
    }
    const modelMeta = modelAttributes(attributeLines, block.name, warnings);
    const columns = [];
    const relations = [];
    for (const line of fieldLines) {
      const match = line.match(/^([A-Za-z_]\w*)\s+([A-Za-z_]\w*(?:\[\]|\?)?)\s*(.*)$/);
      if (!match) {
        warnings.push(`Model ${block.name}: could not safely parse field line "${line}".`);
        continue;
      }
      const [, name, rawType, tail] = match;
      const parsedAttrs = attributes(tail);
      if (parsedAttrs.remainder) {
        warnings.push(`Model ${block.name}.${name}: unsupported trailing syntax "${parsedAttrs.remainder}".`);
        continue;
      }
      const list = rawType.endsWith('[]');
      const optional = rawType.endsWith('?');
      const type = rawType.replace(/\[\]$|\?$/g, '');
      const relationToken = parsedAttrs.tokens.find((token) => token.startsWith('@relation'));
      const isRelation = modelNames.has(type) || Boolean(relationToken);
      if (isRelation) {
        const relation = relationToken ? relationFrom(relationToken) : { name: null, fields: [], references: [] };
        relations.push({
          field: name, to: type, optional, list,
          relationName: relation.name, fields: relation.fields, references: relation.references
        });
        continue;
      }
      if (!SCALAR_TYPES.has(type) && !enumNames.has(type)) {
        warnings.push(`Model ${block.name}.${name}: unsupported field type "${type}".`);
      }
      const mapToken = parsedAttrs.tokens.find((token) => token.startsWith('@map('));
      const dbToken = parsedAttrs.tokens.find((token) => token.startsWith('@db.'));
      const defaultToken = parsedAttrs.tokens.find((token) => token.startsWith('@default('));
      columns.push({
        name,
        type,
        optional,
        list,
        dbName: mapToken?.match(/^@map\(\s*"([^"]+)"\s*\)$/)?.[1] || null,
        dbType: dbToken ? dbToken.slice('@db.'.length) : null,
        default: defaultToken?.match(/^@default\(([\s\S]*)\)$/)?.[1]?.trim() || null,
        primaryKey: parsedAttrs.tokens.some((token) => /^@id(?:$|\()/.test(token)),
        unique: parsedAttrs.tokens.some((token) => /^@unique(?:$|\()/.test(token))
      });
    }
    return {
      name: block.name,
      dbName: modelMeta.dbName,
      schema: modelMeta.schema,
      columns: sortBy(columns, (column) => column.name),
      relations: sortBy(relations, (relation) => relation.field),
      indexes: modelMeta.indexes
    };
  }), (item) => item.name);
}

export function parsePrismaSchema(rawText) {
  const warnings = [];
  const text = stripComments(String(rawText || ''));
  const blocks = extractBlocks(text);
  for (const block of blocks) {
    if (block.unclosed) warnings.push(`${block.kind} ${block.name}: block is not closed.`);
    if (block.kind === 'view' || block.kind === 'type') {
      warnings.push(`Unsupported Prisma ${block.kind} block "${block.name}" was not projected.`);
    }
  }
  const datasourceBlocks = blocks.filter((block) => block.kind === 'datasource');
  if (datasourceBlocks.length > 1) warnings.push('Multiple datasource blocks found; only the first was projected.');
  const datasource = parseDatasource(datasourceBlocks[0]);
  const enums = parseEnums(blocks.filter((block) => block.kind === 'enum'), warnings);
  const enumNames = new Set(enums.map((item) => item.name));
  const tables = parseModels(blocks.filter((block) => block.kind === 'model'), enumNames, warnings);
  return {
    database: {
      kind: dialect(datasource.provider) === 'mongodb' ? 'document' : 'relational',
      dialect: dialect(datasource.provider),
      provider: datasource.provider,
      schemas: datasource.schemas
    },
    enums,
    tables,
    warnings: sortBy(unique(warnings), (warning) => warning)
  };
}

export function buildContract(schemaText, updatedAt = new Date().toISOString()) {
  const parsed = parsePrismaSchema(schemaText);
  return {
    contract: {
      version: NORMALIZED_DB_SCHEMA_VERSION,
      updatedAt,
      ssot: {
        mode: 'repo-prisma',
        source: {
          kind: 'prisma-schema',
          path: PRISMA_SOURCE_PATH,
          checksumSha256: checksumSha256(schemaText)
        }
      },
      database: parsed.database,
      enums: parsed.enums,
      tables: parsed.tables,
      notes: 'Generated projection of prisma/schema.prisma; do not edit by hand.'
    },
    warnings: parsed.warnings
  };
}
