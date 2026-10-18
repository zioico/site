/* Navigation, uncropped galleries, and the public Instagram cache. No libraries. */
"use strict";
document.documentElement.classList.add("js");
const menuToggle = document.querySelector(".menu-toggle");
const navigation = document.querySelector(".site-nav");
menuToggle.hidden = false;
menuToggle.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") !== "true";
  menuToggle.setAttribute("aria-expanded", String(open));
  navigation.classList.toggle("is-open", open);
});
document.addEventListener("click", (event) => {
  document.querySelectorAll(".projects-menu details[open]").forEach((menu) => {
    if (!menu.contains(event.target)) menu.open = false;
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document
      .querySelectorAll(".projects-menu details[open]")
      .forEach((menu) => {
        menu.open = false;
      });
    navigation.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
  }
});

document.querySelectorAll(".gallery").forEach((gallery) => {
  const slides = [...gallery.querySelectorAll(".slide")];
  const dots = [...gallery.querySelectorAll(".gallery-dot")];
  const status = gallery.querySelector(".gallery-status");
  const pause = gallery.querySelector(".gallery-pause");
  let index = 0;
  let timer;
  let paused = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function show(next, announce = true) {
    slides[index].hidden = true;
    dots[index].setAttribute("aria-current", "false");
    index = (next + slides.length) % slides.length;
    slides[index].hidden = false;
    dots[index].setAttribute("aria-current", "true");
    if (announce)
      status.textContent = `Photograph ${index + 1} of ${slides.length}`;
  }
  function stop() {
    clearInterval(timer);
  }
  function start() {
    stop();
    if (gallery.dataset.autoplay && !paused && !document.hidden)
      timer = setInterval(() => show(index + 1, false), 6000);
  }
  function choose(next) {
    show(next);
    if (pause) setPaused(true);
  }
  function setPaused(value) {
    paused = value;
    if (pause) {
      pause.textContent = paused ? "Play slideshow" : "Pause slideshow";
      pause.setAttribute("aria-pressed", String(paused));
    }
    start();
  }
  gallery
    .querySelector(".previous")
    .addEventListener("click", () => choose(index - 1));
  gallery
    .querySelector(".next")
    .addEventListener("click", () => choose(index + 1));
  dots.forEach((dot, i) => dot.addEventListener("click", () => choose(i)));
  gallery.addEventListener("keydown", (event) => {
    const actions = {
      ArrowLeft: index - 1,
      ArrowRight: index + 1,
      Home: 0,
      End: slides.length - 1,
    };
    if (event.key in actions) {
      event.preventDefault();
      choose(actions[event.key]);
    }
  });
  let pointerStart;
  gallery.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse")
      pointerStart = { x: event.clientX, y: event.clientY };
  });
  gallery.addEventListener("pointerup", (event) => {
    if (!pointerStart) return;
    const dx = event.clientX - pointerStart.x;
    const dy = event.clientY - pointerStart.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4)
      choose(index + (dx < 0 ? 1 : -1));
    pointerStart = null;
  });
  gallery.addEventListener("pointercancel", () => {
    pointerStart = null;
  });
  gallery.addEventListener("mouseenter", stop);
  gallery.addEventListener("mouseleave", start);
  gallery.addEventListener("focusin", stop);
  gallery.addEventListener("focusout", (event) => {
    if (!gallery.contains(event.relatedTarget)) start();
  });
  document.addEventListener("visibilitychange", start);
  if (pause) {
    pause.addEventListener("click", () => setPaused(!paused));
    setPaused(paused);
  }
});

const dialog = document.querySelector(".photo-dialog");
dialog
  .querySelector(".dialog-close")
  .addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});

const feed = document.querySelector(".instagram-feed");
if (feed) {
  const grid = feed.querySelector(".instagram-grid");
  const filters = feed.querySelector(".feed-filters");
  const more = feed.querySelector(".load-more");
  let posts = [];
  let activeFilter = "all";
  let visibleCount = 24;
  let refreshing = false;
  const safeLocal = (value) =>
    typeof value === "string" &&
    /^assets\/instagram\/[a-zA-Z0-9_./-]+\.(jpg|jpeg|png|webp)$/.test(value) &&
    !value.includes("..");
  const safePermalink = (value) => {
    try {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        ["www.instagram.com", "instagram.com"].includes(u.hostname) &&
        /^\/(p|reel|tv)\/[a-zA-Z0-9_-]+\/?$/.test(u.pathname)
      );
    } catch {
      return false;
    }
  };
  function validPost(post) {
    return post && safeLocal(post.src) && safePermalink(post.href);
  }
  function makeCard(post, i) {
    const link = document.createElement("a");
    link.className = "instagram-post";
    link.href = post.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.dataset.postIndex = i;
    link.dataset.mediaType = post.media_type || "IMAGE";
    const img = document.createElement("img");
    img.src = "/" + post.src;
    img.alt = (post.caption || `Instagram photograph ${i + 1}`).slice(0, 180);
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 600;
    img.height = 600;
    link.append(img);
    const type = post.media_type;
    if (type === "VIDEO" || type === "CAROUSEL_ALBUM") {
      const badge = document.createElement("span");
      badge.className = "post-badge";
      badge.textContent =
        type === "VIDEO"
          ? post.media_product_type === "REELS"
            ? "Reel"
            : "Video"
          : "Album";
      link.append(badge);
    }
    return link;
  }
  function applyFilter() {
    let matches = 0;
    [...grid.children].forEach((card) => {
      const match =
        activeFilter === "all" ||
        (activeFilter === "reels"
          ? card.dataset.mediaType === "VIDEO"
          : card.dataset.mediaType !== "VIDEO");
      card.hidden = !match || matches++ >= visibleCount;
    });
    more.hidden = matches <= visibleCount;
    feed.querySelector(".feed-empty").hidden = matches !== 0;
    filters
      .querySelectorAll("button")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.filter === activeFilter),
        ),
      );
  }
  function openPost(post) {
    const holder = dialog.querySelector(".dialog-content");
    holder.replaceChildren();
    const visual = document.createElement("div");
    const img = document.createElement("img");
    img.className = "dialog-image";
    img.src = "/" + post.src;
    img.alt = (post.caption || "Instagram photograph").slice(0, 300);
    visual.append(img);
    const children = (post.children || []).filter((child) =>
      safeLocal(child.src),
    );
    if (children.length > 1) {
      let current = 0;
      const controls = document.createElement("div");
      controls.className = "album-controls";
      const previous = document.createElement("button");
      previous.textContent = "Previous";
      previous.setAttribute("aria-label", "Previous image in album");
      const next = document.createElement("button");
      next.textContent = "Next";
      next.setAttribute("aria-label", "Next image in album");
      const count = document.createElement("span");
      count.textContent = `1 / ${children.length}`;
      count.setAttribute("aria-live", "polite");
      const move = (amount) => {
        current = (current + amount + children.length) % children.length;
        img.src = "/" + children[current].src;
        count.textContent = `${current + 1} / ${children.length}`;
      };
      previous.addEventListener("click", () => move(-1));
      next.addEventListener("click", () => move(1));
      controls.append(previous, count, next);
      visual.append(controls);
    }
    const meta = document.createElement("div");
    meta.className = "dialog-meta";
    if (post.timestamp && !Number.isNaN(Date.parse(post.timestamp))) {
      const time = document.createElement("time");
      time.dateTime = post.timestamp;
      time.textContent = new Date(post.timestamp).toLocaleDateString(
        undefined,
        { day: "numeric", month: "long", year: "numeric" },
      );
      meta.append(time);
    }
    const caption = document.createElement("p");
    caption.className = "dialog-caption";
    caption.textContent = post.caption || "";
    meta.append(caption);
    const link = document.createElement("a");
    link.href = post.href;
    link.textContent =
      post.media_type === "VIDEO"
        ? "Watch on Instagram"
        : "View post on Instagram";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    meta.append(link);
    holder.append(visual, meta);
    dialog.showModal();
  }
  filters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    activeFilter = button.dataset.filter;
    visibleCount = 24;
    applyFilter();
  });
  more.addEventListener("click", () => {
    visibleCount += 24;
    applyFilter();
  });
  grid.addEventListener("click", (event) => {
    const card = event.target.closest("[data-post-index]");
    if (
      !card ||
      !posts.length ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    const post = posts[Number(card.dataset.postIndex)];
    if (post && typeof dialog.showModal === "function") {
      event.preventDefault();
      openPost(post);
    }
  });
  async function refreshFeed() {
    if (refreshing || document.hidden) return;
    refreshing = true;
    try {
      const response = await fetch("/assets/instagram/feed.json", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Feed unavailable");
      const data = await response.json();
      if (!Array.isArray(data) || !data.length || !data.every(validPost))
        throw new Error("Invalid feed");
      posts = data;
      const cards = [...grid.children];
      const sameCards =
        cards.length === posts.length &&
        cards.every((card, i) => {
          const post = posts[i];
          const img = card.querySelector("img");
          return (
            card.getAttribute("href") === post.href &&
            img?.getAttribute("src") === "/" + post.src &&
            img.alt ===
              (post.caption || `Instagram photograph ${i + 1}`).slice(0, 180) &&
            card.dataset.mediaType === (post.media_type || "IMAGE")
          );
        });
      // Reuse already decoded photographs when the JSON has not changed.
      if (!sameCards) grid.replaceChildren(...posts.map(makeCard));
      filters.hidden = false;
      applyFilter();
      const statusResponse = await fetch("/assets/instagram/status.json", {
        cache: "no-store",
      });
      if (statusResponse.ok) {
        const status = await statusResponse.json();
        if (
          status.last_success &&
          !Number.isNaN(Date.parse(status.last_success))
        )
          feed.querySelector(".feed-status").textContent =
            "Updated " +
            new Date(status.last_success).toLocaleString(undefined, {
              dateStyle: "medium",
              timeStyle: "short",
            });
      }
    } catch {
      /* Keep the server-rendered saved photographs and links usable. */
    } finally {
      refreshing = false;
    }
  }
  refreshFeed();
  setInterval(refreshFeed, 15 * 60 * 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshFeed();
  });
}
