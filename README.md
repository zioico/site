# federicoienna.com

A static photography portfolio rebuilt from the published `zioico/site` repository on 18 October 2026. Plain HTML, one stylesheet, one browser script. GitHub Pages remains the intended host; the domain is unchanged.

## Preview

From this directory:

```bash
python3 tools/build.py --output dist
python3 -m http.server 8000 --directory dist
```

Open <http://localhost:8000/>. Stop the server with Ctrl+C.

Python 3 is enough to edit, build, and preview the portfolio. Node 22 or newer is needed only to run the Instagram updater or its tests locally. GitHub runs Node 24 automatically for scheduled updates.

## Where to edit

All paths below are relative to this repository root.

| Change | File |
| --- | --- |
| Name, Instagram handle, photograph order, gallery image lists | `content/site.json` |
| Project descriptions, biography, writing, film credits, contact text | `content/pages/*.html` |
| Header, footer, metadata, shared HTML structure | `templates/base.html` |
| Colours, fonts, spacing, image display, mobile layout | `assets/site.css` |
| Gallery controls, mobile menu, Instagram grid and viewer | `assets/site.js` |
| New portfolio photographs | `assets/photos/` |
| Automatic Instagram retrieval and token refresh | `tools/sync_instagram.mjs` |
| Schedule and deployment | `.github/workflows/publish.yml` |

After editing content, run `python3 tools/build.py --output dist` to refresh the preview. The HTML files are generated output; edit the content or template that produces them. Serving `dist/` keeps unpublished source files outside the preview as well as the deployed website.

Words is retained in `content/pages/words-1.html`, with `"published": false` on its entry in `content/site.json`. It is excluded from navigation, generated pages, historical article routes, and the sitemap. To restore it later, change that flag to `true` and rebuild.

For example, to add a photograph to Enfim:

1. Save a web-sized photograph in `assets/photos/`, preferably around 1800 pixels on the longer edge. Keep full-resolution masters elsewhere.
2. In `content/site.json`, find the page with `"slug": "enfim"` and add an entry to its `images` list:

```json
{
  "src": "assets/photos/new-enfim-photograph.jpg",
  "alt": "A short description of the photograph",
  "width": 1800,
  "height": 1440
}
```

3. Run `python3 tools/build.py --output dist` and inspect `http://localhost:8000/enfim.html`.

Changing list order changes the gallery sequence. There is no framework, package installation, database, paid theme, or content management service required.

## Instagram

The existing 80 cached images have been retained and grouped into 30 posts. They are a saved selection, with the newest post dated 22 December 2025. **Automatic retrieval is prepared but is not connected or live yet.**

See [INSTAGRAM_SETUP.md](INSTAGRAM_SETUP.md) for the one-time Meta authorization and repository secrets.

Once connected and published, GitHub checks for updates at 00:23, 06:23, 12:23, and 18:23 UTC. GitHub schedules can run late; this is a periodically refreshed feed rather than an instant mirror. The open page also reloads its public JSON every 15 minutes and when the visitor returns to the tab.

Photos and album images are copied locally. Reels and other videos use local preview images and link to playback on Instagram. Stories and highlights link to Instagram in this version. No Instagram password, token, or browser cookie is exposed to visitors.

The updater validates the account, retrieves the latest posts, saves media, and then replaces the feed. API errors fail the deployment, retaining the last successful live site. Refreshed API tokens are encrypted with AES-256-GCM before being committed; the encryption key stays in GitHub Secrets. Revocation, permission changes, or account changes can still require signing in again.

## Validate

```bash
python3 tools/build.py --output dist
python3 tools/check_site.py dist
node --test tools/sync_instagram.test.mjs
node --check assets/site.js
```

`dist/` contains only public HTML and assets. It excludes source tools, editorial content files, workflow files, and encrypted credential state. The check verifies internal links, image paths, headings, feed paths, preservation of cached images, and removal of the legacy runtime.

`_config.yml` also excludes those source files when GitHub Pages uses its existing main-branch build. Keep the root free of `.nojekyll` so these exclusions apply; the Python builder creates `.nojekyll` inside the clean `dist/` artifact instead.

## Review and publish

The original folder supplied for this task was an HTML export without Git history. The live domain points to `zioico.github.io`; its public repository is <https://github.com/zioico/site>. The current public deployment reports `main`. There is no `docs/`, `gh-pages` branch, or custom workflow in the downloaded baseline. These indicate main-root publication, but the exact Settings → Pages source still needs authenticated verification.

Prepare this replacement on a new branch in a **new clone**:

```bash
bash tools/prepare_review.sh "$HOME/Documents/Website/site-clean-review"
```

That script refuses an existing destination. It clones `zioico/site`, creates `clean-static-rebuild`, installs this replacement, removes the superseded export files from that new clone, and stages the result for review. It does not push or change the live site.

After reviewing:

```bash
cd "$HOME/Documents/Website/site-clean-review"
git status
git diff --cached --stat
git commit -m "Rebuild photography portfolio as a clean static website"
git push -u origin clean-static-rebuild
```

Open a pull request against `main`. At the agreed cutover, verify and change **Settings → Pages → Build and deployment → Source** to **GitHub Actions**, then merge. Keep the custom domain `www.federicoienna.com` and HTTPS enabled; no DNS change is required. The workflow builds `dist/`, uploads that folder, and deploys it. If branch rules disallow the bot’s cache commits, permit this workflow to update the Instagram cache or use a dedicated cache branch before enabling sync.

After publication, check both content and data:

```bash
curl -fsSL https://www.federicoienna.com/ | head -25
curl -fsSL https://www.federicoienna.com/assets/instagram/status.json
curl -fsSL https://www.federicoienna.com/assets/instagram/feed.json \
  | python3 -c 'import json,sys; p=json.load(sys.stdin); print(len(p)); print(p[0])'
```

The `python3 -c` form intentionally leaves stdin available for curl's JSON.

To roll back, revert the replacement merge and restore the previously verified Pages source. Git retains the original site and photographs.

## Design and content notes

- Retains the grey background, blue title with overline, gallery sequences, project texts, short film, biography, and public contact email. Navigation is Home, Projects, Instagram Feed, Short Film, About. Writing is preserved as unpublished source.
- Saves 149 portfolio image URLs locally; the running site has no Squarespace JavaScript, stylesheets, tracking, forms, or image hosting dependency. `content/photo-provenance.json` is an unpublished migration reference, not a runtime dependency.
- Hosts the original open-source Abel title font locally with its OFL license. Body and navigation use local system fonts instead of the old licensed Adobe font loader; text metrics can differ slightly across devices.
- Portfolio images use high-quality WebP copies at their original downloaded dimensions, retaining colour profiles. This reduces transfer size without changing composition or adding a build dependency; future images can still be ordinary JPEG files.
- Galleries show complete photographs without cropping. The Instagram grid uses square previews, with the full photograph available in the viewer.
- Contact details and the working email link are included at the bottom of About. The former Contact URLs forward to that section. A browser-only static site cannot send form submissions by itself.
- The About biography is preserved as published, including its reference to Lisbon; it has not been rewritten from background information.
- Preserves public `.html` page URLs and extensionless aliases. Words and its historical article URLs are absent from the website and return 404. `fragments.html` forwards to its duplicate Radiation project.

## Why this approach

| Option | Fit for this portfolio |
| --- | --- |
| Plain static HTML/CSS/JS on GitHub Pages | Recommended: stays free for a public repository, small codebase, no framework maintenance, retains your domain. |
| Astro or Eleventy generating static pages | Sensible if publishing many new projects or articles; adds a Node dependency and build system that this portfolio does not presently need. |
| WordPress or another hosted CMS | Useful for a browser editing dashboard, but adds hosting, updates, and maintenance beyond the stated needs and budget. |
| Commercial Instagram widget | Reduces API setup work, but introduces a vendor dependency and subscription/free-tier restrictions. The official API path is preferable here. |

Hosting and standard public-repository GitHub Actions can remain €0/month under GitHub's current free offering; the domain renewal remains separate. No paid widget or hosting subscription is built in. GitHub can disable schedules after 60 days without repository activity; failed or inactive workflows need attention. Successful sync runs commit their cache/status updates, but the schedule should still be checked if updates stop.

References checked 18 October 2026:

- [GitHub Pages availability](https://docs.github.com/en/pages/quickstart)
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [GitHub Pages publication sources](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [GitHub scheduled workflow behaviour](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [Meta's Instagram Login API collection](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login)
