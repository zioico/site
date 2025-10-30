// Builds a simple slideshow on three project pages only
document.addEventListener('DOMContentLoaded', function () {
  const pages = ['/in-other-words','/enfim','/notes-to-self','/in-other-words/','/enfim/','/notes-to-self/'];
  if (!pages.includes(window.location.pathname)) return;

  const main = document.querySelector('main') ||
               document.querySelector('[role="main"]') ||
               document.querySelector('#content') ||
               document.body;

  // Choose images that are likely your photos (skip nav/header/footer)
  let imgs = Array.from(main.querySelectorAll('img'))
    .filter(img => !img.closest('nav,header,footer'))
    .filter(img => /images\.squarespace-cdn\.com|\/uploads\//i.test(img.src || ''));

  if (imgs.length < 2) return; // nothing to do

  // Build the wrapper & slideshow
  const wrap = document.createElement('div'); wrap.id = 'fi-wrap';
  const gallery = document.createElement('div'); gallery.className = 'fi-slideshow';

  imgs.forEach((img, i) => {
    // normalize URL to https
    let u = img.currentSrc || img.src || '';
    if (u.startsWith('//')) u = 'https:' + u;
    if (u.startsWith('http:')) u = u.replace(/^http:/,'https:');

    const fig = document.createElement('figure');
    fig.className = 'slide' + (i === 0 ? ' active' : '');
    const clone = img.cloneNode();
    clone.src = u; clone.removeAttribute('width'); clone.removeAttribute('height');
    fig.appendChild(clone);
    gallery.appendChild(fig);

    // remove original to avoid double render
    img.remove();
  });

  // Insert just under the first heading if present, else at top of main
  const anchor = main.querySelector('h1,h2');
  wrap.appendChild(gallery);

  const controls = document.createElement('div');
  controls.className = 'fi-controls';
  controls.innerHTML = '<button class="fi-button fi-prev" aria-label="Previous">‹</button><button class="fi-button fi-next" aria-label="Next">›</button>';
  wrap.appendChild(controls);

  if (anchor && anchor.parentNode === main) {
    anchor.insertAdjacentElement('afterend', wrap);
  } else {
    main.insertBefore(wrap, main.firstChild);
  }

  // Slideshow logic
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

