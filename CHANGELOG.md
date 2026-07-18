# Changelog

Progress log for Padaccheda. Dates are commit dates (KST).

## 2026-07-18 — Anonymous correction collection (dormant)

- Corrections made in the web UI can be submitted anonymously to a Supabase
  table (`corrections`, insert-only RLS) to seed future fine-tuning rounds.
- Consent model: one-time notice banner, on-by-default opt-out toggle in the
  `⋯` menu. Opting out never disables the local JSONL Export.
- **Currently dormant**: `app/src/config.ts` ships with empty
  `SUPABASE_URL` / `SUPABASE_ANON_KEY`, so nothing is sent. Collection starts
  only once a Supabase project is created and the two public values are filled
  in and deployed.
- Verified locally: POST fires with consent on, nothing fires when opted out,
  local Export unaffected either way.

## 2026-07-18 — Public release & live deploy

- Repo published at <https://github.com/naspatterns/padaccheda> (MIT).
- Live app at <https://naspatterns.github.io/padaccheda/> via GitHub Actions →
  Pages (`.github/workflows/deploy.yml`; Vite build with `--base=/padaccheda/`
  so the worker's model fetch resolves under the subpath).
- Git history restarted for the public release; the TSP TEI corpus
  (`TSP*_Round4_Q.xml`, unpublished multi-contributor editorial data) is
  excluded from the repo and gitignored — training/eval data stays local only.
- Shipped model `space_cnn_v1` (fp32, 3.81 MB): char-CNN pretrained on DCS,
  fine-tuned on the in-house TSP corpus. Holdout: F1 0.958, unit-exact 74.4%.

## Pre-release milestones (internal, before history reset)

- **v1.4** — modern academic minimal redesign of the web UI.
- **v1.3** — Padaccheda web UI: two panes, confidence-graded highlights,
  click-to-toggle review with undo/redo, candidate markers, edit mode,
  Copy / Download .txt, correction export (JSONL, latest-wins).
- **v1.1** — dependency-free TypeScript engine + CLI around the char-CNN
  (`model_cnn_v2b`), PyTorch-parity tested.

## Pending / next

- [ ] Create the Supabase project + `corrections` table (owner task), fill
      `app/src/config.ts`, redeploy → collection goes live end-to-end.
- [ ] `feedback_ingest`: offline script turning collected records / exported
      JSONL into fine-tuning TSV (dedup latest-wins, holdout contamination
      filter) — write once real data has accumulated.
- [ ] Next fine-tuning round gated on the frozen holdouts H1/H2.
- [ ] If abuse appears (public anon endpoint has no per-IP rate limit on the
      free tier): put a Cloudflare Worker in front for validation/rate limiting.
- [ ] v1.5 — hybrid engine (planned).
