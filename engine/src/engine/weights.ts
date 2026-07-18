import type { Manifest } from './types.js';

export interface WeightStore {
  get(name: string): { shape: number[]; data: Float32Array };
}

/**
 * Wrap the raw fp32 blob using the manifest's tensor table.
 * Only validates total length; sha256 verification is the loader's concern
 * (crypto is async and environment-dependent).
 */
export function loadWeights(manifest: Manifest, buf: ArrayBuffer): WeightStore {
  if (buf.byteLength !== manifest.bin_bytes) {
    throw new Error(
      `weights blob size mismatch: got ${buf.byteLength}, ` +
      `manifest says ${manifest.bin_bytes}`);
  }
  const all = new Float32Array(buf);
  const map = new Map<string, { shape: number[]; data: Float32Array }>();
  for (const t of manifest.tensors) {
    const size = t.shape.reduce((a, b) => a * b, 1);
    map.set(t.name, {
      shape: t.shape,
      data: all.subarray(t.offset_floats, t.offset_floats + size),
    });
  }
  return {
    get(name: string) {
      const t = map.get(name);
      if (!t) throw new Error(`missing tensor ${name}`);
      return t;
    },
  };
}
