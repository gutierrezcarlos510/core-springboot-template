#!/usr/bin/env node
/**
 * Trae a docs/external/core/ la documentación de core-backend que este repo consume
 * (esquema public + OpenAPI), declarada en contracts.sources.json. No se copia a mano:
 * el CONTEXT.md de core queda desactualizado apenas cambia una migración, así que la
 * referencia acá tiene que salir siempre del archivo generado más reciente de core.
 *
 *   node scripts/sync-contracts.mjs            # actualiza docs/external/core/
 *   node scripts/sync-contracts.mjs --check    # CI: falla si algo quedó desactualizado
 *
 * Necesita core-backend clonado al lado de este repo (../core-backend) o la variable
 * de entorno CORE_REPO_PATH apuntando a un checkout (así lo hace el CI).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const root = process.cwd();
const checkOnly = process.argv.includes('--check');
const { service, repoPath, envPath, files } = JSON.parse(readFileSync(join(root, 'contracts.sources.json'), 'utf8'));

const repo = resolve(root, process.env[envPath] || repoPath);
let fallos = 0;

for (const archivo of files) {
  const origen = join(repo, archivo.from);
  const destino = join(root, archivo.to);

  if (!existsSync(origen)) {
    console.error(`❌ ${service}: no existe ${origen}`);
    console.error(`   Generalo en core-backend o definí ${envPath} apuntando a un checkout que lo tenga.`);
    fallos++;
    continue;
  }

  const contenido = readFileSync(origen, 'utf8');
  const previo = existsSync(destino) ? readFileSync(destino, 'utf8') : null;

  if (previo === contenido) {
    console.log(`= ${relative(root, destino)} al día`);
    continue;
  }
  if (checkOnly) {
    console.error(`❌ ${relative(root, destino)} desactualizado respecto a ${service}. Ejecutá: node scripts/sync-contracts.mjs`);
    fallos++;
    continue;
  }
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, contenido);
  console.log(`✅ ${relative(root, destino)} actualizado desde ${service}`);
}

process.exit(fallos ? 1 : 0);
