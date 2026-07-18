/// <reference lib="webworker" />
/** Engine worker: loads model once, serves analyze() requests with a small
 *  LRU cache. decide()/grading stay on the main thread (pure + cheap). */
import { createSplitter, type Splitter } from '@engine';

let splitter: Splitter | null = null;
let modelTag = '';
const cache = new Map<string, { canonical: string; probs: Float32Array; warnings: unknown[] }>();

async function init() {
  const res = await fetch(import.meta.env.BASE_URL + 'model/space_cnn_v1.json');
  const manifest = await res.json();
  const binRes = await fetch(import.meta.env.BASE_URL + 'model/space_cnn_v1.bin');
  const total = Number(binRes.headers.get('Content-Length')) || manifest.bin_bytes;
  const reader = binRes.body!.getReader();
  const chunks: Uint8Array[] = [];
  let got = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    postMessage({ type: 'progress', got, total });
  }
  const buf = new Uint8Array(got);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.length;
  }
  splitter = createSplitter(manifest, buf.buffer);
  modelTag = manifest.model_tag;
  postMessage({
    type: 'ready',
    modelTag,
    defaultThreshold: splitter.defaultThreshold,
  });
}

onmessage = (e: MessageEvent) => {
  const msg = e.data;
  if (msg.type !== 'analyze' || !splitter) return;
  const text: string = msg.text;
  let a = cache.get(text);
  if (!a) {
    const r = splitter.analyze(text);
    a = { canonical: r.canonical, probs: r.probs, warnings: r.warnings };
    cache.set(text, a);
    if (cache.size > 8) cache.delete(cache.keys().next().value as string);
  }
  postMessage({
    type: 'analysis',
    id: msg.id,
    canonical: a.canonical,
    probs: a.probs,
    warnings: a.warnings,
  });
};

init().catch((err) => postMessage({ type: 'error', message: String(err) }));
