#!/usr/bin/env python3
# Converts Squarespace lazy attrs (data-src, data-srcset, data-image) to real src/srcset
# and injects a small JS for non-<img> elements that use data-image as background.

import re
from pathlib import Path

ROOT = Path(".")

def httpsify(u: str) -> str:
    # //cdn -> https://cdn, and http:// -> https://
    u = re.sub(r'^//', 'https://', u)
    u = re.sub(r'^http://', 'https://', u)
    return u

def fix_srcset(val: str) -> str:
    parts = []
    for piece in val.split(','):
        piece = piece.strip()
        if not piece:
            continue
        if ' ' in piece:
            url, rest = piece.split(' ', 1)
            parts.append(httpsify(url) + ' ' + rest.strip())
        else:
            parts.append(httpsify(piece))
    return ', '.join(parts)

for html in ROOT.rglob("*.html"):
    txt = html.read_text(encoding="utf-8", errors="ignore")
    orig = txt

    # IMG: data-src -> src
    txt = re.sub(
        r'(<img\b[^>]*?)\sdata-src=(["\'])([^"\']+)\2',
        lambda m: f'{m.group(1)} src="{httpsify(m.group(3))}"',
        txt, flags=re.I
    )

    # IMG: data-srcset -> srcset
    txt = re.sub(
        r'(<img\b[^>]*?)\sdata-srcset=(["\'])([^"\']+)\2',
        lambda m: f'{m.group(1)} srcset="{fix_srcset(m.group(3))}"',
        txt, flags=re.I
    )

    # IMG: data-image -> src (some pages use this instead of data-src)
    txt = re.sub(
        r'(<img\b[^>]*?)\sdata-image=(["\'])([^"\']+)\2',
        lambda m: f'{m.group(1)} src="{httpsify(m.group(3))}"',
        txt, flags=re.I
    )

    # Ensure our helper JS is referenced before </body>
    if 'assets/fix-bg.js' not in txt:
        txt = re.sub(r'</body>', '<script src="assets/fix-bg.js"></script>\n</body>', txt, flags=re.I)

    if txt != orig:
        html.write_text(txt, encoding="utf-8")
        print(f"rewrote: {html}")

# Also write the background-image helper (for non-<img> elements that carry data-image)
assets = ROOT / "assets"
assets.mkdir(exist_ok=True)
(assets / "fix-bg.js").write_text(
    """document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('[data-image]:not(img)').forEach(function(el){
    var u = el.getAttribute('data-image');
    if(!u) return;
    if(u.slice(0,2)==='//') u='https:'+u;
    if(u.slice(0,5)==='http:') u=u.replace(/^http:/,'https:');
    if(getComputedStyle(el).backgroundImage==='none' || !getComputedStyle(el).backgroundImage){
      el.style.backgroundImage='url(\"'+u+'\")';
    }
  });
});""",
    encoding="utf-8"
)

print("Done. If images still don’t show, hard-refresh the page (Cmd-Shift-R).")

