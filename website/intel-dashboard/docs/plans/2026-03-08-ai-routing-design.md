# AI Routing Migration Design

## Goal

Move text AI work to Cerebras by default, keep Groq Scout only for true media-aware dedupe, and reserve Cerebras GLM for rare escalations.

## Routing

- Text lane: `cerebras/gpt-oss-120b`
- Media lane: `groq/meta-llama/llama-4-scout-17b-16e-instruct`
- Escalation lane: `cerebras/zai-glm-4.7`

## Behavior

- Standard text dedupe, translate, classify, briefing, and enrichment use the text lane.
- Dedupe requests with image-like URLs in the payload use the media lane and send multimodal message parts.
- If the primary dedupe lane fails to produce a valid `dedupe_key`, the worker retries once on the escalation lane before falling back to deterministic hashing.
- Async AI jobs default to the internal queue-backed concurrency path so the Worker still executes via AI Gateway instead of Groq batch APIs.

## Operations

- Keep route and model selection configurable with environment variables.
- Keep remote Worker secrets authoritative for runtime AI model selection.
- Preserve the legacy Groq batch mode in code for rollback, but do not keep it on the default path.

## Validation

- Unit and integration coverage for text, media, and escalation lanes.
- Typecheck and dry-run deploy must pass before remote deployment.
