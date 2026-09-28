# Goldman Sachs Datorama Profile — Breakdown & Transition Questions
*Based on `GS-CB-Datorama Infrastructure Breakdown.xlsx` and the supporting docs in the shared Drive folder*

---

## What's in the folder

| File | What it actually is |
|---|---|
| `GS-CB-Datorama Infrastructure Breakdown.xlsx` | The real audit of the live GS profile — data streams, data load rules, calculated dimensions/measurements, filtered measurements, and name-parsing patterns. This is the file the rest of this breakdown is built from. |
| `Marketing Cloud Intelligence (Datorama) Bible.docx` | Your own plain-language reference on how MCI works generally (Connect & Mix / Analyze & Act / Visualize) |
| `Datorama Troubleshooting Guide.docx` | Your own step-by-step repair manual |
| `Datorama Holy Grail.docx` | Curated links to Salesforce's official training and help articles |
| `Datorama Integrations.docx` | One entry so far (Magellan AI) |

The Bible/Troubleshooting Guide/Holy Grail are excellent for learning *how Datorama works as a product*. None of them tell you *why this specific GS profile is built the way it is* — that only lives in the Infrastructure Breakdown, and even there, a lot is implied rather than documented. That's the gap this breakdown + question list is meant to close.

---

## Part 1: What the workbook shows

### Data streams (394 total)
- **178 are Classification/Lookup streams**, **150 are TotalConnect** (manual file uploads), and only **~66 are native API connectors** (Google DFA/DS/Bid Manager, LinkedIn, Facebook, Twitter, Quora, Reddit, AdWords, Amazon DSP).
- That ratio matters: less than a fifth of the plumbing is a "connect once and it runs itself" API feed. The large majority depends on someone building a lookup table correctly or uploading a file correctly, on a schedule, forever.

### Corporate Brand (CB) footprint
- CB is heavily built out with **bespoke, date-specific streams per publisher flight** — e.g. `Corp Brand Atlantic 12/01 & 12/02 Impressions and Click`, `Corp Brand Axios 01/1-01/28 Data`, `Corp Brand Bloomberg 05/01-05/12 Spend Impressions clicks`. These read like one-off streams created for a single flight rather than durable, reusable infrastructure.
- The 27-row `GS-CB Data Load Rules` tab is almost entirely exclusion/suppression logic (`Exclude_`, `Suppress_`, `Delete Measurements`), much of it date-bound.
- One stream — `DCM-US-Goldman Sachs-Corporate Brand-Goldman Sachs Lending` — has **~13 stacked data load rules** applied to it simultaneously.
- One rule is literally named `Corp Brand Exclude **test - do not use`, with a blank status, still sitting in the active rule list.
- Two lookup entities — `Country_CorpBrand_MB_CR` and `Country_Corporate_Media Buy` — use the *same mapping values* but populate *separate* classification entities.

### Private Wealth Management (PWM) footprint
- PWM is much thinner: roughly **19 identifiable streams**, mostly Classification/lookup plus a handful of platform connectors (SA360, LinkedIn, DV360, IAS, DCM).
- There is **no PWM-equivalent of the "GS-CB Data Load Rules" tab** in this workbook. That could mean PWM genuinely doesn't need suppression/exclusion logic, or it could mean that logic exists but wasn't captured in this breakdown.
- No PWM-specific Filtered Measurements or Calculated Measurements tab exists either — PWM logic, where it exists, appears to live inside the GS-wide tabs rather than a dedicated PWM tab.

### Calculated dimensions, measurements, and filtered measurements
- `GS Calculated Dimensions`: 472 entries. `GS Calculated Measurements`: 537 entries. `GS Filtered Measurements`: 55 entries. `GS-CB-Filtered Measurements`: 104 entries. `GS-CB-Calculated Measurements`: 48 entries.
- **Across all ~1,160+ entries, the "Function Description" field is blank on every single one.** Nothing documents what any of this logic actually does — you have the field name and the raw expression, and that's it.
- Where an "MA Assignee" column exists (the two CB-specific tabs), ownership splits exactly 50/50 between **Joe** and **Rebecca** on every entry (52/52 and 24/24). That even split suggests a formal review or QA process rather than organic ownership — worth understanding.
- Some fields explicitly named for PWM (`Corporate_PWM_GBM_Targeting Tactic Final`, `GBM_Corporate_PWM_DSP/Site Final`, `GBM_Corporate_PWM_Audience Final`) live inside the **CB-labeled** tab — CB and PWM calculated logic isn't cleanly separated in this workbook.

### Patterns (name-parsing rules)
- Some patterns are scoped tightly to one data stream. Others have **no Data Stream Filter at all**, meaning they apply globally across every stream in the account — including across LOBs.
- At least one pattern, `Display_PWM_Campaign Name`, is explicitly applied across a mixed list that includes both PWM streams and `Linkedin Ads_CorpBrand + OGA` — PWM and CB naming logic is being parsed by the same rule.
- There are near-duplicate patterns (`Display_Corporate_Media Buy Name` vs. `Display_Corporate_Media Buy Name 2`) applied to almost-identical but not identical stream lists, with no indication which one is authoritative or whether both are still needed.

---

## Part 2: Questions I'd ask

Given three years of Datorama experience on the team (with the MCI/MTC edition) but limited depth beyond that, I'd prioritize questions that surface *business logic decisions embedded in this build* — things no generic Datorama training will teach you, because they only exist in this account.

### A. Foundational, before anything else
1. Is this workbook the complete and current picture, or were sections (especially PWM data load rules) simply never documented? I'd want to confirm the gap is in the documentation, not in my read of it.
2. Who is Rebecca, and what does the 50/50 Joe/Rebecca split on CB filtered and calculated measurements represent — active dual ownership, a review/sign-off step, or something inherited from the agency handoff?
3. Is there a change log or version history for calculated dimensions/measurements, or does every edit simply overwrite the prior logic with no record of what changed or why?
4. Of the ~1,160 calculated dimensions, measurements, and filtered measurements with no function description, is there *any* institutional knowledge anywhere (Slack threads, old decks, a departed team member) about what the highest-traffic ones do — or are we starting from the expression alone?

### B. Corporate Brand specific
5. What's the intended lifecycle for the date-specific, per-flight TotalConnect streams (Atlantic, Axios, Bloomberg, Reuters, Economist, WSJ, etc.)? Are they deactivated/archived after the flight ends, or do they stay live indefinitely? I want to know if stream sprawl is being cleaned up or just accumulating.
6. The GS Lending DCM stream has roughly 13 stacked data load rules. What's the intended evaluation order, and has anyone stress-tested what happens if two of those rules' filter conditions overlap on the same row?
7. `Corp Brand Exclude **test - do not use` is still listed as an active-looking rule. Is it actually attached to any stream, and can it be retired, or is there a reason it's been left in place?
8. `Country_CorpBrand_MB_CR` and `Country_Corporate_Media Buy` carry identical mapping values into two separate entities. Is that duplication intentional (e.g., different downstream consumers), or is it drift from having been built twice?
9. What's the actual process when a new one-off publisher placement comes in — is there a standard template for spinning up a new TotalConnect stream, or does each one get built from scratch, which would explain the naming inconsistency across the "Corp Brand" streams?

### C. Private Wealth Management specific
10. Why is PWM's footprint so much thinner than CB's — is that a true reflection of PWM's media complexity (fewer channels, fewer flights), or is it under-built relative to what PWM actually needs?
11. Is there PWM-specific suppression/exclusion logic anywhere that simply isn't captured in this workbook, or does PWM genuinely run without any data load rules?
12. Are there PWM-dedicated calculated dimensions/measurements tabs elsewhere that weren't included here, or does all PWM custom logic live inside the shared GS-wide tabs?
13. The PWM data streams reference "GSID Data Stream" repeatedly (SA360_PWM_FSID, DCM_PWM_FSID, GS GSID PWM). What is the GSID join actually doing structurally — is it the backbone that ties PWM's paid media data to a first-party identifier, and if so, who owns and maintains that stream?

### D. Cross-LOB / shared infrastructure
14. Patterns like `Display_PWM_Campaign Name` are applied across both PWM and CB LinkedIn streams. If PWM's naming convention changes, does that silently break CB's parsing (or vice versa)? Is there any testing process before a shared pattern is edited?
15. For patterns with no Data Stream Filter at all (global application), what's the reasoning — intentional simplicity, or were filters just never set? A global pattern edit for one LOB's benefit could quietly change output for every other LOB.
16. Between `Display_Corporate_Media Buy Name` and `Display_Corporate_Media Buy Name 2`, which one is live/authoritative in current dashboards, and can the other be deprecated?
17. Are Corporate Brand and PWM sharing any Entities, Parent-Child relationships, or Data Fusion logic at the data-model level (not just the reporting layer), such that a structural change for one LOB has downstream effects on the other?

### E. Documentation & governance going forward
18. Is there an approval process for adding new calculated fields, load rules, or patterns, or has this build grown organically without a review gate? Given the volume of undocumented logic, I'd want to know if we're inheriting technical debt or an active, disciplined process.
19. Who has edit access to the shared/GS-wide tabs (Calculated Dimensions, Calculated Measurements) versus the CB-specific ones — is there any protection against a PWM-focused change accidentally breaking a CB-facing dashboard, or vice versa?
20. What's the plan — realistic, given the team's current depth — for backfilling function descriptions on the highest-traffic calculated fields first, rather than trying to document all ~1,160 at once?

---

## The short version, if I could only ask five
1. Is PWM under-documented or genuinely under-built compared to CB?
2. What do the shared/global patterns (especially `Display_PWM_Campaign Name` and the un-filtered ones) actually touch, and what breaks if they're edited?
3. What's the retirement process for date-specific flight streams and rules — are they being cleaned up or just piling up?
4. Who's Rebecca, and what does the Joe/Rebecca split represent for ongoing ownership?
5. Is there any documentation anywhere — outside this workbook — for what the ~1,160 undocumented calculated fields actually do?
