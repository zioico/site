import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  syncInstagram,
  encryptState,
  decryptState,
  validatePermalink,
} from "./sync_instagram.mjs";

const KEY = "ab".repeat(32);
const ENV = {
  INSTAGRAM_ACCESS_TOKEN: "test-secret-token",
  INSTAGRAM_TOKEN_KEY: KEY,
};
const NOW = new Date("2026-10-18T12:00:00Z");
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const photo = () =>
  new Response(Buffer.from([255, 216, 255, 224, 1, 2, 3, 255, 217]), {
    headers: { "content-type": "image/jpeg" },
  });
const media = (id = "123", extra = {}) => ({
  id,
  media_type: "IMAGE",
  media_url: "https://scontent.cdninstagram.com/photo.jpg",
  permalink: `https://www.instagram.com/p/post_${id}/`,
  timestamp: "2026-10-17T10:00:00+0000",
  caption: "Caption <script> stays text",
  ...extra,
});
async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "photo-sync-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "content"), { recursive: true });
  await mkdir(path.join(root, "assets/instagram"), { recursive: true });
  await writeFile(
    path.join(root, "content/site.json"),
    JSON.stringify({ instagram: "zioico" }),
  );
  await writeFile(
    path.join(root, "assets/instagram/feed.json"),
    '[{"old":true}]',
  );
  await writeFile(path.join(root, "assets/instagram/old.jpg"), "old");
  return root;
}
function apiMock(items, extra) {
  return async (url, options) => {
    const u = new URL(url);
    if (extra) {
      const r = await extra(u, options);
      if (r) return r;
    }
    if (u.hostname.endsWith("cdninstagram.com")) return photo();
    if (u.pathname.endsWith("/me"))
      return json({ user_id: "42", username: "zioico" });
    if (u.pathname.endsWith("/42/media")) return json({ data: items });
    throw new Error("Unexpected mock request");
  };
}

test("encrypted token survives round trip, rejects tampering, and contains no plaintext", () => {
  const token = {
    access_token: "private-rotated-token",
    refreshed_at: NOW.toISOString(),
  };
  const encrypted = encryptState(token, KEY);
  assert.deepEqual(decryptState(encrypted, KEY), token);
  assert.ok(!JSON.stringify(encrypted).includes(token.access_token));
  assert.throws(() =>
    decryptState(
      { ...encrypted, tag: Buffer.alloc(16).toString("base64") },
      KEY,
    ),
  );
  assert.throws(() => encryptState(token, "short"));
});
test("permalinks reject lookalike domains and executable URLs", () => {
  assert.ok(validatePermalink("https://www.instagram.com/reel/Ab_C-1/"));
  for (const bad of [
    "javascript:alert(1)",
    "https://instagram.com.evil.test/p/123/",
    "http://instagram.com/p/123/",
    "https://instagram.com/accounts/login/",
  ])
    assert.equal(validatePermalink(bad), false);
});
test("no credentials keeps the saved selection untouched", async (t) => {
  const root = await fixture(t);
  assert.deepEqual(await syncInstagram({ root, env: {}, now: NOW }), {
    configured: false,
  });
  assert.equal(
    await readFile(path.join(root, "assets/instagram/feed.json"), "utf8"),
    '[{"old":true}]',
  );
});
test("a partial connection fails instead of claiming successful synchronization", async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    syncInstagram({ root, env: { INSTAGRAM_ACCESS_TOKEN: "x" }, now: NOW }),
    /Set both/,
  );
});
test("account mismatch retains the previous feed", async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    syncInstagram({
      root,
      env: ENV,
      now: NOW,
      fetchImpl: () => json({ user_id: "42", username: "someone_else" }),
    }),
    /does not match/,
  );
  assert.equal(
    await readFile(path.join(root, "assets/instagram/feed.json"), "utf8"),
    '[{"old":true}]',
  );
});
test("API errors never expose response text or the token", async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    syncInstagram({
      root,
      env: ENV,
      now: NOW,
      fetchImpl: () =>
        json({ error: { code: 190, message: "test-secret-token" } }, 401),
    }),
    (error) =>
      error.message.includes("190") &&
      !error.message.includes("test-secret-token"),
  );
});
test("photos, album children and Reel thumbnails become local files in timestamp order", async (t) => {
  const root = await fixture(t);
  const items = [
    media("123"),
    media("124", {
      media_type: "CAROUSEL_ALBUM",
      timestamp: "2026-10-18T10:00:00Z",
      children: { data: [media("125"), media("126")] },
    }),
    media("127", {
      media_type: "VIDEO",
      media_product_type: "REELS",
      thumbnail_url: "https://scontent.cdninstagram.com/reel.jpg",
    }),
  ];
  const result = await syncInstagram({
    root,
    env: ENV,
    now: NOW,
    fetchImpl: apiMock(items),
  });
  assert.equal(result.posts, 3);
  const saved = JSON.parse(
    await readFile(path.join(root, "assets/instagram/feed.json")),
  );
  assert.equal(saved[0].id, "124");
  assert.equal(saved[0].children.length, 2);
  assert.equal(saved.find((x) => x.id === "127").media_product_type, "REELS");
  for (const post of saved) await access(path.join(root, post.src));
  await assert.rejects(access(path.join(root, "assets/instagram/old.jpg")));
  const state = decryptState(
    JSON.parse(
      await readFile(path.join(root, ".private/instagram-token.json")),
    ),
    KEY,
  );
  assert.equal(state.access_token, ENV.INSTAGRAM_ACCESS_TOKEN);
  assert.equal(
    JSON.parse(await readFile(path.join(root, "assets/instagram/status.json")))
      .last_success,
    NOW.toISOString(),
  );
});
test("a failed image download does not overwrite public feed or remove saved images", async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    syncInstagram({
      root,
      env: ENV,
      now: NOW,
      fetchImpl: apiMock([media()], (u) =>
        u.hostname.endsWith("cdninstagram.com") ? json({}, 500) : null,
      ),
    }),
    /invalid or oversized/,
  );
  assert.equal(
    await readFile(path.join(root, "assets/instagram/feed.json"), "utf8"),
    '[{"old":true}]',
  );
  await access(path.join(root, "assets/instagram/old.jpg"));
});
test("an empty API response preserves the saved feed", async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    syncInstagram({ root, env: ENV, now: NOW, fetchImpl: apiMock([]) }),
    /no posts/,
  );
  assert.equal(
    await readFile(path.join(root, "assets/instagram/feed.json"), "utf8"),
    '[{"old":true}]',
  );
});
test("a non-image response with an image MIME type cannot replace the feed", async (t) => {
  const root = await fixture(t);
  await assert.rejects(
    syncInstagram({
      root,
      env: ENV,
      now: NOW,
      fetchImpl: apiMock([media()], (u) =>
        u.hostname.endsWith("cdninstagram.com")
          ? new Response("not an image", {
              headers: { "content-type": "image/jpeg" },
            })
          : null,
      ),
    }),
    /invalid image bytes/,
  );
  assert.equal(
    await readFile(path.join(root, "assets/instagram/feed.json"), "utf8"),
    '[{"old":true}]',
  );
});
test("weekly refresh persists the returned token and uses it on later runs", async (t) => {
  const root = await fixture(t);
  await mkdir(path.join(root, ".private"));
  const seed_hash = createHash("sha256")
    .update(ENV.INSTAGRAM_ACCESS_TOKEN)
    .digest("hex");
  await writeFile(
    path.join(root, ".private/instagram-token.json"),
    JSON.stringify(
      encryptState(
        {
          access_token: "old-token",
          refreshed_at: "2026-10-01T12:00:00Z",
          seed_hash,
        },
        KEY,
      ),
    ),
  );
  let refreshed = 0;
  const fetchImpl = apiMock([media()], (u, o) => {
    if (u.pathname === "/refresh_access_token") {
      refreshed++;
      assert.equal(u.searchParams.get("access_token"), "old-token");
      return json({ access_token: "new-rotated-token", expires_in: 5184000 });
    }
    if (u.hostname === "graph.instagram.com")
      assert.equal(o.headers.Authorization, "Bearer new-rotated-token");
  });
  await syncInstagram({ root, env: ENV, now: NOW, fetchImpl });
  const encrypted = await readFile(
    path.join(root, ".private/instagram-token.json"),
    "utf8",
  );
  assert.equal(
    decryptState(JSON.parse(encrypted), KEY).access_token,
    "new-rotated-token",
  );
  await syncInstagram({
    root,
    env: ENV,
    now: new Date("2026-10-19T12:00:00Z"),
    fetchImpl,
  });
  assert.equal(refreshed, 1);
  assert.equal(
    await readFile(path.join(root, ".private/instagram-token.json"), "utf8"),
    encrypted,
  );
});
test("API pagination gathers enough posts and follows album child cursors", async (t) => {
  const root = await fixture(t);
  let pages = 0,
    children = 0;
  const fetchImpl = apiMock([], (u) => {
    if (u.pathname.endsWith("/42/media")) {
      pages++;
      return u.searchParams.has("after")
        ? json({
            data: [
              media("124", {
                media_type: "CAROUSEL_ALBUM",
                children: {
                  data: [media("125")],
                  paging: { next: "next", cursors: { after: "children2" } },
                },
              }),
            ],
          })
        : json({
            data: [media("123")],
            paging: { next: "next", cursors: { after: "page2" } },
          });
    }
    if (u.pathname.endsWith("/124/children")) {
      children++;
      return json({ data: [media("126")] });
    }
  });
  await syncInstagram({
    root,
    env: { ...ENV, INSTAGRAM_MAX_POSTS: "3" },
    now: NOW,
    fetchImpl,
  });
  assert.equal(pages, 2);
  assert.equal(children, 1);
  const feed = JSON.parse(
    await readFile(path.join(root, "assets/instagram/feed.json")),
  );
  assert.equal(feed[1].children.length, 2);
});
