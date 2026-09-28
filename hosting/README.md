# Hosting the Analytics Hub without Claude

The Hub also runs as a private claude.ai artifact, which needs a Claude account and a share. This folder is the
other way to run it: the same page on a public URL, gated by **Create an account**, backed by Supabase Auth and
Postgres, deployed by GitHub Actions to GitHub Pages. Nobody needs a Claude account.

## What is in this folder

| File | What it does |
|---|---|
| `adapter.js` | Replaces the claude.ai runtime (`window.claude.use`) with Supabase. Draws the sign-in, create-account, forgot-password and set-new-password screens, checks the password policy in the browser, forces a new password when the last change is older than 180 days, and maps the page's `users` collection onto the `profiles` table and every other collection onto `docs`. |
| `schema.sql` | Tables `profiles` and `docs`, the sign-up trigger that creates a profile, the trigger that stamps `password_changed_at` on every password change, the rule that makes the **first registered account the admin**, and row-level security. Safe to run more than once. |
| `vendor/supabase.js` | The browser build of supabase-js, served next to the page so sign-in does not depend on a CDN. |
| `build.py` | Writes `dist/`: the page from `app/analytics-hub.html` with supabase-js, the config and the adapter loaded first. Reads `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the environment, or from `config.js` for a local build. |
| `verify.js` | Opens the live page in headless Chromium after each deploy and fails the run if the sign-in screen does not render or Supabase rejects the key. |
| `../.github/workflows/deploy-pages.yml` | Build, deploy to GitHub Pages, verify. Runs on every push to `main` that touches `app/` or `hosting/`, and on demand. |
| `test/adapter.test.js` | Runs the adapter in jsdom against an in-memory fake of supabase-js: sign-in, registration, approval, denial, rotation. `npm i jsdom` then `node hosting/test/adapter.test.js`. |
| `config.example.js`, `vercel.json`, `netlify.toml` | For a local build or for hosting on Vercel or Netlify instead of GitHub Pages. |
| `supabase_setup.py` | Talks to the Supabase Management API: finds or creates the project, waits until healthy, runs `schema.sql`, sets the password rules, email confirmation, optional SMTP and redirect URLs, reads the anon key. Tested by `test/supabase_setup.test.py` against a fake of the API. |
| `adapter.md` | The storage and identity contract the adapter satisfies. |

## Go live

### The short path: one token, the workflow does the rest

1. **Supabase account.** Sign up at https://supabase.com and open the dashboard once, so the default organization exists.
2. **Access token.** Go to https://supabase.com/dashboard/account/tokens, generate a token (any name), copy it.
3. **GitHub secret.** In the repo: Settings, then Secrets and variables, then Actions, then **Secrets**, then New repository secret. Name it exactly `SUPABASE_ACCESS_TOKEN` and paste the token.
4. **GitHub Pages.** Settings, then Pages, then under Build and deployment set Source to **GitHub Actions**.
5. **Deploy.** Merge the branch into `main`, or run the workflow from the Actions tab. The workflow finds or creates the project (`analytics-hub`, region `us-east-1` unless the variables `SUPABASE_PROJECT_NAME`, `SUPABASE_ORG_SLUG` or `SUPABASE_REGION` say otherwise), waits until it is healthy, runs `schema.sql`, sets the password rules and redirect URLs, reads the anon key, builds, deploys, points the Site URL at the live page and opens it in a browser. The run summary shows the page URL.
6. **First account.** Open the site, click Create an account, register. The first account ever created is the admin; every later account starts as viewer with status **requested**.
7. **Everyone else.** Send the link. A new person registers with a policy-compliant password and sees **Waiting for approval**. You approve them in Settings, then Users, then Access requests, choosing role, workspaces and capabilities, whenever you like; they do not need to be online or to reach you first.

### The manual path: set the project up in the dashboard

Use this if you would rather not create an access token.

1. Create a project at https://supabase.com. In **SQL Editor** paste the whole of `schema.sql` and run it.
2. **Authentication, then Providers, then Email**: set Minimum password length to 10 and Password requirements to lower case, upper case, digits and symbols. Turn **Confirm email** off (see the email note below).
3. **Project Settings, then API**: copy the Project URL and the anon key. In GitHub add them as repository **Variables** named `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
4. Enable Pages and deploy as in steps 4 and 5 above. After the first deploy, set **Authentication, then URL Configuration**: Site URL and a Redirect URL equal to the page URL.

### Email: read before inviting anyone

Supabase's built-in email sender only delivers to members of your Supabase organization and is rate-limited ([source](https://github.com/supabase/supabase/blob/master/apps/docs/content/guides/auth/auth-smtp.mdx)). That is why the workflow leaves email confirmation off by default: with it on, a friend's confirmation email would never arrive and he could not sign in. Password-reset emails have the same limit. To send real email, add a custom SMTP provider: either set the repository secrets `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and the variables `SMTP_SENDER_NAME`, `SMTP_ADMIN_EMAIL` and re-run the workflow, or fill in Authentication, then SMTP Settings in the dashboard. Set the variable `CONFIRM_EMAIL` to `true` once SMTP works if you want addresses verified.

## How access works on this build

- The `profiles` table holds role and status; row-level security reads them. Only active members read and write data; anyone signed in can append to the activity log; nobody edits or deletes activity rows; only admins delete other rows or change other people's role and status.
- Approving, pausing or declining someone in the page writes their `profiles` row, so the database and the page always agree.
- **Reset password** on a profile (Settings → Users) sends the Supabase reset email; the new password must meet the policy and the 180-day clock restarts (the trigger in `schema.sql` stamps the change).
- The password policy is enforced twice: in the browser by the adapter and on the server by Supabase Auth (set by the workflow or in the dashboard). The server rule is Supabase's strongest option, lower case, upper case, digits and symbols, which covers the required letters, number and special character; the browser checklist shows the same four items.

## What to know

- **The hosted database starts empty.** Client data does not belong in a public repository, so nothing is seeded. Upload plans and workbooks in the hosted Hub, or ask for the export/import feature to move data from the claude.ai copy by file.
- **The page source is public.** The account gate protects the database. Anyone with the URL can read the page's JavaScript, so keep client secrets out of the page.
- **Free tier.** Supabase may pause free projects after a period of inactivity; check https://supabase.com/pricing and move to a paid tier if the Hub must stay up unattended.
- **Custom domain.** Settings → Pages → Custom domain, plus a CNAME at your registrar; then update the Site URL in Supabase.
- **Local build.** Copy `config.example.js` to `config.js`, fill it in, run `python3 hosting/build.py`, and open `hosting/dist/index.html` from any static server. `config.js` and `dist/` are ignored by git.
