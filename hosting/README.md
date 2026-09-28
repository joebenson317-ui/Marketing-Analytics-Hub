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
| `adapter.md` | The storage and identity contract the adapter satisfies. |

## Go live

1. **Supabase project.** Sign up at https://supabase.com and create a project (any name, nearest region, keep the database password). When it is ready:
   - **SQL Editor**: paste the whole of `schema.sql` and run it. It must finish without errors.
   - **Authentication → Providers → Email**: keep the provider enabled; set **Minimum password length** to 10 and **Password requirements** to letters, digits and symbols. For the first evening, turn **Confirm email** off so a new account can sign in immediately; turn it back on later if you want address verification.
   - **Project Settings → API**: copy the **Project URL** and the **anon public** key. Both are meant to be shipped to browsers; row-level security is what protects the data.
2. **Repository variables.** In the GitHub repo: Settings → Secrets and variables → Actions → **Variables** → New repository variable, twice: `SUPABASE_URL` and `SUPABASE_ANON_KEY`. Optionally `ACCOUNT_NAME` for the name under the logo.
3. **GitHub Pages.** Settings → Pages → Build and deployment → Source: **GitHub Actions**.
4. **Deploy.** Merge the branch into `main` (or run the workflow from the Actions tab). The run builds, deploys and verifies; its summary shows the site URL.
5. **Site URL.** Back in Supabase, Authentication → URL Configuration: set **Site URL** to the site URL from step 4 and add the same URL to **Redirect URLs**. Password-reset emails open this address.
6. **First account.** Open the site, click Create an account, register. The first account ever created is the admin; every later account starts as viewer with status **requested**.
7. **Everyone else.** Send the link. A new person registers with a policy-compliant password and sees **Waiting for approval**. You approve them in Settings → Users → Access requests, choosing role, workspaces and capabilities, whenever you like; they do not need to be online or to reach you first.

## How access works on this build

- The `profiles` table holds role and status; row-level security reads them. Only active members read and write data; anyone signed in can append to the activity log; nobody edits or deletes activity rows; only admins delete other rows or change other people's role and status.
- Approving, pausing or declining someone in the page writes their `profiles` row, so the database and the page always agree.
- **Reset password** on a profile (Settings → Users) sends the Supabase reset email; the new password must meet the policy and the 180-day clock restarts (the trigger in `schema.sql` stamps the change).
- The password policy is enforced twice: in the browser by the adapter and on the server by the Supabase Auth settings in step 1. Both are needed; the browser check alone can be bypassed.

## What to know

- **The hosted database starts empty.** Client data does not belong in a public repository, so nothing is seeded. Upload plans and workbooks in the hosted Hub, or ask for the export/import feature to move data from the claude.ai copy by file.
- **The page source is public.** The account gate protects the database. Anyone with the URL can read the page's JavaScript, so keep client secrets out of the page.
- **Free tier.** Supabase may pause free projects after a period of inactivity; check https://supabase.com/pricing and move to a paid tier if the Hub must stay up unattended.
- **Email.** Confirmation and reset emails use Supabase's built-in sender, which is rate-limited; configure custom SMTP under Authentication → SMTP settings before inviting many people.
- **Custom domain.** Settings → Pages → Custom domain, plus a CNAME at your registrar; then update the Site URL in Supabase.
- **Local build.** Copy `config.example.js` to `config.js`, fill it in, run `python3 hosting/build.py`, and open `hosting/dist/index.html` from any static server. `config.js` and `dist/` are ignored by git.
