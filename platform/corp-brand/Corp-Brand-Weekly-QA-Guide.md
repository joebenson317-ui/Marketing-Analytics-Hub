# Corporate Brand — Weekly QA Guide (Dashboard-First)

Rescanned against the full CB infrastructure: 27 data load rules, 14 CB classification entities, 36 patterns (5 of them account-wide/unfiltered), the CB calculated-dimension architecture, and the existing Deep Dive / Handoff documentation. This replaces the day-by-day version with a workflow that starts where you actually start: the taxonomy dashboards.

## Start here: the Taxonomy / Compliance Dashboards

The mechanism behind these dashboards is 18 "Compliance" filtered measurements, one per platform × dimension combination:

| Platform | Dimensions covered |
|---|---|
| Display/DCM | Campaign, Creative, Placement (plus separate OGA, GSAM, and IBD versions of the Campaign one) |
| LinkedIn | Campaign, Creative, Placement, Media Buy Name (Corp Brand + OGA combined) |
| Twitter | Campaign, Media Buy Name, Creative Name |
| SA360 | Campaign, Media Buy Name |

Each checks whether a classified field resolved to a real value or fell through to "Unclassified." That's the whole signal: **a dashboard row isn't "wrong," it's either compliant (classified) or not (Unclassified/blank)** — the dashboard tells you *that* something failed, not *why*. That's what the rest of this guide, and the troubleshooting guide, is for.

### Weekly dashboard review
1. **Open each Compliance dashboard and sort by the non-compliant count**, highest first. A new spike on any one is your entry point — go to the Troubleshooting Guide, match the platform + dimension to the relevant symptom section, and work the causes in order.
2. **Compare this week's non-compliant % to last week's for every dimension**, not just the ones that look obviously broken. A slow creep (2% → 4% → 7%) over several weeks is naming-convention drift catching up with you; a sudden jump in one week points to a specific change (a rename, a new campaign launch, a new load rule).
3. **Cross-check Country and Region specifically against both parallel classification entities** — CB runs three separate Country classifications (`Country_CorpBrand_MB_CR`, `Country_Corporate_Media Buy`, `Country_Corporate Campaign_Display`) and three separate Region ones with the same split. If the dashboard is built on one and looks clean, that tells you nothing about the other two — spot-check all three when Country/Region is the flagged dimension.
4. **If Initiative is flagged**, check both `Initiative_CorpBrand` and `Initiative_CorpBrand_MBN` — they're documented as carrying different mapping counts (83 vs. 90), so a value classified in one may not be in the other.

## Monday — Workflow & Load Verification
- [ ] Run the CB data workflow manually; confirm groups execute in order (lookup/classification streams first, platform streams second, dependent/blended streams last).
- [ ] Open every stream's log; confirm a successful job with today's timestamp. Any classification/lookup stream that failed silently explains a same-day spike on the dashboard before you look anywhere else.
- [ ] Check whether any date-specific suppression rule crossed its end date this week (the ~15-rule rolling expiry list runs through Jun 2026). A lapsed suppression doesn't cause a misclassification, but it can look like one if suppressed rows reappear mixed with genuinely unclassified ones — rule it out first.

## Tuesday — Dashboard Deep-Dive (using this week's flags)
- [ ] For every dimension flagged Monday, work it through the Troubleshooting Guide below.
- [ ] For any renamed or newly added data stream this week, check it against the four hardcoded stream-name strings the CB calculated dimensions match on exact text (`Linkedin Ads_CorpBrand + OGA`, `Corporate Brand + OGA_Facebook-Ads_US`, `SA360 - US- Goldman Sachs - Corporate Brand`, `DCM - US- Goldman Sachs - Corporate Brand- Bloomberg - Video Views`) — a rename anywhere near these breaks Country, Site Name, and CreativeFormat simultaneously.

## Wednesday — Pattern & Classification Maintenance
- [ ] Pivot [Data Stream] + raw value + classified value, filtered to blanks, for whichever classification the dashboard flagged. Add the missing mapping row in Harmonization Center.
- [ ] Run the CreativeFormat "leftover bucket" check: pivot CreativeFormat by month, look for a Banner spike — that's new creative names missing the expected keywords (ifop/vid/news/nat/aud).
- [ ] If a pattern-derived field looks wrong, check whether the value came from one of the 5 account-wide, unfiltered patterns (`Display_Corporate_Creative Name`, `Display_Corporate_Creative Name_Initiative`, `Display_Corporate_Campaign`, `Display_Corporate_Campaign_Initiative`, `Corp Brand OGA Meta Country Only`) — these apply to every stream in the account, not just Corp Brand, so a naming change made for a different LOB can move CB's numbers too.

## Thursday — Manual & Offline Data
- [ ] Confirm manual/offline loads landed on schedule (US Deposit FF, UK Search Pmax, IBD keywords, newsletter/flat-buy offline files) — a missed manual load can look identical to a classification failure on a dashboard that's really just missing rows.
- [ ] Reconcile newsletter partner reach/impression numbers against the documented per-partner formulas (Axios ×2 placement multiplier, Semafor DCM-native, opens-based partners for WSJ/The Information).

## Friday — Close the Loop
- [ ] Re-run the Compliance dashboards after the week's fixes; confirm the flagged dimensions dropped back toward baseline.
- [ ] Log what broke and which cause it turned out to be (from the Troubleshooting Guide) — this is how the "likely cause" ordering in that guide gets more accurate over time instead of staying a generic first guess.
- [ ] Finalize and send the CB Weekly Report; archive it with the dashboard state and any classification rows added this week.
