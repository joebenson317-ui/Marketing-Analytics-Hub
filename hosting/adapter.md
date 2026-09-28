# Storage and identity adapter

The page reaches storage only through `DB` and identity only through `USER`, both obtained from `window.claude.use("db")` and `window.claude.use("user")` at the end of `app/analytics-hub.html`. `adapter.js` defines `window.claude.use` before the page runs, so nothing in the page changes between claude.ai and a self-hosted build. The page reads `window.HOSTED` to show Sign out and to send password resets through the identity provider.

## DB

| Call | Used for | Supabase mapping |
|---|---|---|
| `DB.doc("users/<id>").set(obj)` | profile requests, approvals, pauses, resets | `profiles` row keyed by `obj.claimed_user_id` (the auth user id); columns `email, name, team, timezone, role, status, access`, everything else in `data`. A record without an account yet (an invite) is stored in `docs` under collection `users`. |
| `DB.doc("<collection>/<id>").set(obj)` | every other save and every activity-log row | `upsert` into `docs (collection, id, data)` |
| `DB.doc(path).get()` | occasional single reads | `select` by key |
| `DB.doc(path).delete()` | permanent delete from Trash | `delete` (admins only, by policy) |
| `DB.collection("users").get()` | `loadAll()` | all readable `profiles` rows as user records with `claimed_user_id = id`, plus invites from `docs` whose email has not registered |
| `DB.collection("<name>").get()` | `loadAll()` | `select id, data from docs where collection = $1`, paged by 1000 |

A refused write rejects with an error whose `code` is `permission_denied` (Postgres 42501) or `invalid_argument`; the page then sets `READONLY` and shows the save-failed message. Pause maps to `status = 'paused'` and reads back as `disabled: true`.

## USER

`USER = {id, name, email, owner}`. `id` is the Supabase auth user id; `owner` is true for an active admin (`profiles.role = 'admin'`). The page treats an owner as an admin everywhere, including the access gate.

## Other capabilities

`downloads` resolves to a small shim that saves through a browser download. `assets` and `sample` resolve to `null`, so upload originals are not stored and Claude-assisted features stay hidden on this build.
