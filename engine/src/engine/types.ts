export interface TensorInfo {
  name: string;
  shape: number[];
  offset_floats: number;
}

export interface Manifest {
  format_version: number;
  model_tag: string;
  emb: number;
  ch: number;
  blocks: number[];
  vocab: Record<string, number>;
  default_threshold: number;
  tensors: TensorInfo[];
  bin_bytes: number;
  bin_sha256: string;
}

export type WarningCode =
  | 'devanagari'      // Devanagari characters detected (passed through as-is)
  | 'non-iast'        // many letters outside the IAST inventory
  | 'uppercase'       // uppercase-heavy input (Harvard-Kyoto suspicion)
  | 'invariant';      // internal error: surface preservation check failed

export interface SplitWarning {
  code: WarningCode;
  detail?: string;
}

/** A space the engine inserted. */
export interface SpaceSpan {
  /** index into the canonical (NFC) input: the space sits BEFORE this char */
  pos: number;
  /** index of the inserted space char in the output string */
  outPos: number;
  prob: number;
  band: 'confident' | 'low';
}

/** A juncture just below threshold (candidate the engine did NOT split). */
export interface NearMiss {
  pos: number;
  prob: number;
}

export interface SplitOptions {
  threshold?: number;
}

export interface SplitResult {
  /** canonical input with spaces inserted; chars otherwise untouched */
  text: string;
  spans: SpaceSpan[];
  nearMisses: NearMiss[];
  warnings: SplitWarning[];
  threshold: number;
  /** false only if the internal surface-preservation check failed */
  ok: boolean;
}

/** Result of the inference stage, reusable across thresholds. */
export interface Analysis {
  /** canonical NFC input */
  canonical: string;
  /** P(space before canonical[i]) for every position; 0 where not applicable */
  probs: Float32Array;
  warnings: SplitWarning[];
}
