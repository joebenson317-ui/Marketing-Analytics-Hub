// Adapter tests: run `npm i jsdom` once, then `node hosting/test/adapter.test.js`.
// Runs hosting/adapter.js in jsdom against an in-memory fake of the supabase-js client.
const {JSDOM, VirtualConsole} = require("jsdom");
const fs = require("fs");
const src = fs.readFileSync(require("path").join(__dirname, "..", "adapter.js"), "utf8");
function fakeSupabase(state) {
  const tables = {profiles: state.profiles, docs: state.docs};
  const key = (t, r) => t === "docs" ? r.collection + "/" + r.id : r.id;
  function from(t) {
    const rows = tables[t]; const q = {f: [], op: "select", payload: null, single: false, range: null, ret: false};
    const exec = () => {
      const match = rows.filter(r => q.f.every(fn => fn(r)));
      if (q.op === "select") { let out = match; if (q.range) out = out.slice(q.range[0], q.range[1] + 1); return {data: q.single ? (out[0] || null) : out.map(r => ({...r})), error: null}; }
      if (q.op === "insert") { const arr = [].concat(q.payload); for (const p of arr) { if (rows.some(r => key(t, r) === key(t, p))) return {data: null, error: {code: "23505", message: "duplicate key"}}; if (state.deny && state.deny(t, "insert", p)) return {data: null, error: {code: "42501", message: "new row violates row-level security policy"}}; rows.push({...p}); } return {data: q.single ? {...arr[0]} : arr, error: null}; }
      if (q.op === "update") { if (state.deny && match.some(r => state.deny(t, "update", r))) return {data: null, error: {code: "42501", message: "rls"}}; match.forEach(r => Object.assign(r, q.payload)); return {data: match.map(r => ({...r})), error: null}; }
      if (q.op === "upsert") { const arr = [].concat(q.payload); for (const p of arr) { const ex = rows.find(r => key(t, r) === key(t, p)); if (state.deny && state.deny(t, ex ? "update" : "insert", p)) return {data: null, error: {code: "42501", message: "new row violates row-level security policy"}}; if (ex) Object.assign(ex, p); else rows.push({...p}); } return {data: arr, error: null}; }
      if (q.op === "delete") { match.forEach(r => rows.splice(rows.indexOf(r), 1)); return {data: match, error: null}; }
    };
    const api = {select(s) { if (q.op === "select") q.op = "select"; q.ret = true; return api; }, eq(k, v) { q.f.push(r => r[k] === v); return api; }, in(k, vs) { q.f.push(r => vs.includes(r[k])); return api; }, order() { return api; }, range(a, b) { q.range = [a, b]; return api; }, maybeSingle() { q.single = true; return api; }, insert(p) { q.op = "insert"; q.payload = p; return api; }, update(p) { q.op = "update"; q.payload = p; return api; }, upsert(p) { q.op = "upsert"; q.payload = p; return api; }, delete() { q.op = "delete"; return api; }, then(res, rej) { return Promise.resolve().then(exec).then(res, rej); }};
    return api;
  }
  const listeners = [];
  const auth = {getSession: async () => ({data: {session: state.session}}), onAuthStateChange: cb => { listeners.push(cb); return {data: {subscription: {unsubscribe() {}}}}; }, signInWithPassword: async ({email, password}) => password === "Right-passw0rd!" ? (state.session = {user: {id: state.loginAs, email}}, listeners.forEach(cb => cb("SIGNED_IN", state.session)), {error: null}) : {error: {message: "Invalid login credentials"}}, signUp: async ({email, options}) => { const id = "33333333-3333-3333-3333-333333333333"; state.profiles.push({id, email, name: options.data.name, team: "", timezone: "America/New_York", role: "viewer", status: "requested", access: {workspaces: "all", capabilities: {}}, data: {}, password_changed_at: new Date().toISOString()}); if (state.autoconfirm) { state.session = {user: {id, email, user_metadata: options.data}}; return {data: {user: {id}, session: state.session}, error: null}; } return {data: {user: {id}, session: null}, error: null}; }, updateUser: async () => ({error: null}), resetPasswordForEmail: async () => ({error: null}), signOut: async () => ({})};
  return {createClient: () => ({from, auth}), _listeners: listeners};
}
async function boot(state, cfg) {
  const vc = new VirtualConsole(); const logs = []; vc.on("jsdomError", e => logs.push("jsdomError " + e.message)); vc.on("error", m => logs.push("error " + m));
  const dom = new JSDOM(`<!doctype html><html><head></head><body><div id="main"></div></body></html>`, {runScripts: "outside-only", url: "https://joebenson317-ui.github.io/Marketing-Analytics-Hub/", virtualConsole: vc});
  const w = dom.window; w.HUB_CONFIG = cfg || {SUPABASE_URL: "https://abc.supabase.co", SUPABASE_ANON_KEY: "anon-key-123", ACCOUNT_NAME: "Test Co"}; w.supabase = fakeSupabase(state); w.URL.createObjectURL = () => "blob:x"; w.URL.revokeObjectURL = () => {};
  w.eval(src); await new Promise(r => setTimeout(r, 30)); return {w, dom, logs};
}
const tick = () => new Promise(r => setTimeout(r, 20));
const assert = (c, m) => { if (!c) throw new Error("ASSERT " + m); console.log("ok  ", m); };
const JOE = "11111111-1111-1111-1111-111111111111", FR = "22222222-2222-2222-2222-222222222222";
const mkProfile = (id, email, name, role, status, extra = {}) => ({id, email, name, team: "", timezone: "America/New_York", role, status, access: {workspaces: "all", capabilities: {}}, data: {}, password_changed_at: new Date().toISOString(), ...extra});
(async () => {
  // 1. no session → sign-in screen; register form and policy list; wrong password error
  { const st = {profiles: [mkProfile(JOE, "joe@example.com", "Joe", "admin", "active")], docs: [], session: null, loginAs: JOE};
    const {w} = await boot(st); const d = w.document;
    assert(d.querySelector("#hub-auth h1").textContent === "Sign in", "no session shows Sign in");
    assert(/Test Co/.test(d.querySelector("#hub-auth").textContent), "account name shown");
    d.querySelector('#hub-auth [data-v="register"]').click(); await tick();
    assert(d.querySelector("#hub-auth h1").textContent === "Create your account", "register screen");
    d.querySelector("#a_pw").value = "abc"; d.querySelector("#a_pw").dispatchEvent(new w.Event("input")); assert(d.querySelectorAll("#a_pol li.y").length === 0, "weak password: 0 of 4 checks");
    d.querySelector("#a_pw").value = "Longer-passw0rd!"; d.querySelector("#a_pw").dispatchEvent(new w.Event("input")); assert(d.querySelectorAll("#a_pol li.y").length === 4, "compliant password: 4 of 4 checks");
    d.querySelector("#a_name").value = ""; d.querySelector("#a_go").click(); await tick(); assert(/Enter your name/.test(d.querySelector("#hub-auth .err")?.textContent || ""), "register requires a name");
    d.querySelector('#hub-auth [data-v="signin"]').click(); await tick();
    d.querySelector("#a_email").value = "joe@example.com"; d.querySelector("#a_pw").value = "wrong"; d.querySelector("#a_go").click(); await tick(); await tick();
    assert(/Invalid login/.test(d.querySelector("#hub-auth .err")?.textContent || ""), "wrong password shows the provider error");
    d.querySelector("#a_email").value = "joe@example.com"; d.querySelector("#a_pw").value = "Right-passw0rd!"; d.querySelector("#a_go").click(); await tick(); await tick(); await tick();
    assert(d.querySelector("#hub-auth").style.display === "none", "correct password hides the overlay");
    const u = await w.claude.use("user"); assert(await u.isOwner() === true, "admin resolves as owner"); }
  // 2. admin session: users collection maps profiles; approval writes profiles; invites go to docs; other collections go to docs; pagination
  { const st = {profiles: [mkProfile(JOE, "joe@example.com", "Joe", "admin", "active"), mkProfile(FR, "friend@example.com", "Friend", "viewer", "requested")], docs: [], session: {user: {id: JOE, email: "joe@example.com"}}};
    for (let i = 0; i < 1500; i++) st.docs.push({collection: "plans", id: "p" + String(i).padStart(4, "0"), data: {id: "p" + String(i).padStart(4, "0"), n: i}});
    const {w} = await boot(st); const db = await w.claude.use("db"); const u = await w.claude.use("user");
    assert(!w.document.querySelector("#hub-auth") || w.document.querySelector("#hub-auth").style.display === "none", "admin session never shows the overlay");
    let users = (await db.collection("users").get()).docs.map(d => ({id: d.id, ...d.data()}));
    assert(users.length === 2 && users.find(x => x.id === FR).status === "requested" && users.find(x => x.id === FR).claimed_user_id === FR, "users collection comes from profiles with claimed_user_id = auth id");
    const fr = users.find(x => x.id === FR); fr.role = "editor"; fr.status = "active"; fr.approved_at = "2026-09-28"; fr.access = {workspaces: ["cboe"], capabilities: {upload: true}};
    await db.doc("users/" + FR).set(fr);
    const row = st.profiles.find(p => p.id === FR); assert(row.role === "editor" && row.status === "active" && row.data.approved_at === "2026-09-28" && row.access.workspaces[0] === "cboe", "approval updates role, status, access and keeps extra fields in data");
    await db.doc("users/rand0m1d").set({id: "rand0m1d", email: "new@example.com", role: "viewer", invite_token: "ABC", claimed_user_id: null});
    assert(st.docs.some(d => d.collection === "users" && d.id === "rand0m1d"), "invite without an account is stored in docs");
    users = (await db.collection("users").get()).docs.map(d => d.data()); assert(users.length === 3, "users list merges profiles and pending invites");
    await db.doc("users/rand0m2d").set({id: "rand0m2d", email: "Friend@Example.com", claimed_user_id: null}); users = (await db.collection("users").get()).docs.map(d => d.data()); assert(users.length === 3, "an invite matching a registered email is hidden");
    fr.disabled = true; await db.doc("users/" + FR).set(fr); assert(row.status === "paused", "pause maps to status paused"); const back = (await db.doc("users/" + FR).get()).data(); assert(back.disabled === true && back.status === "active", "paused row reads back as disabled");
    await db.doc("audit/a1").set({id: "a1", kind: "x"}); assert(st.docs.some(d => d.collection === "audit" && d.id === "a1"), "audit rows go to docs");
    const plans = (await db.collection("plans").get()).docs; assert(plans.length === 1500 && plans[0].data().n === 0, "collection get paginates past 1000 rows");
    await db.doc("plans/p0001").delete(); assert(!st.docs.some(d => d.collection === "plans" && d.id === "p0001"), "doc delete removes the row");
    const ps = await u.profiles([JOE, FR, "zzz"]); assert(ps[JOE].name === "Joe" && ps.zzz.name === "", "profiles(ids) resolves names");
    const me = await u.me(); assert(me.id === JOE && me.email === "joe@example.com", "me() carries id and email");
    const dl = await w.claude.use("downloads"); assert(typeof dl.save === "function", "downloads shim present");
    assert((await w.claude.use("sample")) === null && (await w.claude.use("assets")) === null, "sample and assets resolve null"); }
  // 3. requested user: RLS denial surfaces as permission_denied; self-update allowed
  { const st = {profiles: [mkProfile(JOE, "joe@example.com", "Joe", "admin", "active"), mkProfile(FR, "friend@example.com", "Friend", "viewer", "requested")], docs: [], session: {user: {id: FR, email: "friend@example.com"}}, deny: (t, op, r) => t === "docs" && r.collection !== "audit"};
    const {w} = await boot(st); const db = await w.claude.use("db"); const u = await w.claude.use("user");
    assert(await u.isOwner() === false && await u.canEdit() === false, "requested user is not owner and cannot edit");
    let code = null; try { await db.doc("clients/c1").set({id: "c1"}); } catch (e) { code = e.code; } assert(code === "permission_denied", "denied write rejects with permission_denied");
    await db.doc("audit/a2").set({id: "a2", kind: "access_request"}); assert(st.docs.some(d => d.id === "a2"), "audit insert allowed for a requested user");
    const me = (await db.collection("users").get()).docs.map(d => d.data()).find(x => x.claimed_user_id === FR); assert(me && me.status === "requested", "requested user sees own profile as requested"); }
  // 4. rotation: password older than 180 days forces the new-password screen
  { const st = {profiles: [mkProfile(JOE, "joe@example.com", "Joe", "admin", "active", {password_changed_at: new Date(Date.now() - 200 * 864e5).toISOString()})], docs: [], session: {user: {id: JOE, email: "joe@example.com"}}};
    const {w} = await boot(st); assert(w.document.querySelector("#hub-auth h1").textContent === "Set a new password", "stale password forces rotation"); }
  // 5. sign-up with confirmation off signs straight in and lands on the profile; with confirmation on shows the check-email notice
  { const st = {profiles: [mkProfile(JOE, "joe@example.com", "Joe", "admin", "active")], docs: [], session: null, autoconfirm: true};
    const {w} = await boot(st); const d = w.document; d.querySelector('#hub-auth [data-v="register"]').click(); await tick();
    d.querySelector("#a_name").value = "Friend"; d.querySelector("#a_email").value = "friend@example.com"; d.querySelector("#a_pw").value = "Longer-passw0rd!"; d.querySelector("#a_go").click(); await tick(); await tick(); await tick();
    assert(d.querySelector("#hub-auth").style.display === "none", "auto-confirmed sign-up goes straight in");
    const u = await w.claude.use("user"); assert((await u.me()).name === "Friend" && await u.isOwner() === false, "new account is a non-owner with its name"); }
  { const st = {profiles: [], docs: [], session: null, autoconfirm: false};
    const {w} = await boot(st); const d = w.document; d.querySelector('#hub-auth [data-v="register"]').click(); await tick();
    d.querySelector("#a_name").value = "Friend"; d.querySelector("#a_email").value = "friend@example.com"; d.querySelector("#a_pw").value = "Longer-passw0rd!"; d.querySelector("#a_go").click(); await tick(); await tick();
    assert(/Confirm it from the email/.test(d.querySelector("#hub-auth .ok")?.textContent || ""), "confirmation-on sign-up shows the check-email notice"); }
  // 6. guards
  { const {w} = await boot({profiles: [], docs: [], session: null}, {SUPABASE_URL: "https://YOUR-PROJECT.supabase.co", SUPABASE_ANON_KEY: "YOUR-ANON-KEY"}); assert(/not configured/.test(w.document.querySelector("#hub-auth h1").textContent), "placeholder config shows the configuration notice"); assert((await w.claude.use("db")) === null, "unconfigured db resolves null"); }
  console.log("ALL ADAPTER TESTS PASSED");
})().catch(e => { console.error("FAILED:", e.stack || e); process.exit(1); });
