#!/usr/bin/env node
/*
  Removes redundant '/api' prefixes from:
  - backend NestJS controllers when app.setGlobalPrefix('api') is enabled
  - frontend endpoint constants / hardcoded paths when axios baseURL already includes '/api'

  Usage:
    node tools/remove-api-prefix.js           # dry-run
    node tools/remove-api-prefix.js --write  # apply changes
*/

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const BACKEND_ONLY = process.argv.includes('--backend-only');
const FRONTEND_ONLY = process.argv.includes('--frontend-only');

if (BACKEND_ONLY && FRONTEND_ONLY) {
  console.error('[remove-api-prefix] Invalid args: use only one of --backend-only or --frontend-only');
  process.exit(2);
}

const TARGETS = [
  { name: 'backend', dir: path.join(ROOT, 'backend', 'src'), exts: new Set(['.ts']) },
  {
    name: 'frontend',
    dir: path.join(ROOT, 'frontend', 'src'),
    exts: new Set(['.js', '.jsx', '.ts', '.tsx']),
  },
];

function isTextFile(filePath, allowedExts) {
  return allowedExts.has(path.extname(filePath).toLowerCase());
}

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip huge folders if present
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
      yield* walk(fullPath);
    } else if (entry.isFile()) {
      yield fullPath;
    }
  }
}

function applyBackendRewrites(source) {
  const rewrites = [];
  let out = source;

  // @Controller('api/state') -> @Controller('state')
  // @Controller('/api/state') -> @Controller('state')
  out = out.replace(/@Controller\(\s*(["'`])\/?api\/([^"'`]+)\1\s*\)/g, (m, q, rest) => {
    rewrites.push({ from: m, to: `@Controller(${q}${rest}${q})` });
    return `@Controller(${q}${rest}${q})`;
  });

  // @Controller('api') or @Controller('/api') -> @Controller('')
  out = out.replace(/@Controller\(\s*(["'`])\/?api\1\s*\)/g, (m, q) => {
    rewrites.push({ from: m, to: `@Controller(${q}${q})` });
    return `@Controller(${q}${q})`;
  });

  return { out, rewrites };
}

function applyFrontendRewrites(source) {
  const rewrites = [];
  let out = source;

  // Remove leading /api from string literals and template literals that start with /api/
  // '/api/foo' -> '/foo'
  // "\/api/foo" -> "/foo"
  // `\/api/foo/${id}` -> `/foo/${id}`
  out = out.replace(/(["'`])\/api\//g, (m, q) => {
    rewrites.push({ from: m, to: `${q}/` });
    return `${q}/`;
  });

  // Also handle exact '/api' (rare in code) -> '' or '/'? We choose '' only when it's clearly a path.
  // Keep it conservative: only replace when the whole literal is exactly '/api'.
  out = out.replace(/(["'`])\/api\1/g, (m, q) => {
    // Avoid touching full URLs like 'https://api.example.com' (won't match)
    // This only matches exact '/api'
    rewrites.push({ from: m, to: `${q}${q}` });
    return `${q}${q}`;
  });

  return { out, rewrites };
}

function summarizeFileChanges(filePath, rewrites) {
  const unique = new Map();
  for (const r of rewrites) {
    const key = `${r.from} => ${r.to}`;
    unique.set(key, (unique.get(key) || 0) + 1);
  }

  const entries = [...unique.entries()].slice(0, 10);
  const more = unique.size - entries.length;

  return {
    filePath,
    total: rewrites.length,
    preview: entries.map(([k, c]) => `  ${c}x ${k}`),
    more,
  };
}

async function run() {
  const selectedTargets = TARGETS.filter((t) => {
    if (BACKEND_ONLY) return t.name === 'backend';
    if (FRONTEND_ONLY) return t.name === 'frontend';
    return true;
  });

  const changes = [];
  let filesScanned = 0;
  let filesChanged = 0;

  for (const target of selectedTargets) {
    for await (const filePath of walk(target.dir)) {
      if (!isTextFile(filePath, target.exts)) continue;
      filesScanned++;

      const input = await fs.promises.readFile(filePath, 'utf8');
      let res;
      if (target.name === 'backend') res = applyBackendRewrites(input);
      else res = applyFrontendRewrites(input);

      if (res.out !== input) {
        filesChanged++;
        changes.push(summarizeFileChanges(path.relative(ROOT, filePath), res.rewrites));
        if (WRITE) {
          await fs.promises.writeFile(filePath, res.out, 'utf8');
        }
      }
    }
  }

  // Report
  const mode = WRITE ? 'WRITE' : 'DRY-RUN';
  const scope = BACKEND_ONLY ? 'backend-only' : FRONTEND_ONLY ? 'frontend-only' : 'all';
  console.log(`[remove-api-prefix] Mode: ${mode}`);
  console.log(`[remove-api-prefix] Scope: ${scope}`);
  console.log(`[remove-api-prefix] Scanned files: ${filesScanned}`);
  console.log(`[remove-api-prefix] Changed files: ${filesChanged}`);

  for (const c of changes) {
    console.log(`\n- ${c.filePath} (${c.total} replacements)`);
    for (const line of c.preview) console.log(line);
    if (c.more > 0) console.log(`  ...and ${c.more} more unique rewrite(s)`);
  }

  if (!WRITE) {
    console.log('\nTip: re-run with --write to apply changes.');
  }
}

run().catch((err) => {
  console.error('[remove-api-prefix] Failed:', err);
  process.exit(1);
});
