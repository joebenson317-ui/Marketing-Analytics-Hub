# Hosting the Analytics Hub on your own domain

The Hub runs today as a private claude.ai artifact. That gives you sign-in for free (Claude accounts), a database, file downloads and sharing from the page's Share menu, and it costs nothing to run. It also means two things you asked for cannot be done there:

| Ask | On claude.ai | Self-hosted |
|---|---|---|
| A link anyone can open, gated by "create an account" | Anyone you **share the link with** (Share menu, *can edit*) and who has a Claude account. A public link cannot write to the database. | Yes: any visitor can register at your domain. |
| Your own password rules (10+ characters, letters + numbers, one special, rotate every 180 days) | No. Passwords belong to the Claude account; Anthropic sets those rules. | Yes: the identity provider enforces them (settings below). |
| Admin resets a user's password | "Reset sign-in" in Settings → Users clears the account link and mints a new invite link. | Yes: the provider sends the reset email. |
| Every action logged and filterable by profile | Yes, today (Settings → Activity log). | Yes, same code. |

Everything below is what a self-hosted build needs. Nothing here is set up yet; it is the runbook and the pieces that do not depend on your accounts.

## 1. Pieces

- **Static hosting** for `app/analytics-hub.html`: Vercel, Netlify or Cloudflare Pages. Point your domain at it. All three give HTTPS and a custom domain on the free tier.
- **Identity + database**: Supabase (Postgres + Auth). One project. Free tier is enough for this data volume.
- **Adapter**: the page talks to storage through one object, `DB`, with `doc(path).set/get/delete` and `collection(name)` queries, and to identity through `USER`. `platform/hosting/adapter.md` lists the exact calls a Supabase adapter must satisfy so the rest of the page stays untouched.

## 2. Identity provider settings (Supabase Auth)

Dashboard → Authentication → Providers → Email:

- Enable email + password. Disable "Allow new users to sign up" **only if** you want invite-only; you asked for open self-registration, so leave it on.
- Password: minimum length **10**; required characters **lowercase, uppercase, digits, symbols** (Supabase: "Letters, digits and symbols"). This is the 10 / letters + numbers / one special rule.
- Confirm email: on. Rate limits: defaults.

Rotation every 180 days is not a provider switch; it is `schema.sql` below: a `password_changed_at` column kept current by an auth hook, and a login check that forces a reset when it is older than 180 days.

## 3. Database

Run `platform/hosting/schema.sql` in the SQL editor. It creates:

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
