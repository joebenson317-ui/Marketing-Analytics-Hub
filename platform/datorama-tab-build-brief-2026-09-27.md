# Build brief — the Datorama tab: taxonomy builder, compliance engine and analyst runbook

**27 Sep 2026.** Companion to `default-client-workspace-design-2026-09-27.md`, which carries the reasoning behind every rule below. Implemented in `app/analytics-hub.html` (the `Datorama` tab).

## 0 · The one idea everything rests on

A placement name carries **a stable ID plus only flight-invariant attributes**. Everything that can change during a flight lives in a classification keyed on that ID.

Flight-invariant, safe in the name: region · country · publisher · channel · funnel stage. **Volatile, never in the name: package · LOB / funding source · cost method · size / format · audience.** The builder warns, explains, and requires an explicit override with a typed reason.

## 1 · Data model

**Global:** `taxonomy_template` (per data level: campaign · media_buy/placement · creative · ad · keyword · conversion), `token` (position, label, question, vocabulary, volatile, required), `channel_metric_map`, `diagnostic_check`, `threshold_default`, `question_template`.

**Per client:** `client_profile`, `publisher_registry` (canonical name, parent, invoices as, stream type, plan grain, delivery grain → join grain), `rate_registry` (rate card, negotiated, unit basis, units source, billable, rate eligible), `id_registry`, `classification`, `benchmark` (min/target/max with `as_of`), `stream_map`.

**`stream_map`** — one row per data stream: name, platform, grain, join key field, cost field, units field, `authoritative_for[]`, `finalization_window_days`, `reprocess_cadence`, `ingest_route`, `file_shape`. **Exactly one authoritative stream per (metric, join key)**; two is rejected and named. The longest finalization window sets the minimum forecast lookback (CM360: seven days).

## 2 · Ingestion — media plan → normalised plan lines

Detections that raise a question when ambiguous: header row · plan line vs sub-row · package parent/child (`PKG`) · non-numeric cost (`AV`, `PKG`, `-`, `TBD`) · flight dates (≥7 formats, `on hold`, `&`) · hybrid buy model (`CPM/CPC`) · multi-burst lines.

Output schema: `stable_id, plan_version, status, publisher_key, placement_concept, channel, funnel_stage, market_scope, ran_in, funded_by, agency_book, audience_keys[], format, unit_size, buy_model, unit_basis, units_source, rate_card, negotiated_rate, planned_units, planned_cost, flight_start, flight_end, flight_note, package_parent_id, allocation_rule, billable, rate_eligible, benchmarks[], notes`. `allocation_rule` defaults to `ask`, never to a guess.

**ID registry:** `New <date>` → mint; `Updated/Revised` → carry forward; blank → unchanged. A line that cannot be matched with confidence is a question, not a new ID. The tool owns the registry and never recomputes an ID.

## 3 · Taxonomy builder

Token-position editor with the question each token answers, vocabulary, required and volatile flags; recommended template per data level, badged; deviating requires a typed reason stored on the profile; live preview from a real plan line with a character count against CM360's 255 limit.

Hard rules: volatile attributes blocked unless overridden · stable ID in every template at a fixed position · constant token count within a level · no token contains the delimiter · never a token called "Region" (Ran In · Funded By · Agency Book · Market Scope).

Generates: trafficking sheet (DCM-shaped) · classification set (one per volatile attribute, keyed on the ID) · dimension manifest (~20 thin dimensions) · measure manifest · pattern spec per level.

## 4 · Compliance engine

Ten checks in order: token count · delimiter integrity · vocabulary · stable ID present and known · volatile attribute in the name · character limit · plan coverage · cross-level consistency · duplicate names · case and whitespace. Reported as **% of lines** and **% of spend** compliant; the threshold is **≥95% of spend**.

Thresholds (all measured from one reference workspace, all overridable): unclassified spend ≤5% · plan-only publishers 0 · delivery-only publishers 0 · pacing band 80–110% · over-delivery review >110% · duplicate names with spend in 2+ streams 0 · stream freshness ≤ finalization window · spend on compliant names ≥95%.

## 5 · Metrics and aggregation

Three spend metrics with fixed jobs: **Platform Spend** (authoritative stream, moves on reprocess, internal), **Plan Spend** (pacing), **Actualized Spend** (client-facing, frozen once the month closes) plus a `Month Status` dimension. Four rate metrics: Rate Card · Negotiated · Effective · Savings vs Rate Card. Channel-conditional metrics are suppressed, never rendered as zero.

Aggregation rules: cost at package grain, delivery at placement grain — roll delivery up · join grain is the coarser of plan and delivery grain per publisher · campaign name is never a row dimension on a plan-vs-delivered table · `spend > 0` filters only on delivery-only tables · rate-ineligible rows excluded from every rate calculation · export tables, not pivots.

## 6 · The diagnostic ladder

On any uploaded pivot, in order: total = body? · metric non-zero anywhere? · one stream carrying all? · fallback share (NULL ≠ `''`) · plan vs delivery zero side · filters removed · diff vs previous pull. Each finding: what fired · what it means · what to do.

## 7 · Forecasting

`run_rate = delivered_units_in_lookback / lookback_days`; `forecast = delivered_to_date + run_rate × days_remaining`; `forecast_cost = forecast_units × negotiated_rate` (capped at plan where a cap applies). Needs `unit_basis`, `units_source` and `join_grain` from the taxonomy. Default lookback = max finalization window across the feeding streams; warn below it and name the stream.

## 8 · Benchmarks

Key: (client, channel, publisher, audience, format, metric) with min/target/max and `as_of`. Benchmarks stated inline on the plan are harvested at ingestion.

## 9 · Stream conversion and email-in

Byte-identical headers, data on the first sheet, a flowchart-to-plan-stream converter keyed on month position. Prefer email-in; pair every upload route with a freshness check.

## 10 · The question queue

A count badge on the tab; one plain-language decision per card; every answer writes to a registry so it is never asked twice. Catalogue: unknown publisher · unknown buy model · non-numeric cost · ambiguous flight · hybrid buy model · multiple audiences on one budget · inconsistent LOB naming · new channel · no authoritative stream · benchmark missing.

## 11 · The analyst runbook

Before launch (1–9), during flight (10–14), after flight (15–19); steps the Hub can verify are marked automatically.

## 12 · Knowledge basis

Calculated dimensions are string logic evaluated per row; classifications are lookups on a key. A classification is many-to-one on its key. An unmatched classification may return NULL. Name patterns are positional. Stream name substrings are load-bearing. A pivot with 2+ row dimensions exports nested. Reprocessing rewrites history. TotalConnect field mappings bind to exact header strings. Platform-reported cost differs by stream.

Datorama's own documentation is the authority for platform behaviour and changes without notice — verify against Salesforce's current Marketing Cloud Intelligence docs before relying on any platform mechanic here, and record the date checked. Every number in this brief is a measurement from one workspace or one media plan; re-calibrate thresholds per client after a flight.

## 13 · Build order

1. stream_map + publisher registry + ID registry · 2. plan parser + question queue · 3. taxonomy builder + template library · 4. trafficking sheet and classification generators · 5. compliance engine · 6. dimension and measure manifests · 7. diagnostic ladder · 8. forecasting · 9. benchmark loop · 10. stream converters and email-in · 11. runbook UI.

**Status 27 Sep 2026:** 1–7 and 11 shipped in the Datorama tab; benchmark harvest (part of 9) shipped; forecasting (8), the benchmark upload loop (9) and stream converters / email-in (10) are next.
