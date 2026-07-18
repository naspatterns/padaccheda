#!/usr/bin/env node
// Demo/verification CLI for the Sanskrit space engine.
//   node cli.mjs "rāmogacchati"            -> rāmo gacchati
//   echo "text" | node cli.mjs --t 0.3
//   node cli.mjs --spans "text"            -> JSON with span metadata
// Build first: npm run build
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSplitter } from './dist/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  readFileSync(join(here, 'model/space_cnn_v1.json'), 'utf-8'));
const bin = readFileSync(join(here, 'model/space_cnn_v1.bin'));
const blob = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);

const args = process.argv.slice(2);
let threshold;
let spans = false;
const texts = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--t') threshold = parseFloat(args[++i]);
  else if (args[i] === '--spans') spans = true;
  else texts.push(args[i]);
}
const input = texts.length
  ? texts.join(' ')
  : readFileSync(0, 'utf-8');

const splitter = createSplitter(manifest, blob);
const t0 = performance.now();
const result = splitter.split(input, { threshold });
const ms = performance.now() - t0;

if (spans) {
  console.log(JSON.stringify(result, null, 1));
} else {
  process.stdout.write(result.text);
  if (!result.text.endsWith('\n')) process.stdout.write('\n');
}
for (const w of result.warnings) {
  console.error(`warning: ${w.code}${w.detail ? ` (${w.detail})` : ''}`);
}
console.error(
  `threshold=${result.threshold} spaces=${result.spans.length} ` +
  `chars=${input.length} time=${ms.toFixed(1)}ms`);
