# Analytics Hub — context handoff for a chat session

Written 28 Sep 2026 at the end of the Claude Code sessions that built versions 20–36 of the Hub. Feed this to the chat that will continue the work. It covers what the product is, how it is built, the decisions behind it, the infrastructure, the working conventions, and what is still open. Where a fact could not be verified from a reachable source it is marked as such; that convention is itself one of the rules below.

---

## 1. What the Hub is

A single-file web app for a media-analytics team: one HTML file (`app/analytics-hub.html`, about 1.2 MB) with no build step, holding every page, engine and stylesheet. It runs in two places from the same file:

| Deployment | Storage | Sign-in | URL |
|---|---|---|---|
| claude.ai artifact (private) | the artifact's own document database (per-document cap about 256 KB) | the person's Claude account | https://claude.ai/artifact/ECztkmmQ4uMFYTynvtTqWD |
| Self-hosted on GitHub Pages | Supabase Postgres (one `docs` table plus `profiles`), row-level security | Supabase email + password; the first registered account becomes admin | https://joebenson317-ui.github.io/Marketing-Analytics-Hub/ |

Source of record: GitHub repo `joebenson317-ui/Marketing-Analytics-Hub`, default branch `claude/sharp-allen-3h4t36` (`main` lags behind and is synced by pull request). Every push to the default branch builds, deploys to Pages and verifies the live sign-in screen in Chromium.

The Hub follows the media-plan lifecycle: **Plan** (plans, audiences, Datorama workspace build) → **Measure** (campaign ingest, reports, reach & frequency, deduplication) → **Deliver** (studio outputs, pivot, landscape) → **Team** (calendar, team load, playbook). Cross-client settings sit behind the gear. The visual language is deliberately Datorama-like: dark chrome, a warm "midnight desert" palette, one accent family per area.

---

## 2. Architecture schematic

```
┌──────────────────────────────── app/analytics-hub.html ────────────────────────────────┐
│  <style> tokens (:root, per-area accents, light theme) + every component's CSS         │
│  <script>                                                                              │
│   helpers: parseCSV, readFile(xlsx→csv), sha256, headerHash, applyRecipe, num, esc …   │
│   state:   COLS[] collections · S{col: [docs]} in-memory · V{} page state · route()     │
│   store:   put(col, obj) → S + DB.doc().set + audit row · live(col) · byId · trash      │
│   nav:     NAV_GROUPS (Plan/Measure/Deliver/Team) · GROUP_OF · navHtml · topHtml        │
│   render(): route → page function → #main innerHTML → decoratePage → syncSubnav        │
│   engines: plans/versions, forecasts (R&F), dedup, Datorama (streams, QA tiers,         │
│            taxonomy, benchmarks, delivery/forecast), data-stream wizard, dashboards,     │
│            layout engine, reports (active/QA/interpret), users/access, import/export    │
│   events:  delegated document listeners keyed on data-* attributes (data-a, data-w,     │
│            data-dw, data-ar, data-rl, data-ap, data-dr …); handlers mutate V/S, call    │
│            put(), then render()                                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
            │ window.claude.use("db"|"user"|"downloads"|"assets")
            ▼
   claude.ai artifact runtime                      hosting/adapter.js (polyfills window.claude)
   (document DB, viewer identity)                          │
                                                           ▼
                                                 Supabase: Auth · Postgres (docs jsonb, profiles)
                                                 RLS with security-definer helpers; bootstrap admin
                                                           ▲
   .github/workflows/deploy-pages.yml ── build (hosting/build.py wraps the page + vendored
   supabase-js) → deploy to Pages → verify (Playwright opens the live page); Supabase project
   set up / finalised through the Management API with the repo secret SUPABASE_ACCESS_TOKEN
```

Key mechanics:
- **Everything renders from memory.** `loadAll()` pulls every collection once at start; `put()` writes through to the store and appends an audit record. There are no partial re-renders except a few live DOM patches (drag/resize, the account-picker panel).
- **Collections** are plain document lists. Core: `clients, campaigns, publishers, users, taxonomies, uploads, templates, plans, facts, rules, tasks, schedules, snapshots, audit, placements`. Added over time: `mplans, pubfacts, audiences, mplans_meas, reports, sites, forecasts, closeouts, documents, registers, changelog, scenarios, benchmarks, actuals, observations, defaults, sources, resolutions, policyblocks, studio, dat_streams, dat_ids, dat_templates, dat_answers, dat_benchmarks, dat_profiles, dat_delivery, report_templates, rf_maps, region_profiles, class_registry, atps, dat_rules, dat_patterns, dat_classes, qa_runs, dashboards, upload_templates`.
- **Workspaces** are client rows: `Client - Line of Business`. `V.ws` is the active workspace, `V.client` the client name; `inWs`, `sameWs`, `groupOf`, `wsOfClient`, `clientNames`, `allowedWs` scope every page. Workspaces of one client can share Datorama records through a `group` on the client row. Clients with `needs_rf: false` (Cboe) hide the reach tabs.
- **Splice points** used when adding modules: JavaScript before the comment `// ===== Research Foundation v1.0 seed`; CSS before `</style><script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/…`. Module sources are kept in `app/modules/` for reference; the page already contains them.

---

## 3. Data-flow schematic (a report through the Hub)

```
file dropped ──▶ Data streams wizard (Measure › Reports, or Plan/Measure/Deliver sidebar)
   Intent ──▶ File ──▶ Recognise ──▶ Map ──▶ Process
     │           │        │            │        └─ processors: starter QA / Datorama 4-tier QA ·
     │           │        │            │           interpretOverlap → reports · datParseDelivery →
     │           │        │            │           dat_delivery · rfParseUpload → actuals grid ·
     │           │        │            │           datBenchmarkProposals → dat_benchmarks (confirmed) ·
     │           │        │            │           commitFacts → facts + templates · ingestPlanFile →
     │           │        │            │           mplans · documents
     │           │        │            └─ suggestions from: the matched template → platform dictionary
     │           │        │               (PLATFORM_DOCS) → generic aliases (HUB_TARGETS) → token match
     │           │        └─ tiers: known (same client, intent, header set → runs itself) ·
     │           │           variant (template covers ≥50% of mapped columns → new/missing flagged) ·
     │           │           platform (column signature fired) · unknown (define platform, then map)
     │           └─ hashed (sha256), header-hashed (order-independent), text kept ≤220 KB (2 MB hosted)
     └─ qa · interpret · delivery · rf · benchmarks · facts · plan · document
confirmed mapping ──▶ upload_templates {client_id | share_all, intent, platform, report_type,
                      header_hash, headers, mapping{source→hub field}, options, version, uses}
```

---

## 4. Decisions and the reasoning behind them

**Product shape**
- One HTML file, no framework, no build. Rationale: publishable as a claude.ai artifact, hostable anywhere static, diffable, and the whole app is readable in one place. Cost: the file is large and every page re-renders; accepted.
- The same file serves both deployments. Hosting was added by polyfilling `window.claude` (`hosting/adapter.js`) rather than forking the app, so features never diverge.
- Datorama is the design reference: stage tiles for building a data stream, hover `?` explanations, hero drag-and-drop, wizard footers, option cards, label-left settings, drawers with breadcrumbs, table housing with type glyphs and item counts, a toolbar-anchored account picker like Google Ads.

**Measurement doctrine baked into the code**
- Reach is never summed across rows or periods; rates (CTR, CPM, frequency) are recomputed from components, never summed. The pivot shows "n/a · not summable" for reach.
- The deduplication divisor rests on the one CM360 deduplicated pull per period; per-partner reach comes from the same report over the same window. A 1.40 pre-flight floor is the default divisor until measured.
- Platform units differ and are labelled: CM360/DV360 modelled people, LinkedIn member accounts, Meta logged-in people, Reddit mostly devices, Comscore persons (panel + census), newsletters email addresses with MPP-inflated opens.
- Comscore `(000)` columns are scaled ×1,000; exclusive/duplicate is derived from unique minus the other when only one is present.
- Every finding names a source and a status (DOCUMENTED / DIRECTIONAL / INVALID) so a person can check it before quoting it.

**Recognition and templates**
- Templates are client-wide by default (LOB workspaces of one client share them) and can be shared with every client. They are versioned and retired, never overwritten, so a bad mapping can be traced.
- Auto-processing happens only on an exact column-set match with the same intent. Anything else stops for confirmation; suggestions are guesses until confirmed.
- Benchmarks always require an explicit Confirm because they supersede values in the bank (history kept by as-of date).

**Dashboards**
- Per person, per area. First visit asks for three widgets or the default. Widgets sit on a free 12-column grid with row units (30 px + 22 px gap); positions are stored in twelfths so layouts scale with the window. Drag by title bar; resize on the right edge, bottom edge or corner; others pack upward with CSS transitions; saves are debounced. Legacy half/full widgets migrated automatically.
- The picker leads with widgets built for that area, each card: title, a two-sentence description, the kind underneath.

**Reports**
- Active reports are stored as the existing report rules so the Team tab's outreach → QA → send tasks and the schedule widgets keep working; daily cadence is listed and calendared but generates no per-day tasks. Monthly dates fall to the prior business day.
- QA and Interpret start from platform tiles, then templatized report types, then Upload | View old reports, then the field map. The plan/window/divisor inputs moved into the wizard's Map stage.

**Access and users**
- Artifact build: sign-in is the Claude account; profiles are linked by email or invite code; admins approve access requests, grant workspaces and capabilities, pause accounts, reset sign-in.
- Hosted build: open registration gated by admin approval, first account becomes admin, password policy (10+ chars, letters, numbers, one special, 180-day rotation) enforced by Supabase Auth. Built-in email only reaches organisation members until custom SMTP is configured.
- Create user is a wide horizontal form: Email, First name, Last name, Role, Client, LOBs (all or a selection), welcome-email preview.

**Storage semantics**
- The account-menu gauge counts records against about 5,000 on the artifact build and estimates bytes against 500 MB on the hosted build. Uploads keep their text, so trashing old uploads frees the most space. Settings → Data exports/imports a full JSON backup (users and dashboards are skipped on import).

---

## 5. Infrastructure plan and runbook pointers

- `hosting/README.md` is the runbook. `hosting/schema.sql` (v2), `hosting/adapter.js` (v2, includes bulk upsert), `hosting/build.py`, `hosting/verify.js`, `hosting/supabase_setup.py` (modes `setup`, `finalize`, `inspect`, driven by the Management API; docs were read from the supabase/supabase GitHub repo because supabase.com was blocked).
- Workflows: `deploy-pages.yml` (deploys only from the repository's default branch; other branches pre-flight only) and `hosted-status.yml` (record counts per collection and profile counts by role, no contents).
- Secrets: repository secret `SUPABASE_ACCESS_TOKEN`. **The token that was pasted into a chat must be rotated** (Supabase dashboard → Account → Access tokens) and the secret updated.
- Custom domain (declined for now to avoid cost): buy the domain, DNS `www` CNAME to `joebenson317-ui.github.io` plus the four Pages A records and AAAA records from GitHub's docs, set Settings → Pages → Custom domain, add a `CNAME` file to the deployed site, point the Supabase Site URL at the domain (the workflow's "Expected page URL" and `finalize` step), enforce HTTPS once the check passes.
- Limits worth watching before storage: free Supabase projects pause after inactivity and need a manual resume; email delivery outside the org needs SMTP.

---

## 6. Working conventions (the rules the user set)

1. Act as a personal assistant. Never lie, assume or invent. Source every claim with a clickable link the user can use to reproduce it. Anything not verifiable from a reachable source is labelled unverified, both in answers and inside the product (the platform dictionary and the README sources table do this with a checked date).
2. Always think about how something could fail or break, and what makes an approach sustainable long term; say it in the answer.
3. No model identifiers in commits, PR titles or bodies.
4. Before pushing: syntax-check the extracted script, run the jsdom regressions (`app/test/`, all print `ERRORS []`), take screenshots of new screens and look at them. One validated push beats several speculative ones.
5. Keep the artifact and the repo in step: after a commit, republish the same file to the same artifact URL.
6. Vendor documentation sites (Google, Meta, Microsoft/LinkedIn, TikTok, Reddit, Comscore, Salesforce) were blocked from the build environment; GitHub-hosted official sources (API discovery documents, SDK enumerations, protos) were used and cited instead. Keep doing that, or check the vendor page yourself when it matters.

---

## 7. Page map (routes → what they do)

- `home` personal dashboard · `dash/<Area>` area overview dashboards · `plans` (mplans, versions, strategy, register, change log, sandbox, R&F inputs, priors, audience info, measurement plan, projections, portfolio) · `audiences` · `datorama` (streams, QA runs, taxonomy, regions, docs, questions, forecast, benchmarks, files, diagnostics) · `campaigns` (inbox, map, file QA, plan versions, explore, reach) · `reports` (Data streams, Active reports, Stored, Create, QA a report, Interpret a report) · `rf` forecasts · `dedup` · `uploads` (Data streams page, shared by Plan/Measure/Deliver) · `studio` · `pivot` · `landscape` · `calendar` · `team` · `playbook` · `settings` (clients & workspaces, users, publishers, benchmarks, rates, templates, library, catalogue, data, security, trash, activity log) · `clients` · `lobs` (compare LOBs).

---

## 8. Open items and next steps

- Rotate the exposed Supabase token (above).
- Open a PR from `claude/sharp-allen-3h4t36` to `main` when the user wants `main` current.
- Custom SMTP in Supabase before inviting people outside the organisation.
- Column names for LinkedIn, TikTok, Reddit, Comscore and Datorama in the platform dictionary are working names; verify against the vendor pages linked in the README.
- The widget and import jsdom tests existed only in the old session's scratchpad; recreate if needed (the remaining tests cover the wizard, dashboards, reports, users and the picker).
- Ideas discussed but not built: none pending beyond the above.

---

## 9. Glossary

- **LOB** line of business (a workspace under a client). **Stable ID** the identifier that survives placement renames. **DCM pull** the one deduplicated CM360 reach report per period. **Divisor** Σ per-partner reach ÷ deduplicated reach. **Template** a saved column mapping for an exporter (client-wide). **Intent** what an upload is for (QA, interpret, delivery, R&F, benchmarks, facts, plan, document). **Table export** a Datorama Table-widget CSV that the four-tier Cboe QA reads.
