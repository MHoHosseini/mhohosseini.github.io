/* =========================================================================
   dynamics.js — a full-screen ODE / SDE "trailer", now with curved geometry.
   An ensemble propagates under a chosen dynamical system (Euler–Maruyama),
   inside a space of chosen constant curvature: Euclidean, Spherical, or
   Hyperbolic. One conformal metric unifies all three:
       ds² = 4 (dx²+dy²) / (1 + κ r²)²
   κ = 0 → plane, κ > 0 → sphere (stereographic), κ < 0 → Poincaré disk.
   Brownian motion diffuses with coefficient 1/λ, so curvature is felt, not
   just drawn. Vanilla, no dependencies. Reduced-motion → a static frame.
   ========================================================================= */
(function () {
  "use strict";

  var canvas = document.getElementById("dynamics");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;
  var field = document.createElement("canvas");
  var fctx = field.getContext("2d");

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function dpr() { return Math.min(window.devicePixelRatio || 1, 1.4); }
  var DPR = dpr();
  var W = 0, H = 0, DOM = 3.7, scaleE = 1, Rs = 1;
  var COLORS = ["56,225,214", "76,141,255", "166,137,251"];
  var pointer = { x: -9999, y: -9999, active: false };
  var TAU = Math.PI * 2;

  function randn() {
    var u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  var SYSTEMS = [
    { id: "spiral", kind: "ODE", name: "Spiral sink", eq: "ẋ = −¼x − y,  ẏ = x − ¼y",
      note: "A rotating flow spiralling to equilibrium — a cyclone in phase space.",
      sigma: 0.04, speed: 1.0, fixed: [[0, 0, "sink"]],
      f: function (x, y) { return [-0.25 * x - y, x - 0.25 * y]; } },
    { id: "rotation", kind: "ODE", name: "Rotation", eq: "ẋ = −y,  ẏ = x",
      note: "A pure rotation — every orbit a closed circle, a foliation of the plane.",
      sigma: 0.015, speed: 0.9, fixed: [[0, 0, "center"]],
      f: function (x, y) { return [-y, x]; } },
    { id: "vanderpol", kind: "ODE", name: "Van der Pol", eq: "ẋ = y,  ẏ = μ(1−x²)y − x",
      note: "A nonlinear oscillator relaxing onto a limit cycle.",
      sigma: 0.035, speed: 0.72, fixed: [[0, 0, "source"]],
      f: function (x, y) { return [y, 1.6 * (1 - x * x) * y - x]; } },
    { id: "duffing", kind: "ODE", name: "Duffing", eq: "ẋ = y,  ẏ = x − x³ − 0.15y",
      note: "A double-well oscillator — two basins split by a saddle and its manifolds.",
      sigma: 0.03, speed: 0.85, fixed: [[1, 0, "sink"], [-1, 0, "sink"], [0, 0, "saddle"]],
      f: function (x, y) { return [y, x - x * x * x - 0.15 * y]; } },
    { id: "pendulum", kind: "ODE", name: "Pendulum", eq: "θ̇ = ω,  ω̇ = −sinθ − 0.15ω",
      note: "A damped pendulum settling through its phase portrait.",
      sigma: 0.04, speed: 0.9, fixed: [[0, 0, "sink"], [Math.PI, 0, "saddle"], [-Math.PI, 0, "saddle"]],
      f: function (x, y) { return [y, -Math.sin(x) - 0.15 * y]; } },

    { id: "ou", kind: "SDE", name: "Ornstein–Uhlenbeck", eq: "dx = −θx dt + σ dW",
      note: "Mean-reverting diffusion with a Gaussian stationary law.",
      sigma: 0.72, speed: 1.0, fixed: [[0, 0, "sink"]],
      f: function (x, y) { return [-0.8 * x, -0.8 * y]; } },
    { id: "doublewell", kind: "SDE", name: "Double well", eq: "dx = (x − x³) dt + σ dW",
      note: "Bistable diffusion hopping between two potential wells.",
      sigma: 0.55, speed: 1.0, fixed: [[1, 0, "sink"], [-1, 0, "sink"], [0, 0, "saddle"]],
      f: function (x, y) { return [x - x * x * x, -1.4 * y]; } },
    { id: "noisyspiral", kind: "SDE", name: "Noisy spiral", eq: "dx = Ax dt + σ dW",
      note: "A stochastic cyclone — deterministic rotation blurred by noise.",
      sigma: 0.42, speed: 1.0, fixed: [[0, 0, "sink"]],
      f: function (x, y) { return [-0.22 * x - y, x - 0.22 * y]; } },
    { id: "stochpendulum", kind: "SDE", name: "Stochastic pendulum", eq: "dθ = ω dt,  dω = (−sinθ − γω) dt + σ dW",
      note: "A pendulum kicked by noise — libration, rotation, and escapes.",
      sigma: 0.45, speed: 0.9, fixed: [[0, 0, "sink"], [Math.PI, 0, "saddle"], [-Math.PI, 0, "saddle"]],
      f: function (x, y) { return [y, -Math.sin(x) - 0.2 * y]; } },
    { id: "brownian", kind: "SDE", name: "Brownian motion", eq: "dx = σ dW",
      note: "Pure diffusion — noise with no drift, the scaffold of it all.",
      sigma: 0.6, speed: 1.0, fixed: [],
      f: function () { return [0, 0]; } }
  ];

  var GEOMS = { euclidean: 0, spherical: 1, hyperbolic: -1 };
  var GEO_NOTE = {
    euclidean: "Flat space — zero curvature.",
    spherical: "Positive curvature — a sphere; recurrent, geodesics reconverge.",
    hyperbolic: "Negative curvature — the Poincaré disk; walkers flee to the boundary."
  };

  var current = SYSTEMS[0];
  var geom = "euclidean", curv = 0.85;
  var N = 0, P = [], raf = null, visible = true;
  var ODES = DOM; // vector-field is evaluated on chart·ODES so it spans the disk

  function kappa() { return GEOMS[geom] * curv; }
  function curved() { return geom !== "euclidean"; }
  // horizon radius in the unit chart (hyperbolic closes in as curvature grows)
  function rmax() {
    var k = kappa();
    if (k < 0) return 0.985 * Math.min(1, 1 / Math.sqrt(-k));
    return 0.985;
  }
  function lam(r2) { return 2 / (1 + kappa() * r2); }

  function count() {
    var a = window.innerWidth * window.innerHeight;
    var n = Math.round(a / 9000);
    return Math.max(60, Math.min(n, window.innerWidth < 680 ? 130 : 300));
  }

  function seed(p) {
    if (curved()) {
      var r = Math.sqrt(Math.random()) * rmax() * 0.96, a = Math.random() * TAU;
      p.x = r * Math.cos(a); p.y = r * Math.sin(a);
    } else {
      p.x = (Math.random() * 2 - 1) * (W / 2) / scaleE;
      p.y = (Math.random() * 2 - 1) * (H / 2) / scaleE;
    }
    p.px = p.x; p.py = p.y;
    p.c = COLORS[(Math.random() * COLORS.length) | 0];
    p.life = 50 + Math.random() * 200;
  }
  function build() { N = count(); P = []; for (var i = 0; i < N; i++) { var p = {}; seed(p); P.push(p); } }

  // chart -> screen
  function SX(x) { return curved() ? W / 2 + x * Rs : W / 2 + x * scaleE; }
  function SY(y) { return curved() ? H / 2 - y * Rs : H / 2 - y * scaleE; }
  // screen -> chart
  function CX(px) { return curved() ? (px - W / 2) / Rs : (px - W / 2) / scaleE; }
  function CY(py) { return curved() ? (H / 2 - py) / Rs : (H / 2 - py) / scaleE; }

  var FP_COLOR = { sink: "56,225,214", source: "166,137,251", saddle: "226,181,103", center: "56,225,214" };

  function renderField() {
    field.width = canvas.width; field.height = canvas.height;
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fctx.clearRect(0, 0, W, H);
    if (curved()) renderCurvedGrid(); else renderFlatGrid();

    // vector-field streaks (sample a screen grid inside the domain)
    var step = W < 680 ? 48 : 56; fctx.lineWidth = 1;
    var cx = W / 2, cy = H / 2, rm = rmax() * Rs;
    for (var px = step / 2; px < W; px += step) {
      for (var py = step / 2; py < H; py += step) {
        if (curved() && (px - cx) * (px - cx) + (py - cy) * (py - cy) > rm * rm) continue;
        var x = CX(px), y = CY(py);
        var s = curved() ? ODES : 1;
        var v = current.f(x * s, y * s), m = Math.hypot(v[0], v[1]);
        if (m < 1e-4) continue;
        var L = Math.min(step * 0.34, 6 + m * 2.4), ux = v[0] / m, uy = -v[1] / m;
        fctx.strokeStyle = "rgba(120,160,240," + Math.min(0.16, 0.05 + m * 0.02).toFixed(3) + ")";
        fctx.beginPath();
        fctx.moveTo(px - ux * L, py - uy * L); fctx.lineTo(px + ux * L, py + uy * L); fctx.stroke();
      }
    }

    // fixed points
    for (var i = 0; i < current.fixed.length; i++) {
      var fp = current.fixed[i], x0 = fp[0], y0 = fp[1];
      if (curved()) { x0 /= ODES; y0 /= ODES; if (x0 * x0 + y0 * y0 > rmax() * rmax()) continue; }
      var c = FP_COLOR[fp[2]] || "56,225,214", X = SX(x0), Y = SY(y0);
      fctx.beginPath(); fctx.fillStyle = "rgba(" + c + ",0.12)"; fctx.arc(X, Y, 12, 0, TAU); fctx.fill();
      fctx.beginPath(); fctx.strokeStyle = "rgba(" + c + ",0.9)"; fctx.lineWidth = 1.4; fctx.arc(X, Y, 5, 0, TAU); fctx.stroke();
      if (fp[2] !== "center") { fctx.beginPath(); fctx.fillStyle = "rgba(" + c + ",0.95)"; fctx.arc(X, Y, 2, 0, TAU); fctx.fill(); }
    }
  }

  function renderFlatGrid() {
    fctx.strokeStyle = "rgba(120,160,240,0.06)"; fctx.lineWidth = 1;
    fctx.beginPath(); fctx.moveTo(0, SY(0)); fctx.lineTo(W, SY(0));
    fctx.moveTo(SX(0), 0); fctx.lineTo(SX(0), H); fctx.stroke();
    for (var r = 1; r <= 4; r++) {
      fctx.beginPath();
      fctx.strokeStyle = "rgba(120,160,240," + (0.05 - r * 0.008).toFixed(3) + ")";
      fctx.arc(SX(0), SY(0), r * scaleE, 0, TAU); fctx.stroke();
    }
  }

  // geodesic polar grid: equidistant metric circles + radial geodesics + horizon
  function renderCurvedGrid() {
    var k = kappa(), cx = W / 2, cy = H / 2, rm = rmax();
    // spherical shading — read the disk as a globe
    if (k > 0) {
      var g = fctx.createRadialGradient(cx - rm * Rs * 0.28, cy - rm * Rs * 0.3, rm * Rs * 0.1, cx, cy, rm * Rs);
      g.addColorStop(0, "rgba(76,141,255,0.10)");
      g.addColorStop(0.7, "rgba(20,32,66,0.05)");
      g.addColorStop(1, "rgba(5,8,18,0.32)");
      fctx.fillStyle = g; fctx.beginPath(); fctx.arc(cx, cy, rm * Rs, 0, TAU); fctx.fill();
    }
    // equidistant metric circles
    var rhoMax = metricDist(rm), step = rhoMax / 5;
    fctx.lineWidth = 1;
    for (var i = 1; i <= 4; i++) {
      var r = invMetric(i * step);
      if (r >= rm) break;
      fctx.beginPath();
      fctx.strokeStyle = "rgba(120,160,240," + (0.11 - i * 0.012).toFixed(3) + ")";
      fctx.arc(cx, cy, r * Rs, 0, TAU); fctx.stroke();
    }
    // radial geodesics
    for (var a = 0; a < 16; a++) {
      var ang = a / 16 * TAU;
      fctx.beginPath(); fctx.strokeStyle = "rgba(120,160,240,0.045)";
      fctx.moveTo(cx, cy); fctx.lineTo(cx + Math.cos(ang) * rm * Rs, cy - Math.sin(ang) * rm * Rs); fctx.stroke();
    }
    // horizon / rim
    fctx.beginPath();
    if (k < 0) { fctx.setLineDash([3, 4]); fctx.strokeStyle = "rgba(166,137,251,0.55)"; }
    else { fctx.setLineDash([]); fctx.strokeStyle = "rgba(56,225,214,0.5)"; }
    fctx.lineWidth = 1.4; fctx.arc(cx, cy, rm * Rs, 0, TAU); fctx.stroke(); fctx.setLineDash([]);
  }

  function metricDist(r) {
    var k = kappa();
    if (k > 0) { var s = Math.sqrt(k); return (2 / s) * Math.atan(s * r); }
    if (k < 0) { var t = Math.sqrt(-k); return (1 / t) * Math.log((1 + t * r) / (1 - t * r)); }
    return 2 * r;
  }
  function invMetric(rho) {
    var k = kappa();
    if (k > 0) { var s = Math.sqrt(k); return Math.tan(s * rho / 2) / s; }
    if (k < 0) { var t = Math.sqrt(-k); return Math.tanh(t * rho / 2) / t; }
    return rho / 2;
  }

  function resize() {
    var r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.max(1, Math.floor(W * DPR));
    canvas.height = Math.max(1, Math.floor(H * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    scaleE = Math.min(W, H) / (2 * DOM);
    Rs = 0.44 * Math.min(W, H);
    ctx.clearRect(0, 0, W, H);
    build();
    renderField();
  }

  function integrate() {
    var dt = 0.02 * current.speed, base = current.sigma, cur = curved(), rm = rmax();
    for (var i = 0; i < N; i++) {
      var p = P[i]; p.px = p.x; p.py = p.y;
      for (var s = 0; s < 2; s++) {
        if (cur) {
          var r2 = p.x * p.x + p.y * p.y, g = (1 + kappa() * r2) / 2; // = 1/λ
          if (g < 0.02) g = 0.02;
          var v = current.f(p.x * ODES, p.y * ODES);
          p.x += g * (v[0] / ODES) * dt / 2 + g * base * Math.sqrt(dt / 2) * randn() * 0.5;
          p.y += g * (v[1] / ODES) * dt / 2 + g * base * Math.sqrt(dt / 2) * randn() * 0.5;
        } else {
          var w = current.f(p.x, p.y);
          p.x += w[0] * dt / 2 + base * Math.sqrt(dt / 2) * randn();
          p.y += w[1] * dt / 2 + base * Math.sqrt(dt / 2) * randn();
        }
      }
      if (pointer.active) {
        var mx = CX(pointer.x), my = CY(pointer.y);
        var dx = mx - p.x, dy = my - p.y, d2 = dx * dx + dy * dy, R = cur ? 0.6 : 2.2;
        if (d2 < R * R && d2 > 1e-4) { var d = Math.sqrt(d2), f = (1 - d / R) * (cur ? 0.02 : 0.05); p.x += dx / d * f; p.y += dy / d * f; }
      }
      if (cur) {
        var rr = Math.hypot(p.x, p.y);
        if (rr > rm) {
          if (kappa() > 0) { var nr = 2 * rm - rr; if (nr < 0) nr = rm * Math.random(); p.x *= nr / rr; p.y *= nr / rr; }
          else { p.x *= (rm * 0.999) / rr; p.y *= (rm * 0.999) / rr; } // pile at hyperbolic horizon
        }
      } else {
        var mX = (W / 2) / scaleE * 1.15, mY = (H / 2) / scaleE * 1.15;
        if (p.x < -mX || p.x > mX || p.y < -mY || p.y > mY) seed(p);
      }
      p.life -= 1;
      if (p.life <= 0) seed(p);
    }
  }

  function draw() {
    ctx.fillStyle = "rgba(6,9,18,0.16)";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(field, 0, 0, W, H);
    for (var i = 0; i < N; i++) {
      var p = P[i], x0 = SX(p.px), y0 = SY(p.py), x1 = SX(p.x), y1 = SY(p.y);
      ctx.strokeStyle = "rgba(" + p.c + ",0.5)"; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.fillStyle = "rgba(" + p.c + ",0.9)";
      ctx.beginPath(); ctx.arc(x1, y1, 1.2, 0, TAU); ctx.fill();
    }
  }

  function loop() { integrate(); draw(); raf = requestAnimationFrame(loop); }
  function start() { if (!raf && !reduce && visible) raf = requestAnimationFrame(loop); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  function staticFrame() { ctx.clearRect(0, 0, W, H); for (var k = 0; k < 320; k++) { integrate(); draw(); } }

  function refresh() { build(); renderField(); ctx.clearRect(0, 0, W, H); if (reduce) staticFrame(); }

  function updateReadout() {
    var nm = document.querySelector(".dyn-name"), eq = document.querySelector(".dyn-eq"), nt = document.querySelector(".dyn-note");
    if (nm) nm.textContent = current.name;
    if (eq) eq.textContent = current.eq;
    if (nt) {
      var geoTxt = geom.charAt(0).toUpperCase() + geom.slice(1) + (curved() ? " · κ = " + (kappa()).toFixed(2) : "");
      nt.textContent = current.note + "  —  " + geoTxt + ". " + GEO_NOTE[geom];
    }
  }

  function setSystem(sys) {
    current = sys; refresh();
    document.querySelectorAll(".dyn-btn").forEach(function (b) {
      var on = b.dataset.sys === sys.id; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    updateReadout();
  }
  function setGeom(g) {
    geom = g; refresh();
    document.querySelectorAll(".geo-btn").forEach(function (b) {
      var on = b.dataset.geo === g; b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    var sl = document.querySelector(".dyn-curv");
    if (sl) sl.classList.toggle("disabled", g === "euclidean");
    updateReadout();
  }

  // ---- controls ----
  var controls = document.querySelector(".dyn-controls");
  if (controls) {
    ["ODE", "SDE"].forEach(function (kind) {
      var grp = document.createElement("div");
      grp.className = "dyn-group";
      grp.innerHTML = '<span class="dyn-group-label">' + kind + "</span>";
      SYSTEMS.filter(function (s) { return s.kind === kind; }).forEach(function (s) {
        var b = document.createElement("button");
        b.className = "dyn-btn"; b.dataset.sys = s.id; b.textContent = s.name; b.type = "button";
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () { setSystem(s); });
        grp.appendChild(b);
      });
      controls.appendChild(grp);
    });
    // geometry group + curvature slider
    var gg = document.createElement("div");
    gg.className = "dyn-group dyn-geo";
    gg.innerHTML = '<span class="dyn-group-label">GEO</span>';
    [["euclidean", "Euclidean"], ["spherical", "Spherical"], ["hyperbolic", "Hyperbolic"]].forEach(function (pair) {
      var b = document.createElement("button");
      b.className = "geo-btn" + (pair[0] === "euclidean" ? " active" : "");
      b.dataset.geo = pair[0]; b.textContent = pair[1]; b.type = "button";
      b.setAttribute("aria-pressed", pair[0] === "euclidean" ? "true" : "false");
      b.addEventListener("click", function () { setGeom(pair[0]); });
      gg.appendChild(b);
    });
    var lab = document.createElement("label");
    lab.className = "dyn-curv disabled";
    lab.innerHTML = '<span>curvature</span>';
    var range = document.createElement("input");
    range.type = "range"; range.min = "0.4"; range.max = "1.4"; range.step = "0.05"; range.value = "0.85";
    range.setAttribute("aria-label", "Curvature magnitude");
    range.addEventListener("input", function () { curv = parseFloat(range.value); if (curved()) refresh(); updateReadout(); });
    lab.appendChild(range);
    gg.appendChild(lab);
    controls.appendChild(gg);
  }

  // ---- lifecycle ----
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { DPR = dpr(); resize(); if (reduce) staticFrame(); }, 180);
  });
  window.addEventListener("pointermove", function (e) {
    var r = canvas.getBoundingClientRect();
    if (e.clientY >= r.top && e.clientY <= r.bottom) { pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.active = true; }
    else pointer.active = false;
  }, { passive: true });
  window.addEventListener("blur", function () { pointer.active = false; });
  document.addEventListener("visibilitychange", function () { if (reduce) return; if (document.hidden) stop(); else start(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (ents) { visible = ents[0].isIntersecting; if (reduce) return; if (visible) start(); else stop(); }, { threshold: 0.02 }).observe(canvas);
  }

  resize(); setSystem(SYSTEMS[0]);
  if (reduce) staticFrame(); else start();
})();
