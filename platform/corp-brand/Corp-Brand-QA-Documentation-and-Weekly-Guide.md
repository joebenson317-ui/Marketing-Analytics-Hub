# Corporate Brand Datorama — QA Documentation & Weekly QA Guide

## Part 1: Existing QA Documentation (Pulled from Drive)

Four real sources of QA guidance already exist, none of them in the original shared folder. Here's what each one covers.

### 1.1 "Datorama Deep Dive — Workflows, Filtered Measurements & Corporate Brand Calc Dimensions Map"
The most substantial find. Two sections are explicit QA procedures:

**"How to QA a workflow" (7 steps):** run the workflow manually rather than waiting overnight; confirm groups execute in strict order; open every stream's log and check for a successful job with today's timestamp; spot-check that VLOOKUP dependencies actually resolved (pivot a Group 2 stream, confirm the looked-up value from Group 1 is populated); check the wall-clock timing leaves a buffer before your first scheduled report; deliberately disable one stream to test that the failure path is caught by alerting; re-check after any mapping change since it may require manual reprocessing.

**"How to QA an action rule" (5 steps):** force-fire the rule while the condition is true and confirm it fires correctly; then set the real threshold and confirm it does NOT fire when false; check the rule's schedule runs *after* the workflow that feeds it finishes (a 9am rule checking a workflow that completes at 10am is judging yesterday's data); confirm filters scope to the intended rows via a pivot table; verify platform write-access credentials are live for any rule that acts inside an ad platform.

The same document also maps the actual Corporate Brand calculated-dimension architecture — Country, Site Name, and CreativeFormat all route on an exact-text match of the data stream name, which means **a renamed stream silently breaks every one of these fields** (they fall through to the catch-all branch, not an error). It documents the CreativeFormat waterfall precisely (SA360→Search, then video/newsletter/native/audio keywords in order, with "Banner" as the leftover bucket) and flags two live documentation gaps: the Creative Name and Campaign Initiative formulas are incomplete in the sheet and only exist in the platform.

### 1.2 "Datorama Handoff — Questions for the Outgoing Agency (Corp Brand)"
Framed as handoff questions, but it's really a risk inventory — 40+ items rescanned against the actual workbook (27 load rules, ~105 CB calc dimensions, ~587 calc measurements), sorted Critical → Medium with a "Risk Horizon" flag for day-to-day vs. down-the-road failures. The Critical items are the backbone of the weekly guide below:

- ~15 date-specific suppression rules expire on a rolling schedule between Dec 2025 and Jun 2026 — when each lapses, suppressed spend/clicks/conversions silently reappear with no code change.
- Two "packages to suppress in 2026" rules run "ongoing" with no defined end condition — a standing risk of double-counting once removed at the wrong time.
- Daily processing order (Lookup → CM360 VLOOKUP dependency) isn't written down anywhere outside this doc.
- Several near-duplicate calculated fields exist per concept (e.g., three versions of a "Banking App ID" calc) with no record of which one actually feeds which live dashboard.
- Two classification pairs (Initiative_CorpBrand vs. Initiative_CorpBrand_MBN; Country/Region duplicated across entities) can silently diverge if only one is updated.
- A stray rule literally named "**do not use**" still sits in the active rule list with undetermined attachment status.

### 1.3 Newsletter QA — "Newsletter reporting Metric Definitions" + "Process for adding in newsletter"
Partner-by-partner reconciliation logic for how newsletter reach/impressions get QA'd against each publisher's raw send data — this is real, currently-applied methodology, not theoretical:

| Partner | Reach on RF doc | Impression on RF doc |
|---|---|---|
| Axios | DCM unique reach + total opens (1P report) | DCM impression + (1P opens × 2 — two placements run per newsletter) |
| Semafor | DCM unique reach (tracked natively) | DCM impression |
| The Information | Total opens from 1P report | Total opens from 1P report |
| WSJ | Total opens from 1P report | Total opens from 1P report |
| Politico | One open per day, summed across the week (partner applies overall opens to all creatives, so this avoids overcounting) | — |

### 1.4 The weekly cadence, as actually practiced
There's a master "Weekly Reports" folder with ~26 dated week-subfolders spanning the full year (e.g. `Week 3.23 - 3.29`). Each one I checked follows the same pattern, and it reveals the real QA workflow already in use:

1. **Publisher-specific reporting templates** are pulled per site (WSJ, Reuters, Ad.Apt/Bloomberg, Axios newsletter) — these are the source-of-truth comparison points.
2. **A platform-side QA export** is pulled directly from CM360 (e.g. `450204_CBR_Silver_-1_QA_...xlsx`) — filtered to a specific Floodlight activity, campaign, and site, with MRC-accredited-metrics noted explicitly. This is the ground truth the Datorama output gets checked against.
3. **The CB Weekly Report itself goes through multiple named rounds** before being finalized — "first sent," "Round 1," "Round 2" versions all exist for the same week, meaning discrepancies get caught and corrected iteratively before the report is considered final.

---

## Part 2: Weekly QA Guide

Built directly from the four sources above — every check below traces back to something in Part 1, not a generic QA template.

### Monday — Workflow & Load Verification
- [ ] Run the Corp Brand data workflow manually (don't wait for the overnight run) and confirm groups execute in dependency order — lookup/reference streams first, then platform streams, then anything downstream. *(Source: 1.1, Deep Dive Part 1.2)*
- [ ] Open every stream's processing log; confirm a successful job with today's timestamp on each. Any "failed" status gets read before anything else happens. *(1.1)*
- [ ] Spot-check one Group 2 stream's VLOOKUP into Group 1 — pivot a handful of rows and confirm the looked-up value (rate, classification) is populated and current, not stale or blank. *(1.1)*
- [ ] Confirm total workflow wall-clock time still leaves a buffer before the first scheduled report or stakeholder login. *(1.1)*
- [ ] Check whether any date-specific suppression rule crossed its end date this week (see the rolling Dec 2025–Jun 2026 expiry list in 1.2, Handoff Q#1). If one lapsed, confirm whether that was intended or needs re-extending — this is the single highest-risk recurring item on record.

### Tuesday — Platform-Side Reconciliation
- [ ] Pull the platform-side QA export for the week (CM360 Floodlight activity report, filtered to the relevant campaign/site — same format as the existing `_QA_` files in the weekly folders). *(1.4)*
- [ ] Compare platform-side totals against the corresponding Datorama pivot for at least one high-volume site (Reuters, WSJ, Bloomberg). Flag any variance beyond normal rounding.
- [ ] Reconcile newsletter partners against the table in 1.3 — confirm the correct reach/impression formula is being applied per partner (Axios ×2 placement multiplier, Semafor's DCM-native numbers, opens-based partners). A new partner with no defined divisor is a known silent-error pattern (Handoff Q#18).
- [ ] For any renamed or newly added data stream this week: confirm the exact stream name matches what's hardcoded in the Country/Site Name/CreativeFormat calculated dimensions. A rename breaks these silently, not with an error. *(1.1, Deep Dive Part 3.4)*

### Wednesday — Calculated Field & Classification Spot-Checks
- [ ] Run the "leftover bucket" check: pivot CreativeFormat by month and look for a spike in "Banner" — that's the waterfall's catch-all, and a spike usually means new creative names aren't matching the expected keywords (ifop/vid/news/nat/aud). *(Deep Dive Part 3.5, explicitly recommended as a monthly check — worth folding into the weekly cycle given how fast naming drift compounds)*
- [ ] Pivot [Data Stream] + raw country field + [Country] filtered to blanks — any unclassified raw values get added in Harmonization Center before they reach a dashboard. *(Deep Dive Part 3.4)*
- [ ] For any calculated field touched this week, confirm which *exact* version (of any near-duplicate pair) is wired into the live dashboard before editing — editing the wrong twin changes nothing, or breaks something silently. *(1.2, Handoff Q#9)*
- [ ] Confirm no dashboard widget is still pointing at a "test," "draft," or person-named field. *(1.2, Handoff Q#25)*

### Thursday — Manual & Offline Data Reconciliation
- [ ] Confirm each manual/offline Corp Brand load this week actually landed on schedule: US Deposit FF (daily), UK Search Pmax, IBD keywords, and any flat-buy/podcast/newsletter offline files (10KSB Summit Print, Chartable/Megaphone/iHeart). *(1.2, Handoff Q#6, Q#17)*
- [ ] For any action rule that fired this week (pacing alerts, threshold emails): confirm it evaluated data from *after* the morning workflow completed, not a stale prior run. *(1.1, "How to QA an action rule," step 3)*

### Friday — Report Finalization & Delivery
- [ ] Build the CB Weekly Report as Round 1; run the same platform-side comparison from Tuesday against the finished report, not just mid-week raw data.
- [ ] If a discrepancy surfaces, iterate to Round 2 rather than sending Round 1 — this matches the existing practice already visible in the weekly folders (every week on file has at least one revision round before being sent).
- [ ] Before sending, re-confirm de-duplicated Reach/Frequency widgets are using the R&F-specific stream, not a summed reach figure — reach can't be added across rows without overstating unique audience. *(1.2, Handoff Q#36)*
- [ ] Archive the finalized report, the platform QA export, and the publisher templates together in that week's folder — matching the existing pattern so the next audit has the same trail this one did.

---

## Where this guide has open edges
A few things in Part 1 remain unresolved and would make this guide more complete once answered — most are already logged as open questions in the Handoff doc, not new gaps found here:
- The full list of currently-active suppression rules and their exact expiry dates (Handoff Q#1) — worth turning into a literal calendar rather than checking ad hoc.
- Which calculated field version is wired into which live dashboard widget (Handoff Q#9, Q#23) — a one-time mapping exercise would remove most of the guesswork in the Wednesday check.
- The full live formulas for Creative Name and Campaign Initiative, which are documented as incomplete even in the Deep Dive doc itself (Part 3.1).
