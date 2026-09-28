#!/usr/bin/env python3
"""Assemble hosting/dist/: the unchanged Hub page with supabase-js, the deployment config and the adapter loaded first.

Config comes from hosting/config.js when it exists (local builds), otherwise from the environment
(SUPABASE_URL, SUPABASE_ANON_KEY, optional ACCOUNT_NAME), which is how the GitHub Actions workflow builds it.
"""
import json, os, pathlib, shutil

root = pathlib.Path(__file__).resolve().parent.parent
hosting = root / "hosting"
page = (root / "app" / "analytics-hub.html").read_text(encoding="utf-8")
adapter = (hosting / "adapter.js").read_text(encoding="utf-8")
vendor = hosting / "vendor" / "supabase.js"
if not vendor.exists():
    raise SystemExit("hosting/vendor/supabase.js is missing")

cfg_file = hosting / "config.js"
if cfg_file.exists():
    cfg = cfg_file.read_text(encoding="utf-8")
else:
    url, key = os.environ.get("SUPABASE_URL", "").strip(), os.environ.get("SUPABASE_ANON_KEY", "").strip()
    if not (url and key):
        raise SystemExit("Set SUPABASE_URL and SUPABASE_ANON_KEY (or create hosting/config.js from config.example.js)")
    cfg = "window.HUB_CONFIG = " + json.dumps({
        "SUPABASE_URL": url,
        "SUPABASE_ANON_KEY": key,
        "ACCOUNT_NAME": os.environ.get("ACCOUNT_NAME", "").strip() or "Analytics Hub",
    }) + ";"
for blob, name in ((cfg, "config"), (adapter, "adapter")):
    if "</script" in blob.lower():
        raise SystemExit(f"{name} contains a closing script tag and cannot be inlined")

inject = ('<script src="./vendor/supabase.js"></script>'
          '<script>' + cfg + '</script>'
          '<script>' + adapter + '</script>')
i = page.index("<head>") + len("<head>")
out = page[:i] + inject + page[i:]

dist = hosting / "dist"
if dist.exists():
    shutil.rmtree(dist)
(dist / "vendor").mkdir(parents=True)
(dist / "index.html").write_text(out, encoding="utf-8")
shutil.copyfile(vendor, dist / "vendor" / "supabase.js")
(dist / ".nojekyll").write_text("")
print("wrote", dist / "index.html", len(out.encode("utf-8")), "bytes; vendor/supabase.js", vendor.stat().st_size, "bytes")
