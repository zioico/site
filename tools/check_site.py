#!/usr/bin/env python3
"""Check the actual publish directory, including links and image files."""
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = (ROOT / (sys.argv[1] if len(sys.argv) > 1 else 'dist')).resolve()
errors = []


class Page(HTMLParser):
    def __init__(self, filename):
        super().__init__(); self.filename = filename; self.h1 = 0; self.redirect = False

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'h1': self.h1 += 1
        if tag == 'meta' and attrs.get('http-equiv') == 'refresh': self.redirect = True
        for name in attrs:
            if name.startswith('on'): errors.append(f'{self.filename}: inline event handler {name}')
        values = [attrs[k] for k in ('src','href') if k in attrs]
        for value in values:
            parts = urlsplit(value)
            if parts.scheme or parts.netloc or not parts.path: continue
            path = (PUBLIC / unquote(parts.path).lstrip('/')) if parts.path.startswith('/') else self.filename.parent / unquote(parts.path)
            if not path.exists(): errors.append(f'{self.filename.relative_to(PUBLIC)}: missing {value}')
        if tag == 'img' and 'alt' not in attrs: errors.append(f'{self.filename}: photograph without alt attribute')


for filename in sorted(PUBLIC.rglob('*.html')):
    parser = Page(filename); text = filename.read_text(); parser.feed(text)
    if not parser.redirect and parser.h1 != 1: errors.append(f'{filename.relative_to(PUBLIC)}: expected one main heading, got {parser.h1}')
    if re.search(r'squarespace|sqspcdn|typekit|\bY\.use|\bsqs-', text, re.I): errors.append(f'{filename.relative_to(PUBLIC)}: legacy runtime reference')
for filename in [PUBLIC/'assets/site.css',PUBLIC/'assets/site.js']:
    text = filename.read_text()
    if re.search(r'squarespace|sqspcdn|typekit|\bY\.use|\bsqs-', text, re.I): errors.append(f'{filename.name}: legacy runtime reference')
for local in re.findall(r'url\([\'"]?([^\)\'\"]+)', (PUBLIC/'assets/site.css').read_text()):
    if not urlsplit(local).scheme and not (PUBLIC/'assets'/local).is_file(): errors.append('Missing stylesheet asset: '+local)
feed = json.loads((PUBLIC/'assets/instagram/feed.json').read_text())
if not isinstance(feed,list) or not feed: errors.append('Empty or invalid Instagram feed')
for post in feed:
    for media in [post] + post.get('children',[]):
        if not (PUBLIC/media['src']).is_file(): errors.append('Missing Instagram image: '+media['src'])
    link = urlsplit(post['href'])
    if link.scheme != 'https' or link.hostname not in ('www.instagram.com','instagram.com'): errors.append('Invalid Instagram permalink')
status = json.loads((PUBLIC/'assets/instagram/status.json').read_text())
if status['count'] != len(feed): errors.append('Instagram status count differs from feed')
if status['source'] == 'saved-selection':
    migration = json.loads((ROOT/'content/cache-migration.json').read_text())
    current = {p['src'] for p in feed}
    current.update(c['src'] for p in feed for c in p.get('children',[]))
    if current != set(migration['files']): errors.append('A photograph from the original Instagram cache was lost')
for forbidden in ['.private','content','templates','tools','.github','.git']:
    if (PUBLIC/forbidden).exists(): errors.append('Source or credential state included in publish directory: '+forbidden)
total = sum(p.stat().st_size for p in PUBLIC.rglob('*') if p.is_file())
if total > 950*1024*1024: errors.append('Publish directory approaches the GitHub Pages size limit')
if errors:
    print('\n'.join(errors));sys.exit(1)
print(f'PASS: {len(list(PUBLIC.rglob("*.html")))} HTML files, all local links and image files, {len(feed)} Instagram posts, no legacy runtime; {total/1024/1024:.1f} MB published.')
