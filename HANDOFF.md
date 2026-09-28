# Handoff — picking the Analytics Hub up in a new session

A new Claude session starts with no memory of earlier chats. Everything it needs is in this repository, the artifact and the hosted site. Point the new session at this file first.

## Where things live

| What | Where |
|---|---|
| The app (one HTML file, source of record) | `app/analytics-hub.html` on the default branch `claude/sharp-allen-3h4t36` |
| Live hosted site (Supabase auth + Postgres, GitHub Pages) | https://joebenson317-ui.github.io/Marketing-Analytics-Hub/ — deploys automatically on every push to the default branch via `.github/workflows/deploy-pages.yml` (build → deploy → Playwright verify) |
| claude.ai artifact (private, own database) | https://claude.ai/artifact/ECztkmmQ4uMFYTynvtTqWD — a new session updates it by publishing `app/analytics-hub.html` with that URL after reading it once |
| Hosted data | The Supabase project created by the workflow; record counts via `.github/workflows/hosted-status.yml`; export/import from Settings → Data inside the app |
| Runbook for hosting | `hosting/README.md` |
| Module sources merged into the page | `app/modules/*.js` and `*.css` (reference only; the page already contains them) |
| Tests | `app/test/*.js` (jsdom) with `app/test/seed.json` demo data |

## How to work on the page

1. Edit `app/analytics-hub.html` directly (there is no build step). New features were added as blocks spliced before the line `// ===== Research Foundation v1.0 seed` (JavaScript) and before `</style><script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/...` (CSS).
2. Syntax check: extract the inline script and run `node --check`.
3. Regression: `cd app/test && npm install jsdom xlsx && node v33_test.js` (also `wiz_test.js`, `test_qa.js`, `picker_test.js`; the widget and import tests lived only in the old session scratchpad). Each prints `ERRORS []` when clean.
4. Commit and push to the default branch; the deploy workflow verifies the live sign-in screen. Republish the artifact from the same file.

## Conventions the user asked for

- Sources for every factual claim, clickable; anything unverifiable labelled unverified (see the platform dictionary in the page and the README sources table).
- Think through failure modes and long-term sustainability in every answer.
- No model identifiers in commits, PR titles or bodies.

## State at handoff (28 Sep 2026)

Shipped: data-stream upload wizard, active reports, QA/Interpret landings, dashboard layout engine (drag/resize), horizontal Create user form, filled area tabs with icons, toolbar account picker (client › LOB), hosted-build storage gauge.

Outstanding:
- Rotate the Supabase personal access token that was pasted into a chat (Supabase dashboard → Account → Access tokens), then update the repository secret `SUPABASE_ACCESS_TOKEN`.
- `main` is behind the default branch; open a PR from `claude/sharp-allen-3h4t36` to `main` when wanted.
- Custom domain (declined for now): DNS records + Settings → Pages custom domain + `CNAME` file + Supabase Site URL in the workflow.
- Custom SMTP in Supabase before inviting people outside the organisation (built-in email only reaches org members).
