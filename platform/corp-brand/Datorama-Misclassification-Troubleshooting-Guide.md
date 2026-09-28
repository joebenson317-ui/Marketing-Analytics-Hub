# Datorama Misclassification Troubleshooting Guide — Corporate Brand

Organized by what you'll actually see on a taxonomy/Compliance dashboard. Each symptom lists multiple potential causes, ordered roughly by likelihood given what's actually in this build — not a generic list. Every cause names the real stream, rule, pattern, or classification entity behind it.

---

## Symptom A: A dimension's "Unclassified" / non-compliant count spiked this week

**Most likely causes, in order:**

1. **A data stream was renamed.** Country, Site Name, and CreativeFormat all route on an exact-text match of the data stream name (`Linkedin Ads_CorpBrand + OGA`, `Corporate Brand + OGA_Facebook-Ads_US`, `SA360 - US- Goldman Sachs - Corporate Brand`, `DCM - US- Goldman Sachs - Corporate Brand- Bloomberg - Video Views`, spacing and all). A renamed stream fails every `==` check silently and falls to the catch-all branch — no error, just wrong or blank values.
   *Check:* Compare live stream names in Connect & Mix character-for-character against these four strings.

2. **A classification-of-a-classification gap.** Country in particular is built as a classification on top of another classification (`Country_Values_[Country__CF]`). A new raw value that's unclassified at either layer produces a blank at the top, even if it looks "close enough" to an existing mapped value.
   *Check:* Pivot [Data Stream] + raw country field + [Country], filtered to blanks — the unmatched raw values will be obvious.

3. **New creative/campaign names don't match the CreativeFormat waterfall's keywords.** The waterfall only catches "ifop," "vid," "news," "nat," "aud" (in that order) — anything else falls to Banner.
   *Check:* Pivot Creative Name + CreativeFormat filtered to Banner; read the names for what's missing.

4. **The naming convention itself drifted** — an added or removed underscore-delimited segment in Campaign/Media Buy/Creative Name. Region/Market and several patterns extract by fixed position (e.g., segment 12 or 13), so one new segment anywhere upstream silently shifts every extraction after it.
   *Check:* Compare this week's naming convention against the naming-convention master doc, segment by segment, for the flagged campaigns specifically.

5. **A classification/lookup stream didn't finish before the dependent stream ran.** If the workflow's Group 1 (lookups) hasn't completed when Group 2 (platform streams with VLOOKUPs into it) fires, the lookup returns blank or stale — which reads as a classification failure but is really a timing issue.
   *Check:* Confirm Monday's workflow log shows Group 1 fully complete before Group 2 started.

---

## Symptom B: A specific platform's Compliance field is failing (e.g., only SA360 or only LinkedIn)

1. **Platform-specific pattern is out of date.** SA360 has 5 overlapping Campaign-related patterns (`SA360_Corporate_Campaign`, `_Campaign Name`, `_Campaign Name_Channel`, `_Campaign_Initiative`, plus a `Test_` prefixed one) — if the platform's naming convention changed, all of them may be extracting from the wrong position, or only some were updated.
   *Check:* Pull a sample of this platform's raw Campaign/Media Buy names and manually walk each relevant pattern's logic against them.

2. **The platform's dedicated Compliance field exists in two places.** Display/DCM alone has separate `Corporate-Display-Campaign-Compliance`, an OGA version, a GSAM version, and an IBD version — if you're looking at the wrong one, you may be diagnosing a different LOB's problem or missing your own.
   *Check:* Confirm the Compliance field name matches Corporate Brand specifically, not one of the OGA/GSAM/IBD variants.

3. **A load rule is deleting the rows before classification even runs**, and the "Unclassified" count is actually just a missing-data count in disguise. Several CB load rules use `Include Rows` (inverse logic — keep only matching rows, drop everything else): `Corporate Brand - WSJ - Exclude 0 video Views` and `Corporate Reputation Filter_Reach&Frequency` both work this way. Misreading the scope of an inverse rule can make legitimate rows vanish.
   *Check:* Confirm whether the affected rows are truly unclassified in the raw data, or whether they're missing entirely because a load rule excluded them.

---

## Symptom C: Two dashboards/reports disagree on the same campaign's Country, Region, or Initiative

1. **You're looking at two different classification entities that happen to hold the same values — usually.** CB runs three parallel Country classifications (`Country_CorpBrand_MB_CR`, `Country_Corporate_Media Buy`, `Country_Corporate Campaign_Display`) and three parallel Region ones. They're documented as carrying the same mapping values, but nothing enforces that they stay in sync — updating one doesn't update the others.
   *Check:* Identify which entity each dashboard actually pulls from, then compare the specific campaign's mapping row across all three.

2. **Initiative_CorpBrand and Initiative_CorpBrand_MBN have different mapping counts** (83 vs. 90 — 7 more in the MBN version). A campaign mapped in one may simply not exist in the other.
   *Check:* Look up the specific campaign in both classification entities directly.

3. **Two near-identical patterns are both live and may not agree.** `Display_Corporate_Media Buy Name` and `Display_Corporate_Media Buy Name 2` run against nearly the same (but not identical) stream list. If a stream is in one list but not the other, or the two patterns were edited independently, the extracted value can differ by dashboard depending on which pattern feeds it.
   *Check:* Compare the two patterns' stream-filter lists and extraction logic directly; confirm which one the disagreeing dashboards each actually use.

---

## Symptom D: A row is classified, but into the wrong bucket (not blank — just wrong)

1. **Order-dependence in a waterfall-style formula.** CreativeFormat checks rules top to bottom and stops at the first match. A creative named something like "national_news_video" hits the video/newsletter checks before it ever reaches the "native" check — the earliest matching rule wins, not the "best" one.
   *Check:* Read the full creative/campaign name against the waterfall in order; identify which earlier rule is claiming it.

2. **A filtered measurement's condition text no longer matches the live classified value.** These fail silently — not with an error, just a result of 0 or a miss — if the upstream value changed even slightly (e.g., "Paid Social" reclassified as "Social — Paid").
   *Check:* Compare the filtered measurement's exact condition string against the current live values of the dimension it filters on, including case and spacing.

3. **The row came through a combined multi-LOB stream and got attributed to the wrong LOB.** `Corporate Brand + OGA_Facebook-Ads_US` and `Linkedin Ads_CorpBrand + OGA` carry both CBR and OGA rows in one stream — the CBR/OGA split depends entirely on whatever dimension does that separation being classified correctly first. If that upstream field is wrong, the row's whole LOB attribution is wrong, not just one dimension.
   *Check:* For a suspect row, confirm the CBR/OGA-splitting dimension's value before checking anything downstream of it.

---

## Symptom E: You edited a calculated field and nothing changed on the dashboard (or something else broke)

1. **You edited a non-live near-duplicate.** Several concepts exist in multiple versions with no record of which one is wired into which dashboard — e.g., three-plus versions of some Corp Brand report fields, "(New)" vs. no-suffix pairs, "_Final" vs. pre-final fields.
   *Check:* Before editing, open the actual dashboard widget's field reference and confirm the exact field name it points to — don't assume from the name alone.

2. **You edited a field with `_Final` in the name, but an older non-final version is still referenced somewhere.** Cleanup of "safe to delete" fields hasn't been confirmed — deleting or repurposing the wrong one can silently break a widget still pointing at it.
   *Check:* Search all calculated dimensions/measurements for references to the field you're about to change before changing it.

3. **A test or person-named field is still live.** Fields like "Test," "corp test," or person-named variants exist in production-adjacent spaces. One rule (`Corp Brand Exclude **test - do not use`) sits in the active rule list with no confirmed attachment status.
   *Check:* Confirm the field/rule you're troubleshooting isn't one of these before spending time on it — and separately, flag it for cleanup if it isn't attached to anything.

---

## Symptom F: Everything looks classified correctly, but the numbers still seem off

This usually isn't a classification problem at all — check these before going back to the classification layer:

1. **A load rule is suppressing or including rows you don't know about.** 27 load rules exist for CB alone, most with specific date windows; ~15 expire on a rolling schedule through mid-2026. When one lapses, previously-suppressed data reappears with no code change and no warning.
   *Check:* Cross-reference the affected date range and metric against the current list of active load rules and their start/end dates.

2. **A "2026 packages" suppression rule is still active past its intended window.** Two rules (`CBR Reuters 2025 Packages to supress 2026`, `CBR Packages to Supress in 2026`) run "ongoing" from Jan 1, 2026 with no defined end condition — they'll keep suppressing Total Conversions indefinitely unless someone deliberately turns them off.
   *Check:* Confirm whether the suppressed package IDs are still relevant to the current reporting period.

3. **Reach is being summed instead of deduplicated.** Reach/Frequency can't be added across rows without overstating unique audience — if a widget sums a per-row reach field instead of pulling from the dedicated R&F stream, the total will be inflated even though every individual row is "correctly" classified.
   *Check:* Confirm the widget is pulling from the R&F-specific measurement, not summing a raw reach field.

---

## Using this guide

Match your symptom to a section, work the causes in the order listed — they're ranked by what's actually most common in this build, not alphabetically. If none of the listed causes explain what you're seeing, that's worth logging as a new pattern in itself: the ranking above only gets more accurate if new root causes get fed back into it.
