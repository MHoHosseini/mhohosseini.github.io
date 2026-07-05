/* =========================================================================
   app.js — navigation, scroll reveals, progress bar, card glow, project filter
   Vanilla JS, no dependencies.
   ========================================================================= */
(function () {
  "use strict";

  /* ---- Navbar: scrolled state + mobile toggle ---- */
  var nav = document.querySelector(".nav");
  var toggle = document.querySelector(".nav-toggle");
  var links = document.querySelector(".nav-links");

  function onScroll() {
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 20);
    var sp = document.querySelector(".scroll-progress");
    if (sp) {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      sp.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (toggle && links) {
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        links.classList.remove("open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---- Scroll reveal ---- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("in"); });
  }

  /* ---- Active nav link by section (home page) ---- */
  var sections = document.querySelectorAll("section[id]");
  var navAnchors = links ? links.querySelectorAll('a[href*="#"]') : [];
  if (sections.length && navAnchors.length && "IntersectionObserver" in window) {
    var map = {};
    navAnchors.forEach(function (a) {
      var id = a.getAttribute("href").split("#")[1];
      if (id) map[id] = a;
    });
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && map[en.target.id]) {
          navAnchors.forEach(function (a) { a.classList.remove("active"); });
          map[en.target.id].classList.add("active");
        }
      });
    }, { threshold: 0.5 });
    sections.forEach(function (s) { if (map[s.id]) so.observe(s); });
  }

  /* ---- Research card pointer glow ---- */
  document.querySelectorAll(".rcard").forEach(function (card) {
    card.addEventListener("pointermove", function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
      card.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
    });
  });

  /* ---- Project filter + search ---- */
  var filterBar = document.querySelector(".filter-bar");
  if (filterBar) {
    var buttons = filterBar.querySelectorAll(".filter-btn");
    var search = filterBar.querySelector("input");
    var cards = Array.prototype.slice.call(document.querySelectorAll(".pcard"));
    var headings = Array.prototype.slice.call(document.querySelectorAll(".cat-heading"));
    var empty = document.querySelector(".no-results");
    var current = "all";

    function apply() {
      var q = (search && search.value || "").trim().toLowerCase();
      var shown = 0;
      cards.forEach(function (c) {
        var okCat = current === "all" || c.dataset.category === current;
        var hay = (c.dataset.search || "").toLowerCase();
        var okQ = !q || hay.indexOf(q) !== -1;
        var show = okCat && okQ;
        c.style.display = show ? "" : "none";
        if (show) shown++;
      });
      // hide category headings with no visible cards
      headings.forEach(function (h) {
        var cat = h.dataset.category;
        var any = cards.some(function (c) {
          return c.dataset.category === cat && c.style.display !== "none";
        });
        h.style.display = any ? "" : "none";
      });
      if (empty) empty.style.display = shown === 0 ? "block" : "none";
    }

    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        buttons.forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        current = b.dataset.filter;
        apply();
      });
    });
    if (search) search.addEventListener("input", apply);
  }

  /* ---- Year in footer ---- */
  var y = document.querySelector("[data-year]");
  if (y) y.textContent = new Date().getFullYear();
})();
