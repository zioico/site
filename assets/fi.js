document.addEventListener('DOMContentLoaded', function () {
  const pages = [
    '/in-other-words','/enfim','/notes-to-self',
    '/in-other-words/','/enfim/','/notes-to-self/'
  ];
  if (!pages.includes(window.location.pathname)) return;

  const main =
    document.querySelector('main') ||
    document.querySelector('[role="main"]') ||
    document.querySelector('#content') ||
    document.body;

  // Pick likely project images (skip nav/header/footer)
  let imgs = Array.from(main.querySelectorAll('img'))
    .filter(img => !img.closest('nav,header,footer'))
    .filter(img => /images\.squarespace-cdn\.com/i.test(img.src || ''));

  if (imgs.length < 2) return;

  const wrap = document.createElement('div');
  wrap.id = 'fi-wrap';

  const gallery = document.createElement('div');
  gallery.className = 'fi-slideshow';

  // Build clean slides
  imgs.forEach((img, i) => {
    let u = img.currentSrc || img.src || '';
    if (u.startsWith('//')) u = 'https:' + u;
    if (u.startsWith('http:')) u = u.replace(/^http:/,'https:');

    const fig = document.createElement('figure');
    fig.className = 'slide' + (i === 0 ? ' active' : '');

    const fresh = document.createElement('img');
    fresh.src = u;
    fresh.alt = img.alt || '';
    fresh.loading = 'lazy';
    fresh.decoding = 'async';

    fig.appendChild(fresh);
    gallery.appendChild(fig);

    // remove original markup so they don't stack
    img.remove();
  });

  const controls = document.createElement('div');
  controls.className = 'fi-controls';
  controls.innerHTML =
    '<button class="fi-button fi-prev" aria-label="Previous">‹</button>' +
    '<button class="fi-button fi-next" aria-label="Next">›</button>';

  wrap.appendChild(gallery);
  wrap.appendChild(controls);

  const anchor = main.querySelector('h1,h2');
  if (anchor && anchor.parentNode === main) anchor.insertAdjacentElement('afterend', wrap);
  else main.insertBefore(wrap, main.firstChild);

  const slides = Array.from(gallery.querySelectorAll('.slide'));
  let idx = 0;

  function show(i){
    idx = (i + slides.length) % slides.length;
    slides.forEach((s,j)=> s.classList.toggle('active', j === idx));
  }

  controls.querySelector('.fi-prev').addEventListener('click', ()=> show(idx - 1));
  controls.querySelector('.fi-next').addEventListener('click', ()=> show(idx + 1));
  gallery.addEventListener('click', ()=> show(idx + 1));

  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') show(idx + 1);
    if (e.key === 'ArrowLeft') show(idx - 1);
  });
});
