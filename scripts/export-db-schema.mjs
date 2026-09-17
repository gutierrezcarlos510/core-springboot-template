#!/usr/bin/env node
/**
 * Documenta el esquema de base de datos de este backend a partir de sus migraciones Flyway.
 *
 *   node scripts/export-db-schema.mjs --service CORE
 *   node scripts/export-db-schema.mjs --service CORE --check   # CI: falla si las migraciones no aplican o docs está desactualizado
 *
 * Crea una base temporal en un Postgres LOCAL, aplica db/migration desde cero, lee el
 * catálogo y la elimina. Nunca toca bases existentes. Conexión por variables estándar
 * PGHOST/PGPORT/PGUSER/PGPASSWORD (por defecto localhost:5432, postgres/postgres); el
 * usuario necesita permiso CREATEDB. Requiere `psql` en el PATH.
 *
 * Salida: docs/database/{service}-schema.md y docs/database/{service}-migraciones.md
 *
 * El mismo archivo vive en core-backend-2026 y restobar-backend-2026: si lo
 * modificás en uno, copialo al otro.
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const SERVICES = {
  CORE: { schema: 'public', prerequisites: '' },
  RESTOBAR: {
    schema: 'tenant_plantilla',
    // V21 altera public.core_usuarios, que pertenece a core-backend.
    prerequisites: 'CREATE TABLE public.core_usuarios (id uuid PRIMARY KEY);',
  },
};

const MIGRATIONS_DIR = 'src/main/resources/db/migration';
const OUT_DIR = 'docs/database';
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const service = argValue('--service');
const checkOnly = args.includes('--check');
if (!service || !SERVICES[service]) {
  console.error(`Uso: node scripts/export-db-schema.mjs --service <${Object.keys(SERVICES).join('|')}> [--check]`);
  process.exit(1);
}
const { schema, prerequisites } = SERVICES[service];

const pgEnv = {
  ...process.env,
  PGHOST: process.env.PGHOST || 'localhost',
  PGPORT: process.env.PGPORT || '5432',
  PGUSER: process.env.PGUSER || 'postgres',
  PGPASSWORD: process.env.PGPASSWORD ?? 'postgres',
};
if (!LOCAL_HOSTS.has(pgEnv.PGHOST)) {
  console.error(`PGHOST=${pgEnv.PGHOST} no es local. Este script crea y borra bases: solo se ejecuta contra localhost.`);
  process.exit(1);
}

function psql(database, { sql, file, searchPath, tuplesOnly = false, singleTransaction = false }) {
  const flags = ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', database];
  if (tuplesOnly) flags.push('-At');
  if (singleTransaction) flags.push('--single-transaction');
  if (file) flags.push('-f', file);
  const env = { ...pgEnv, PGOPTIONS: `-c client_min_messages=warning${searchPath ? ` -c search_path=${searchPath}` : ''}` };
  const r = spawnSync('psql', flags, { env, input: sql, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error(`No se pudo ejecutar psql: ${r.error.message}`);
  if (r.status !== 0) throw new Error(r.stderr.trim() || `psql terminó con código ${r.status}`);
  return r.stdout;
}

function versionParts(file) {
  return file.match(/^V([\d._]+)__/)[1].split(/[._]/).map(Number);
}
function compareVersions(a, b) {
  const pa = versionParts(a);
  const pb = versionParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

const migrations = readdirSync(MIGRATIONS_DIR).filter((f) => /^V[\d._]+__.+\.sql$/.test(f)).sort(compareVersions);
if (migrations.length === 0) {
  console.error(`No hay migraciones en ${MIGRATIONS_DIR}`);
  process.exit(1);
}

// ---------------------------------------------------------------- base temporal

const tmpDb = `docs_schema_${service.toLowerCase()}_${process.pid}`;
let tmpCreated = false;
function dropTmpDb() {
  if (!tmpCreated) return;
  tmpCreated = false;
  try {
    psql('postgres', { sql: `DROP DATABASE IF EXISTS "${tmpDb}" WITH (FORCE);` });
  } catch (e) {
    console.error(`No se pudo eliminar la base temporal ${tmpDb}: ${e.message}`);
  }
}
process.on('SIGINT', () => {
  dropTmpDb();
  process.exit(130);
});

const CATALOG_SQL = `
WITH
t AS (
  SELECT c.oid, c.relname AS name, obj_description(c.oid, 'pg_class') AS comment
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = :'schema' AND c.relkind IN ('r', 'p') AND NOT c.relispartition
),
cols AS (
  SELECT a.attrelid, json_agg(json_build_object(
           'name', a.attname,
           'type', format_type(a.atttypid, a.atttypmod),
           'udt', ty.typname,
           'notNull', a.attnotnull,
           'default', pg_get_expr(d.adbin, d.adrelid),
           'comment', col_description(a.attrelid, a.attnum)
         ) ORDER BY a.attnum) AS list
  FROM pg_attribute a
  JOIN t ON t.oid = a.attrelid
  JOIN pg_type ty ON ty.oid = a.atttypid
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  WHERE a.attnum > 0 AND NOT a.attisdropped
  GROUP BY a.attrelid
),
cons AS (
  SELECT con.conrelid, json_agg(json_build_object(
           'name', con.conname,
           'type', con.contype,
           'definition', pg_get_constraintdef(con.oid),
           'columns', (SELECT json_agg(a.attname ORDER BY k.ord)
                       FROM unnest(con.conkey) WITH ORDINALITY k(attnum, ord)
                       JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = k.attnum),
           'refTable', fc.relname
         ) ORDER BY con.contype, con.conname) AS list
  FROM pg_constraint con
  JOIN t ON t.oid = con.conrelid
  LEFT JOIN pg_class fc ON fc.oid = con.confrelid
  WHERE con.contype IN ('p', 'f', 'u', 'c')
  GROUP BY con.conrelid
),
idx AS (
  SELECT i.indrelid, json_agg(pg_get_indexdef(i.indexrelid) ORDER BY ic.relname) AS list
  FROM pg_index i
  JOIN t ON t.oid = i.indrelid
  JOIN pg_class ic ON ic.oid = i.indexrelid
  WHERE NOT EXISTS (SELECT 1 FROM pg_constraint c WHERE c.conindid = i.indexrelid)
  GROUP BY i.indrelid
)
SELECT json_build_object(
  'tables', COALESCE((
    SELECT json_agg(json_build_object(
             'name', t.name, 'comment', t.comment,
             'columns', COALESCE(cols.list, '[]'::json),
             'constraints', COALESCE(cons.list, '[]'::json),
             'indexes', COALESCE(idx.list, '[]'::json)
           ) ORDER BY t.name)
    FROM t
    LEFT JOIN cols ON cols.attrelid = t.oid
    LEFT JOIN cons ON cons.conrelid = t.oid
    LEFT JOIN idx ON idx.indrelid = t.oid), '[]'::json),
  'views', COALESCE((
    SELECT json_agg(json_build_object('name', c.relname, 'kind', c.relkind,
                                      'comment', obj_description(c.oid, 'pg_class')) ORDER BY c.relname)
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = :'schema' AND c.relkind IN ('v', 'm')), '[]'::json),
  'enums', COALESCE((
    SELECT json_agg(json_build_object('name', ty.typname,
             'values', (SELECT json_agg(e.enumlabel ORDER BY e.enumsortorder) FROM pg_enum e WHERE e.enumtypid = ty.oid))
           ORDER BY ty.typname)
    FROM pg_type ty JOIN pg_namespace n ON n.oid = ty.typnamespace
    WHERE n.nspname = :'schema' AND ty.typtype = 'e'), '[]'::json),
  'functions', COALESCE((
    SELECT json_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' ORDER BY p.proname, pg_get_function_identity_arguments(p.oid))
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = :'schema'
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')), '[]'::json),
  'triggers', COALESCE((
    SELECT json_agg(json_build_object('table', c.name, 'name', tg.tgname,
                                      'definition', pg_get_triggerdef(tg.oid)) ORDER BY c.name, tg.tgname)
    FROM pg_trigger tg JOIN t c ON c.oid = tg.tgrelid
    WHERE NOT tg.tgisinternal), '[]'::json)
);
`;

let catalog;
try {
  psql('postgres', { sql: `CREATE DATABASE "${tmpDb}";` });
  tmpCreated = true;
  const bootstrap = `${schema === 'public' ? '' : `CREATE SCHEMA ${schema};`}${prerequisites}`;
  if (bootstrap) psql(tmpDb, { sql: bootstrap });
  for (const file of migrations) {
    try {
      psql(tmpDb, { file: join(MIGRATIONS_DIR, file), searchPath: schema, singleTransaction: true });
    } catch (e) {
      throw new Error(`La migración ${file} falló al aplicarse desde cero:\n${e.message}`);
    }
  }
  const out = psql(tmpDb, { sql: `\\set schema ${schema}\n${CATALOG_SQL}`, searchPath: schema, tuplesOnly: true });
  catalog = JSON.parse(out);
} catch (e) {
  console.error(e.message);
  dropTmpDb();
  process.exit(1);
}
dropTmpDb();

// ---------------------------------------------------------------- markdown

const cell = (v) => (v == null || v === '' ? '' : String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, ' '));
const lastVersion = migrations.at(-1).match(/^V([\d._]+)__/)[1];
const header = (title, command) => [
  `# ${title} — ${service}`,
  '',
  `> Generado por \`${command}\` a partir de \`${MIGRATIONS_DIR}\`. No editar a mano.`,
  '',
];

function mermaidType(col) {
  return col.udt.startsWith('_') ? `${col.udt.slice(1)}[]` : col.udt;
}

function renderSchema() {
  const { tables } = catalog;
  const lines = header('Esquema de base de datos', `node scripts/export-db-schema.mjs --service ${service}`);
  lines.push(
    `Esquema: \`${schema}\` · Tablas: ${tables.length} · Última migración: V${lastVersion}`,
    '',
    '## Diagrama entidad-relación',
    '',
    'Solo muestra columnas clave (PK, FK, UK). El detalle completo está en [Tablas](#tablas).',
    '',
    '```mermaid',
    'erDiagram',
  );

  const relations = [];
  for (const table of tables) {
    const keys = new Map();
    const mark = (colName, key) => keys.set(colName, [...(keys.get(colName) ?? []), key]);
    const uniqueSets = [];
    for (const c of table.constraints) {
      if (c.type === 'p') c.columns.forEach((n) => mark(n, 'PK'));
      if (c.type === 'u') c.columns.forEach((n) => mark(n, 'UK'));
      if (c.type === 'p' || c.type === 'u') uniqueSets.push(c.columns.join(','));
    }
    for (const c of table.constraints.filter((x) => x.type === 'f')) {
      c.columns.forEach((n) => mark(n, 'FK'));
      const nullable = c.columns.some((n) => !table.columns.find((col) => col.name === n).notNull);
      const oneToOne = uniqueSets.includes(c.columns.join(','));
      const childSide = oneToOne ? '|o' : '}o';
      const parentSide = nullable ? 'o|' : '||';
      relations.push(`  ${table.name} ${childSide}--${parentSide} ${c.refTable} : "${c.columns.join(', ')}"`);
    }
    const keyCols = table.columns.filter((col) => keys.has(col.name));
    lines.push(`  ${table.name} {`);
    for (const col of keyCols) {
      lines.push(`    ${mermaidType(col)} ${col.name} ${[...new Set(keys.get(col.name))].join(', ')}`);
    }
    lines.push('  }');
  }
  lines.push(...relations, '```', '', '## Tablas', '');

  for (const table of tables) {
    lines.push(`### ${table.name}`, '');
    if (table.comment) lines.push(cell(table.comment), '');
    lines.push('| Columna | Tipo | Nulo | Default | Descripción |', '|---|---|---|---|---|');
    for (const col of table.columns) {
      lines.push(`| \`${col.name}\` | ${cell(col.type)} | ${col.notNull ? 'NO' : 'sí'} | ${col.default ? `\`${cell(col.default)}\`` : ''} | ${cell(col.comment)} |`);
    }
    lines.push('');
    if (table.constraints.length) {
      lines.push('**Restricciones**', '');
      const label = { p: 'PK', f: 'FK', u: 'UNIQUE', c: 'CHECK' };
      for (const c of table.constraints) lines.push(`- ${label[c.type]} \`${c.name}\`: \`${cell(c.definition)}\``);
      lines.push('');
    }
    if (table.indexes.length) {
      lines.push('**Índices**', '');
      for (const def of table.indexes) lines.push(`- \`${cell(def.replaceAll(`${schema}.`, ''))}\``);
      lines.push('');
    }
  }

  if (catalog.views.length) {
    lines.push('## Vistas', '');
    for (const v of catalog.views) lines.push(`- \`${v.name}\`${v.kind === 'm' ? ' (materializada)' : ''}${v.comment ? `: ${cell(v.comment)}` : ''}`);
    lines.push('');
  }
  if (catalog.enums.length) {
    lines.push('## Tipos enumerados', '');
    for (const e of catalog.enums) lines.push(`- \`${e.name}\`: ${e.values.map((v) => `\`${v}\``).join(', ')}`);
    lines.push('');
  }
  if (catalog.functions.length) {
    lines.push('## Funciones', '');
    for (const f of catalog.functions) lines.push(`- \`${f}\``);
    lines.push('');
  }
  if (catalog.triggers.length) {
    lines.push('## Triggers', '');
    for (const tg of catalog.triggers) lines.push(`- \`${tg.table}.${tg.name}\`: \`${cell(tg.definition.replaceAll(`${schema}.`, ''))}\``);
    lines.push('');
  }
  return lines.join('\n');
}

const RISKY_OPERATIONS = [
  ['DROP TABLE', /\bdrop\s+table\b/i],
  ['DROP COLUMN', /\bdrop\s+column\b/i],
  ['RENAME', /\brename\b/i],
  ['ALTER COLUMN TYPE', /\balter\s+column\s+[\w"]+\s+(set\s+data\s+)?type\b/i],
  ['SET NOT NULL', /\bset\s+not\s+null\b/i],
  ['TRUNCATE', /\btruncate\b/i],
  ['DELETE', /\bdelete\s+from\b/i],
];

function describeMigration(file) {
  const raw = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
  const summary = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '') {
      if (summary.length) break;
      continue;
    }
    if (!trimmed.startsWith('--')) break;
    const text = trimmed.replace(/^-+\s*/, '').trim();
    if (/^[-=\s]*$/.test(text) || /^V[\d._]+__.+\.sql$/.test(text)) continue;
    summary.push(text);
  }
  const sql = raw.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const tables = new Set();
  for (const m of sql.matchAll(/\b(?:create|alter|drop)\s+table\s+(?:if\s+(?:not\s+)?exists\s+)?(?:only\s+)?([\w."]+)/gi)) {
    tables.add(m[1].replace(/"/g, '').split('.').pop());
  }
  const risks = RISKY_OPERATIONS.filter(([, re]) => re.test(sql)).map(([name]) => name);
  const dataChange = /\b(insert\s+into|update\s+[\w."]+\s+set)\b/i.test(sql);
  const [, version, description] = file.match(/^V([\d._]+)__(.+)\.sql$/);
  return { version, description: description.replace(/_/g, ' '), summary: summary.join(' '), tables: [...tables].sort(), risks, dataChange };
}

function renderMigrations() {
  const described = migrations.map(describeMigration);
  const present = new Set(described.map((m) => m.version));
  const max = Math.max(...described.map((m) => Number(m.version.split(/[._]/)[0])));
  const missing = [];
  for (let v = 1; v <= max; v++) if (!present.has(String(v))) missing.push(`V${v}`);

  const lines = header('Migraciones', `node scripts/export-db-schema.mjs --service ${service}`);
  lines.push(
    `Esquema destino: \`${schema}\` · Migraciones: ${described.length} · Última: V${lastVersion}`,
    '',
    `Versiones sin archivo: ${missing.length ? missing.join(', ') : 'ninguna'}`,
    '',
    '"Riesgo" marca operaciones que pueden romper código desplegado o perder datos; revisalas antes de aplicar en producción.',
    '"Datos" indica que la migración inserta o actualiza filas además de cambiar estructura.',
    '',
    '| Versión | Descripción | Tablas | Riesgo | Datos | Resumen |',
    '|---|---|---|---|---|---|',
  );
  for (const m of described) {
    lines.push(`| V${m.version} | ${cell(m.description)} | ${m.tables.map((t) => `\`${t}\``).join(', ')} | ${m.risks.join(', ')} | ${m.dataChange ? 'sí' : ''} | ${cell(m.summary)} |`);
  }
  lines.push('');
  return lines.join('\n');
}

const outputs = [
  [join(OUT_DIR, `${service.toLowerCase()}-schema.md`), renderSchema()],
  [join(OUT_DIR, `${service.toLowerCase()}-migraciones.md`), renderMigrations()],
];

if (checkOnly) {
  const stale = outputs.filter(([path, content]) => !existsSync(path) || readFileSync(path, 'utf8') !== content).map(([path]) => path);
  if (stale.length) {
    console.error(`Desactualizado: ${stale.join(', ')}. Ejecutá: node scripts/export-db-schema.mjs --service ${service}`);
    process.exit(1);
  }
  console.log(`Migraciones aplican desde cero y ${OUT_DIR} está al día (${migrations.length} migraciones, ${catalog.tables.length} tablas).`);
} else {
  mkdirSync(OUT_DIR, { recursive: true });
  for (const [path, content] of outputs) writeFileSync(path, content);
  console.log(`Generado ${outputs.map(([p]) => p).join(' y ')} (${migrations.length} migraciones, ${catalog.tables.length} tablas).`);
}
