# Default Client Workspace — the design, and why

**27 Sep 2026.** Reasoned from the Cboe build (Brand 186952 — 146 calculated dimensions, 98 calculated measures, measured) and stress-tested against a second, structurally different plan: `GS_PWM_2026_PWM_2H_Media_Plan_R3_9_18_26.xlsx`.

---

## 1 · The diagnosis: the name is being used as the database

Cboe encodes 16 attributes into a placement-name string. Every one is then *re-extracted* by a calculated dimension with a 20–46 branch `IF` chain. The result, counted:

| Job | Dimensions doing it |
|---|---|
| Region / geo / market | **16** |
| LOB / funding source | **26** |
| Size / format | **13** |
| Creative message / theme | **11** |
| Product | **10** |
| Channel | **8** |
| Audience · publisher · tactic | 4 each |
| **Total in these nine families** | **93 of 146** |

Plus 98 measures, of which **31 are QA measures** — a QA layer whose size is a direct function of how much parsing the workspace does. And 74 of 146 dimensions have zero downstream dependents; 68 of 98 measures likewise. The workspace is mostly sediment.

**The parsing is not the mistake. Putting *volatile* attributes in the name is.**

### The volatility test

Ask of each attribute: *does this change during the flight?*

| Attribute | Changes mid-flight? | Evidence from Cboe |
|---|---|---|
| Region, country | no | — |
| Publisher | no | — |
| Channel | no | — |
| Funnel / strategy | no | — |
| **Package** | **yes** | `APAC_KR…_Consideration_TP_` → `…_Consideration_Naver_TP_` stranded 20,000/month |
| **LOB / funding source** | **yes** | `Hood HOU` → `Hood US`; budget reallocations |
| **Cost method** | **yes** | a CPM line renegotiated to flat — why `PMI Cost Method` needs 23 IFs *plus* name-token fallbacks |
| **Size / format** | **yes** | retrafficking — 13 dimensions chasing it |
| **Audience** | **yes** | audiences added mid-flight (GS LinkedIn, four under one line) |

Every stranded dollar, every fallback chain, every `Unclassified` bucket in the Cboe workspace traces to a volatile attribute living in an immutable string. A renamed placement is a new entity; history does not follow it.

### The rule

> **The name carries a stable ID plus only flight-invariant attributes. Everything volatile lives in a classification keyed on that ID.**

Not "nothing in the name" — the name is the only field that flows to *every* platform (ad server, social APIs, search, DSP, vendor files), so it is both the universal join key and the human fallback when a classification row is missing. That is why Cboe put everything there. The fix is to be selective, not to stop.

---

## 2 · What that buys

| | Cboe today | Default Client Workspace |
|---|---|---|
| Region dimensions | 16 | **4** — named for the question, not the word |
| LOB dimensions | 26 | **2** (LOB, funding source) |
| Size / format | 13 | **1** |
| Adding a publisher | classification row + possible cost-method branch + possible size branch | **1 classification row** |
| Adding a region | rows across 16 dimensions | **rows in 1 classification** |
| Adding a channel | new metric set + branches | **new metric set** (unavoidable) |

**New publishers are free. New regions are free. New cost types are nearly free. New channels cost a metric set — that is the real boundary,** and it is the only one that should ever require workspace surgery.

### Never build a dimension called "Region"

Cboe has 16 because "region" is at least four questions. Name dimensions for the question:

- `Ran In` — where the impression served
- `Funded By` — whose budget paid
- `Agency Book` — whose P&L it sits on (the page scope)
- `Market Scope` — national / DMA / event

GS PWM proves the fourth is not optional: its `MARKET` column holds **National · San Francisco · Event** — a mix of geographic scope and buy occasion that no country field can express.

---

## 3 · Stress test — GS PWM, a structurally different plan

What it contains that Cboe does not:

**Seven buy models, two of them hybrids:** CPM · CPT (Uber "Cost per Trip") · Flat Rate · Flat · AV (Added Value) · **CPM/CPC** (LinkedIn, blended) · **CPM/Added Value** (Axios).

**Non-numeric cost and impression cells:** the literal strings `PKG` and `AV` sit in the Cost, Impressions and Rate columns.

**Seven flight-date formats in one column:** `9/21/2026 - 12/31/2026`, `10/1 - 10/5`, `9/21/26 - 12/31/26`, `11/9 on hold`, `12/1 & 12/3 on hold`, `11/2 - 11/6`, and one real datetime.

**A change log inside the plan:** the `Status` column reads `New 9/16`, `New 9/18`, `Updated 9/18`, `Revised 9/16`. This is the single most useful field in the workbook — see §5.

**Three rate concepts per line:** `Rate Card`, `Rate` (negotiated), `Savings`. Entrepreneur: rate card 65, negotiated 40. Cboe carries only the negotiated rate, so it can never show the client value delivered.

**An Audience Tracker tab** carrying Line of Business · Vendor · Campaign · Channel · Media Partner · Markets · Data Provider · Audience Name (Brief) · Audience Name (Platform) · Audience Size · Definition · Collection Methodology · **Compliance Approved · Approver · Approval Date**. A pre-built classification *with governance attached*, handed over for free.

**Two site lists** — Programmatic (42 domains) and Martini (39) — as Domain → Publication → Parent Company with include/exclude. A pre-built publisher classification.

**An RF Projections tab** with a stated universe of 800,000, on-target impressions (7,311,080 of 184,213,700 total), non-cumulative and cumulative reach, and monthly frequency.

**An immediate compliance finding:** the Audience Tracker's own Line of Business column reads `GS PWM`, `Private Wealth Management` and `PMI` on consecutive rows. Three names, probably one LOB, before a single tag is trafficked.

---

## 4 · Eight iterations — what each publisher and cost type broke, and what it revealed

### i · Uber, CPT (Cost per Trip)
A unit basis no ad server reports. Trips come from Uber's own file. **Revealed:** the classification must carry not just `Unit Basis` but **`Units Source` — which data stream is authoritative for the denominator.** **Design change:** rate classification gains `Units Source` and `Units Field`.

### ii · Martini, package with SOV children
Parent carries 83,448.78; five children carry the string `PKG` and a `Planned SOV` (40% · 100% · 40% · 100%). Those SOVs sum past 100% — they are share of *that size's* rotation, not share of budget. **Revealed:** package children cannot be assigned cost by any rule present in the plan. **The tool must flag and ask, never allocate by guess.** Cost lives at package grain, delivery at placement grain, so **any table mixing them must roll delivery up to the package** — the Cboe rule that cost 279,233.44 of August plan to learn. **Design change:** `Allocation Rule` is an explicit, required field: `none (cost stays at parent)` · `by SOV` · `by impressions` · `even` · `ask`.

### iii · LinkedIn, one line and four audiences
One cost (115,000); four audience rows beneath it with no allocation. LinkedIn *will* report per ad set, so delivery splits and plan does not. **Revealed:** **plan grain ≤ delivery grain, per publisher.** The join grain must be computed as the **coarser of the two**, per publisher, and stored. (At Cboe: campaign name cannot be a row dimension because plan and delivery name campaigns differently — 409,926.72 of phantom unplanned spend.) **Design change:** publisher registry gains `Plan Grain` and `Delivery Grain`; the tool derives `Join Grain` and refuses to build a widget below it.

### iv · Axios and Puck, Newsletter with Open Rate
Open Rate exists only for newsletter. **Revealed:** **metrics are channel-conditional.** A column of zeros is how an analyst concludes underperformance when the truth is the metric does not exist for that channel. **Design change:** `channel_metric_map` is a first-class object; widgets inherit it.

### v · Condé Nast and Martini, Brand Lift Study — channel `Study`
No impressions, no cost, buy model AV. Must exist for completeness; must be excluded from every rate calculation or it divides by zero. **Design change:** `Billable (Y/N)` and `Rate Eligible (Y/N)` become explicit classification columns, not inferred from a token.

### vi · MARKET = National / San Francisco / Event
Not a region. A blend of geographic scope and buy occasion. **Revealed:** confirms §2 — dimensions named for the question, and a fourth axis (`Market Scope`).

### vii · Rate Card vs Rate vs Savings
**Revealed:** a new metric family — `Rate Card` · `Negotiated Rate` · `Effective Rate` (delivered cost ÷ delivered units) · `Savings vs Rate Card`. **Design change:** three rate fields on the plan feed from day one.

### viii · Hybrid buy models — `CPM/CPC`, `CPM/Added Value`
One plan line, two cost bases. **Revealed:** `Cost Method` cannot be single-valued at plan-line grain. **Design change:** the tool **forces the split at ingestion** and flags it, because a row with two cost bases cannot be paced.

### Interrogating the result

A ninth case — a podcast buy at CPCV from a new publisher, mid-flight — is absorbed with **two classification rows and zero dimension changes**. Completion-rate reporting would be a new measure. The boundary holds: **publishers, regions and cost types are data; channels are schema.**

The one place the design is still weak: the **ID registry**. Cboe minted `FCM-` keys with a rule that is now unrecoverable (tested 10 candidate inputs × 4 algorithms, no match), and two identical placement names carry different IDs because the rule keyed on row identity. **An ID scheme that cannot be re-derived from the data must be owned and persisted by the tool, never recomputed.**

---

## 5 · The `Status` column is the ID registry's carry-forward mechanism

An ID must be minted once per plan line and survive every later version and every retrafficking. Matching plan versions by name fails — names change. Matching by position fails — rows are inserted.

GS PWM's `Status` column solves it: `New 9/18` says *mint*, `Updated 9/18` and `Revised 9/16` say *carry forward the existing ID*, blank says *unchanged*. The tool should require this column (or generate it by diffing versions) and treat any line it cannot match with confidence as a question for a human, not a new ID.

---

## 6 · Why reports get misread — the seven root causes, all observed

| Cause | Observed at Cboe |
|---|---|
| Metric does not apply to the channel | newsletter open rate on display rows |
| Aggregation double-counts | a Pivot with 2+ row dimensions exports nested; the body sums to exactly 2× the total |
| Plan and delivery on different grains | 279,233.44 of August plan vanished from a widget |
| A fallback silently buckets | unmatched classification returns NULL, and `== ''` does not match NULL — 1,987,317 and 2,775,692 sat in alarm buckets |
| Two metrics, same name, different maths | `Total Spend` vs `PMI Total Spend` vs `PMI Total Spend v2` |
| A reprocess rewrote history | actualized spend moving — the reason the three-metric split exists |
| A filter excluded plan rows | `PMI Total Spend > 0` deleted 100% of plan from two widgets |

### The diagnostic ladder the tool should run, in order

1. Does the grand total equal the sum of the body? *(nested export / double count)*
2. Is the metric non-zero **anywhere**? *(channel-inapplicable)*
3. Split by Data Stream — does one stream carry all of it? *(stream-only field)*
4. How much sits in the dimension's own fallback value? *(silent bucketing)*
5. Put plan and delivery side by side — is one side zero? *(grain mismatch)*
6. Remove every filter and re-pull. *(the `>0` trap)*
7. Diff against the previous pull. *(reprocess drift)*

---

## 7 · Thresholds worth encoding

| Check | Threshold | Why this number |
|---|---|---|
| Unclassified share of spend | **≤5%** | below this, classification work has diminishing returns |
| Plan-only publishers | **0** | any is a naming break, not a pacing story |
| Delivery-only publishers | **0** | same |
| Pacing band, flighted month | **80–110%** | Cboe's healthy publishers all landed 80–95% |
| Over-delivery needing review | **>110% of plan** | only 4 of 188 packages exceed it, worth 3,467.31 |
| Duplicate media buy names across streams | **0 with spend in both** | Cboe has 8, worth 36,455.73 |
| Stream freshness | **≤ the stream's own finalization window** | CM360 states "finalized after seven days" |
| Name compliance | **≥95% of spend on compliant names** | below that, dimensions are running on fallbacks |

---

## 8 · The lookback window, and how taxonomy determines it

Forecast = (delivered over the lookback ÷ lookback days) × days remaining, capped at plan. The taxonomy determines the denominator (`Unit Basis`), where it comes from (`Units Source`) and the grain it can be computed at (`Join Grain`). **The lookback default must be ≥ the longest finalization window across the streams feeding that line.**

---

## 9 · Benchmarks from an uploaded pivot — what makes it possible

The benchmark key is **(client, channel, publisher, audience, format)** — and it only works if each of those five is a dimension in its own right rather than a token inside a name. Benchmarks also need a **range**, not a point — GS gives `.06 - .11%` and `.15 - .35%`. Store min, max and target.

---

## 10 · The client-setup export list

**Tier 1 — cannot start without these:** media plan (current version) · naming convention doc · rate card / negotiated rate sheet plus IO or ATP · CM360 placement export · site list(s).

**Tier 2 — needed before launch:** measurement plan / KPI document · audience tracker · digital specs sheet · flowchart / monthly pacing · benchmark set · creative export · per-platform exports · conversion / floodlight configuration.

**Tier 3 — only when migrating an existing workspace:** stream, calculated dimension, calculated measure and classification lists · **page and widget usage report**.

**Tier 4 — nice to have:** RF projections and universe size · prior-period reporting the client already trusts.

---

## 11 · Storage and mapping model

**Global:** taxonomy templates (agency default + recommended per data level), the channel → metric map, the diagnostic ladder, the threshold defaults.

**Per client:** `client_profile` holding the chosen taxonomy, token map, classification schemas, publisher registry, rate registry, **ID registry**, benchmark set, threshold overrides.

**Per data stream, a mapping document:** `stream_name`, `platform`, `grain`, `join_key_field`, `cost_field`, `units_field`, **`authoritative_for`**, `finalization_window_days`, `reprocess_cadence`, `ingest_route`. `authoritative_for` is the generalisation of Cboe's `In Vendor File` exclusion classification and its `PMI Spend Gate`.

**Email-in streams:** a manual TotalConnect upload's failure mode is silent — nobody uploads, the stream keeps last month's plan, and every closed month reads ~100% pacing. Email-in plus a freshness QA is the fix.

---

## 12 · What changes when conventions change mid-relationship

**Check first:** page and widget usage report · dependency chains (at Cboe, `Site Name Clean` has 15 dependents; `PMI Media Buy Site Name` has 0) · which literals reference old spellings.

**Change, in this order:** add the new convention alongside the old · prepend the new lookup as the first branch of existing dimensions · gate on `Unclassified` only shrinking and no value moving between named buckets · only then retire the old chain, renaming to `ZZ - DO NOT USE`.

---

## 13 · The shortest path from ingestion to dashboard

Cboe's path: platform → stream → 146 dimensions parsing names → 98 measures → page. The target: platform → stream → **~20 thin dimensions reading classifications** → **~15 measures** → page.

1. Classifications instead of IF chains.
2. One dimension per question, named for the question.
3. `authoritative_for` per stream instead of an exclusion gate.
4. Declared grains instead of discovering mismatches in production.
5. A channel → metric map instead of one-off metrics per channel.
6. Three spend metrics with fixed jobs — platform truth (internal, may move), plan (pacing), actualized (client-facing, frozen at close).
