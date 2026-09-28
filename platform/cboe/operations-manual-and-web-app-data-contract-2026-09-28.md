# Cboe Datorama — operations manual and web-app data contract

**28 Sep 2026.** Written two ways at once: as the document a marketing analytics director
hands a new analyst on day one, and as the specification for the website that will ingest
this workspace's exports.

**Companion docs.** `cboe/infrastructure-breakdown.md` (4 Sep) remains the reference for
load rules, floodlights, exclusion lists and dashboard inventory. This doc **supersedes it
on four points** — see §0.3. `cboe/decision-log.md` is the running record of every choice and
its evidence.

---

## PART I — ORIENTATION

### 1.1 What this workspace is, in one paragraph

Cboe's media runs across an ad server, four social platforms, a search API and a large
manually-uploaded vendor file. All of it lands in **data streams**. Names carried in each row
are split by **patterns** into positional fields; **classification files** correct exceptions
and supply attributes the names don't carry; **calculated dimensions** translate those into
business values. Spend is never a raw field — it is a **calculated measure** that swaps its
source column depending on the publisher, zeroes hundreds of listed IDs, and (once fixed)
computes cost from rate × delivered units for contract-rate lines. The client's own reporting
artifact is not a Datorama dashboard at all: it is an Excel **flowchart**, four LOB pivot tabs,
which a human updates monthly by reading Datorama. The whole job is keeping those two things
in agreement.

### 1.2 The five things that will confuse you first

1. **The flowchart is downstream of Datorama, not upstream.** For EMEA and APAC a human reads
   the dashboard and types the number into the spreadsheet. Nothing computes it.
2. **Two-thirds of delivered spend arrives in a manually uploaded file.** `TotalConnect -
   Vendor Data` carries **4,284,050.96** of 6,335,334.62 (67.6%). The APIs are the minority.
3. **Plan and delivery do not share a key.** Prisma placement IDs never enter Datorama —
   0 of 1,703 match 5,730 live keys. Everything hand-built in this workspace exists because of
   that one missing join.
4. **"Region" is four different questions**, and there are sixteen dimensions answering them.
5. **A reprocess changes history** unless a month-status gate freezes it. That is why there are
   three spend metrics, not one.

### 1.3 The shape of the pipeline

```
SOURCE            ad server · social APIs · search API · vendor file · Prisma plan
   │
   ▼ INGEST       Data Stream. One CM360 connection → 3 DFA streams via load rules
   │
   ▼ FILTER       Data Load Rules — Site Name allowlists, row-level, at ingest
   │
   ▼ MAP          source columns → dimensions & measurements (raw _TX fields)
   │
   ▼ HARMONIZE    a. PATTERNS split names into positions
   │              b. CLASSIFICATION FILES correct exceptions and add attributes
   │              c. CALCULATED DIMENSIONS translate and compose — never parse
   │
   ▼ MEASURE      spend, impressions, conversions; fees layered on top
   │
   ▼ REPORT       dashboards · scheduled exports
   │
   └─ EXIT        → the flowchart workbook (today a manual read; target: generated)
```

**Extraction doctrine, in priority order: Pattern > Classification File > Calculated
Dimension.** A calculated dimension that parses a string is a pattern that was never built.
This workspace has 146 calculated dimensions largely because that doctrine was not held.

---

## PART II — INFRASTRUCTURE

### 2.1 Data streams — 14 live, with measured spend (Apr–today)

| Stream | Route | Delivered spend | Authoritative for | Notes |
|---|---|---|---|---|
| **TotalConnect - Vendor Data** | manual upload | **4,284,050.96** | cost for offline/site-direct/EMEA/APAC | 67.6% of all delivered spend. Free-text names. The workspace's single biggest dependency and its most fragile. |
| Google DFA DV360 | API daily | 698,048.61 | impressions; cost for programmatic | load rule: `Site Name EQUALS {Ptarmigan Trading Desk, Ptarmigan Trading Desk US}` |
| Google DFA Site Direct | API daily | 635,772.55 | impressions | load rule: `Site Name EQUALS` a ~45-publisher allowlist. 🔴 **EQUALS means a new publisher silently drops** until added. |
| Google DS search test521 | API daily | 397,954.53 | cost + units for search | named "test" but carries all real search |
| Facebook-Ads | API daily | 145,145.49 | cost + units | 7d/28d post-click variants here and Reddit only |
| Linkedin Ads | API daily | 120,254.21 | cost + units | Revenue = platform Conversion Value — never sum with Floodlight |
| Reddit Ads | API daily | 43,244.22 | cost + units | has its own package classification (see 2.4) |
| Twitter Ads | API daily | 10,864.05 | cost + units | names hand-typed in the UI; no package token |
| Google DFA Social Conversions | API daily | 0.00 | conversions only | misnamed — 3,671 of 7,310 rows are Ptarmigan |
| **Cboe - Plan - Prisma - 2026** | manual upload | 0.00 (plan only) | **plan budget, rate, flight dates** | 🔴 `PMI Plan Source` matches the literal substring `Plan - Prisma` in the stream name. Rename it and every plan number silently becomes zero. |
| Cboe - Media Plan - 2026 | manual upload | 0.00 | **nothing — retire** | 83.6% duplicate of the plan stream; a live double-count hazard of up to 8.2M if anyone widens `PMI Plan Source` |
| TotalConnect SA Headlines 2 | manual upload | 0.00 | search copy | |
| TotalConnect SA Description | manual upload | 0.00 | search copy | |
| Retail Reach and Frequency | manual upload | 0.00 | reach / frequency | the only source of a reach universe |

**Three streams are named for things they are not** — `Google DS search test521` (all real
search), `Google DFA Social Conversions` (mostly programmatic), and the deleted
`Google DFA ESPN Test` (was a 100% duplicate carrying 172,523.40). Someone will eventually
filter these out believing they are test data.

### 2.2 Stream mapping — the contract the website must hold per stream

Every stream needs these declared. Four of them do not exist in Datorama and must be held in
the website, because without them double-counting and forecasting are both unsolvable.

| Field | Why it matters |
|---|---|
| `grain` | the row level the stream reports at |
| `join_key_field` | which column carries the joining name or ID |
| `cost_field` | `Media Cost` or `Media Cost (Original)` — they differ by 1.344× on DFA |
| `units_field` | impressions, clicks, completed views, or a partner-specific unit |
| 🔴 **`authoritative_for`** | cost · units · conversions · none. **Does not exist today.** 8 media buy names carry spend in both the vendor file and DFA (36,455.73), and an entire exclusion classification plus a six-branch spend gate exists to pick a winner. Declare authority once and that logic disappears. |
| 🔴 **`finalization_window_days`** | CM360 states on its own export face: *"Reporting numbers are finalized after seven days."* A three-day lookback on a seven-day window reads as under-delivery. |
| 🔴 **`reprocess_cadence`** | drives the freshness alarm |
| 🔴 **`ingest_route`** | api · manual upload · email-in |

**The silent failure.** The plan stream is a manual TotalConnect upload. If nobody uploads, it
keeps last month's plan and **every closed month reads ~100% pacing with no alarm**. This is
the highest-probability undetected failure in the workspace. The fix is email-in plus a
freshness check: `max(Day) on stream X older than its cadence`.

### 2.3 Patterns — what they are and what they parse

A pattern splits a delimited name into positional fields at ingest. It is the cheapest and
most durable extraction layer: it self-heals on new names, needs no maintenance per value, and
costs nothing per row.

| Pattern | Reads | Positions | Scoped to |
|---|---|---|---|
| `Media Buy - DFA & Vendor` | Media Buy Name | 1–13 | the 3 DFA streams + Vendor |
| `Media Buy - Socials (excl X)` | Media Buy Name | 9-token, geo-first | LinkedIn · Facebook · Reddit |
| `Creative - DFA & Vendor` | Creative Name | 1–7 full schema | DFA + Vendor |
| `Creative - DFA & Vendor (No LOB Pair)` | Creative Name | 7, short schema → `*_2_TX` alt fields | DFA + Vendor |
| `Creative - Socials` / `(9-Token)` / `(9-Token Variant)` | Creative Name | 8 / 9 | social streams |
| `Campaign - Search` | Campaign Name | 5 (LOB at 2, geo at 5) | search |
| `Campaign - Social (X) - Product` | Campaign Name | — | the two Twitter streams |
| `CountryTest` | Media Buy Name | — | **not ours — ignore** |

**Rules that cost money when broken.**

- `EXTRACT(text, delimiter, index)` is **zero-indexed**. 1-indexed position 12 is
  `EXTRACT(name,'_',11)`. Off by one and you silently read the wrong token.
- **One pattern per convention, scoped to every matching stream** — never per-stream copies.
- **Two patterns cannot write the same target fields.** The second writes parallel `*_2_TX`
  fields and a chooser dimension picks per row.
- `Media Buy - DFA & Vendor` maps **positions 1–13 only.** The LOB pair at 14/15 is parsed by
  a calculated dimension reading the raw name — the largest doctrine violation here. It works
  ($5.7M) but belongs in the pattern.
- **Structure Compliant is OFF**, so 14-, 15- and 17-token names parse left-aligned and land
  their tail tokens in the wrong fields. See §4.3 for how much.
- **A conforming test must check position, not presence.** `contains '_X_'` passed 14 broken
  X names; the fix is `TRIM(EXTRACT([Media_Buy_Name],'_',1)) == 'X'`. `contains` is only safe
  against a value **we** control, never a token someone else typed.

### 2.4 Classification files — what each one does

A classification is a lookup keyed on a field, loaded as a spreadsheet, editable by an analyst
without touching formulas. It can key off a **pattern** dimension but **not** a calculated one.
Datorama reads **sheet 1** — never make sheet 1 instructions. CSV must be UTF-8.

| Classification | Key | Rows | What it does and why it exists |
|---|---|---|---|
| `Classification - Media Buy - Prisma Package` | Media Buy Name | 1,734 | the main package resolver. Applied to DFA, DV360, Vendor, Plan, Facebook, LinkedIn, Twitter — **not Reddit**. |
| `Classification - Social - Reddit` | Media Buy Name | 15 | exists **only** because 11 media buy names run on two platforms at once (Facebook+Reddit ×8, LinkedIn+Reddit ×3, 161,479.43) and a classification is **many-to-one on its key** — one key cannot return two values. Do not merge it into the main file. |
| `Classification - Site Name - Clean` | Site Name | 85 | publisher normalisation, delivery-side spellings. See §3.4 — it must be merged with the client's own 78-row table, not replaced. |
| `Classification - Media Buy - Contract Rate` | Media Buy Name | — | the negotiated rate and its `Unit Basis` (CPM · dCPM · CPCV · CPC). Feeds contract-rate spend. |
| `Classification - Media Buy - In Vendor File` | Media Buy Name | — | marks rows the vendor file is authoritative for, so DFA does not double count. **This is `authoritative_for` implemented as a file.** |
| `Classification - Media Buy - Spend Override` | Media Buy Name | — | manual exclusions |
| `Classification - Media Buy - LOB Override` / `LOB Split` | Media Buy Name | — | overrides for names whose LOB token is wrong or absent, pending retrafficking |
| `Classification - Media Buy - Rename Request` | Media Buy Name | — | the retrafficking queue |
| `Classification - Creative - Size Correction` | Creative Name | — | a wrong size value inside an otherwise valid name |
| Creative Message 2026 Cboe (stream 7445515) | Creative Name | — | historically the only classification stream |
| **`Classification - Reference Sheet`** *(proposed, 366 rows)* | Media Buy Name | 366 | lifted from the client's own flowchart Reference Sheet — 15 attributes including **Cost Structure, Cboe Line of Business and BUYING REGION**. Covers all 140 standalone buys including **83 names with no tokens at all**. This is the file that should replace three hand-built IF chains. |

**Classification files go stale monthly.** The `File Dependency` dimensions are the shrinking
mechanism: every row flagged `2 - Review` is one a pattern has already made redundant.
`PMI QA Spend File Dependent` is the doctrine metric — **if it grows, conventions are losing
to files.**

### 2.5 Keying — how anything joins anything

There is no relational database. A key is whatever string two rows share.

| Key | What it is | Trap |
|---|---|---|
| **Media Buy Name** | the 16-token placement name | the workhorse. 10 conventions coexist. **Never retype one — copy from an export**; one contains a U+2019 apostrophe. |
| Media Buy Key | platform placement ID | used to zero specific rows |
| Media Buy Package Id | DCM package ID | **used interchangeably with Media Buy Key** in adjacent exclusion branches — never assume which |
| Creative Key / Name | creative identity | resolves LOB only under a buy that already classifies — **zero incremental classification value.** Build creative patterns for format, size and message, not LOB. |
| Campaign Name | umbrella or search/social campaign | resolves LOB only where the campaign *is* the LOB unit. DFA and vendor campaigns are cross-LOB umbrellas that resolve nothing. 🔴 **Never a row dimension on a plan-vs-delivered table** — plan and delivery name campaigns differently; measured phantom spend 409,926.72. |
| Conversion Tag Key / Category / Name | floodlight tag / group / activity | `==` exact only. Category = group. |
| **Prisma Placement ID** | the plan key | 🔴 **never enters Datorama — 0 of 1,703 match 5,730 live keys.** Every hand-built layer here exists because of this. **Highest-leverage fix in the workspace: have trafficking append the Prisma ID into the DCM placement name.** Then plan and delivery share a key and most of this document becomes unnecessary. |

### 2.6 Calculating spend — the part that takes longest to learn

**Three metrics, three jobs.** Confusing them is the most common error.

| Metric | Definition | Moves on reprocess? | Audience |
|---|---|---|---|
| `PMI Total Spend` | what the platform reports | **yes, by design** | internal QA only |
| `PMI Plan Spend` | the monthly budget to pace against | only on plan re-upload | pacing |
| `PMI Actualized Spend` | what the client is told they spent | **never, once the month closes** | **client-facing — the flowchart** |

Today `PMI Actualized Spend` = `Prisma Actualized Cost` on plan rows, and on all **737 closed
rows that equals the planned figure exactly** — because a human types it. It carries no
independent calculation yet.

**Spend swaps its source field.** `Total Spend` runs on `Media Cost (Original)` everywhere
except programmatic (Ptarmigan) and search (Google Adwords), which use `Media Cost`. On DFA
streams `Media Cost = 1.344 × Media Cost (Original)` — the DCM currency gross-up. So **any
cost-per metric reads ~25% more efficient than reality** against a planned CPA built on booked
cost. Flag it on every efficiency figure.

**The exclusion machinery.** 309+ Media Buy Key and 75+ Package ID exclusions, all conditioned
on `Data Stream contains 'DFA'`. Same shape in clicks, impressions and video. ~50 branches
return the *string* `'0'` rather than numeric zero. **Evaluation order is load-bearing and
undocumented** — the Ptarmigan branch sits ~250 branches deep, so a Ptarmigan row caught by an
earlier zero-out is zeroed first. Four expressions were **truncated at 32,767 characters on
export** — pull full text from the UI before replacing anything.

🔴 **The highest-value open fix.** `PMI Total Spend v2` reads
`IF(PMI Spend Gate == '6 - Source: contract rate x units', PMI Contract Spend, …)` — **and the
gate has no `6 -` value.** So contract-rate spend never computes and v2 is arithmetically
identical to v1. Add the branch and fixed-rate CPM lines start costing from delivered
impressions, which is what the two-rule model requires:

```
dCPM (platform reports cost)    → actualized net = media cost ÷ (1 − margin)
CPM  (platform reports no cost) → cost = rate × delivered impressions ÷ 1000
```

Always dCPM: Facebook, Twitter, Google, DV360. Vendors with no platform cost are CPM, priced
off the plan rate.

**CPM has a live divide-by-zero:** 87 media buys / 1,862,398 (21.6% of spend) have zero
impressions and non-zero cost — Linear TV and print by nature, plus six ESPN keys hand-zeroed
in impressions but not in spend.

### 2.7 The fee stack

```
Ad Serving   = PLANNED units ÷ 1,000 × $0.135
Commission   = the ATP's own rate × actuals
Client GROSS = Media NET (planned) + Commission + Ad Serving + Tax
```

🔴 **Ad Serving is on PLANNED units, not delivered impressions.** `PMI Ad Serving` uses
`PMI Impressions` (delivered) and will therefore **never reconcile to the flowchart.** To
match, feed it planned units from the plan stream. "Digital Media Tech Fee (0.135%)" is the
same $0.135 CPM under a percentage label — one number, two descriptions.

🔴 **Commission is per-ATP, not per-calendar-period.** Both `PMI Commission` and the flowchart
split by month (7% Jan–Mar, 6.5% Apr–Dec). The `Approved ATPs` tab shows the rate is fixed at
signing: `FY26 CNBC Linear TV` (3/16–12/27) = **7.0%**, `FY26 Retail - Q2-Q4` = **7.0%**,
`Prediction Markets` and `Vpon reallocation` = 6.5%. Distinct rates on the tab: **0.065,
0.06882, 0.070.** EMEA is a flat **7% on all media** per its own handover. A campaign signed
at 7% and running in June is billed 7%; the month rule bills 6.5%. Carry the rate per ATP.

**Tax is per-publisher and provably derived** — reproduces the flowchart's hand-entered tax to
six decimals: Nikkei 0.100000 · Grab 0.100000 · Channel News Asia 0.096786 · Business Times
0.096984 (the *blended* rate across its three lines). Only AFR (0.09) is unverifiable.

---

## PART III — THE THREE REGIONS

The single most important operational fact: **AMER, EMEA and APAC are three different
processes that produce the same-shaped output.** Treating them identically is how money goes
missing.

### 3.1 AMER / NAMR / Global

- **Plan origin:** the US team's Prisma instance. Real Prisma placement IDs.
- **Flowchart role:** the flowchart is the **planning** artifact. The US team plans in it, the
  client approves, an ATP is issued.
- **Delivery:** ad server + platform APIs, with real cost.
- **Actualization:** Prisma overwrites planned with actual at month close.
- **Datorama coverage:** full. Plan rows are `Monthly plan` type with real IDs.
- **Naming:** mostly the 16-token convention; ~77% of spend conforms.

### 3.2 EMEA

- **Plan origin:** a **separate Prisma instance**. No NAMR placement IDs, ever.
- **Flowchart role:** EMEA adds its media and placement detail to the **EMEA sections** of the
  US flowcharts, then does monthly spend splits from the totals.
- **Bookings go in as GROSS; the flowchart is kept in NET.** The agency keeps **7% on all
  media** — one flat rate. Currency codes: **CBT = GBP · CBV = EUR · CBU = USD**.
- **Geographic permissions:** Brand and Data Vantage run UK, DE, FR, NL. **Derivatives runs UK
  and FR only.** Stated twice — in the handover prose and in the `Approved Country list` tab,
  with approval dates and client sign-off. A line outside the matrix is a compliance failure.
- 🔴 **Actualization is manual.** *"Jennifer from the US team will get in touch to ask us if we
  can check the spends in Datorama and update the flowchart to show 'actual' spend per month."*
  **The client-facing number is a human reading a dashboard and typing into a spreadsheet.**
- 🔴 **Capping is an ad-hoc human request.** *"If a publisher has overdelivered on impressions,
  then it may look like we're over budget — so in this instance, I'd ask Jennifer to cap the
  spend."* Not a rule. Model it as an **event with an author and a date**, never a formula.
- **Metrics that no platform supplies**, requested from publishers by email monthly:
  newsletters → sends, opens, clicks · advertorials → page views, average time on site ·
  videos → starts, completes. Scoping rule: *"we only add spend data for content placements."*
- **Datorama coverage:** plan present as **Manual entry** rows with synthetic `FCM-` IDs;
  delivery present but with **`Prisma Package Name` blank on all 307 rows**, so both sides fall
  into `0 - No package`.
- **Operating rhythm:** trackers and status sheet updated **every Friday** · status meeting
  **Monday** · publisher data collated in the first days of the month · monthly report on the
  **penultimate Monday** · invoices quarterly (Q3 by 22 Jul, Q4 by 21 Oct).

### 3.3 APAC

Same as EMEA in every structural respect — separate Prisma, manual actualization, manual
additions to the flowchart — with these differences:

- **Markets:** HK, SG, JP, TW, AU, KR. Three languages appear in creative names: `EN`, `TC`
  (Traditional Chinese), and landing pages split `cboe.com` vs `cboe.com/zh_HK`.
- **Publishers are almost entirely APAC-only** — AAStocks, EtNet, AnyMind, Vpon, HKEJ, HKET,
  Business Times, Channel News Asia, Nikkei, Nikkei Business, Grab, South China Morning Post.
  None appear in AMER.
- **Tax applies** — the five per-publisher rates in §2.7 are all APAC publishers.
- **Vocabulary changes are governed:** *"Additional values must be agreed to by APAC team and
  EMEA team first, before EMEA team recirculates document to all global teams."*
- **Trafficking compliance is the worst of the three** — see §4.3.

### 3.4 What the three have in common, and where they diverge

| | AMER | EMEA | APAC |
|---|---|---|---|
| Prisma instance | US | own | own |
| Real Prisma placement IDs | ✅ | ❌ | ❌ |
| Plan row type in Datorama | Monthly plan | Manual entry (`FCM-`) | Manual entry (`FCM-`) |
| Actualization | Prisma overwrite at close | **human types it** | **human types it** |
| Commission | per-ATP (0.065 / 0.06882 / 0.070) | flat 7% | flat 7% |
| Booking basis | net in flowchart | **gross in Prisma, net in flowchart** | as EMEA |
| Currency | USD | GBP / EUR / USD | local + USD |
| Tax | none | none observed | **5 publishers, 9–10%** |
| Cost in CM360 | ✅ present | ❌ **$0.00 with real impressions** | ❌ **$0.00 with real impressions** |
| Non-platform metrics | few | newsletters, advertorials, videos by email | as EMEA |
| `Prisma Package Name` populated | ✅ | ❌ blank | ❌ blank |

🔴 **The single fix that unifies all three.** Populate `Prisma Package Name` on the 307 Manual
entry rows with a synthetic package name, and load a classification mapping the trafficked
placement names to the same value. `PMI Media Buy Package` then resolves both sides identically
and EMEA/APAC pacing works at **line grain** instead of publisher grain — which is the only
reason the three regions cannot be viewed as one plan today.

### 3.5 The unified three-region view

To see AMER, EMEA and APAC as one media plan, exactly **six fields** must be populated
identically on every row, whatever the region:

| Field | Why it is the minimum |
|---|---|
| `Buying Region` | who funded it — the flowchart's first pivot level |
| `Publisher` (normalised) | the second pivot level; must use one spelling across all three |
| `Free Form` | the third pivot level — the placement's semantic identity |
| `Funding Source` / `LOB` | the page filter that makes the four LOB tabs |
| `Cost Structure` | determines which cost rule applies, and therefore whether a number is comparable |
| `Prisma Package Name` | the join between plan and delivery |

Everything else — country, audience, device, targeting, format — enriches the view but does not
gate it. **A region that fills these six can be merged; a region that does not cannot.**

Today: AMER fills all six. EMEA and APAC fill four (they lack `Free Form` consistently and
`Prisma Package Name` entirely).

---

## PART IV — TAXONOMY

### 4.1 The 16-token media buy name — reconciled, authoritative

Derived from the client's own `Global Placement Builder`, which generates the names
column-by-column. All 224 builder rows are exactly 16 tokens.

| 1-idx | 0-idx | Authoritative label | Vocabulary | Older label |
|---|---|---|---|---|
| 1 | 0 | Region | AMER · APAC · EMEA · Global | Region |
| 2 | 1 | Country | US UK FR DE NL HK SG JP TW AU KR APAC EMEA GLO | Country |
| 3 | 2 | Site Name | publisher | Site |
| 4 | 3 | **Site Type** | Business · Finance · Network · News · Programmatic · Sports · Lifestyle | ~~Vertical~~ |
| 5 | 4 | Channel | Audio · DOOH · Display · Video | Channel |
| 6 | 5 | Targeting | `Contextual - …` · `Audience - …` | Targeting |
| 7 | 6 | **Strategy** | Awareness · Consideration · Engagement · Lead Gen | ~~Objective~~ |
| 8 | 7 | **Siteserved** | SS · TP | Serving |
| 9 | 8 | **Audience class** | TRAD · INTE · INVB | ~~Type~~ |
| 10 | 9 | Audience | INSTR · RETTR · HFM · RIA · INVB · WIRE · FA | Audience |
| 11 | 10 | Device | MULT · MOB · CONNTV · DKTP · TAB · IOS · AOS | ~~Multi~~ |
| 12 | 11 | **Format** | a semantic class, **not a pixel size** — see 4.2 | ~~Size~~ |
| 13 | 12 | **Cost Structure** | CPM · dCPM · CPCV · CPC · CPA · CPE · Flat · Free | ~~Rate~~ |
| 14 | 13 | **Funding Source** | BRD · IND · DVA · RET · GLO | ~~LOB 1~~ |
| 15 | 14 | **Line of Business / Campaign** | BRD · RTD · IND · DVA · CRD · VID · MAG · LIB · SP5 · OIP · RUT · ALL | ~~LOB 2~~ |
| 16 | 15 | Free Form | the placement's semantic identity | Creative |

Tokens **9+10** are one two-part code (`TRAD_INSTR`, `INTE_RIA`, `INVB_INVB`). Tokens
**14+15** are likewise one code (`BRD_BRD`, `IND_CRD` Credit Suite, `RTD_SP5` SP500 Suite,
`IND_VID` VIX Decomp, `RTD_MAG` MAG 10, `RTD_LIB` LIBWO, `RTD_OIP` OI Learning Portal,
`IND_RUT` RUT Options). **Position 15 is the product, not a second LOB** — the 46-IF
`PMI Line of Business` was reverse-engineering this table.

Validation against 280 tokenised Reference Sheet rows: token 13 == Cost Structure **99.6%** ·
token 4 == Site Type 98.2% · token 5 == Channel 97.9% · token 12 == Format 98.9%.
Token 3 == Site Name only **71.4%** — the sheet normalises the publisher beyond the token.

### 4.2 Why format is a name and not a pixel size — and the general rule

The Glossary states the reasoning, and it is better than the obvious answer:

> *"Placement Formats have been set up as names as opposed to pixel dimensions to allow for the
> grouping of formats — for example the billboard format has numerous dimensions based on
> region, therefore grouping this data using names is the ideal approach."*

A pixel size is **volatile** — retrafficking changes it. A format class is **stable**:
`970x250`, `994x250` and `980x250` are all `Billboard` forever. The 35-value vocabulary runs
`Ad.apt Unit · Advertorial · Audio · Banner · Billboard · Carousel Post · Cover Page · Ezine ·
Full Page · Halfpage · HTML Email · Image Post · InMail · Interscroller · Interstitial ·
Lead Gen Post · Leaderboard · Liquid Ad · Logo · Mobile Banner · MPU · MTR · Newsletter ·
Portrait · Skinner · Skyscraper · Special Execution · Super Leaderboard · Video · Video Post ·
Wallpaper · Wide Skyscraper · Audio/Image/Video Native Unit`.

**The general rule this proves.** Put an attribute in the name only if it cannot change during
the flight. Where an attribute is volatile at one granularity, **abstract it to a stable class,
name the class, and classify the instance.** Placement names carry the format class; creative
names carry the exact dimension. Two levels, deliberately.

Test every attribute this way:

| Attribute | Volatile? | Belongs in |
|---|---|---|
| Region, Country, Publisher, Channel, Site Type, Strategy, Siteserved | no | the name |
| **Format class** | no | the name |
| **Exact pixel size** | yes | creative name + a classification |
| **Package** | yes | a classification (renamed mid-flight: `_Consideration_TP_` → `_Consideration_Naver_TP_` stranded 20,000/month) |
| **LOB / Funding** | yes | a classification (`Hood HOU` → `Hood US`) |
| **Cost Structure** | yes | a classification (a CPM line gets renegotiated to flat) |
| **Audience** | yes | a classification (added mid-flight) |

### 4.3 Compliance reality — and why the fallback chains exist

Measured across the three APAC/HKSG trafficking sheets, 386 unique placement names:

| Tokens | Count | What is wrong |
|---|---|---|
| **14** | **311 (80.6%)** | **the Funding/LOB pair is MISSING.** The LOB is written in prose in the free-text field — `Data Vantage - Banner Ad`, `Derivatives - Newsletter 10`, `Brand - MPU Unit`. |
| 16 | 39 | compliant |
| 15 | 18 | one short — a **date** sits where the LOB belongs (`…_Flat_First Impression Takeover_9.16`) |
| 17 | 18 | an extra targeting suffix appended after Free Form (`…_Data Vantage_Behavioural`) |

**Only 39 of 386 conform.** Because Structure Compliant is OFF, all 347 non-conforming names
parse left-aligned and their tail tokens land in the wrong fields.

**This is why `PMI Line of Business` has 46 branches** including
`contains 'Data Vantage'` and `contains 'Derivatives'` — those exist for the 311 rows. It is
why there are 16 region dimensions and 13 size dimensions. **The fallback chains are not bad
engineering; they are the cost of non-compliant names**, and they will shrink only when the
names change.

One consequence worth knowing: `Global_US_The Economist_…_Flat_First Impression Takeover_9.16`
is the stale HPTO carrying 12,422 of plan in Datorama. It looked anomalous because the **name
is structurally malformed**, not because the money is wrong.

### 4.4 The taxonomy grammar — the numeric prefix

Every taxonomy dimension uses the same numeric prefix; the letter is a serial within one
dimension:

- `1` — conforming to a convention
- `2` — **no name by design** (search placements, plan rows)
- `3` — **no convention exists** (offline, no delimiter)
- `4` — **broken** — the rename queue

🔴 **`N/A` ≠ `Unclassified`.** `N/A` means the convention has no such token and never will — a
convention gap to raise. `Unclassified` means a fixable out-of-convention name — a worklist.
Keep them separately visible everywhere.

🔴 **The compliance denominator is valid + invalid, not total spend.** Search, plan rows and
offline have no name by design; counting them produces a score nobody can win.

### 4.5 The ideal taxonomy, at every level

What to specify for a new client, or a new campaign where conventions can change. Each level
carries **a stable ID plus flight-invariant attributes only.**

**Level 0 — the ID.** A short stable key minted once per plan line, present at a fixed position
in **every** level's name, carried into every platform. This is the one change that collapses
most of this document. Today its absence costs: 0 of 1,703 Prisma IDs match Datorama's key
space, so the Reference Sheet, the drift census, the CPM back-solve, the vendor correction
layer and the `FCM-` crosswalk all exist to work around it.

**Level 1 — Campaign** (5 tokens)
`Client | LOB | Product | Market Scope | Period`
Campaign is an umbrella. It must resolve LOB **only** where the campaign genuinely is the LOB
unit; never make a cross-LOB umbrella carry a LOB token.

**Level 2 — Media Buy / Placement** (13 tokens + ID)
`ID_Region_Country_Publisher_SiteType_Channel_Targeting_Strategy_Siteserved_AudienceClass_Device_FormatClass_FreeForm`
🔴 **Drop Cost Structure, Funding Source and Line of Business from the name.** All three are
volatile; all three belong in a classification keyed on the ID. That removes 3 tokens, the two
two-part codes, and the reason 26 LOB dimensions exist.

**Level 3 — Creative** (8 tokens + ID)
`ID_Country_Language_FormatClass_ExactDimension_Message_Version_FreeText`
Creative carries the **exact dimension** (the instance) where placement carries the class.
Creative never carries LOB — it resolves nothing a buy has not already resolved.

**Level 4 — Ad / Ad Set** (social) (6 tokens + ID)
`ID_Platform_Objective_AudienceKey_CreativeRef_Variant`
The audience is a **key into the audience registry**, not a prose description. The client's own
Audience Tracker already holds the registry: name (brief), name (platform), size, data
provider, definition, collection methodology, **compliance approval, approver, approval date**.

**Level 5 — Keyword / Ad Group** (search) (4 tokens + ID)
`ID_Product_MatchType_Intent`
MatchType ∈ PHR · EXT · BRD. Intent ∈ NB (non-brand) · BN (brand) · COMP (competitor). This is
already the live convention — `Cboe Brand-NB-PHR-US`, `LIBWO-UK-BN-EXT`, `Mag10-COMP-PHR` —
110 ad groups carrying 402,712.84 currently mis-bucketed as `0 - No package`. **Search has no
package concept; give it its own bucket.**

**Level 6 — Conversion / Floodlight**
`Group_Activity_CountingMethod`
Never build a conversion→LOB dimension: conversions land on media rows and inherit LOB through
the buy. Verified: **0 Unclassified across 4,916,941 conversions.** The tag contributes only
*what converted*. 🔴 Never sum across counting methods — Standard 184 / Unique 41 /
Transactions 3, and the Unique flag is **invisible in Datorama**; it exists only in the CM360
export.

**What this buys, measured against the current workspace**

| | Today | Ideal |
|---|---|---|
| Region dimensions | 16 | **4** — `Ran In` · `Funded By` · `Agency Book` · `Market Scope` |
| LOB dimensions | 26 | **2** |
| Size / format | 13 | **1** |
| Total calculated dimensions | 146 (93 in nine families) | **~20** |
| Adding a publisher | classification row + possible cost-method and size branches | **1 classification row** |
| Adding a region | rows across 16 dimensions | **rows in 1 classification** |
| Adding a channel | new metric set + branches | **new metric set** — unavoidable |

**Publishers, regions and cost types become data. Channels remain schema.** That is the only
boundary that should ever require workspace surgery.

---

## PART V — THE WEB APPLICATION

### 5.1 What the site must understand before it can be useful

1. The stream map (§2.2), including the four fields Datorama does not hold.
2. The taxonomy per level, with each token's vocabulary and volatility (§4.5).
3. Which classification supplies which attribute (§2.4).
4. The three regional processes and what differs (Part III).
5. The three spend metrics and which is client-facing (§2.6).
6. That two-thirds of spend arrives in a manual file, and the plan feed fails silently.

### 5.2 Ingest contract — a Datorama Table export

🔴 **Table widget, never Pivot.** A Pivot with 2+ row dimensions exports Datorama's nested
indented format — one row per level, parents blank, nothing joined — and **the body sums to a
multiple of the total.** A Table gives each dimension a flat column.

Header row must be row 1. Required columns for every export type:

```
Day                         ISO date, the grain's date
Data Stream                 exact stream name — the site validates against the stream map
PMI Media Buy Package       the join key; may be a 0-/9- sentinel
Media Buy Name              raw, never retyped
PMI Buying Region           AMER | EMEA | APAC | GLOBAL
PMI Media Buy Site Name     normalised publisher
PMI Funding Source          Brand | Retail | Data Vantage | Institutional Derivatives
PMI Free Form               placement semantic identity
PMI Cost Method             the cost structure
PMI Plan Spend              currency, 2dp, no thousands separator, no currency symbol
PMI Total Spend v2          currency
PMI Actualized Spend        currency
PMI Impressions             integer
PMI Month Status            Closed | Open
```

**Validation on upload, in order — reject with a named reason, never silently coerce:**

| # | Check | Reject when |
|---|---|---|
| 1 | Nested-pivot detection | any row has a populated measure and a blank first dimension |
| 2 | Total reconciliation | a `Total` row exists and ≠ the sum of the body |
| 3 | Unknown stream | `Data Stream` not in the stream map |
| 4 | Date coverage | the range is filtered — 🔴 **a date-filtered export produced five phantom missing packages when only one was real** |
| 5 | Currency format | a symbol, a thousands separator, or parentheses for negatives |
| 6 | Encoding | not UTF-8, or a U+2019 apostrophe in a name that should be ASCII |
| 7 | Column contract | a required column missing or renamed |

### 5.3 The QA suite — what runs, and the pass/fail flags

**Tier 1 — structural. Any failure blocks everything downstream.**

| Flag | Test | Pass |
|---|---|---|
| `STRUCT-NESTED` | body sums to the grand total | equal |
| `STRUCT-STREAM` | every stream is known | 100% |
| `STRUCT-DATE` | full-year coverage | unfiltered |
| `STRUCT-FRESH` | `max(Day)` per stream vs its cadence | within window |

**Tier 2 — classification.**

| Flag | Test | Threshold |
|---|---|---|
| `CLASS-UNCLASS` | unclassified share of spend | **≤5%** |
| `CLASS-PLANONLY` | publishers with plan and no delivery | **0** |
| `CLASS-DELIVONLY` | publishers with delivery and no plan | **0** |
| `CLASS-SPELLING` | two rows differing only by spelling/case/whitespace | **0** |
| `CLASS-NAMECOMPLY` | share of **spend** on compliant names | **≥95%** |
| `CLASS-DUPSTREAM` | names with spend in 2+ streams | **0** (currently 8, 36,455.73) |

**Tier 3 — measurement.**

| Flag | Test | Threshold |
|---|---|---|
| `MEAS-PARITY` | `PMI Total Spend v2` − `PMI Total Spend` | explained, not zero, once the `6 -` branch lands |
| `MEAS-CPMZERO` | zero impressions with non-zero cost | flagged and listed |
| `MEAS-FROZEN` | actualized spend on closed months vs the last accepted run | **byte-identical** |
| `MEAS-PACING` | delivered ÷ plan, open months only | **80–110%** |
| `MEAS-OVERDEL` | >110% of plan | listed for review |

**Tier 4 — reconciliation to the flowchart.** The acceptance gate.

| Flag | Target |
|---|---|
| `RECON-LOB` | Brand 4,397,999.65 · Retail 2,909,190.92 · IND 2,234,224.60 · DVA 1,199,497.01 |
| `RECON-REGION` | GLOBAL 7,611,056.51 · NAMR 1,977,999.67 · EMEA 592,220.40 · APAC 559,635.60 |
| `RECON-TOTAL` | 10,740,912.18 |
| `RECON-APPROVED` | BRAND 4,232,963.02 · RETAIL 3,047,282.18 · IND 2,373,454.88 · DVA 1,170,030.40 |

🔴 **Pacing on open months only.** Prisma overwrites planned with actual at close, so closed
months read ~100% by construction.

### 5.4 The diagnostic ladder — run before any number is shown

1. Grand total = sum of body? *(nested export)*
2. Is the metric non-zero **anywhere**? *(channel-inapplicable — newsletter Open Rate on
   display rows is the classic)*
3. Split by stream — does one carry all of it? *(stream-only field)*
4. How much sits in the dimension's fallback? *(🔴 an unmatched classification returns **NULL**,
   and `== ''` does not match NULL — this hid 1,987,317 and 2,775,692)*
5. Plan and delivery side by side — is one side zero? *(grain mismatch — cost 279,233.44)*
6. Re-pull with every filter removed. *(`> 0` deleted 100% of plan from two widgets)*
7. Diff against the previous pull. *(reprocess drift)*

Each finding renders as: what fired · what it means in plain words · what to do · a link to the
dimension or measure involved.

### 5.5 Notification

- **All tiers pass** → `PASSED`, with the reconciliation deltas shown, and the flowchart export
  unlocked.
- **Tier 1 fails** → `BLOCKED`, one message naming the file problem. Nothing else runs.
- **Tier 2 or 3 fails** → `PASSED WITH FLAGS`, each flag carrying its threshold, its actual, the
  spend at risk and the remediation route. The flowchart export is available but **watermarked
  DRAFT**.
- **Tier 4 fails** → `FAILED RECONCILIATION`, with a per-LOB and per-region variance table.
  Export stays locked until a human accepts each variance with a typed reason, which is stored.

Every notification names the run, the export timestamp, the streams included and the date range.

### 5.6 Flowchart generation

The output reproduces the four LOB tabs plus Overview & Pacing. Each tab is a **pivot with rows
Buying Region → Publisher → Free Form**, page-filtered on Funding Source — **no campaign and no
package appear in the hierarchy.**

Per tab:

```
B5   Total Approved   = the ATP figure for that LOB (§5.3 RECON-APPROVED)
B6   Total Spent      = Σ months. 🔴 The client's label says "March-August" and the
                        formula sums March–JULY, understating by 577,177.72 across the
                        four tabs. The site must ask which is intended and print the
                        answer on the tab.
B8   Remaining        = B5 − B6
B10  % of budget      = B6 ÷ B5
row 20+  the pivot: MIN start · MAX end · units · rate · Media NET · Mar–Dec months
```

**States:**

- `DRAFT` — editable in the site. Cells a user overrides are stored as an **override with
  author, timestamp and reason**, never written over the computed value. A draft export is
  watermarked and carries an "unresolved flags" sheet.
- `FINAL` — only from a run where all four tiers passed. Immutable; re-running regenerates
  rather than edits.

**Gross is not in v1.** Ship on **net media**. The commission rule is known wrong (§2.7), ad
serving must switch to planned units, and the ad-serving rate is unconfirmed. Add gross as a
column once those three land.

### 5.7 Scheduling

- Datorama scheduled report → the site's ingest endpoint, one schedule per export type.
- On arrival: validate (§5.2) → run QA (§5.3) → notify (§5.5) → on full pass, generate `FINAL`.
- **Freshness is checked independently of arrival.** A stream that stops updating still arrives
  on schedule with stale data — `STRUCT-FRESH` is the only thing that catches the silent
  plan-feed failure.
- Default lookback = **max(`finalization_window_days`)** across the streams in that export.
  CM360's is seven days. Warn below the floor and name the stream that sets it.

### 5.8 Uploading a media plan — what the site asks when it cannot resolve something

A count badge on the tab; clicking opens a queue of plain-language questions. One decision per
card, and every answer writes to a registry so it is never asked twice.

| Trigger | The question | Writes to |
|---|---|---|
| Unknown publisher | "We haven't seen **X** before. Same as one of these? Or new?" then invoices-as, parent company, stream type | publisher registry |
| Unknown cost structure | "**CPT** is new. What unit is billed? Which platform reports those units?" | rate registry |
| Non-numeric cost | "This line reads **PKG**. Child of a package? Which one? Should cost stay on the parent?" | plan line + allocation rule |
| Ambiguous flight | "**11/9 on hold** — live, hold, or placeholder? Include in pacing?" | plan line |
| Hybrid cost structure | "**CPM/CPC** is two bases. Split the line, or pick the primary?" | plan line |
| Many audiences, one budget | "Four audiences share one budget. Will the platform report them separately?" | allocation rule |
| Inconsistent LOB naming | "Three spellings of one line of business appear. One LOB or three?" | classification |
| New channel | "**Newsletter** is new. These metrics apply: opens, open rate, CTR. These don't: viewability, VCR. Confirm?" | channel metric map |
| No authoritative stream | "Both the vendor file and the ad server report cost for these 8 placements. Which wins?" | stream map |
| Market outside the matrix | "**Derivatives** is planned in DE. The approved list allows UK and FR only. Confirm or escalate?" | compliance exception |
| Benchmark missing | "No CTR benchmark for Newsletter × Axios × SF Locals. Use the plan's stated 0.16%?" | benchmark |

**Harvest before asking.** Media plans usually state the benchmark inline, and carry an audience
tracker and site lists. A plan that arrives with those is most of a classification set already.

---

## §0.3 — Where this doc supersedes the 4 Sep infrastructure breakdown

1. **Commission.** 4 Sep says `7.0% × (Jan–Jun) + 6.5% × (Jul–Dec)`. The live formula splits at
   **March/April**, and the `Approved ATPs` tab shows the rate is **per-agreement** (0.065,
   0.06882, 0.070) with EMEA flat at 7%. Neither month rule is correct.
2. **Token labels.** The position map is the same; the labels are not. Use the client's own:
   Site Type · Strategy · Siteserved · Format · Cost Structure · Funding Source · Line of
   Business / Campaign. Position 15 is the **product**, not a second LOB.
3. **Field counts.** 4 Sep records 61 dimensions / 33 measures. Current: **146 dimensions,
   98 measures** — 93 dimensions in nine attribute families, 74 with zero dependents, 31 of the
   98 measures are QA. The workspace more than doubled.
4. **Actualization.** 4 Sep treats net-vs-delivered as two legitimate measures. True, and now
   specific: for EMEA and APAC the net figure is **typed by a human** reading Datorama, and
   capping is an **ad-hoc request**, not a rule.

Everything else in that document stands, and it remains the reference for load rules,
floodlights, the exclusion lists and the dashboard inventory.
