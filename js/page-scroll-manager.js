/**
 * Page Scroll Manager — intelligent snapping + auto-centering for Winamp-style 3-section flow.
 * Landing Hero → snap top | ASCII Slideshow → center canvas | Music Library → center clicked folder/track.
 * Side nav: hover-reveal Up/Down. IntersectionObserver, keyboard nav, History API, debounced resize.
 */
(function () {
  "use strict";

  var HEADER_H = 60;
  var SCROLL_PADDING = 20;
  var PULSE_DURATION_MS = 1500;
  var DEBOUNCE_RESIZE_MS = 150;
  var SNAP_COOLDOWN_MS = 800;

  var lastSnapTime = 0;
  var isScrollingProgrammatically = false;
  var currentSection = null;
  var resizeTimer = null;

  var sections = [
    { selector: ".landing-hero", action: "snapTop", id: "hero" },
    { selector: ".ascii-slideshow", action: "centerCanvas", id: "ascii" },
    { selector: "#viz", action: "libraryMode", id: "library" },
  ];

  function getHeaderHeight() {
    var h = document.querySelector("header");
    return (h && h.getBoundingClientRect().height) || HEADER_H;
  }

  function scrollToY(y, smooth) {
    isScrollingProgrammatically = true;
    window.scrollTo({ top: Math.max(0, y), behavior: smooth ? "smooth" : "auto" });
    setTimeout(function () {
      isScrollingProgrammatically = false;
    }, 600);
  }

  function snapToHero() {
    lastSnapTime = Date.now();
    scrollToY(0, true);
  }

  function snapToAscii() {
    var wrap = document.querySelector(".ascii-slideshow .winamp-ascii-wrap");
    if (!wrap) {
      var section = document.querySelector(".ascii-slideshow");
      if (section) {
        var rect = section.getBoundingClientRect();
        scrollToY(window.scrollY + rect.top - getHeaderHeight() - SCROLL_PADDING, true);
      }
      return;
    }
    lastSnapTime = Date.now();
    var rect = wrap.getBoundingClientRect();
    var wrapHeight = rect.height;
    var targetScroll = window.scrollY + rect.top - (window.innerHeight / 2) + (wrapHeight / 2) - getHeaderHeight() * 0.5;
    scrollToY(Math.max(0, targetScroll), true);
  }

  function centerOnMusicItem(item) {
    if (!item || !item.scrollIntoView) return;
    lastSnapTime = Date.now();
    item.scrollIntoView({ block: "center", behavior: "smooth" });
    highlightPulse(item);
  }

  function highlightPulse(el) {
    if (!el) return;
    el.classList.add("highlight-pulse");
    setTimeout(function () {
      el.classList.remove("highlight-pulse");
    }, PULSE_DURATION_MS);
  }

  function handleSectionFocus(el) {
    if (!el || isScrollingProgrammatically) return;
    var id = el.id || (el.classList && el.classList[0]) || "";
    if (currentSection === id) return;
    currentSection = id;
    document.querySelectorAll(".section-scroll-active").forEach(function (s) {
      s.classList.remove("section-scroll-active");
    });
    el.classList.add("section-scroll-active");
    if (typeof window.onScrollSectionFocus === "function") {
      window.onScrollSectionFocus({ section: el, id: id });
    }
  }

  function runSnapForSection(sectionConfig) {
    var el = document.querySelector(sectionConfig.selector);
    if (!el) return;
    if (sectionConfig.action === "snapTop") snapToHero();
    else if (sectionConfig.action === "centerCanvas") snapToAscii();
    else if (sectionConfig.action === "libraryMode") {
      var panel = document.getElementById("winamp-folders-panel");
      if (panel) panel.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }

  function setupIntersectionObserver() {
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          if (Date.now() - lastSnapTime < SNAP_COOLDOWN_MS) return;
          handleSectionFocus(entry.target);
        });
      },
      { threshold: 0.35, rootMargin: "-" + getHeaderHeight() + "px 0px 0px 0px" }
    );

    sections.forEach(function (s) {
      var el = document.querySelector(s.selector);
      if (el) observer.observe(el);
    });
  }

  function setupPageNav() {
    var nav = document.querySelector(".page-nav");
    if (!nav) {
      nav = document.createElement("div");
      nav.className = "page-nav";
      nav.setAttribute("aria-label", "Page navigation");
      nav.innerHTML =
        '<button type="button" class="nav-btn nav-up" aria-label="Scroll Up">↑</button>' +
        '<button type="button" class="nav-btn nav-down" aria-label="Scroll Down">↓</button>';
      document.body.appendChild(nav);
    }

    var up = nav.querySelector(".nav-up");
    var down = nav.querySelector(".nav-down");

    function scrollByViewport(direction) {
      var delta = direction === "up" ? -window.innerHeight : window.innerHeight;
      lastSnapTime = Date.now();
      scrollToY(window.scrollY + delta, true);
    }

    if (up) up.addEventListener("click", function () { scrollByViewport("up"); });
    if (down) down.addEventListener("click", function () { scrollByViewport("down"); });
  }

  function unifiedClickHandler(e) {
    var target = e.target;

    if (target.closest(".nav-btn")) return;

    var folderOrTrack = target.closest(".winamp-folder-tracks li") || target.closest(".winamp-folder-item");
    if (folderOrTrack && target.closest("#winamp-folders-panel")) {
      centerOnMusicItem(folderOrTrack);
      return;
    }

    if (target.closest(".ascii-slideshow")) {
      snapToAscii();
      return;
    }

    if (target.closest(".landing-hero")) {
      snapToHero();
      return;
    }
  }

  function setupKeyboard() {
    document.addEventListener("keydown", function (e) {
      if (e.target.closest("input, textarea, [contenteditable]")) return;
      switch (e.key) {
        case "ArrowUp":
        case "PageUp":
          e.preventDefault();
          scrollToY(window.scrollY - (e.key === "PageUp" ? window.innerHeight : 120), true);
          break;
        case "ArrowDown":
        case "PageDown":
          e.preventDefault();
          scrollToY(window.scrollY + (e.key === "PageDown" ? window.innerHeight : 120), true);
          break;
      }
    });
  }

  function onResize() {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (currentSection) {
        var cfg = sections.find(function (s) {
          var el = document.querySelector(s.selector);
          return el && el.classList.contains("section-scroll-active");
        });
        if (cfg && cfg.action === "libraryMode") {
          var panel = document.getElementById("winamp-folders-panel");
          var centered = panel && panel.querySelector(".highlight-pulse");
          if (centered) centered.scrollIntoView({ block: "center", behavior: "auto" });
        }
      }
      resizeTimer = null;
    }, DEBOUNCE_RESIZE_MS);
  }

  var historySaveTimer = null;
  var HISTORY_DEBOUNCE_MS = 150;
  function initHistory() {
    function saveScroll() {
      try {
        history.replaceState({ scrollY: window.scrollY }, "", window.location.href);
      } catch (err) {}
    }
    window.addEventListener("scroll", function () {
      if (isScrollingProgrammatically) return;
      if (historySaveTimer) clearTimeout(historySaveTimer);
      historySaveTimer = setTimeout(function () {
        historySaveTimer = null;
        requestAnimationFrame(saveScroll);
      }, HISTORY_DEBOUNCE_MS);
    });
    window.addEventListener("popstate", function (e) {
      if (e.state && typeof e.state.scrollY === "number") {
        scrollToY(e.state.scrollY, false);
      }
    });
  }

  function init() {
    setupPageNav();
    setupIntersectionObserver();
    setupKeyboard();
    initHistory();
    window.addEventListener("resize", onResize);

    document.addEventListener("click", unifiedClickHandler, { passive: false });

    var hero = document.querySelector(".landing-hero");
    if (hero) hero.classList.add("section-scroll-active");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.pageScrollManager = {
    snapToHero: snapToHero,
    snapToAscii: snapToAscii,
    centerOnMusicItem: centerOnMusicItem,
    runSnapForSection: runSnapForSection,
  };
})();
