#!/usr/bin/env python3
"""Runs hosting/supabase_setup.py against an in-process fake of the Supabase Management API. Usage: python3 hosting/test/supabase_setup.test.py"""
import json, os, pathlib, subprocess, sys, tempfile, threading
from http.server import BaseHTTPRequestHandler, HTTPServer

HERE = pathlib.Path(__file__).resolve().parent
REF = "abcdefghijklmnopqrst"
STATE = {"projects": [], "polls": 0, "queries": [], "auth": {}, "patches": [], "reject_double_backslash": False}


class Fake(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(data))); self.end_headers(); self.wfile.write(data)

    def _body(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"null")

    def do_GET(self):
        if self.headers.get("Authorization") != "Bearer test-token":
            return self._send(401, {"message": "Unauthorized"})
        if self.path == "/v1/organizations":
            return self._send(200, [{"id": "x", "slug": "my-org", "name": "My Org"}])
        if self.path == "/v1/projects":
            return self._send(200, STATE["projects"])
        if self.path == f"/v1/projects/{REF}":
            STATE["polls"] += 1
            p = STATE["projects"][0]; p["status"] = "COMING_UP" if STATE["polls"] < 2 else "ACTIVE_HEALTHY"
            return self._send(200, p)
        if self.path.startswith(f"/v1/projects/{REF}/health"):
            return self._send(200, [{"name": "auth", "healthy": True}, {"name": "db", "healthy": True}, {"name": "rest", "healthy": True}])
        if self.path.startswith(f"/v1/projects/{REF}/api-keys"):
            reveal = "reveal=true" in self.path
            return self._send(200, [{"name": "anon", "type": "legacy", "api_key": "eyJanon" if reveal else None},
                                    {"name": "service_role", "type": "legacy", "api_key": "eyJservice" if reveal else None},
                                    {"name": "default", "type": "publishable", "api_key": "sb_publishable_x"}])
        self._send(404, {"message": "not found: " + self.path})

    def do_POST(self):
        b = self._body()
        if self.path == "/v1/projects":
            assert b["organization_slug"] == "my-org" and b["name"] == "analytics-hub" and len(b["db_pass"]) >= 16
            assert b["region_selection"] == {"type": "specific", "code": "us-east-1"}
            p = {"id": REF, "ref": REF, "name": b["name"], "organization_slug": "my-org", "region": "us-east-1", "status": "COMING_UP"}
            STATE["projects"].append(p); return self._send(201, p)
        if self.path == f"/v1/projects/{REF}/database/query":
            STATE["queries"].append(b["query"]); return self._send(201, [])
        self._send(404, {"message": "nf"})

    def do_PATCH(self):
        b = self._body()
        if self.path == f"/v1/projects/{REF}/config/auth":
            STATE["patches"].append(b)
            if STATE["reject_double_backslash"] and "\\\\" in (b.get("password_required_characters") or ""):
                return self._send(400, {"message": "password_required_characters must be one of the following values: ..."})
            STATE["auth"].update(b); return self._send(200, STATE["auth"])
        self._send(404, {"message": "nf"})


srv = HTTPServer(("127.0.0.1", 0), Fake); PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()


def run(mode, site, extra=None):
    out = tempfile.NamedTemporaryFile("w+", delete=False, suffix=".out"); out.close()
    summ = tempfile.NamedTemporaryFile("w+", delete=False, suffix=".md"); summ.close()
    env = {**os.environ, "SUPABASE_API": f"http://127.0.0.1:{PORT}", "SUPABASE_ACCESS_TOKEN": "test-token", "SUPABASE_POLL_SECONDS": "0",
           "GITHUB_OUTPUT": out.name, "GITHUB_STEP_SUMMARY": summ.name, **(extra or {})}
    for k in ("SUPABASE_PROJECT_NAME", "SUPABASE_ORG_SLUG", "SUPABASE_REGION", "CONFIRM_EMAIL", "SMTP_HOST"):
        env.setdefault(k, "")
    r = subprocess.run([sys.executable, str(HERE.parent / "supabase_setup.py"), mode, "--site-url", site], env=env, capture_output=True, text=True)
    return r, open(out.name).read(), open(summ.name).read()


def ok(cond, msg):
    if not cond:
        raise SystemExit("ASSERT " + msg)
    print("ok  ", msg)


SITE = "https://joebenson317-ui.github.io/Marketing-Analytics-Hub/"
r, out, summ = run("setup", SITE)
ok(r.returncode == 0, "fresh setup exits 0" + ("" if r.returncode == 0 else ": " + r.stdout + r.stderr))
ok(len(STATE["projects"]) == 1 and STATE["polls"] >= 2, "project created and polled until healthy")
ok("create table if not exists public.profiles" in STATE["queries"][0], "schema.sql was sent to the query endpoint")
ok(f"url=https://{REF}.supabase.co" in out and "anon_key=eyJanon" in out and f"ref={REF}" in out, "outputs carry ref, url and the anon key")
ok("eyJanon" not in summ and REF in summ, "job summary shows the ref but not the key")
a = STATE["auth"]
ok(a["site_url"] == SITE and "**" in a["uri_allow_list"] and SITE.lower() in a["uri_allow_list"], "site url and wildcard allow list set")
ok(a["password_min_length"] == 10 and "!" in a["password_required_characters"] and a["mailer_autoconfirm"] is True and a["disable_signup"] is False and a["external_email_enabled"] is True, "password policy, open sign-up and no email confirmation by default")

r, out, _ = run("setup", SITE)
ok(r.returncode == 0 and len(STATE["projects"]) == 1, "second setup reuses the existing project")

r, out, _ = run("setup", SITE, {"CONFIRM_EMAIL": "true"})
ok(r.returncode == 0 and STATE["auth"]["mailer_autoconfirm"] is False, "CONFIRM_EMAIL=true turns confirmation on")

r, out, _ = run("setup", SITE, {"SMTP_HOST": "smtp.example.com", "SMTP_PORT": "587", "SMTP_USER": "u", "SMTP_PASS": "p", "SMTP_SENDER_NAME": "Hub", "SMTP_ADMIN_EMAIL": "ops@example.com"})
ok(r.returncode == 0 and STATE["auth"].get("smtp_host") == "smtp.example.com" and STATE["auth"].get("smtp_admin_email") == "ops@example.com", "custom SMTP settings are passed through")

STATE["reject_double_backslash"] = True
r, out, _ = run("setup", SITE)
ok(r.returncode == 0 and "\\\\" not in STATE["auth"]["password_required_characters"] and "!" in STATE["auth"]["password_required_characters"], "enum spelling falls back when the server rejects the doubled backslash")
STATE["reject_double_backslash"] = False

n = len(STATE["patches"])
r, out, _ = run("finalize", "https://hub.example.com/")
ok(r.returncode == 0 and STATE["auth"]["site_url"] == "https://hub.example.com/" and "password_min_length" not in STATE["patches"][-1] and len(STATE["patches"]) == n + 1, "finalize only moves the site url and allow list")

r, out, _ = run("setup", SITE, {"SUPABASE_ACCESS_TOKEN": "wrong"})
ok(r.returncode != 0 and "HTTP 401" in (r.stdout + r.stderr), "a bad token fails with the server's status")

r, out, _ = run("setup", SITE, {"SUPABASE_ORG_SLUG": "other-org", "SUPABASE_PROJECT_NAME": "another-project"})
ok(r.returncode != 0 and "other-org" in (r.stdout + r.stderr), "an unknown organization slug is reported")
print("ALL SUPABASE SETUP TESTS PASSED")
