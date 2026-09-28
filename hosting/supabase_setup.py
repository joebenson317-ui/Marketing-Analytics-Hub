#!/usr/bin/env python3
"""Set up the Hub's Supabase project through the Supabase Management API, so nobody has to click through the dashboard.

  setup     find or create the project, wait until it is healthy, run schema.sql, set the auth policy,
            print the project URL and anon key (also written to $GITHUB_OUTPUT and $GITHUB_STEP_SUMMARY when set)
  finalize  point Site URL and the redirect allow list at the deployed page (run after the deploy)

Environment:
  SUPABASE_ACCESS_TOKEN   personal access token from https://supabase.com/dashboard/account/tokens   (required)
  SUPABASE_PROJECT_NAME   project name to find or create                                             (default analytics-hub)
  SUPABASE_ORG_SLUG       organization slug when the account has more than one                       (default: the first)
  SUPABASE_REGION         region code for a new project                                              (default us-east-1)
  CONFIRM_EMAIL           "true" to require email confirmation on sign-up                            (default false, see README)
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SENDER_NAME, SMTP_ADMIN_EMAIL   optional custom SMTP for auth emails
API reference: https://api.supabase.com (OpenAPI spec: apps/docs/spec/api_v1_openapi.json in github.com/supabase/supabase).
"""
import argparse, json, os, pathlib, secrets, string, sys, time, urllib.error, urllib.request

API = os.environ.get("SUPABASE_API", "https://api.supabase.com").rstrip("/")
TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "").strip()
NAME = os.environ.get("SUPABASE_PROJECT_NAME", "analytics-hub").strip() or "analytics-hub"
# Strongest option of Supabase Auth's password_required_characters: lower case, upper case, digits and symbols.
STRONGEST = "abcdefghijklmnopqrstuvwxyz:ABCDEFGHIJKLMNOPQRSTUVWXYZ:0123456789:!@#$%^&*()_+-=[]{};'\\\\:\"|<>?,./`~"
HERE = pathlib.Path(__file__).resolve().parent


def call(method, path, body=None, soft=False):
    """Returns (status, json). Exits with the server's message on an error unless soft=True, which returns it instead."""
    data = json.dumps(body).encode() if body is not None else None
    for attempt in range(4):
        req = urllib.request.Request(API + path, data=data, method=method, headers={
            "Authorization": "Bearer " + TOKEN, "Content-Type": "application/json", "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                raw = r.read().decode()
                return r.status, (json.loads(raw) if raw.strip() else None)
        except urllib.error.HTTPError as e:
            raw = e.read().decode(errors="replace")
            if e.code == 429 and attempt < 3:
                time.sleep(5 * (attempt + 1)); continue
            if soft:
                try:
                    return e.code, json.loads(raw)
                except ValueError:
                    return e.code, {"message": raw[:600]}
            raise SystemExit(f"{method} {path} failed: HTTP {e.code}: {raw[:600]}")
        except urllib.error.URLError as e:
            if attempt < 3:
                time.sleep(3); continue
            raise SystemExit(f"{method} {path} failed: {e}")


def org_slug():
    _, orgs = call("GET", "/v1/organizations")
    orgs = orgs or []
    want = os.environ.get("SUPABASE_ORG_SLUG", "").strip()
    if want:
        if any(o.get("slug") == want for o in orgs):
            return want
        raise SystemExit(f"organization '{want}' not found; this token sees: {[o.get('slug') for o in orgs]}")
    if not orgs:
        raise SystemExit("this account has no organization yet; sign in once at https://supabase.com/dashboard to create the default one")
    return orgs[0]["slug"]


def find_project():
    _, projects = call("GET", "/v1/projects")
    live = [p for p in (projects or []) if p.get("name") == NAME and p.get("status") != "REMOVED"]
    return live[0] if live else None


def ensure_project():
    p = find_project()
    if p:
        print(f"project '{NAME}' exists: ref {p['ref']}, status {p.get('status')}, region {p.get('region')}")
        return p
    slug = org_slug()
    region = os.environ.get("SUPABASE_REGION", "us-east-1").strip() or "us-east-1"
    db_pass = "".join(secrets.choice(string.ascii_letters + string.digits) for _ in range(32))
    _, p = call("POST", "/v1/projects", {"name": NAME, "organization_slug": slug, "db_pass": db_pass,
                                          "region_selection": {"type": "specific", "code": region}})
    print(f"created project '{NAME}': ref {p['ref']} in {region} under organization {slug}. "
          "The database password was generated and not kept; reset it under Project Settings > Database if direct access is ever needed.")
    return p


def wait_healthy(ref, minutes=10):
    deadline = time.time() + minutes * 60
    last = None
    while time.time() < deadline:
        _, p = call("GET", f"/v1/projects/{ref}")
        st = p.get("status")
        if st != last:
            print("project status:", st); last = st
        if st in ("INIT_FAILED", "RESTORE_FAILED", "REMOVED"):
            raise SystemExit(f"project cannot be used: status {st}")
        if st == "ACTIVE_HEALTHY":
            try:
                _, h = call("GET", f"/v1/projects/{ref}/health?services=auth,db,rest")
                bad = [x.get("name") for x in (h or []) if not x.get("healthy")]
                if not bad:
                    return p
                print("waiting for services:", bad)
            except SystemExit as e:
                print("health check unavailable, continuing:", e)
                return p
        time.sleep(int(os.environ.get("SUPABASE_POLL_SECONDS", "15")))
    raise SystemExit("project did not become healthy in time; re-run the workflow in a few minutes")


def run_schema(ref):
    sql = (HERE / "schema.sql").read_text(encoding="utf-8")
    code, _ = call("POST", f"/v1/projects/{ref}/database/query", {"query": sql})
    print(f"schema.sql applied (HTTP {code})")


def allow_list(site_url):
    site = site_url.rstrip("/") + "/"
    items = [site, site + "**", site.lower(), site.lower() + "**"]
    return ",".join(dict.fromkeys(items))


def configure_auth(ref, site_url, full=True):
    body = {"site_url": site_url, "uri_allow_list": allow_list(site_url)}
    if full:
        body.update({"password_min_length": 10, "password_required_characters": STRONGEST,
                     "mailer_autoconfirm": os.environ.get("CONFIRM_EMAIL", "false").strip().lower() != "true",
                     "external_email_enabled": True, "disable_signup": False})
        if os.environ.get("SMTP_HOST", "").strip():
            body.update({"smtp_host": os.environ["SMTP_HOST"].strip(), "smtp_port": os.environ.get("SMTP_PORT", "587").strip(),
                         "smtp_user": os.environ.get("SMTP_USER", ""), "smtp_pass": os.environ.get("SMTP_PASS", ""),
                         "smtp_sender_name": os.environ.get("SMTP_SENDER_NAME", "Analytics Hub"),
                         "smtp_admin_email": os.environ.get("SMTP_ADMIN_EMAIL", "")})
    code, cfg = call("PATCH", f"/v1/projects/{ref}/config/auth", body, soft=True)
    if code == 400 and body.get("password_required_characters") == STRONGEST and "password_required_characters" in json.dumps(cfg):
        # the published spec doubles the backslash inside this enum value; fall back to the single-backslash spelling
        body["password_required_characters"] = STRONGEST.replace("\\\\", "\\")
        code, cfg = call("PATCH", f"/v1/projects/{ref}/config/auth", body, soft=True)
    if code >= 400:
        raise SystemExit(f"PATCH /v1/projects/{ref}/config/auth failed: HTTP {code}: {json.dumps(cfg)[:600]}")
    cfg = cfg or {}
    print("auth config:", json.dumps({k: cfg.get(k) for k in ("site_url", "password_min_length", "mailer_autoconfirm", "disable_signup", "smtp_host")}))


def anon_key(ref):
    _, keys = call("GET", f"/v1/projects/{ref}/api-keys?reveal=true")
    keys = keys or []
    for pick in (lambda k: k.get("name") == "anon", lambda k: k.get("type") == "publishable"):
        for k in keys:
            if pick(k) and k.get("api_key"):
                return k["api_key"], k.get("name")
    raise SystemExit("no anon or publishable API key was returned for the project")


def emit(**kv):
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            for k, v in kv.items():
                f.write(f"{k}={v}\n")
    summ = os.environ.get("GITHUB_STEP_SUMMARY")
    if summ:
        with open(summ, "a", encoding="utf-8") as f:
            f.write("### Supabase\n\n" + "\n".join(f"- **{k}**: `{v}`" for k, v in kv.items() if k != "anon_key") + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["setup", "finalize"])
    ap.add_argument("--site-url", required=True, help="the page URL, e.g. https://owner.github.io/repo/")
    a = ap.parse_args()
    if not TOKEN:
        raise SystemExit("SUPABASE_ACCESS_TOKEN is not set")
    if a.mode == "setup":
        p = ensure_project()
        p = wait_healthy(p["ref"])
        run_schema(p["ref"])
        configure_auth(p["ref"], a.site_url, full=True)
        key, kind = anon_key(p["ref"])
        url = f"https://{p['ref']}.supabase.co"
        print(f"project url {url}; browser key '{kind}' retrieved")
        emit(ref=p["ref"], url=url, anon_key=key)
    else:
        p = find_project()
        if not p:
            raise SystemExit(f"project '{NAME}' not found")
        configure_auth(p["ref"], a.site_url, full=False)
        emit(ref=p["ref"], site_url=a.site_url)


if __name__ == "__main__":
    main()
