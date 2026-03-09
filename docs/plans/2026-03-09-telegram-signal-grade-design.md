# Telegram Signal Grade Design

## Goal
Add a world-class, explainable subscriber signal grading system for the Telegram feed without introducing opaque black-box ranking.

## Principles
- Deterministic and explainable first.
- Fast enough to run inline in the Telegram Durable Object.
- Tunable without code changes where practical.
- Subscriber-facing grade should be stable; internal rank can remain more sensitive.
- Operator debugging must stay possible from stored inputs and breakdowns.

## Outputs
Each canonical Telegram event will carry:
- `signal_score` (0-100)
- `signal_grade` (`A`, `B`, `C`, `D`)
- `signal_reasons[]`
- `signal_profile_id`
- `grade_breakdown` (owner/debug surfaces only)

## Scoring model
The scoring engine combines six feature families:
- `source_quality_score`
- `lead_score`
- `corroboration_score`
- `evidence_score`
- `freshness_score`
- `penalty_score`

Final score is deterministic, weighted, clamped to `0..100`, and converted to a letter grade.

### Initial feature inputs
- source prior from trust tier and channel historical performance
- first-reporter / lead-report status
- corroboration count and source diversity
- media and OCR evidence presence
- recency / freshness tier
- penalties for single-source late follow-on chatter, duplicate-heavy posts, and weak evidence

## Storage model
### D1
Store durable and auditable grading state in D1:
- `telegram_signal_profiles`
  - active profile definitions and category-specific weights
- `telegram_signal_profile_rules`
  - optional threshold/rule overrides
- `telegram_source_history`
  - persisted channel history used to inform source-quality scoring

### KV
Use KV for precomputed summaries and optional hot caches:
- cached leaderboard snapshots (`24h`, `7d`, `30d`)
- top first-reporter summaries

D1 remains the authoritative source for the active grading profile. KV may mirror hot profile reads, but reproducibility must come from D1 plus the persisted `signal_profile_id` on each event.

## Runtime flow
1. Telegram scraper DO canonicalizes an event cluster.
2. It loads the active grading profile from D1 (with optional hot caching), not KV as the source of truth.
3. It computes feature vector + score + grade.
4. It updates source-history aggregates.
5. It includes grade metadata on the canonical event payload.

## UI changes
Subscriber-facing Telegram UI should expose:
- signal grade badge (`A/B/C/D`)
- concise reasons such as:
  - `First`
  - `Multi-source`
  - `Core source`
  - `Media-backed`
  - `Fresh`
- subscriber-only modes:
  - `First reports only`
  - `High signal only`

Owner/debug UI can expose the raw breakdown.

## Why not use an npm ranking engine
A package may help with small support concerns, but not as the core ranking model.
- Black-box ranking reduces trust.
- Subscriber and operator workflows need explainability.
- Current source-performance logic is already a strong first-party base.

If any package is used, it should only support configuration or calibration, not replace the scoring engine.

## Testing
- unit tests for score breakdowns and grade thresholds
- edge tests for canonical event grading persistence
- UI tests for grade rendering and new filters
- regression tests for category-specific weighting

## Rollout
1. Introduce engine + storage with safe defaults.
2. Render grade + reasons.
3. Enable `High signal only` and `First reports only`.
4. Add leaderboards after the history data has enough depth.
