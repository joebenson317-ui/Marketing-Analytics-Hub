# Hosting the Analytics Hub on your own domain

The Hub runs today as a private claude.ai artifact. That gives you sign-in for free (Claude accounts), a database, file downloads and sharing from the page's Share menu, and it costs nothing to run. It also means two things you asked for cannot be done there:

| Ask | On claude.ai | Self-hosted |
|---|---|---|
| A link anyone can open, gated by "create an account" | Anyone you **share the link with** (Share menu, *can edit*) and who has a Claude account. A public link cannot write to the database. | Yes: any visitor can register at your domain. |
| Your own password rules (10+ characters, letters + numbers, one special, rotate every 180 days) | No. Passwords belong to the Claude account; Anthropic sets those rules. | Yes: the identity provider enforces them (settings below). |
| Admin resets a user's password | "Reset sign-in" in Settings → Users clears the account link and mints a new invite link. | Yes: the provider sends the reset email. |
| Every action logged and filterable by profile | Yes, today (Settings → Activity log). | Yes, same code. |

Everything below is what a self-hosted build needs. Nothing here is set up yet; it is the runbook and the pieces that do not depend on your accounts.

## What is in this folder

| File | What it does |
|---|---|
| `adapter.js` | Replaces the claude.ai runtime (`window.claude.use`) with Supabase Auth + Postgres. Draws the sign-in, create-account, forgot-password and set-new-password screens, enforces the password policy on the client (the provider enforces it again on the server), forces a new password when the last change is older than 180 days, and hands the unchanged page a `db` and `user` namespace. |
| `schema.sql` | Tables (`profiles`, `docs`, `audit`), the sign-up trigger that creates a profile row, the trigger that stamps `password_changed_at` on every password change, and row-level security (active profiles read and write; only admins change other profiles or delete). |
| `build.py` | Writes `dist/index.html`: the Hub page from `app/analytics-hub.html` with the adapter and your `config.js` loaded first. |
| `config.example.js` | Copy to `config.js` and fill in the Supabase URL and anon key (both are safe to ship to the browser; row-level security does the protecting). |
| `vercel.json`, `netlify.toml` | Build and publish settings for either host. |
| `adapter.md` | The storage and identity contract the adapter satisfies. |

## Deploy in five steps

1. **Supabase.** Create a project at supabase.com. In the SQL editor paste `schema.sql` and run it. Under Authentication → Providers → Email: keep sign-ups on, set the minimum password length to **10** and required characters to **letters, digits and symbols**, keep email confirmation on. Under Authentication → URL configuration add your domain as the site URL and redirect URL.
2. **Config.** Copy `config.example.js` to `config.js`; paste the project URL and anon key from Project settings → API.
3. **Host.** Import the GitHub repo in Vercel or Netlify; both read the manifest in this folder and run `build.py` (set the root directory to `hosting` and add `config.js` there, or set its two values as build-time environment variables and write the file in a pre-build step). Attach your domain in the host's dashboard. If you prefer no build step, run `python3 hosting/build.py` locally and upload `hosting/dist/index.html` to any static host.
4. **First admin.** Open the domain, create your own account, confirm the email. In the SQL editor: `update profiles set role='admin', status='active' where email='you@…';` This is the only manual step, once.
5. **Your friend.** Send him the link. He creates an account with a policy-compliant password, sees Waiting for approval, and you approve him in Settings → Users → Access requests whenever you like, assigning admin and client access. He never needs a Claude account, and he never needs to reach you first.

Password reset: he uses Forgot password on the sign-in screen, or you press Reset sign-in on his profile and the provider emails him the link. Either way the new password must meet the policy and the 180-day clock restarts.

## Notes on the pieces

- **Static hosting** for `app/analytics-hub.html`: Vercel, Netlify or Cloudflare Pages. Point your domain at it. All three give HTTPS and a custom domain on the free tier.
- **Identity + database**: Supabase (Postgres + Auth). One project. Free tier is enough for this data volume.
- **Adapter**: the page talks to storage through one object, `DB`, with `doc(path).set/get/delete` and `collection(name)` queries, and to identity through `USER`. `hosting/adapter.md` lists the exact calls a Supabase adapter must satisfy so the rest of the page stays untouched.

## 2. Identity provider settings (Supabase Auth)

Dashboard → Authentication → Providers → Email:

- Enable email + password. Disable "Allow new users to sign up" **only if** you want invite-only; you asked for open self-registration, so leave it on.
- Password: minimum length **10**; required characters **lowercase, uppercase, digits, symbols** (Supabase: "Letters, digits and symbols"). This is the 10 / letters + numbers / one special rule.
- Confirm email: on. Rate limits: defaults.

Rotation every 180 days is not a provider switch; it is `schema.sql` below: a `password_changed_at` column kept current by an auth hook, and a login check that forces a reset when it is older than 180 days.

## 3. Database

Run `hosting/schema.sql` in the SQL editor. It creates:

- `profiles` (one row per user, mirrors the Hub's `users` collection: role, status, access, `password_changed_at`);
- `docs` (every other Hub collection as JSONB, keyed by `collection` + `id`, mirroring the artifact database);
- `audit` (the activity log, append-only);
- row-level security: signed-in users read shared docs; only profiles with `status = 'active'` write; only admins change other profiles; nobody deletes audit rows.

## 4. Deploy order

1. Create the Supabase project; run the schema; set the Auth options above.
2. Copy `app/analytics-hub.html` to the hosting project; add the Supabase URL and anon key to the adapter; deploy; attach the domain.
3. Open the domain, register the first account, then in SQL set that profile's `role = 'admin'` and `status = 'active'` (the only manual step, once).
4. Send your friend the link. He registers, sees "Waiting for approval", you approve in Settings → Users → Access requests at any time; he does not need to reach you.

## 5. What the Hub already does that carries over unchanged

Access requests and approval, roles, workspace grants, sign-in reset, the security policy screen, and the activity log with the per-profile filter are all page code; they work identically on claude.ai and self-hosted.
