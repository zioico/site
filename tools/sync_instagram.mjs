#!/usr/bin/env node
/** Read @zioico's media through Meta's Instagram Login API. Node 22+, no packages. */
import {
  readFile,
  writeFile,
  mkdir,
  rename,
  rm,
  readdir,
  stat,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import process from "node:process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEEK = 7 * 24 * 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export function encryptState(state, keyHex) {
  if (!/^[a-fA-F0-9]{64}$/.test(keyHex || ""))
    throw new Error("INSTAGRAM_TOKEN_KEY must be 64 hexadecimal characters.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keyHex, "hex"), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(state), "utf8"),
    cipher.final(),
  ]);
  return {
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptState(encrypted, keyHex) {
  if (encrypted.version !== 1 || !/^[a-fA-F0-9]{64}$/.test(keyHex || ""))
    throw new Error("Invalid encrypted Instagram token state or key.");
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(keyHex, "hex"),
      Buffer.from(encrypted.iv, "base64"),
    );
    decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
    return JSON.parse(
      Buffer.concat([
        decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8"),
    );
  } catch {
    throw new Error(
      "Cannot decrypt Instagram token. Restore the matching key or reset the token connection.",
    );
  }
}

async function readJson(filename, fallback) {
  try {
    return JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}

async function atomicJson(filename, value) {
  await mkdir(path.dirname(filename), { recursive: true });
  await writeFile(filename + ".tmp", JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
  });
  await rename(filename + ".tmp", filename);
}

export function validatePermalink(value) {
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["www.instagram.com", "instagram.com"].includes(url.hostname) &&
      /^\/(p|reel|tv)\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function mediaUrl(value) {
  try {
    const url = new URL(value);
    if (
      url.protocol === "https:" &&
      ["cdninstagram.com", "fbcdn.net"].some((domain) =>
        url.hostname.endsWith("." + domain),
      )
    )
      return url;
  } catch {
    /* Reject malformed URLs without logging signed URLs. */
  }
  throw new Error(
    "Instagram returned an unsupported media host. Previous feed retained.",
  );
}

export async function syncInstagram({
  root = ROOT,
  env = process.env,
  fetchImpl = fetch,
  now = new Date(),
} = {}) {
  const initialToken = env.INSTAGRAM_ACCESS_TOKEN;
  const key = env.INSTAGRAM_TOKEN_KEY;
  const stateFile = path.join(root, ".private/instagram-token.json");
  const encrypted = await readJson(stateFile, null);
  if (!initialToken && !key && !encrypted) return { configured: false };
  if (!initialToken || !key)
    throw new Error(
      "Set both INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_TOKEN_KEY in GitHub repository secrets.",
    );
  if (!/^[a-fA-F0-9]{64}$/.test(key))
    throw new Error("INSTAGRAM_TOKEN_KEY must be 64 hexadecimal characters.");
  const site = await readJson(path.join(root, "content/site.json"));
  const handle = site.instagram;
  const seedHash = createHash("sha256").update(initialToken).digest("hex");
  const cachedState =
    encrypted && env.INSTAGRAM_RESET_TOKEN !== "true"
      ? decryptState(encrypted, key)
      : null;
  let state =
    !cachedState ||
    cachedState.seed_hash !== seedHash ||
    env.INSTAGRAM_RESET_TOKEN === "true"
      ? {
          access_token: initialToken,
          refreshed_at: now.toISOString(),
          seed_hash: seedHash,
        }
      : cachedState;
  const version = env.INSTAGRAM_API_VERSION || "v25.0";
  if (!/^v\d+\.0$/.test(version))
    throw new Error("Invalid Instagram API version.");
  const maxPosts = Number(env.INSTAGRAM_MAX_POSTS || 80);
  if (!Number.isInteger(maxPosts) || maxPosts < 1 || maxPosts > 200)
    throw new Error("INSTAGRAM_MAX_POSTS must be between 1 and 200.");

  async function api(endpoint, params = {}, versioned = true) {
    const url = new URL(
      `https://graph.instagram.com/${versioned ? version + "/" : ""}${endpoint}`,
    );
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    let response;
    try {
      response = await fetchImpl(url, {
        headers: { Authorization: `Bearer ${state.access_token}` },
        signal: AbortSignal.timeout(30000),
        redirect: "error",
      });
    } catch {
      throw new Error(
        "Cannot reach the Instagram API. Previous feed retained.",
      );
    }
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error("Instagram returned an invalid API response.");
    }
    if (!response.ok || result.error)
      throw new Error(
        `Instagram API failed (HTTP ${response.status}; code ${Number(result.error?.code) || "unknown"}). Check authorization. Previous feed retained.`,
      );
    return result;
  }

  // A refreshed long-lived token can change. Retain it encrypted between runs.
  let stateChanged = state !== cachedState;
  if (now.getTime() - Date.parse(state.refreshed_at) >= WEEK) {
    const refreshed = await api(
      "refresh_access_token",
      { grant_type: "ig_refresh_token", access_token: state.access_token },
      false,
    );
    if (
      !refreshed.access_token ||
      !Number.isFinite(Number(refreshed.expires_in))
    )
      throw new Error(
        "Instagram token refresh failed. Previous feed retained.",
      );
    state = {
      ...state,
      access_token: refreshed.access_token,
      refreshed_at: now.toISOString(),
      expires_at: new Date(
        now.getTime() + Number(refreshed.expires_in) * 1000,
      ).toISOString(),
    };
    stateChanged = true;
  }

  const account = await api("me", { fields: "user_id,username" });
  if (String(account.username).toLowerCase() !== handle.toLowerCase())
    throw new Error(
      `Authorized Instagram account does not match @${handle}. Previous feed retained.`,
    );
  const userId = String(account.user_id || account.id || "");
  if (!/^\d+$/.test(userId))
    throw new Error("Instagram did not return a valid account ID.");
  const fields =
    "id,caption,media_type,media_product_type,media_url,thumbnail_url,permalink,timestamp,children.limit(100){id,media_type,media_url,thumbnail_url}";
  let media = [],
    after;
  for (let page = 0; page < 10; page++) {
    const response = await api(userId + "/media", {
      fields,
      limit: 100,
      ...(after ? { after } : {}),
    });
    if (!Array.isArray(response.data))
      throw new Error(
        "Instagram returned an invalid media list. Previous feed retained.",
      );
    media.push(...response.data);
    if (
      media.length >= maxPosts ||
      !response.paging?.next ||
      !response.paging?.cursors?.after
    )
      break;
    after = response.paging.cursors.after;
  }
  media = [...new Map(media.map((item) => [item.id, item])).values()];
  if (!media.length)
    throw new Error(
      "Instagram returned no posts. Previous feed retained; check the account and API access.",
    );
  media.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  media = media.slice(0, maxPosts);
  const output = path.join(root, "assets/instagram");
  await mkdir(output, { recursive: true });
  const keepFiles = new Set(["feed.json", "status.json"]);

  async function download(item) {
    if (!/^\d+$/.test(String(item.id)))
      throw new Error("Instagram returned an invalid media ID.");
    const stem = "ig-" + item.id;
    for (const ext of ["jpg", "png", "webp"]) {
      const filename = `${stem}.${ext}`;
      try {
        if ((await stat(path.join(output, filename))).size > 0) {
          keepFiles.add(filename);
          return "assets/instagram/" + filename;
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
    }
    const source = mediaUrl(
      item.media_type === "VIDEO" ? item.thumbnail_url : item.media_url,
    );
    let response;
    try {
      response = await fetchImpl(source, {
        signal: AbortSignal.timeout(30000),
        redirect: "error",
      });
    } catch {
      throw new Error(
        "Instagram photo download failed. Previous feed retained.",
      );
    }
    const mime = (response.headers.get("content-type") || "").split(";")[0];
    const ext = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    }[mime];
    if (
      !response.ok ||
      !ext ||
      Number(response.headers.get("content-length")) > MAX_IMAGE_BYTES
    )
      throw new Error(
        "Instagram returned an invalid or oversized photograph. Previous feed retained.",
      );
    const bytes = Buffer.from(await response.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
      throw new Error(
        "Instagram photograph exceeds the cache size limit. Previous feed retained.",
      );
    const signature =
      ext === "jpg"
        ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
        : ext === "png"
          ? bytes
              .subarray(0, 8)
              .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : bytes.toString("ascii", 0, 4) === "RIFF" &&
            bytes.toString("ascii", 8, 12) === "WEBP";
    if (!signature)
      throw new Error(
        "Instagram returned invalid image bytes. Previous feed retained.",
      );
    const filename = `${stem}.${ext}`;
    await writeFile(path.join(output, filename + ".tmp"), bytes);
    await rename(
      path.join(output, filename + ".tmp"),
      path.join(output, filename),
    );
    keepFiles.add(filename);
    return "assets/instagram/" + filename;
  }

  const posts = [];
  // Do not replace either public JSON file until every requested image is available.
  for (const item of media) {
    if (
      !validatePermalink(item.permalink) ||
      !Number.isFinite(Date.parse(item.timestamp))
    )
      throw new Error(
        "Instagram returned invalid post metadata. Previous feed retained.",
      );
    let childMedia = item.children?.data || [];
    // Follow the child cursor for albums larger than one API page.
    let childAfter = item.children?.paging?.cursors?.after;
    let childNext = item.children?.paging?.next;
    for (let page = 0; childNext && childAfter && page < 5; page++) {
      const children = await api(item.id + "/children", {
        fields: "id,media_type,media_url,thumbnail_url",
        limit: 100,
        after: childAfter,
      });
      if (!Array.isArray(children.data))
        throw new Error("Invalid Instagram album response.");
      childMedia.push(...children.data);
      childAfter = children.paging?.cursors?.after;
      childNext = children.paging?.next;
    }
    const children = [];
    for (const child of childMedia)
      children.push({
        id: String(child.id),
        media_type: child.media_type,
        src: await download(child),
      });
    const src =
      item.media_type === "CAROUSEL_ALBUM" && children.length
        ? children[0].src
        : await download(item);
    posts.push({
      id: String(item.id),
      shortcode: new URL(item.permalink).pathname.split("/")[2],
      href: item.permalink,
      src,
      timestamp: item.timestamp,
      handle,
      caption: item.caption || "",
      media_type: item.media_type,
      media_product_type: item.media_product_type || "",
      children,
    });
  }
  const cacheBytes = await Promise.all(
    [...keepFiles]
      .filter((name) => !name.endsWith(".json"))
      .map(async (name) => (await stat(path.join(output, name))).size),
  );
  if (cacheBytes.reduce((a, b) => a + b, 0) > 700 * 1024 * 1024)
    throw new Error(
      "Instagram cache exceeds 700 MB. Reduce INSTAGRAM_MAX_POSTS. Previous feed retained.",
    );
  // Save encrypted credentials only after the API and media have been validated.
  if (stateChanged) await atomicJson(stateFile, encryptState(state, key));
  await atomicJson(path.join(output, "feed.json"), posts);
  await atomicJson(path.join(output, "status.json"), {
    source: "instagram-api",
    handle,
    last_success: now.toISOString(),
    latest_post: posts[0].timestamp,
    count: posts.length,
  });
  // Remove only obsolete files from this dedicated cache after successful replacement.
  for (const filename of await readdir(output)) {
    if (/\.(jpg|jpeg|png|webp|tmp)$/.test(filename) && !keepFiles.has(filename))
      await rm(path.join(output, filename));
  }
  return { configured: true, posts: posts.length, refreshed: stateChanged };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = await syncInstagram();
    console.log(
      result.configured
        ? `Instagram: saved ${result.posts} posts; connection checked.`
        : "Instagram is not connected yet. Keeping the saved selection.",
    );
  } catch (error) {
    // Deliberately omit raw responses, request URLs, and stack traces containing credentials.
    console.error(error.message);
    process.exitCode = 1;
  }
}
