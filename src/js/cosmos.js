/* =========================================================================
   Cosmos — an optimal-transport background.
   A few clouds of "mass" (Gaussian components) are repeatedly transported
   between distributions via displacement interpolation: each particle rides a
   straight transport path as one measure morphs into the next, while faint
   threads trace the coupling. Replaces the old constellation graph.
   Vanilla 2D canvas, no dependencies. Respects prefers-reduced-motion,
   pauses when hidden, gently parts around the cursor.
   ========================================================================= */
(function () {
  "use strict";

  var canvas = document.getElementById("cosmos");
  if (!canvas) return;
  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0, raf = null, phase = 0;
  var PI = Math.PI, TAU = PI * 2;
  var COLORS = ["56,225,214", "76,141,255", "166,137,251"]; // cyan / blue / violet
  var pointer = { x: -9999, y: -9999, active: false };
  var K = 3;            // Gaussian components (mass lumps)
  var comps = [];       // { src, tgt } affine configs per component
  var parts = [];       // { zx, zy, ci, c, r }

  function rand(a, b) { return a + Math.random() * (b - a); }
  function randn() { var u = 1 - Math.random(), v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); }
  function ease(t) { return t * t * (3 - 2 * t); }

  // a random anisotropic Gaussian: mean + covariance factor M = R(ang)·diag(sx,sy)
  function newConfig() {
    var m = Math.min(W, H), ang = rand(0, PI), sx = rand(0.05, 0.17) * m, sy = rand(0.03, 0.12) * m;
    var c = Math.cos(ang), s = Math.sin(ang);
    return { mx: rand(0.14, 0.86) * W, my: rand(0.14, 0.86) * H, a: c * sx, b: -s * sy, cc: s * sx, d: c * sy };
  }
  function P(cfg, zx, zy) { return [cfg.mx + cfg.a * zx + cfg.b * zy, cfg.my + cfg.cc * zx + cfg.d * zy]; }

  function count() {
    var a = window.innerWidth * window.innerHeight;
    return Math.max(60, Math.min(Math.round(a / 9500), window.innerWidth < 720 ? 100 : 240));
  }

  function build() {
    comps = []; for (var k = 0; k < K; k++) comps.push({ src: newConfig(), tgt: newConfig() });
    var n = count(); parts = [];
    for (var i = 0; i < n; i++) parts.push({ zx: randn() * 0.92, zy: randn() * 0.92, ci: i % K, c: COLORS[(Math.random() * 3) | 0], r: Math.random() < 0.12 ? 2.1 : 1.4 });
  }

  function resize() {
    var w = window.innerWidth, h = window.innerHeight; W = w; H = h;
    canvas.width = Math.floor(w * DPR); canvas.height = Math.floor(h * DPR);
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (parts.length === 0) build();
    else for (var k = 0; k < K; k++) { comps[k].src = newConfig(); comps[k].tgt = newConfig(); }
  }

  function draw() {
    var e = ease(phase);
    ctx.clearRect(0, 0, W, H);
    // coupling threads — brightest mid-transport, gone at the settle points
    var threadA = 0.05 * Math.sin(phase * PI);
    if (threadA > 0.003) {
      ctx.lineWidth = 1;
      for (var i = 0; i < parts.length; i += 2) {
        var p = parts[i], cf = comps[p.ci];
        var s = P(cf.src, p.zx, p.zy), t = P(cf.tgt, p.zx, p.zy);
        ctx.strokeStyle = "rgba(" + p.c + "," + threadA.toFixed(3) + ")";
        ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(t[0], t[1]); ctx.stroke();
      }
    }
    // mass at the displacement-interpolated position
    for (var j = 0; j < parts.length; j++) {
      var q = parts[j], cf2 = comps[q.ci];
      var s2 = P(cf2.src, q.zx, q.zy), t2 = P(cf2.tgt, q.zx, q.zy);
      var x = s2[0] + (t2[0] - s2[0]) * e, y = s2[1] + (t2[1] - s2[1]) * e;
      if (pointer.active) {
        var dx = x - pointer.x, dy = y - pointer.y, d2 = dx * dx + dy * dy, R = 175;
        if (d2 < R * R && d2 > 1) { var d = Math.sqrt(d2), f = (1 - d / R) * 14; x += dx / d * f; y += dy / d * f; }
      }
      if (q.r > 2) { ctx.fillStyle = "rgba(" + q.c + ",0.10)"; ctx.beginPath(); ctx.arc(x, y, q.r * 3.4, 0, TAU); ctx.fill(); }
      ctx.fillStyle = "rgba(" + q.c + "," + (q.r > 2 ? 0.92 : 0.6) + ")";
      ctx.beginPath(); ctx.arc(x, y, q.r, 0, TAU); ctx.fill();
    }
  }

  function loop() {
    phase += 0.0016; // ~10 s per transport cycle
    if (phase >= 1) { phase = 0; for (var k = 0; k < K; k++) { comps[k].src = comps[k].tgt; comps[k].tgt = newConfig(); } }
    draw(); raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf) raf = requestAnimationFrame(loop); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  function staticFrame() { phase = 0.4; draw(); }

  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { DPR = Math.min(window.devicePixelRatio || 1, 2); resize(); if (reduce) staticFrame(); }, 160);
  });
  window.addEventListener("pointermove", function (e) { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; }, { passive: true });
  window.addEventListener("pointerleave", function () { pointer.active = false; });
  window.addEventListener("blur", function () { pointer.active = false; });
  document.addEventListener("visibilitychange", function () { if (reduce) return; if (document.hidden) stop(); else start(); });

  resize();
  if (reduce) staticFrame(); else start();
})();
