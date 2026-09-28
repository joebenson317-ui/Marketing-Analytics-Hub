# Datorama Misclassification Troubleshooting Guide — Corporate Brand (Step-by-Step)

Same causes and same ranking as the original guide, but every "how to check" is now a literal set of clicks instead of a one-line instruction. If a menu name below doesn't match exactly what you see, look for something close to it — Datorama's labels can shift slightly by version or permission level.

**Quick glossary, since these terms come up constantly below:**
- **Data stream** = one incoming feed (e.g., "our SA360 data"). Find these under **Connect & Mix → Data Streams.**
- **Classification** = a lookup table that turns a messy raw value into a clean label. Find these under **Harmonization Center → Data Classification.**
- **Pattern** = a rule that extracts a clean value from a longer text field using a fixed position or keyword. Find these under **Harmonization Center → Naming Convention Patterns.**
- **Load rule** = a rule attached to a data stream that deletes, suppresses, or filters specific rows (often for a set date range). Find these on the stream itself, under a **Data Load Rules** tab.
- **Calculated dimension / measurement** = a field built from a formula rather than pulled directly from a source. Find these under **Connect & Mix → Dimensions** or **Connect & Mix → Measurements.**
- **"Unclassified"** = what shows up when a raw value has no matching row in a classification's lookup table.

---

## Symptom A: A dimension's "Unclassified" count spiked this week

**Cause 1 — A data stream was renamed.**
Several of our calculated fields (Country, Site Name, CreativeFormat) check the exact name of the data stream a row came from, character for character. If the name changes even slightly, the check fails silently and the row falls into a generic fallback bucket.
*How to check:*
1. Go to **Connect & Mix → Data Streams** and open each Corporate Brand stream.
2. Note its exact current name, including spacing.
3. Compare it letter-by-letter against these four names:
   - `Linkedin Ads_CorpBrand + OGA`
   - `Corporate Brand + OGA_Facebook-Ads_US`
   - `SA360 - US- Goldman Sachs - Corporate Brand`
   - `DCM - US- Goldman Sachs - Corporate Brand- Bloomberg - Video Views`
4. If any stream's name has drifted from these (even by one space or hyphen), that's very likely your answer.

**Cause 2 — A two-step lookup has a gap in it.**
Country in particular isn't a single lookup — it's a lookup built on top of another lookup. A raw value can fail at either step.
*How to check:*
1. In your dashboard or report builder, build a table with three columns: **Data Stream**, the **raw** country field, and the final **Country** field.
2. Filter to rows where Country is blank.
3. Note the raw values showing up — those are the ones with no matching row.
4. Go to **Harmonization Center → Data Classification**, search for the relevant classification, and add the missing values.

**Cause 3 — New creative or campaign names don't match the expected keywords.**
The system that assigns a "format" to each creative (Search, Video, Newsletter, Native, Audio, or Banner as the leftover) only recognizes creative names containing "ifop," "vid," "news," "nat," or "aud." Anything else defaults to Banner.
*How to check:*
1. Build a table with **Creative Name** and **CreativeFormat**, filtered to CreativeFormat = Banner.
2. Read through the creative names — you're looking for ones that clearly should be a video or newsletter placement but don't contain the expected keyword.

**Cause 4 — The campaign/creative naming convention itself changed.**
Several fields pull a specific "chunk" out of a name by counting its position (e.g., "the 12th segment when you split by underscore"). Adding or removing one segment anywhere in the name shifts every position after it.
*How to check:*
1. Pull a handful of this week's new campaign or media buy names.
2. Count the underscore-separated segments and compare that count against older, known-good campaign names of the same type.
3. If the segment count is different, that's the likely cause — flag it so the naming convention document gets updated (or the extraction rule does).

**Cause 5 — The morning data load ran out of order.**
Lookups need to finish loading before the streams that depend on them run. If they run in the wrong order, or at the same time, the dependent stream can pull a blank or outdated value.
*How to check:*
1. Go to **Connect & Mix → Workflows**, open the Corporate Brand workflow, and open today's run history.
2. Confirm Group 1 (lookups/classifications) shows a completed timestamp *before* Group 2 (platform streams) started.

---

## Symptom B: Only one platform is failing (e.g., only SA360 or only LinkedIn)

**Cause 1 — That platform's extraction pattern is out of date.**
SA360 alone has five separate, overlapping rules that all try to pull "Campaign" out of raw text — if the platform's naming convention changed, some or all of them may be extracting from the wrong spot.
*How to check:*
1. Go to **Harmonization Center → Naming Convention Patterns** and search "SA360."
2. Open each SA360-related pattern one at a time and note what position or keyword it's extracting.
3. Take a few of this week's actual SA360 campaign names and manually work through each pattern's logic against them by hand — does it pull out what you'd expect?

**Cause 2 — You're looking at a different line of business's version of the same field.**
Several platforms have more than one "Compliance" field — one for Corporate Brand, and separate ones for OGA, GSAM, or IBD.
*How to check:*
1. On the dashboard, hover over or click into the field name to confirm exactly which one you're viewing.
2. Make sure it explicitly says Corporate Brand / "CB" / "CBR" and not OGA, GSAM, or IBD.

**Cause 3 — A load rule is deleting rows before classification even has a chance to run**, and what looks like "Unclassified" is really just missing data.
*How to check:*
1. Go to **Connect & Mix → Data Streams**, open the relevant stream, and click its **Data Load Rules** tab.
2. Look for a rule set to "Include Rows" — this type keeps only rows matching a condition and silently drops everything else.
3. Compare the rule's condition against the rows you think are missing — if they don't match the condition, that explains why they're gone.

---

## Symptom C: Two dashboards disagree on the same campaign's Country, Region, or Initiative

**Cause 1 — Country and Region each have three separate lookup tables, and they aren't automatically kept in sync.**
*How to check:*
1. Go to **Harmonization Center → Data Classification.**
2. Search "Country" — you'll find three: `Country_CorpBrand_MB_CR`, `Country_Corporate_Media Buy`, `Country_Corporate Campaign_Display`.
3. Search for the specific flagged campaign in all three, one at a time.
4. Do the same search for "Region."
5. If the campaign is mapped correctly in one but missing or different in another, that's your answer — you'll need to add or correct the row in whichever one is wrong.

**Cause 2 — Initiative has two versions with different numbers of mapped values.**
*How to check:*
1. Search "Initiative" under **Data Classification.**
2. Open both `Initiative_CorpBrand` and `Initiative_CorpBrand_MBN`.
3. Search for the flagged campaign in both — one has 7 more mapped values than the other, so it's possible for a campaign to exist in one and not the other.

**Cause 3 — Two nearly-identical extraction patterns may have drifted apart.**
*How to check:*
1. Under **Naming Convention Patterns**, find `Display_Corporate_Media Buy Name` and `Display_Corporate_Media Buy Name 2`.
2. Compare their stream lists and extraction logic side by side.
3. Check which one each of the two disagreeing dashboards is actually built from — that tells you which pattern to fix (or which one to stop using).

---

## Symptom D: A row is classified, just into the wrong category

**Cause 1 — An earlier rule in a top-to-bottom check claimed the row before a later, more correct rule got a chance.**
The CreativeFormat check runs top to bottom and stops at the very first match, so a name matching an earlier keyword wins even if a later keyword would have been more accurate.
*How to check:*
1. Take the specific creative name in question.
2. Manually check it against the order: does it contain "ifop"? Then "vid" (or come from the Bloomberg video stream)? Then "news"? Then "nat"? Then "aud"?
3. Whichever keyword it matches *first* in that order is what it was assigned — even if a later keyword also technically appears in the name and would have been the better match.

**Cause 2 — A filtered field's built-in condition text no longer matches the live classified values.**
These don't error out — they just quietly return zero or nothing.
*How to check:*
1. Go to **Connect & Mix → Measurements**, open the filtered measurement in question, and read its exact condition text (e.g., "Channel equals Paid Social").
2. Compare that exact text — including capitalization and spacing — against the current live values in that dimension.
3. If the live values have changed even slightly (e.g., "Paid Social" is now written "Social — Paid"), that mismatch is the cause.

**Cause 3 — The row's line-of-business split (Corp Brand vs. OGA) was wrong to begin with.**
A couple of our streams carry both CBR and OGA rows together in one feed, split apart later by another field.
*How to check:*
1. For the row in question, find the field that determines CBR vs. OGA (usually derived from the campaign or media buy name).
2. Confirm that field is correct *before* checking anything else about the row — if the LOB split is wrong, everything downstream of it will also look wrong, and fixing those downstream fields won't help until this one is fixed.

---

## Symptom E: You edited a field and nothing changed (or something else broke)

**Cause 1 — You edited a version of the field that isn't actually connected to the dashboard.**
Several concepts exist in multiple near-identical versions, and there's no single master list of which version each dashboard widget actually points to.
*How to check:*
1. On the dashboard itself, click into the specific widget (chart or table) that should have changed.
2. Look for an option like "Edit Widget" or "Widget Settings" and find the exact field name it's pulling from.
3. Compare that exact name against the field you edited — don't assume from a similar-sounding name that they're the same field.

**Cause 2 — You changed a "_Final" field, but an older, non-final version is still in use somewhere.**
*How to check:*
1. Go to **Connect & Mix → Dimensions** (or **Measurements**), and use the search bar to look for any other field referencing the one you just edited.
2. Open a few of the search results and check their formulas for a reference to your field's old name or logic.

**Cause 3 — You were troubleshooting a test object that isn't actually live.**
*How to check:*
1. Search for "test" in the relevant classification, pattern, or load rule list.
2. Before spending more time on it, confirm whether it's attached to anything active (check for an "Applied Data Streams" or similar field). If it's not attached to anything, it's a dead end for this issue — flag it for cleanup separately.

---

## Symptom F: Everything looks correctly classified, but the numbers still seem off

This usually isn't a classification issue — check these first before going back to the lookup tables.

**Cause 1 — An active load rule is suppressing data you don't know about.**
*How to check:*
1. Go to **Connect & Mix → Data Streams**, open the relevant stream, and click its **Data Load Rules** tab.
2. Look through the list for any rule whose date range overlaps the period you're questioning.
3. Note what metric it affects (spend, clicks, conversions, etc.) — if it matches what looks "off," that's your answer.

**Cause 2 — A suppression rule meant to be temporary is still running.**
Two rules suppressing 2025 campaign packages that rolled into 2026 have no defined end date — they'll keep suppressing conversions indefinitely unless someone turns them off deliberately.
*How to check:*
1. In the same Data Load Rules tab, look for anything mentioning "2025 packages" or "supress in 2026."
2. Confirm whether the package IDs it's suppressing are still relevant to what you're currently reporting on.

**Cause 3 — Reach is being added up instead of de-duplicated.**
Unique audience reach can't be summed row by row without inflating the total — it needs its own dedicated calculation.
*How to check:*
1. Click into the widget showing the reach number.
2. Check whether it's using a field specifically built for Reach & Frequency, or whether it's just summing a plain "reach" column.
3. If it's summing a plain column, that's almost certainly why the number looks too high.

---

## How to use this guide day to day
Match what you're seeing to a Symptom heading, then work the causes top to bottom — they're already ordered by what's most likely given how this specific account is built, not alphabetically. If you get through all the causes listed and still haven't found the answer, that's worth writing down too — it's a sign there's a new cause this guide doesn't cover yet.
