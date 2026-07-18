import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { SpaceCnn } from '../src/engine/cnn.js';
import { loadWeights } from '../src/engine/weights.js';
import type { Manifest } from '../src/engine/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const manifest = JSON.parse(
  readFileSync(join(here, '../model/space_cnn_v1.json'), 'utf-8')) as Manifest;
const bin = readFileSync(join(here, '../model/space_cnn_v1.bin'));
const blob = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
const fixture = JSON.parse(
  readFileSync(join(here, 'fixtures/parity.json'), 'utf-8')) as {
    model_tag: string;
    cases: { input: string; probs: number[] }[];
  };

describe('PyTorch parity', () => {
  const cnn = new SpaceCnn(manifest, loadWeights(manifest, blob));

  it('fixture matches the shipped model', () => {
    expect(fixture.model_tag).toBe(manifest.model_tag);
  });

  it('probabilities match within 1e-4 and decisions are identical', () => {
    let maxDiff = 0;
    for (const c of fixture.cases) {
      const chars = [...c.input];
      expect(chars.length).toBe(c.probs.length);
      const probs = cnn.infer(cnn.encode(chars));
      for (let i = 0; i < chars.length; i++) {
        const diff = Math.abs(probs[i] - c.probs[i]);
        if (diff > maxDiff) maxDiff = diff;
        expect(diff).toBeLessThan(1e-4);
        for (const t of [0.24, 0.5]) {
          expect(probs[i] >= t).toBe(c.probs[i] >= t);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log(`parity max |Δp| = ${maxDiff.toExponential(2)}`);
  });
});
