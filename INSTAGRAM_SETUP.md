# Connect @zioico

Status: the API integration and scheduled workflow are implemented; no Meta authorization or GitHub repository secrets have been supplied. The current preview uses the existing saved posts.

## One-time connection

1. In Instagram, confirm that `@zioico` is a **Creator** or **Business** account. A professional dashboard suggests that it is, but check the account type directly. This API does not support ordinary personal accounts.
2. In [Meta for Developers](https://developers.facebook.com/), create or use your own app with **Instagram API with Instagram Login**. Add `@zioico` as an authorized Instagram account/tester and accept the account invitation where required. Use the setup for your own account; permissions for unrelated users can require additional review.
3. Authorize read access with `instagram_business_basic`. This display-only integration does not need permission to publish, message people, manage comments, or read private messages. This API setup does not require linking a Facebook Page.
4. Obtain a **long-lived Instagram User access token** for the Instagram Login API, following the app dashboard's current token instructions and Meta's [Business Login documentation](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login/). A short-lived token is insufficient for unattended operation. Dashboard labels and account approval requirements can vary; verify the token type and permission before enabling the workflow.
5. In `zioico/site` → Settings → Secrets and variables → Actions, create two **repository secrets**:

| Secret | Value |
| --- | --- |
| `INSTAGRAM_ACCESS_TOKEN` | The long-lived Instagram Login token authorized for `@zioico`. |
| `INSTAGRAM_TOKEN_KEY` | A new 32-byte encryption key encoded as 64 hexadecimal characters. Generate it locally with the command below. |

```bash
openssl rand -hex 32
```

Paste the generated key directly into GitHub Secrets. Keep a secure backup together with the account's credential recovery information. Do not put either secret in HTML, JavaScript served to visitors, `content/site.json`, a screenshot, a commit, or a chat message.

6. Verify the Pages publication source and switch to **GitHub Actions** at cutover, as described in `README.md`. Ensure repository workflow policy permits the build job's declared `contents: write` permission and cache commits to `main`; protected branch rules may need a separate cache branch implementation.
7. Run **Actions → Publish photography website → Run workflow** on `main`. Inspect the job result, then verify `/assets/instagram/status.json` on the live domain. `source` should be `instagram-api`, `handle` should be `zioico`, and `last_success` should match the successful run. Confirm the newest post on the Instagram page.

The public site never sees these secrets. The server-side job stores only the refreshed token's AES-256-GCM ciphertext at `.private/instagram-token.json`; the key stays in GitHub Secrets, and `.private/` is excluded from the deployed `dist/` folder.

## Operation

- Runs every six hours, at minute 23 UTC, plus on a push to `main` and manual runs. Delayed GitHub schedules are possible; this is not instantaneous synchronization.
- Keeps the latest 80 posts by default. Change the repository Actions variable `INSTAGRAM_MAX_POSTS` to a number between 1 and 200 if needed.
- Uses API version `v25.0` by default. Change the repository variable `INSTAGRAM_API_VERSION` when moving to another supported version; test before changing it. Version upgrades are periodic maintenance, not a monthly subscription.
- Downloads photos, carousel children, and video/Reel preview images. Actual video playback, stories, and highlights open on Instagram. It does not scrape Instagram's website or reuse a browser login cookie.
- Refreshes the long-lived token weekly once the stored connection is at least seven days old. It encrypts and retains the returned token, including when Meta returns a different token string.
- Checks that the authorized username matches `content/site.json` before replacing any feed data.
- On API failures, revoked access, unsupported media, or failed downloads, exits unsuccessfully before replacing the public feed. GitHub does not deploy the failed build, leaving the previous live version online.

## Reconnect

If access is revoked or the token expires, obtain a new long-lived token and replace `INSTAGRAM_ACCESS_TOKEN` in GitHub Secrets. The updater detects that the initial secret changed and uses the new token automatically. Keep the same `INSTAGRAM_TOKEN_KEY` unless deliberately rotating it.

To rotate the encryption key, remove the old **encrypted** `.private/instagram-token.json` from a maintenance branch and replace both repository secrets before the next run. Never change the key while expecting it to decrypt state produced with the old key.

If updates stop, inspect the latest Actions run and the last success date. GitHub may disable scheduled workflows in inactive public repositories after 60 days; re-enable the workflow where necessary. Notifications and account approvals remain owned by the repository/account owner.

## Local manual run

Normally GitHub runs the updater, so Node need not be installed on the photography computer. For a local run with Node 22+ installed, read secrets into temporary shell variables rather than command arguments or files:

```bash
read -r -s -p 'Instagram access token: ' INSTAGRAM_ACCESS_TOKEN
printf '\n'
export INSTAGRAM_ACCESS_TOKEN
read -r -s -p 'Instagram token key: ' INSTAGRAM_TOKEN_KEY
printf '\n'
export INSTAGRAM_TOKEN_KEY
node tools/sync_instagram.mjs
unset INSTAGRAM_ACCESS_TOKEN INSTAGRAM_TOKEN_KEY
python3 tools/build.py
```

Run this from the repository root. Do not use `set -x` while handling credentials.
