(() => {
  const FEED_URL = "/assets/instagram/feed.json"; // absolute path for GH Pages
  const BATCH = 24;

  const grid = document.getElementById("ig-grid");
  const stories = document.getElementById("ig-stories");
  const status = document.getElementById("ig-status");
  const sentinel = document.getElementById("ig-sentinel");

  const btnGrid = document.getElementById("btn-grid");
  const btnFeed = document.getElementById("btn-feed");

  // Lightbox elements
  const lb = document.getElementById("lb");
  const lbImg = document.getElementById("lb-img");
  const lbDate = document.getElementById("lb-date");
  const lbLink = document.getElementById("lb-link");
  const lbPrev = document.getElementById("lb-prev");
  const lbNext = document.getElementById("lb-next");
  const lbClose = document.getElementById("lb-close");

  let items = [];
  let rendered = 0;
  let currentIndex = 0;

  const toAbsPath = (p) => {
    if (!p) return "";
    if (/^https?:\/\//i.test(p)) return p;
    // normalize: "assets/.." -> "/assets/.."
    return p.startsWith("/") ? p : ("/" + p.replace(/^\.?\//, ""));
  };

  const fmtDate = (iso) => {
    if (!iso) return "";
    try{
      const d = new Date(iso);
      return d.toLocaleDateString(undefined, { year:"numeric", month:"short", day:"2-digit" });
    }catch{
      return iso;
    }
  };

  const setMode = (mode) => {
    document.body.classList.toggle("mode-feed", mode === "feed");
    btnGrid.setAttribute("aria-pressed", mode === "grid" ? "true" : "false");
    btnFeed.setAttribute("aria-pressed", mode === "feed" ? "true" : "false");
    localStorage.setItem("ig_mode", mode);
  };

  btnGrid?.addEventListener("click", () => setMode("grid"));
  btnFeed?.addEventListener("click", () => setMode("feed"));

  const loadMode = () => {
    const m = localStorage.getItem("ig_mode") || "grid";
    setMode(m === "feed" ? "feed" : "grid");
  };

  const openLightbox = (idx) => {
    currentIndex = idx;
    const it = items[currentIndex];
    if (!it) return;

    const img = toAbsPath(it.src || it.image || it.file);
    lbImg.src = img;
    lbImg.alt = `Instagram post ${it.shortcode || ""}`.trim();
    lbDate.textContent = fmtDate(it.timestamp);
    lbLink.href = it.href || it.url || "#";
    lb.classList.add("open");
    document.body.style.overflow = "hidden";
  };

  const closeLightbox = () => {
    lb.classList.remove("open");
    document.body.style.overflow = "";
  };

  const step = (dir) => {
    if (!items.length) return;
    currentIndex = (currentIndex + dir + items.length) % items.length;
    openLightbox(currentIndex);
  };

  lbPrev?.addEventListener("click", () => step(-1));
  lbNext?.addEventListener("click", () => step(+1));
  lbClose?.addEventListener("click", closeLightbox);
  lb?.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });

  window.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") step(-1);
    if (e.key === "ArrowRight") step(+1);
  });

  const makeTile = (it, idx) => {
    const a = document.createElement("a");
    a.className = "tile";
    a.href = it.href || it.url || "#";
    a.target = "_blank";
    a.rel = "noopener";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.decoding = "async";
    img.src = toAbsPath(it.src || it.image || it.file);
    img.alt = `Instagram image ${idx + 1}`;

    const meta = document.createElement("div");
    meta.className = "meta";
    const left = document.createElement("div");
    left.className = "pill";
    left.textContent = fmtDate(it.timestamp);
    const right = document.createElement("div");
    right.className = "pill";
    right.textContent = "View";
    meta.append(left, right);

    a.append(img, meta);

    // Click opens lightbox (instead of leaving site)
    a.addEventListener("click", (e) => {
      e.preventDefault();
      openLightbox(idx);
    });

    return a;
  };

  const renderNextBatch = () => {
    const slice = items.slice(rendered, rendered + BATCH);
    slice.forEach((it, k) => grid.appendChild(makeTile(it, rendered + k)));
    rendered += slice.length;

    if (rendered >= items.length) {
      status.textContent = `Showing ${items.length} posts.`;
      sentinel.style.display = "none";
    } else {
      status.textContent = `Showing ${rendered} / ${items.length}…`;
    }
  };

  const renderStories = () => {
    const top = items.slice(0, 12);
    stories.innerHTML = "";
    top.forEach((it, idx) => {
      const a = document.createElement("a");
      a.className = "story";
      a.href = it.href || it.url || "#";
      a.target = "_blank";
      a.rel = "noopener";

      const ring = document.createElement("div");
      ring.className = "ring";

      const img = document.createElement("img");
      img.loading = "lazy";
      img.decoding = "async";
      img.src = toAbsPath(it.src || it.image || it.file);
      img.alt = "Story preview";

      ring.appendChild(img);

      const d = document.createElement("div");
      d.className = "date";
      d.textContent = fmtDate(it.timestamp);

      a.append(ring, d);

      // click opens lightbox, not external
      a.addEventListener("click", (e) => {
        e.preventDefault();
        openLightbox(idx);
      });

      stories.appendChild(a);
    });
  };

  const main = async () => {
    loadMode();

    status.textContent = "Loading…";

    // Cache-bust lightly (keeps GH Pages caching from confusing you during updates)
    const url = `${FEED_URL}?v=${Date.now()}`;

    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
    const data = await r.json();

    items = (Array.isArray(data) ? data : []).slice();

    // sort newest first
    items.sort((a, b) => {
      const ta = Date.parse(a.timestamp || "") || 0;
      const tb = Date.parse(b.timestamp || "") || 0;
      return tb - ta;
    });

    if (!items.length) {
      status.textContent = "No posts found in local cache.";
      return;
    }

    renderStories();
    renderNextBatch();

    // Infinite scroll
    const io = new IntersectionObserver((entries) => {
      if (entries.some(e => e.isIntersecting)) {
        renderNextBatch();
      }
    }, { root: null, rootMargin: "800px 0px", threshold: 0 });

    io.observe(sentinel);
  };

  main().catch(err => {
    console.error(err);
    status.textContent = "Could not load the Instagram cache. Check /assets/instagram/feed.json exists and is valid JSON.";
  });
})();
