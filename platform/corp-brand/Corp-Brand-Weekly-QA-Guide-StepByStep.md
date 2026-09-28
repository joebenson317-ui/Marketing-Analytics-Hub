# Corporate Brand — Weekly QA Guide (Step-by-Step)

Written for someone who doesn't work inside Datorama every day. Same checks as the original guide, but each one is broken into literal clicks instead of assuming you already know where things live. A quick note before you start: menu labels can shift slightly between Datorama versions or based on your permission level — if a click path below doesn't match exactly what you see, look for something with a similar name nearby rather than assuming the whole step doesn't apply.

**Two words you'll see everywhere in this guide:**
- **Data stream** = one incoming feed of data (e.g., "our LinkedIn ads data" or "our SA360 search data"). Each platform or file source usually has its own stream.
- **Classification** = a lookup table that translates a raw, messy value (like a long campaign code) into a clean label (like "United Kingdom" or "Brand Awareness"). When a value has no matching row in that lookup table, it shows up as **"Unclassified."**

---

## Start here: the Taxonomy / Compliance Dashboards

These are the dashboards that show you, per platform, how much of your data landed correctly labeled vs. fell into "Unclassified." Think of it as a report card — it tells you *something* is wrong, not *why*.

**Step by step:**
1. Log into Datorama and go to your **Dashboards** (sometimes called **Visualize** depending on your navigation setup).
2. Open the Corporate Brand Compliance dashboard(s). There isn't just one — there are separate ones covering Display/DCM, LinkedIn, Twitter, and SA360, and Display has extra versions for OGA, GSAM, and IBD. **Make sure the one you're looking at says "Corporate" or "CB," not one of those other lines of business.**
3. On each dashboard, find the table or chart showing **non-compliant / Unclassified counts by dimension** (Campaign, Creative, Placement, Media Buy Name — whichever the dashboard covers). Sort it so the highest non-compliant number is at the top.
4. Write down (a running notes doc or even just a scratch note) which platform + dimension combo has the worst number this week.

**What to do with what you find:**
- **A number that's higher than last week** → this is your entry point. Go to the Troubleshooting Guide, find the section matching what you're seeing (a spike, one platform only, two dashboards disagreeing, etc.), and work through the causes listed there in order — they're ranked by what's actually most likely to be the culprit.
- **A slow creep over several weeks** (say, 2% → 4% → 7% Unclassified) rather than a sudden jump → this usually means a naming convention has drifted gradually. Still worth flagging even though nothing "broke" overnight.

**One extra check specific to this account:** if the flagged dimension is **Country** or **Region**, there are actually three separate lookup tables behind each (not one) — a value can be mapped correctly in one and missing from the other two without either dashboard complaining. To check all three:
1. Go to **Harmonization Center → Data Classification.**
2. Search for "Country" — you should see three separate entries: `Country_CorpBrand_MB_CR`, `Country_Corporate_Media Buy`, and `Country_Corporate Campaign_Display`.
3. Search the specific campaign or value that's flagged as Unclassified in all three, one at a time, to see if it's missing from just one or from all of them.
4. Do the same for "Region" (same three-way split), and if **Initiative** is flagged, check both `Initiative_CorpBrand` and `Initiative_CorpBrand_MBN` — the second one has 7 more mapped values than the first, so something mapped in one may not exist in the other.

---

## Monday — Workflow & Load Verification

A **workflow** is Datorama's name for the sequence that loads your data every morning — think of it like a checklist that runs itself, one step finishing before the next begins.

**Step by step:**
1. Go to **Connect & Mix → Workflows.**
2. Find the Corporate Brand workflow and click into it. You'll see it's broken into numbered **groups** — lookup/classification streams should be Group 1, platform streams (LinkedIn, SA360, DCM, etc.) Group 2, and anything that depends on those Group 3.
3. Click **Run** (or the equivalent manual-trigger button) to kick it off yourself rather than waiting for the overnight run.
4. Watch it process — confirm Group 2 doesn't start until Group 1 shows as fully complete.
5. Once it finishes, click into **each individual data stream's log/history** (usually a "Jobs" or "History" tab on the stream itself) and confirm today's date shows a successful run. Anything marked "failed" — click into it and read the error message before doing anything else. A failed classification/lookup stream on a Monday is often the real explanation for a same-day dashboard spike, so ruling this out first saves time later.
6. **Check for expiring suppression rules.** Go to **Connect & Mix → Data Streams**, click into a Corporate Brand stream, and look for its **Data Load Rules** tab (this lists any rules that delete, suppress, or filter specific rows — usually tied to a date range). About 15 of these rules are set to expire on a rolling basis through mid-2026. If one crossed its end date this week, the rows it was hiding will reappear — that's expected, not a bug, but it can look like a sudden data spike if you don't know it's coming.

---

## Tuesday — Dashboard Deep-Dive

**Step by step:**
1. Pull up your notes from Monday's dashboard review (the worst-performing platform + dimension from Step 1 above).
2. Open the **Troubleshooting Guide** and find the matching symptom section.
3. Work through the numbered causes in that section one at a time — each one tells you exactly where to look and what you're checking for.
4. **If a data stream was renamed or a new one was added this week**, there's one specific thing worth checking regardless of what the dashboard says: go to **Connect & Mix → Data Streams** and get the exact current name of the stream. Then compare it, character by character (including spacing around hyphens), against these four names, which several of our classification formulas are hardcoded to match exactly:
   - `Linkedin Ads_CorpBrand + OGA`
   - `Corporate Brand + OGA_Facebook-Ads_US`
   - `SA360 - US- Goldman Sachs - Corporate Brand`
   - `DCM - US- Goldman Sachs - Corporate Brand- Bloomberg - Video Views`
   
   If a stream's name doesn't match one of these exactly anymore, that alone can explain Country, Site Name, and CreativeFormat all breaking at once.

---

## Wednesday — Pattern & Classification Maintenance

A **pattern** in Datorama pulls a clean value out of a longer text field (for example, pulling "United Kingdom" out of a long campaign code) using a fixed rule, like "take whatever text sits in position 12 of the name, split by underscores." A **classification** is the lookup-table kind of cleanup described earlier.

**Step by step:**
1. **Find unclassified values.** In Analyze & Act (or your dashboard/report builder), build a simple table: put the **data stream** name in one column, the **raw** (unclean) version of the flagged field in a second column, and the **classified** version in a third. Filter the table to rows where the classified column is blank. This shows you exactly which raw values have no matching row in the lookup table.
2. **Add the missing mapping.** Go to **Harmonization Center → Data Classification**, find the relevant classification (matching the flagged dimension), and add a new row mapping the raw value you found in Step 1 to the correct clean label.
3. **Check for creative-naming drift.** Build a table with **Creative Name** in one column and **CreativeFormat** in another, grouped by month. Look for a spike in anything labeled "Banner" — that's the catch-all bucket for creative names that didn't match any of the expected keywords (the system looks for "ifop," "vid," "news," "nat," or "aud" in the name, checked in that order). If Banner jumped, open a few of those creative names and see what keyword is missing.
4. **If a pattern-derived value looks wrong**, check whether it's one that applies account-wide rather than just to Corporate Brand. Go to **Harmonization Center → Naming Convention Patterns** and look up these five pattern names — they have no data-stream filter attached, meaning they run against every stream in the whole account, not just ours:
   - `Display_Corporate_Creative Name`
   - `Display_Corporate_Creative Name_Initiative`
   - `Display_Corporate_Campaign`
   - `Display_Corporate_Campaign_Initiative`
   - `Corp Brand OGA Meta Country Only`
   
   If someone changed one of these for a different line of business, it can move Corporate Brand's numbers too, even though nobody touched anything "ours."

---

## Thursday — Manual & Offline Data

Some data doesn't come in automatically through an API — it's a person uploading a file. That's called a **manual load**, and it's the easiest thing to accidentally skip in a busy week.

**Step by step:**
1. Confirm these manual loads happened on schedule this week: US Deposit FF (daily), UK Search Pmax, IBD keyword data, and any newsletter or flat-buy offline files (print, podcast placements, etc.). Ask whoever owns each one, or check the stream's upload history directly in **Connect & Mix → Data Streams.**
2. A missed manual load can look exactly like a classification failure on a dashboard — the row is just missing, not mislabeled — so ruling this out is worth doing before assuming something's broken in the classification logic.
3. **Reconcile newsletter numbers.** For each newsletter partner, confirm the reach/impression math matches the agreed formula:
   - **Axios:** DCM's own reach number, plus that week's total opens from the partner's report; impressions get the opens number doubled (Axios runs two ad placements per newsletter).
   - **Semafor:** just use DCM's own reach and impression numbers directly — no partner-report math needed.
   - **WSJ / The Information:** total opens from the partner's own report, used as-is for both reach and impressions.

---

## Friday — Close the Loop

**Step by step:**
1. Re-open the Compliance dashboards from Monday/Tuesday and confirm the numbers you flagged have come back down after this week's fixes.
2. Write a quick note (even a few bullet points) of what broke this week and which cause from the Troubleshooting Guide actually explained it. Over time, this makes the "most likely cause" ordering in that guide more accurate instead of just a first guess.
3. Build and send the Corporate Brand Weekly Report as normal — if a number looks off, it's fine (and matches existing practice) to send a "Round 1," catch the issue, and send a corrected "Round 2" rather than holding everything up.
4. Save the finished report, along with any notes on what you fixed this week, in that week's folder — so the next person (including future-you) has the same trail to work from.
