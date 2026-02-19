#!/usr/bin/env python3
from __future__ import annotations
import argparse
import re
from pathlib import Path

SKIP_DIRS = {".git", "node_modules", ".DS_Store"}

def fix_text(text: str, handle: str) -> str:
    # Normalize double-protocol accidents
    text = text.replace("https://https://", "https://")
    text = text.replace("http://https://", "https://")
    text = text.replace("https://https//", "https://")  # missing colon variant
    text = re.sub(r"https?://https?//", "https://", text)

    # Fix broken post URLs like:
    # https://https://www.instagram.com/federicoienna/federicoienna/p/XXXX/
    # -> https://www.instagram.com/p/XXXX/
    text = re.sub(
        r"https?://(www\.)?instagram\.com/(?:[A-Za-z0-9_.-]+/)+p/",
        "https://www.instagram.com/p/",
        text,
        flags=re.IGNORECASE,
    )

    # Replace any remaining old-handle profile links with the new handle
    text = re.sub(
        r"https?://(www\.)?instagram\.com/federicoienna/?",
        f"https://www.instagram.com/{handle}/",
        text,
        flags=re.IGNORECASE,
    )

    # Fix repeated handle chains in profileUrl etc:
    # https://www.instagram.com/federicoienna/federicoienna/federicoienna -> https://www.instagram.com/zioico/
    text = re.sub(
        r"https?://(www\.)?instagram\.com/(?:[A-Za-z0-9_.-]+/){2,}",
        f"https://www.instagram.com/{handle}/",
        text,
        flags=re.IGNORECASE,
    )

    return text

def should_skip(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("root", nargs="?", default=".", help="Repo root")
    ap.add_argument("--handle", default="zioico", help="New Instagram handle (no URL)")
    args = ap.parse_args()

    root = Path(args.root).resolve()
    exts = {".html", ".css", ".js", ".json", ".xml", ".txt"}

    changed = 0
    for p in root.rglob("*"):
        if p.is_dir() or should_skip(p) or p.suffix.lower() not in exts:
            continue
        try:
            old = p.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        if "instagram" not in old.lower():
            continue

        new = fix_text(old, args.handle)
        if new != old:
            p.write_text(new, encoding="utf-8")
            changed += 1
            print(f"fixed: {p.relative_to(root)}")

    print(f"\nDone. Files changed: {changed}")

if __name__ == "__main__":
    main()
