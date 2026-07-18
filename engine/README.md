# sanskrit-space-engine

Dependency-free IAST Sanskrit word-spacing engine (char-CNN). Inserts spaces
at word boundaries in unspaced IAST text; never alters any character. Runs in
Node and the browser (no DOM, no external runtime).

## Model

`model/space_cnn_v1.{json,bin}` — 952k-param dilated char-CNN (fp32, 3.81 MB),
pretrained on 590k DCS sentences, fine-tuned on the TSP corpus (~14k line
units + 2.6k paragraph units; tag: see `model_tag` in the manifest).
Per-position output = P(space before this character). Receptive field ±64.

Measured quality (threshold 0.32):
- frozen holdout H1 (500 units): R 0.971 / P 0.946 / F1 0.958 / unit-exact 74.4%
- new-chapter holdout H2 (300 units): F1 0.948 / unit-exact 67.7%

## Usage

```js
import { createSplitter } from './dist/index.js';

const manifest = JSON.parse(await (await fetch('model/space_cnn_v1.json')).text());
const weights  = await (await fetch('model/space_cnn_v1.bin')).arrayBuffer();
const splitter = createSplitter(manifest, weights);

const r = splitter.split('rāmogacchati');        // { text: 'rāmo gacchati', ... }
r.spans        // inserted spaces: {pos, outPos, prob, band: 'confident'|'low'}
r.nearMisses   // junctures just below threshold (candidate splits)
r.warnings     // 'devanagari' | 'non-iast' | 'uppercase' | 'invariant'

// threshold slider UX: run inference once, re-decide cheaply
import { decide } from './dist/index.js';
const analysis = splitter.analyze(text);
decide(analysis, 0.5);   // conservative
decide(analysis, 0.2);   // aggressive
```

CLI: `npm run build && node cli.mjs "rāmogacchati"` (`--t 0.3`, `--spans`,
or pipe stdin).

## Behavior notes

- Vowel-fusion junctures (gajena+āgacchati → gajenāgacchati) are not split —
  a space cannot be inserted without altering characters (out of scope for v1).
- Compounds stay joined; enclitics (ca, iti, ...) are split per the TSP
  editorial convention learned in fine-tuning.
- Existing spaces / daṇḍas / digits / any non-IAST content pass through
  verbatim and act as hard boundaries.
- Surface-preservation invariant is checked on every call; on failure the
  engine returns the input unchanged with an `invariant` warning.

## Development

- `npm install` then `npm test` — 17 unit tests incl. PyTorch parity
  (max |Δp| 5e-7 vs fixture).
- Model retraining/export is handled by a separate offline pipeline that is
  not part of this repository; only the trained weights are shipped here.
