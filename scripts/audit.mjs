// Throwaway static audit v2. Counts tests as consumers, treats `export {..} from`
// re-exports as imports of the source, and distinguishes "used inside its own
// file" from "truly unused". Regex-based — verify before acting.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve } from 'node:path';

const ROOT = process.cwd();
const srcFiles = [];
const allFiles = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (['node_modules', '.git', 'docs', 'examples', 'data'].includes(name)) continue;
      walk(p);
    } else if (name.endsWith('.js') && name !== 'audit.mjs') {
      allFiles.push(p);
      if (!p.includes(`${join(ROOT, 'tests')}`)) srcFiles.push(p);
    }
  }
})(ROOT);

const text = new Map(allFiles.map((f) => [f, readFileSync(f, 'utf8')]));
const rel = (f) => relative(ROOT, f).replace(/\\/g, '/');
const resolveImport = (from, spec) => {
  if (!spec.startsWith('.')) return null;
  let p = resolve(dirname(from), spec);
  if (!p.endsWith('.js')) p += '.js';
  return p;
};

// declared exports vs re-exported names
const declExports = new Map(); // file -> Set(name)
const reExports = new Map(); // file -> Set(name)
for (const f of srcFiles) {
  const t = text.get(f);
  const decl = new Set();
  for (const m of t.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g)) decl.add(m[1]);
  for (const m of t.matchAll(/export\s+const\s+([A-Za-z0-9_]+)/g)) decl.add(m[1]);
  for (const m of t.matchAll(/export\s+class\s+([A-Za-z0-9_]+)/g)) decl.add(m[1]);
  declExports.set(f, decl);
  const re = new Set();
  for (const m of t.matchAll(/export\s*\{([^}]*)\}\s*from/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name) re.add(name);
    }
  }
  reExports.set(f, re);
}

// imports (incl tests); re-exports counted as imports of source
const importsTo = []; // {name, target}
for (const f of allFiles) {
  const t = text.get(f);
  for (const m of t.matchAll(/import\s+(?:([A-Za-z0-9_]+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g)) {
    const target = resolveImport(f, m[3]);
    if (!target) continue;
    if (m[1]) importsTo.push({ name: 'default', target });
    if (m[2]) for (const part of m[2].split(',')) {
      const orig = part.trim().split(/\s+as\s+/)[0].trim();
      if (orig) importsTo.push({ name: orig, target });
    }
  }
  for (const m of t.matchAll(/export\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const target = resolveImport(f, m[2]);
    if (!target) continue;
    for (const part of m[1].split(',')) {
      const orig = part.trim().split(/\s+as\s+/)[0].trim();
      if (orig) importsTo.push({ name: orig, target });
    }
  }
}
const importedSomewhere = (name, file) => importsTo.some((i) => i.name === name && i.target === file);
const nameCount = (t, name) => (t.match(new RegExp(`\\b${name}\\b`, 'g')) || []).length;

console.log('=== UNUSED IMPORTS (dangling) ===');
let n = 0;
for (const f of allFiles) {
  const t = text.get(f);
  for (const m of t.matchAll(/import\s+(?:([A-Za-z0-9_]+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"][^'"]+['"]/g)) {
    const locals = [];
    if (m[1]) locals.push(m[1]);
    if (m[2]) for (const part of m[2].split(',')) { const seg = part.trim(); if (seg) locals.push(seg.split(/\s+as\s+/).pop().trim()); }
    const body = t.replace(/import[^;]*?from\s*['"][^'"]+['"];?/g, '');
    for (const loc of locals) if (!new RegExp(`\\b${loc}\\b`).test(body)) { console.log(`  ${rel(f)} : ${loc}`); n++; }
  }
}
if (!n) console.log('  (none)');

console.log('\n=== TRULY DEAD (declared, not imported anywhere, not used in own file) ===');
let d = 0;
for (const f of srcFiles) {
  const t = text.get(f);
  for (const name of declExports.get(f)) {
    if (importedSomewhere(name, f)) continue;
    if (nameCount(t, name) > 1) continue; // used in own file body
    console.log(`  ${rel(f)} : ${name}`);
    d++;
  }
}
if (!d) console.log('  (none)');

console.log('\n=== DEAD RE-EXPORTS (barrel re-exports nobody imports) ===');
let r = 0;
for (const f of srcFiles) {
  for (const name of reExports.get(f)) {
    if (!importedSomewhere(name, f)) { console.log(`  ${rel(f)} : ${name}`); r++; }
  }
}
if (!r) console.log('  (none)');

console.log('\n=== EXPORTED BUT ONLY USED IN OWN FILE (could un-export; informational) ===');
let o = 0;
for (const f of srcFiles) {
  const t = text.get(f);
  for (const name of declExports.get(f)) {
    if (importedSomewhere(name, f)) continue;
    if (nameCount(t, name) > 1) { console.log(`  ${rel(f)} : ${name}`); o++; }
  }
}
if (!o) console.log('  (none)');
