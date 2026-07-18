# Padaccheda — Sanskrit word division

Divides unspaced romanized (IAST) Sanskrit into words, preserving every
character (spaces only; vowel-sandhi fusions and compounds stay joined).

**Live demo:** https://naspatterns.github.io/padaccheda/

- **engine/** — dependency-free TypeScript engine + CLI.
  Char-CNN model (fp32 3.81 MB). Holdout quality: F1 0.958, unit-exact 74.4%.
  `cd engine && npm install && npm run build && node cli.mjs "rāmogacchati"`
- **app/** — Padaccheda web UI (Vite). Two panes, confidence-graded highlights
  (green/amber/red), click-to-toggle review, candidate markers, free-edit mode,
  Copy / Download .txt, and correction export (JSONL) for future fine-tuning.
  `cd app && npm install && npm run dev` → http://localhost:5173

Correction records accumulate in the browser (localStorage) and can be exported
as JSONL for a future fine-tuning round (gated on the frozen holdouts H1/H2).

## Model & data

The shipped model (`engine/model/space_cnn_v1.*`) is a char-CNN pretrained on the
Digital Corpus of Sanskrit (DCS) and fine-tuned on an in-house editorial corpus.
Only the trained weights are distributed here; the source corpus is not part of
this repository.

## License

[MIT](LICENSE) © 2026 Hyoung Seok Ham. The bundled Gentium Plus fonts are under
the SIL Open Font License (`app/public/fonts/OFL.txt`).
