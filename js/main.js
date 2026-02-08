/**
 * Main — nav toggle, player panel toggle, loader, nav active state (YEAR0001-style)
 */
(function () {
  const navBtn = document.querySelector('.navMobileButton');
  const navList = document.querySelector('.navList');
  const loader = document.getElementById('site-loader');

  function setActiveNav(id) {
    ['.navList', '.navList-footer'].forEach(function (sel) {
      var list = document.querySelector(sel);
      if (!list) return;
      list.querySelectorAll('a[href^="#"]').forEach(function (a) {
        var href = a.getAttribute('href');
        if (href === '#' + id) {
          a.classList.add('active');
        } else {
          a.classList.remove('active');
        }
      });
    });
  }

  var cachedSections = null;
  function getSections() {
    if (!cachedSections) cachedSections = document.querySelectorAll('section[id]');
    return cachedSections;
  }
  function updateActiveOnScroll() {
    var sections = getSections();
    if (!sections.length) return;
    var scrollY = window.scrollY;
    var headerH = 60;
    var current = null;
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      var top = sec.getBoundingClientRect().top + scrollY;
      var h = sec.offsetHeight;
      if (scrollY >= top - headerH - 80 && scrollY < top + h - headerH) {
        current = sec.id;
        break;
      }
    }
    if (current) setActiveNav(current);
  }

  if (navBtn && navList) {
    navBtn.addEventListener('click', function () {
      const open = navList.classList.toggle('is-open');
      navBtn.setAttribute('aria-expanded', open);
    });
    navList.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        navList.classList.remove('is-open');
        navBtn.setAttribute('aria-expanded', 'false');
        var href = a.getAttribute('href');
        if (href && href.indexOf('#') === 0) {
          setActiveNav(href.slice(1));
        }
      });
    });
  }

  document.querySelectorAll('.navList-footer a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function () {
      var href = a.getAttribute('href');
      if (href && href.indexOf('#') === 0) setActiveNav(href.slice(1));
    });
  });

  var scrollTicking = false;
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      updateActiveOnScroll();
      scrollTicking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  updateActiveOnScroll();

  if (loader) {
    window.addEventListener('load', function () {
      loader.classList.add('is-hidden');
    });
    setTimeout(function () {
      loader.classList.add('is-hidden');
    }, 1500);
  }
})();
