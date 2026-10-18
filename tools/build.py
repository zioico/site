#!/usr/bin/env python3
"""Render the static website. Python 3 only; no packages or framework required."""
import argparse
from datetime import datetime, timezone
from html import escape
import json
from pathlib import Path
import shutil
from string import Template

ROOT = Path(__file__).resolve().parents[1]
SITE = json.loads((ROOT / 'content/site.json').read_text())
PAGES = {p['slug']: p for p in SITE['pages'] if p.get('published', True)}
TEMPLATE = Template((ROOT / 'templates/base.html').read_text())


def image(item, eager=False):
    size = f' width="{item["width"]}" height="{item["height"]}"' if item.get('width') and item.get('height') else ''
    priority = ' loading="eager" fetchpriority="high"' if eager else ' loading="lazy"'
    return f'<img src="/{escape(item["src"], quote=True)}" alt="{escape(item.get("alt", ""), quote=True)}"{size}{priority} decoding="async">'


def block(page, index):
    return (ROOT / 'content/pages' / page['blocks'][index]).read_text()


def gallery(page, home=False):
    photos = page['images']
    slides = '\n'.join(f'<figure class="slide"{ " hidden" if i else ""}>{image(p, i == 0)}</figure>' for i, p in enumerate(photos))
    dots = ''.join(f'<button class="gallery-dot" aria-label="Photograph {i+1} of {len(photos)}" aria-current="{str(i == 0).lower()}"></button>' for i in range(len(photos)))
    autoplay = ' data-autoplay="true"' if home else ''
    pause = '<button class="gallery-pause" aria-pressed="false">Pause slideshow</button>' if home else ''
    links = ''.join(f'<li><a href="/{escape(p["src"])}">Photograph {i+1}</a></li>' for i, p in enumerate(photos))
    return f'''<section class="gallery" aria-label="{escape(page['title'])} photographs" aria-roledescription="carousel" tabindex="0"{autoplay}>
      <div class="gallery-stage">{slides}
        <button class="gallery-arrow previous" aria-label="Previous photograph">‹</button>
        <button class="gallery-arrow next" aria-label="Next photograph">›</button>
      </div>
      <div class="gallery-controls"><div class="gallery-dots" aria-label="Choose a photograph">{dots}</div>{pause}</div>
      <p class="sr-only gallery-status" aria-live="polite" aria-atomic="true">Photograph 1 of {len(photos)}</p>
      <noscript><p>Open individual photographs:</p><ol>{links}</ol></noscript>
    </section>'''


def navigation(active):
    def link(slug, label):
        current = ' aria-current="page"' if active == slug else ''
        return f'<a href="/{slug}.html"{current}>{escape(label)}</a>'
    projects = ''.join(f'<li>{link(s, PAGES[s]["title"])}</li>' for s in SITE['projects'])
    words = f'<li>{link("words", "Words")}</li>' if 'words' in PAGES else ''
    return f'''<ul>
      <li>{link('index', 'Home')}</li>
      <li class="projects-menu"><details><summary{' class="active"' if active in SITE['projects'] else ''}>Projects</summary><ul>{projects}</ul></details></li>
      <li>{link('insta', 'Instagram Feed')}</li>{words}
      <li>{link('albums', 'Short Film')}</li><li>{link('about', 'About')}</li>
    </ul>'''


def instagram():
    posts = json.loads((ROOT / 'assets/instagram/feed.json').read_text())
    status = json.loads((ROOT / 'assets/instagram/status.json').read_text())
    if status.get('last_success'):
        date = datetime.fromisoformat(status['last_success'].replace('Z', '+00:00'))
        label = 'Updated ' + date.strftime('%d %B %Y at %H:%M UTC').lstrip('0')
    else:
        latest = datetime.fromisoformat(status['latest_post'].replace('Z', '+00:00'))
        label = 'Saved selection · Latest post ' + latest.strftime('%d %B %Y').lstrip('0')
    cards = []
    for i, post in enumerate(posts):
        title = post.get('caption') or f'Instagram photograph {i+1}'
        media_type = post.get('media_type', 'IMAGE')
        badge = '<span class="post-badge" aria-hidden="true">' + ('Reel' if post.get('media_product_type') == 'REELS' else 'Video') + '</span>' if media_type == 'VIDEO' else '<span class="post-badge" aria-hidden="true">Album</span>' if media_type == 'CAROUSEL_ALBUM' else ''
        cards.append(f'<a class="instagram-post" href="{escape(post["href"], quote=True)}" data-post-index="{i}" data-media-type="{media_type}" target="_blank" rel="noopener noreferrer" aria-label="{escape(title[:180], quote=True)}"><img src="/{escape(post["src"])}" alt="{escape(title[:180], quote=True)}" loading="lazy" decoding="async" width="600" height="600">{badge}</a>')
    return f'''<section class="instagram-feed" aria-labelledby="instagram-heading">
      <div class="instagram-heading"><div><h1 id="instagram-heading">Instagram</h1><a class="instagram-handle" href="https://www.instagram.com/{SITE['instagram']}/" target="_blank" rel="noopener noreferrer">@{SITE['instagram']}</a></div><p class="feed-status">{label}</p></div>
      <div class="feed-filters" aria-label="Filter Instagram posts" hidden><button data-filter="all" aria-pressed="true">All posts</button><button data-filter="photos" aria-pressed="false">Photographs</button><button data-filter="reels" aria-pressed="false">Video &amp; reels</button></div>
      <div class="instagram-grid">{''.join(cards)}</div>
      <p class="feed-empty" hidden>No posts in this selection.</p>
      <button class="load-more" hidden>More photographs</button>
      <p class="instagram-follow"><a href="https://www.instagram.com/{SITE['instagram']}/" target="_blank" rel="noopener noreferrer">View posts, stories, and highlights on Instagram</a></p>
    </section>'''


def content(page):
    slug = page['slug']
    if slug == 'index':
        return '<h1 class="sr-only">Photography by ' + escape(SITE['name']) + '</h1>' + gallery(page, home=True)
    if slug in SITE['projects']:
        title = '<div class="project-heading">' + block(page, 0).replace('<h2', '<h1').replace('</h2>', '</h1>') + '</div>'
        text = '<div class="project-text">' + block(page, 1) + '</div>'
        extra = ''
        if page.get('detail_images'):
            extra = '<div class="book-details">' + ''.join(image(p) for p in page['detail_images']) + '</div>'
            if len(page['blocks']) > 2:
                extra += '<div class="project-text">' + block(page, 2) + '</div>'
        return title + gallery(page) + text + extra
    if slug == 'about':
        return '<h1 class="sr-only">About</h1><section class="about-layout"><div class="about-portraits"><figure>' + image(page['images'][0], True) + '<figcaption>Photo credit: Julia Dickow</figcaption></figure>' + image(page['images'][1]) + '</div><div class="prose">' + ''.join(block(page, i) for i in range(len(page['blocks']))) + '</div></section>'
    if slug == 'albums':
        return '<section class="film-page"><div class="project-heading">' + block(page, 0).replace('<h2', '<h1').replace('</h2>', '</h1>') + '</div><div class="film-player"><iframe src="https://player.vimeo.com/video/367898129?dnt=1" title="Event Horizon — short film by Federico Ienna" loading="lazy" allow="fullscreen; picture-in-picture" allowfullscreen></iframe></div><div class="film-credits">' + block(page, 1) + '</div><p class="text-center"><a href="https://vimeo.com/367898129">Watch Event Horizon on Vimeo</a></p></section>'
    if slug == 'words':
        return '<article class="prose words"><time datetime="2019-06-29">29 June 2019</time><h1>A Basic Question</h1>' + block(page, 0) + '</article>'
    raise ValueError('No page renderer configured for ' + slug)


def render(slug, title, html, photo=None):
    description = 'Photography, personal projects, and visual stories by ' + SITE['name'] + '.'
    if slug != 'index': description = title + ' — ' + description
    return TEMPLATE.substitute(title=escape(title if slug == 'index' else title + ' — ' + SITE['name']),
        description=escape(description, quote=True), canonical=SITE['url'] + ('/' if slug == 'index' else '/' + slug + '.html'),
        social_image=SITE['url'] + '/' + (photo or PAGES['index']['images'][0]['src']),
        body_class='home' if slug == 'index' else escape(slug), name=escape(SITE['name']),
        instagram=SITE['instagram'], navigation=navigation(slug), content=html)


def build(destination):
    if destination not in (ROOT, ROOT / 'dist'):
        raise ValueError('Build output must be the repository root or its generated dist folder.')
    if destination == ROOT / 'dist' and destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True, exist_ok=True)
    # Remove previously generated routes for pages kept only as unpublished source.
    for page in SITE['pages']:
        if not page.get('published', True):
            (destination / (page['slug'] + '.html')).unlink(missing_ok=True)
            directory = destination / page['slug']
            if directory.exists():
                shutil.rmtree(directory)
    if destination != ROOT:
        shutil.copytree(ROOT / 'assets', destination / 'assets', dirs_exist_ok=True)
        shutil.copy2(ROOT / 'CNAME', destination / 'CNAME')
        (destination / '.nojekyll').touch()
    for slug, page in PAGES.items():
        (destination / (slug + '.html')).write_text(render(slug, SITE['name'] if slug == 'index' else page['title'], content(page), page['images'][0]['src'] if page['images'] else None))
    (destination / 'insta.html').write_text(render('insta', 'Instagram', instagram()))
    (destination / '404.html').write_text(render('404', 'Page not found', '<section class="prose"><h1>Page not found</h1><p><a href="/index.html">Return to the photographs</a>, or choose a project from the menu.</p></section>'))
    aliases = {s: '/' + s + '.html' for s in list(PAGES) + ['insta'] if s != 'index'}
    if 'words' in PAGES:
        aliases['words/2019/6/29/why-do-i-photograph'] = '/words.html'
    aliases['fragments'] = '/radiation.html'
    aliases['contact'] = '/about.html#contact'
    for alias, target in aliases.items():
        path = destination / alias / 'index.html'; path.parent.mkdir(parents=True, exist_ok=True)
        canonical_target = target.split('#', 1)[0]
        redirect = f'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Federico Ienna</title><meta http-equiv="refresh" content="0;url={target}"><link rel="canonical" href="{SITE["url"]}{canonical_target}"></head><body><a href="{target}">Continue to {escape(target)}</a></body></html>\n'
        path.write_text(redirect)
        if alias in ['contact', 'fragments', 'words/2019/6/29/why-do-i-photograph']:
            (destination / (alias + '.html')).write_text(redirect)
    urls = [''] + [s + '.html' for s in PAGES if s != 'index'] + ['insta.html']
    (destination / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join('<url><loc>' + SITE['url'] + '/' + s + '</loc></url>' for s in urls) + '</urlset>\n')
    (destination / 'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: ' + SITE['url'] + '/sitemap.xml\n')
    print(f'Built {len(PAGES) + 1} pages, error page, and historical URL aliases in {destination}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', choices=['.', 'dist'], default='.', help='Use dist for publication; default is the repository root.')
    args = parser.parse_args()
    build((ROOT / args.output).resolve())
