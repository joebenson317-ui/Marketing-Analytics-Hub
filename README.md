# Marketing Analytics Hub

Source of record for the **Analytics Hub** — a single-file web app published as a private page on claude.ai:

- Live page: https://claude.ai/artifact/ECztkmmQ4uMFYTynvtTqWD
- App source: [`app/analytics-hub.html`](app/analytics-hub.html) (one HTML file; data lives in the page's own database, not in this repo)

## What is in here

| Path | What it is |
|---|---|
| `app/analytics-hub.html` | The published page. Edit here, then republish to the same artifact URL so the link and the stored data survive. |
| `platform/default-client-workspace-design-2026-09-27.md` | Why the Datorama workspace design looks the way it does, measured against a 146-dimension reference workspace. |
| `platform/datorama-tab-build-brief-2026-09-27.md` | The build brief for the Datorama tab (registries, plan normalisation, question queue, taxonomy builder, compliance engine, runbook). |

The Research Foundation and Default Value Library v1.0 (the T3/T4 research layer behind the reach model) lives in the Google Doc it was authored in — https://docs.google.com/document/d/10abQLZ0DsqzQlu3MAHefj3GocsI5rg0oceBJlPGvKpc/edit — and its values are loaded into the page's database with source, vintage and status on every row.

## How the page is organised

- **Workspaces** are named `Client - Line of Business` (e.g. `Goldman Sachs - PWM`, `Goldman Sachs - Corporate Brand`); the picker is top-left, site-wide settings are behind the gear top-right.
- **Sign-in is claude.ai's.** There is no separate Hub username or password. A person invited in Settings → Users receives a link carrying an invite code; on first open the Hub links their Claude account to their Hub profile and walks them through profile and home-dashboard setup.
- **Datorama tab** turns the media plan in a workspace into a Datorama workspace plan: normalised plan lines with stable IDs, a question queue for anything the client profile cannot resolve, a taxonomy builder that blocks volatile attributes from names, generated trafficking sheet / classifications / manifests, a ten-check compliance engine reported as % of spend, a stream map with one authoritative stream per metric, the seven-step diagnostic ladder, and the 19-step analyst runbook.
- **Library** holds the default-value library (every row with source, vintage, status and the question it answers), the fallback chains, policy blocks and the source registry.

## Working on it

The page has no build step. To test headlessly:

```sh
npm install jsdom xlsx
node --check <(sed -n '/<script>/,/<\/script><\/body>/p' app/analytics-hub.html | sed '1s/^<script>//;$s/<\/script><\/body><\/html>$//')
```

Storage caveats worth knowing before changing the data model: records already in the page's database keep their shape, so field renames need a migration path; the database is per-artifact, so publishing to a new URL starts empty.
