#!/usr/bin/env python3
import re
from pathlib import Path

def read(p: str) -> str:
    return Path(p).read_text(encoding="utf-8", errors="ignore")

def write(p: str, s: str) -> None:
    Path(p).write_text(s, encoding="utf-8")

index = read("index.html")
insta = read("insta.html")

# Grab common <link> tags that likely define fonts + site css
head_bits = []
# preconnect/fonts/stylesheet
patterns = [
    r'<link[^>]+rel=["\']preconnect["\'][^>]*>',
    r'<link[^>]+href=["\'][^"\']*fonts[^"\']*["\'][^>]*>',
    r'<link[^>]+rel=["\']stylesheet["\'][^>]*>',
]
for pat in patterns:
    head_bits.extend(re.findall(pat, index, flags=re.IGNORECASE))

head_includes = "\n  ".join(dict.fromkeys(head_bits)).strip()

# Try to extract a header/nav block (best effort)
nav_block = ""
m = re.search(r'(<header\b.*?</header>)', index, flags=re.IGNORECASE | re.DOTALL)
if m:
    nav_block = m.group(1).strip()
else:
    m = re.search(r'(<nav\b.*?</nav>)', index, flags=re.IGNORECASE | re.DOTALL)
    if m:
        nav_block = m.group(1).strip()

def replace_block(html: str, name: str, content: str) -> str:
    pat = rf'<!-- BEGIN {name} -->.*?<!-- END {name} -->'
    rep = f'<!-- BEGIN {name} -->\n  {content}\n  <!-- END {name} -->' if content else f'<!-- BEGIN {name} -->\n  <!-- END {name} -->'
    return re.sub(pat, rep, html, flags=re.DOTALL)

insta = replace_block(insta, "SITE_HEAD_INCLUDES", head_includes)
insta = replace_block(insta, "SITE_NAV", nav_block)

write("insta.html", insta)
print("synced insta.html from index.html (head includes + nav/header)")
