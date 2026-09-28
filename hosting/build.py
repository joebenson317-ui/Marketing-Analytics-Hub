#!/usr/bin/env python3
"""Assemble hosting/dist/index.html: the unchanged Hub page with the Supabase adapter loaded first."""
import pathlib, re, shutil
root = pathlib.Path(__file__).resolve().parent.parent
page = (root / "app" / "analytics-hub.html").read_text()
adapter = (root / "hosting" / "adapter.js").read_text()
cfg = root / "hosting" / "config.js"
if not cfg.exists():
    raise SystemExit("hosting/config.js is missing — copy config.example.js and fill it in")
head_inject = ('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>'
               '<script>' + cfg.read_text() + '</script><script>' + adapter + '</script>')
i = page.index('<head>')
out = page[:i + 6] + head_inject + page[i + 6:]
dist = root / "hosting" / "dist"; dist.mkdir(exist_ok=True)
(dist / "index.html").write_text(out)
print("wrote", dist / "index.html", len(out), "bytes")
