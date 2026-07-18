import type { Manifest } from './types.js';
import type { WeightStore } from './weights.js';

const PAD = 0;
const UNK = 1;

interface ConvLayer {
  dilation: number;
  cin: number;
  cout: number;
  /** per-tap kernels, each [cout * cin], tap 0 = t-d, 1 = t, 2 = t+d */
  w: [Float32Array, Float32Array, Float32Array];
  bias: Float32Array;
}

/**
 * Hand-rolled forward pass of the dilated char-CNN space tagger.
 * Mirrors probes/neural/cnn.py: Embedding -> N x (Conv1d k=3 dil=d + ReLU)
 * -> Conv1d(ch,1,1) head -> sigmoid = P(space before char i).
 */
export class SpaceCnn {
  private vocab: Record<string, number>;
  private emb: Float32Array;   // [vocabSize * embDim]
  private embDim: number;
  private layers: ConvLayer[];
  private headW: Float32Array; // [ch]
  private headB: number;

  constructor(manifest: Manifest, weights: WeightStore) {
    this.vocab = manifest.vocab;
    this.embDim = manifest.emb;
    const embT = weights.get('emb.weight');
    this.emb = embT.data;

    // conv modules sit at indices 0,2,4,... in the Sequential (ReLU between)
    this.layers = manifest.blocks.map((d, li) => {
      const wT = weights.get(`convs.${li * 2}.weight`);
      const bT = weights.get(`convs.${li * 2}.bias`);
      const [cout, cin, k] = wT.shape;
      if (k !== 3) throw new Error(`unexpected kernel size ${k}`);
      // PyTorch layout [out][in][k] -> per-tap [out*in]
      const taps: [Float32Array, Float32Array, Float32Array] = [
        new Float32Array(cout * cin),
        new Float32Array(cout * cin),
        new Float32Array(cout * cin),
      ];
      const src = wT.data;
      for (let o = 0; o < cout; o++) {
        for (let i = 0; i < cin; i++) {
          const base = (o * cin + i) * 3;
          taps[0][o * cin + i] = src[base];
          taps[1][o * cin + i] = src[base + 1];
          taps[2][o * cin + i] = src[base + 2];
        }
      }
      return { dilation: d, cin, cout, w: taps, bias: bT.data };
    });

    const hW = weights.get('head.weight'); // [1, ch, 1]
    this.headW = hW.data;
    this.headB = weights.get('head.bias').data[0];
  }

  /** map model-view chars to ids (no folding here - caller normalizes) */
  encode(chars: ArrayLike<string>): Int32Array {
    const ids = new Int32Array(chars.length);
    for (let i = 0; i < chars.length; i++) {
      const v = this.vocab[chars[i] as string];
      ids[i] = v === undefined ? UNK : v;
    }
    return ids;
  }

  /** P(space before position i); probs[0] is forced to 0. */
  infer(ids: Int32Array): Float32Array {
    const L = ids.length;
    const probs = new Float32Array(L);
    if (L === 0) return probs;

    // embedding lookup
    const embDim = this.embDim;
    let h = new Float32Array(L * embDim);
    for (let t = 0; t < L; t++) {
      const id = ids[t] === PAD ? PAD : ids[t];
      const src = id * embDim;
      const dst = t * embDim;
      for (let j = 0; j < embDim; j++) h[dst + j] = this.emb[src + j];
    }

    let cin = embDim;
    for (const layer of this.layers) {
      const { dilation: d, cout, w, bias } = layer;
      const out = new Float32Array(L * cout);
      const [wl, wc, wr] = w;
      for (let t = 0; t < L; t++) {
        const cBase = t * cin;
        const lBase = (t - d) * cin;
        const rBase = (t + d) * cin;
        const hasL = t - d >= 0;
        const hasR = t + d < L;
        const oBase = t * cout;
        for (let o = 0; o < cout; o++) {
          let acc = bias[o];
          const wBase = o * cin;
          for (let i = 0; i < cin; i++) acc += wc[wBase + i] * h[cBase + i];
          if (hasL) {
            for (let i = 0; i < cin; i++) acc += wl[wBase + i] * h[lBase + i];
          }
          if (hasR) {
            for (let i = 0; i < cin; i++) acc += wr[wBase + i] * h[rBase + i];
          }
          out[oBase + o] = acc > 0 ? acc : 0; // ReLU
        }
      }
      h = out;
      cin = cout;
    }

    const hw = this.headW;
    for (let t = 0; t < L; t++) {
      let logit = this.headB;
      const base = t * cin;
      for (let i = 0; i < cin; i++) logit += hw[i] * h[base + i];
      probs[t] = 1 / (1 + Math.exp(-logit));
    }
    probs[0] = 0;
    return probs;
  }
}
