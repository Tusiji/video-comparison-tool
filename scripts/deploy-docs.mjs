#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Usage:
//   node scripts/deploy-docs.mjs repo-name   # for project pages (username.github.io/repo-name)
//   node scripts/deploy-docs.mjs --root      # for user/organization site (username.github.io)

const arg = process.argv[2];
let base = '/';
if (!arg) {
  console.log('\nUsage:');
  console.log('  node scripts/deploy-docs.mjs repo-name');
  console.log('  node scripts/deploy-docs.mjs --root');
  process.exit(1);
}
if (arg !== '--root') {
  base = `/${arg.replace(/^\/+|\/+$/g, '')}/`;
}

console.log(`Building with base: ${base}`);
const env = { ...process.env, VITE_BASE: base };
const build = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build'], { stdio: 'inherit', env });
if (build.status !== 0) {
  process.exit(build.status || 1);
}

const root = resolve('.');
const dist = resolve(root, 'dist');
const docs = resolve(root, 'docs');
if (!existsSync(dist)) {
  console.error('Missing dist folder. Build may have failed.');
  process.exit(1);
}

console.log('Publishing dist → docs ...');
rmSync(docs, { recursive: true, force: true });
mkdirSync(docs, { recursive: true });
cpSync(dist, docs, { recursive: true });

console.log('Done. Commit and push docs, then enable Pages → main /docs.');

