# AI Observability

## Overview

The repository uses two telemetry surfaces for AI:

- **Backend custom metrics** in Cloudflare Analytics Engine dataset `intel_dashboard_ai`
- **AI Gateway native analytics** for gateway-level request, cache, and provider visibility

Use these together:

- Analytics Engine for application-level lanes and outcomes
- AI Gateway analytics for provider/gateway/cache behavior across edge and backend calls

## Dataset Shape

Binding:

- `AI_TELEMETRY`

Dataset:

- `intel_dashboard_ai`

Current write schema:

- `index1`: `source:pipeline`
- `blob1`: source (`backend` or `edge`)
- `blob2`: pipeline
- `blob3`: lane
- `blob4`: model
- `blob5`: provider
- `blob6`: outcome
- `blob7`: cache status
- `double1`: status code
- `double2`: duration milliseconds
- `double3`: prompt tokens
- `double4`: completion tokens
- `double5`: total tokens
- `double6`: output/input ratio
- `double7`: call count
- `double8`: translated count
- `double9`: failed count
- `double10`: media count

## Grafana Query Starters

### Calls by pipeline and lane

```sql
SELECT
  blob2 AS pipeline,
  blob3 AS lane,
  COUNT(*) AS calls
FROM intel_dashboard_ai
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY pipeline, lane
ORDER BY calls DESC
```

### Prompt vs completion tokens

```sql
SELECT
  blob2 AS pipeline,
  blob3 AS lane,
  SUM(double3) AS prompt_tokens,
  SUM(double4) AS completion_tokens,
  SUM(double5) AS total_tokens
FROM intel_dashboard_ai
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY pipeline, lane
ORDER BY total_tokens DESC
```

### Output/Input ratio by lane

```sql
SELECT
  blob2 AS pipeline,
  blob3 AS lane,
  AVG(double6) AS avg_output_input_ratio
FROM intel_dashboard_ai
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY pipeline, lane
ORDER BY avg_output_input_ratio DESC
```

### Average latency by lane

```sql
SELECT
  blob2 AS pipeline,
  blob3 AS lane,
  AVG(double2) AS avg_duration_ms,
  MAX(double2) AS max_duration_ms
FROM intel_dashboard_ai
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY pipeline, lane
ORDER BY avg_duration_ms DESC
```

### Cache hit rate by lane

```sql
SELECT
  blob2 AS pipeline,
  blob3 AS lane,
  blob7 AS cache_status,
  COUNT(*) AS calls
FROM intel_dashboard_ai
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY pipeline, lane, cache_status
ORDER BY pipeline, lane, cache_status
```

### Failure rate by pipeline

```sql
SELECT
  blob2 AS pipeline,
  blob6 AS outcome,
  COUNT(*) AS calls
FROM intel_dashboard_ai
WHERE timestamp > NOW() - INTERVAL '24' HOUR
GROUP BY pipeline, outcome
ORDER BY pipeline, outcome
```

## Dashboard Recommendation

Start with Grafana panels for:

1. total AI calls by pipeline
2. prompt vs completion token spend by lane
3. output/input ratio by lane
4. average latency by lane
5. cache hit/miss mix by lane
6. error/fallback outcomes by pipeline

## Notes

- Edge Telegram translation and OCR currently rely primarily on AI Gateway native analytics for gateway-level visibility.
- Backend telemetry is the source of truth for application-level AI job outcomes and token ratios.
- If edge application-level telemetry becomes necessary later, add aggregated cycle-level Analytics Engine writes rather than per-message writes.
