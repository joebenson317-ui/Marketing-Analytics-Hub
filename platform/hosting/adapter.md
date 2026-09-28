# Storage and identity adapter

The page reaches storage only through `DB` and identity only through `USER`. A self-hosted build replaces the two bootstrap lines at the end of `app/analytics-hub.html` (`DB = await claude.use("db")` and the `claude.use("user")` block) with an object that satisfies the calls below. Nothing else in the page changes.

## DB

| Call | Used for | Supabase equivalent |
|---|---|---|
| `DB.doc("<collection>/<id>").set(obj)` | every save (`put`) and every audit row | `upsert` into `docs` (or `audit` when the path starts with `audit/`) |
| `DB.doc(path).get()` | occasional single reads | `select` by `(collection, id)` |
| `DB.doc(path).delete()` | permanent delete from Trash | `delete` (admins only, by policy) |
| `DB.collection("<name>").get()` | `loadAll()` at start | `select data from docs where collection = $1` |

Writes must reject with an object carrying `code` (`"permission_denied"` or `"invalid_argument"`) when the policy refuses; the page then sets `READONLY` and shows the share-level message.

## USER

`USER = {id, name, email, owner}` where `id` is the auth user id, `owner` is true for the first admin (or never; on a self-hosted build the gate can rely on `profiles.status` alone).

## What the page persists per user

`users` collection ↔ `profiles` table: `email, name, team, timezone, role, status, access, request_note, requested_at, approved_at, approved_by, invite_token, claimed_user_id, disabled, password_changed_at`. On a self-hosted build `claimed_user_id` equals the auth id and `invite_token` is unused; "Reset sign-in" calls `supabase.auth.resetPasswordForEmail(email)` instead of minting a token.
