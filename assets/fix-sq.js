document.addEventListener('DOMContentLoaded', () => {
  // img tags that Squarespace left with data-src or data-image
  document.querySelectorAll('img[data-src], img[data-image]').forEach(img => {
    let u = img.getAttribute('data-src') || img.getAttribute('data-image');
    if (!u) return;
    if (u.startsWith('//')) u = 'https:' + u;
    if (u.startsWith('http:')) u = u.replace(/^http:/, 'https:');
    img.src = u;
    img.loading = img.loading || 'lazy';
  });

  // non-img elements that carry a data-image (used for background-image blocks)
  document.querySelectorAll('[data-image]:not(img)').forEach(el => {
    let u = el.getAttribute('data-image');
    if (!u) return;
    if (u.startsWith('//')) u = 'https:' + u;
    if (u.startsWith('http:')) u = u.replace(/^http:/, 'https:');
    el.style.backgroundImage = `url("${u}")`;
  });
});
