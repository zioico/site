#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path
from datetime import datetime, timezone

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp"}

def iso_utc(ts: float) -> str:
    return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat().replace("+00:00", "Z")

def shortcode_from_filename(p: Path) -> str:
    # Instaloader sidecars often: SHORTCODE_1.jpg, SHORTCODE_2.jpg
    stem = p.stem
    return stem.split("_")[0]

def build_items(files, site_root: Path, handle: str, format_mode: str):
    items = []
    for f in files:
        st = f.stat()
        rel = f.relative_to(site_root).as_posix()  # e.g. assets/instagram/ABC.jpg
        sc = shortcode_from_filename(f)
        href = f"https://www.instagram.com/p/{sc}/"
        if format_mode == "strings":
            items.append(rel)
        else:
            items.append({
                "shortcode": sc,
                "href": href,
                "url": href,
                "src": rel,
                "image": rel,
                "file": f.name,
                "timestamp": iso_utc(st.st_mtime),
                "handle": handle,
            })
    return items

def scan_images(scan_dir: Path):
    files = []
    for p in scan_dir.rglob("*"):
        if p.is_file() and p.suffix.lower() in IMG_EXTS:
            files.append(p)
    # newest first
    files.sort(key=lambda x: x.stat().st_mtime, reverse=True)
    return files

def main():
    ap = argparse.ArgumentParser(
        description="Generate assets/instagram/feed.json from local cached images (and optionally download via Instaloader)."
    )
    ap.add_argument("--handle", default="zioico", help="Instagram handle (used for href + optional download dir)")
    ap.add_argument("--site-root", default=".", help="Site root (where insta.html and assets/ live)")
    ap.add_argument("--assets-dir", default="assets/instagram", help="Instagram assets directory")
    ap.add_argument("--out", default="assets/instagram/feed.json", help="Output JSON path")
    ap.add_argument("--max-posts", type=int, default=60, help="How many items to write")
    ap.add_argument("--format", choices=["objects","strings"], default="objects",
                    help="JSON format. 'objects' is richer; 'strings' is just a list of image paths.")
    ap.add_argument("--local-only", action="store_true", help="Only scan local cache; do not attempt Instagram download")
    ap.add_argument("--download", action="store_true", help="Attempt to download recent posts using instaloader")
    ap.add_argument("--login-user", default=None, help="Instagram login username (often required). Password will be prompted.")
    args = ap.parse_args()

    site_root = Path(args.site_root).resolve()
    assets_dir = (site_root / args.assets_dir).resolve()
    out_path = (site_root / args.out).resolve()

    assets_dir.mkdir(parents=True, exist_ok=True)

    # Optional download step (writes into assets/instagram/<handle>/)
    handle_dir = assets_dir / args.handle
    if args.download and not args.local_only:
        try:
            import instaloader
            import getpass

            L = instaloader.Instaloader(
                dirname_pattern=str(assets_dir / "{target}"),
                filename_pattern="{shortcode}",
                download_pictures=True,
                download_videos=False,
                download_video_thumbnails=False,
                save_metadata=False,
                compress_json=False,
                post_metadata_txt_pattern="",
                quiet=False,
                max_connection_attempts=3,
            )

            if args.login_user:
                pw = getpass.getpass(f"Instagram password for {args.login_user}: ")
                L.login(args.login_user, pw)

            profile = instaloader.Profile.from_username(L.context, args.handle)

            n = 0
            for post in profile.get_posts():
                if n >= args.max_posts:
                    break
                # This will download into assets/instagram/<handle>/
                L.download_post(post, target=args.handle)
                n += 1

            print(f"Downloaded (attempted) {n} posts into: {handle_dir}")
        except Exception as e:
            print(f"[download skipped/failed] {e}")

    # Scan directory preference: use handle subdir if present + non-empty; else scan assets_dir root
    scan_dir = handle_dir if handle_dir.exists() and any(handle_dir.iterdir()) else assets_dir

    files = scan_images(scan_dir)
    files = files[: max(args.max_posts, 0)]

    items = build_items(files, site_root=site_root, handle=args.handle, format_mode=args.format)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = out_path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(items, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(out_path)

    print(f"Wrote {len(items)} items to {out_path}")
    if len(items):
        print("First item:", items[0])

if __name__ == "__main__":
    main()
