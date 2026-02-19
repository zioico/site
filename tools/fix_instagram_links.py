#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path
from urllib.parse import urlparse

PROFILE = "https://www.instagram.com/zioico/"
OLD_HANDLE = "federicoienna"

# Find instagram URLs inside quotes (HTML attributes, JSON blobs, etc.)
RE_QUOTED_IG = re.compile(
    r'(?P<q>["\'])'
    r'(?P<url>(?:https?:)?//(?:www\.)?instagram\.com[^"\']*)'
    r'(?P=q)',
    re.IGNORECASE,
)

# Also catch bare "www.instagram.com" or "instagram.com" inside quotes
RE_QUOTED_BARE = re.compile(
    r'(?P<q>["\'])'
    r'(?P<url>(?:www\.)?instagram\.com(?:/[^"\']*)?)'
    r'(?P=q)',
    re.IGNORECASE,
)

def _canonicalize(url: str) -> str:
    u = url.strip()

    if u.startswith("//"):
        u = "https:" + u
    elif u.lower().startswith("http:"):
        u = "https:" + u[5:]
    elif re.match(r"^(www\.)?instagram\.com", u, flags=re.IGNORECASE):
        u = "https://" + u

    return u

def _should_replace_to_profile(parsed) -> bool:
    path = (parsed.path or "").rstrip("/")
    low = path.lower()

    if low in ("", "/"):
        return True

    # Keep post-level links intact
    if low.startswith("/p/") or low.startswith("/reel/") or low.startswith("/tv/"):
        return False

    # Replace old handle and new handle profile links
    if low == f"/{OLD_HANDLE}".lower():
        return True
    if low == "/zioico":
        return True

    # Sometimes exports contain /instagram (generic)
    if low == "/instagram":
        return True

    return False

def _rewrite(url: str) -> str:
    u = _canonicalize(url)
    p = urlparse(u)

    if "instagram.com" not in (p.netloc or "").lower():
        return url

    if (p.path or "").lower().startswith(f"/{OLD_HANDLE}".lower()):
        return PROFILE

    if _should_replace_to_profile(p):
        return PROFILE

    return u

def rewrite_file(fp: Path) -> bool:
    txt = fp.read_text(encoding="utf-8", errors="ignore")
    orig = txt

    def subber(m):
        q = m.group("q")
        url = m.group("url")
        new = _rewrite(url)
        return f"{q}{new}{q}"

    txt = RE_QUOTED_IG.sub(subber, txt)
    txt = RE_QUOTED_BARE.sub(subber, txt)

    if txt != orig:
        fp.write_text(txt, encoding="utf-8")
        return True
    return False

def main() -> None:
    root = Path(".").resolve()
    html_files = list(root.rglob("*.html"))

    changed = []
    for fp in html_files:
        if rewrite_file(fp):
            changed.append(fp.relative_to(root))

    print(f"Scanned {len(html_files)} HTML files.")
    print(f"Updated {len(changed)} files.")
    for c in changed[:50]:
        print(f"  - {c}")
    if len(changed) > 50:
        print(f"  ... and {len(changed)-50} more")

if __name__ == "__main__":
    main()
