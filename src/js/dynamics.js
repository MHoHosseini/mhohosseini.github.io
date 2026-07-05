/* =========================================================================
   dynamics.js — a full-screen ODE / SDE "trailer".
   An ensemble of particles propagates under a chosen dynamical system
   (Euler–Maruyama), over a live vector-field geometry with fixed points and
   a faint reference grid. The (static) geometry is cached to an offscreen
   canvas and blitted each frame; only the particles are recomputed.
   Vanilla, no dependencies. Reduced-motion → a single static frame.
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
  var W = 0, H = 0, DOM = 3.7, scale = 1;
  var COLORS = ["56,225,214", "76,141,255", "166,137,251"];
  var pointer = { x: -9999, y: -9999, active: false };
  var TAU = Math.PI * 2;

  function randn() {
    var u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // f: velocity field. fixed: equilibria [x, y, type] (sink|source|saddle|center)
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

  var current = SYSTEMS[0];
  var N = 0, P = [], raf = null, visible = true;

  function count() {
    var a = window.innerWidth * window.innerHeight;
    var n = Math.round(a / 9000);
    return Math.max(60, Math.min(n, window.innerWidth < 680 ? 130 : 300));
  }
  function domX() { return (W / 2) / scale; }
  function domY() { return (H / 2) / scale; }

  function seed(p) {
    p.x = (Math.random() * 2 - 1) * domX();
    p.y = (Math.random() * 2 - 1) * domY();
    p.px = p.x; p.py = p.y;
    p.c = COLORS[(Math.random() * COLORS.length) | 0];
    p.life = 50 + Math.random() * 200;
  }
  function build() { N = count(); P = []; for (var i = 0; i < N; i++) { var p = {}; seed(p); P.push(p); } }

  function sx(x) { return W / 2 + x * scale; }
  function sy(y) { return H / 2 - y * scale; }

  var FP_COLOR = { sink: "56,225,214", source: "166,137,251", saddle: "226,181,103", center: "56,225,214" };

  // ---- static geometry, drawn once per system/resize to the offscreen canvas
  function renderField() {
    field.width = canvas.width; field.height = canvas.height;
    fctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fctx.clearRect(0, 0, W, H);

    // reference grid: axes + concentric unit circles
    fctx.strokeStyle = "rgba(120,160,240,0.06)"; fctx.lineWidth = 1;
    fctx.beginPath(); fctx.moveTo(0, sy(0)); fctx.lineTo(W, sy(0));
    fctx.moveTo(sx(0), 0); fctx.lineTo(sx(0), H); fctx.stroke();
    for (var r = 1; r <= 4; r++) {
      fctx.beginPath();
      fctx.strokeStyle = "rgba(120,160,240," + (0.05 - r * 0.008).toFixed(3) + ")";
      fctx.arc(sx(0), sy(0), r * scale, 0, TAU); fctx.stroke();
    }

    // vector-field streaks — the geometry of the current flow
    var step = W < 680 ? 48 : 56; fctx.lineWidth = 1;
    for (var px = step / 2; px < W; px += step) {
      for (var py = step / 2; py < H; py += step) {
        var x = (px - W / 2) / scale, y = (H / 2 - py) / scale;
        var v = current.f(x, y), m = Math.hypot(v[0], v[1]);
        if (m < 1e-4) continue;
        var L = Math.min(step * 0.34, 6 + m * 2.4);
        var ux = v[0] / m, uy = -v[1] / m;
        fctx.strokeStyle = "rgba(120,160,240," + Math.min(0.16, 0.05 + m * 0.02).toFixed(3) + ")";
        fctx.beginPath();
        fctx.moveTo(px - ux * L, py - uy * L); fctx.lineTo(px + ux * L, py + uy * L); fctx.stroke();
      }
    }

    // fixed points / equilibria
    for (var i = 0; i < current.fixed.length; i++) {
      var fp = current.fixed[i], c = FP_COLOR[fp[2]] || "56,225,214", X = sx(fp[0]), Y = sy(fp[1]);
      fctx.beginPath(); fctx.fillStyle = "rgba(" + c + ",0.12)"; fctx.arc(X, Y, 12, 0, TAU); fctx.fill();
      fctx.beginPath(); fctx.strokeStyle = "rgba(" + c + ",0.9)"; fctx.lineWidth = 1.4; fctx.arc(X, Y, 5, 0, TAU); fctx.stroke();
      if (fp[2] !== "center") { fctx.beginPath(); fctx.fillStyle = "rgba(" + c + ",0.95)"; fctx.arc(X, Y, 2, 0, TAU); fctx.fill(); }
    }
  }

  function resize() {
    var r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.max(1, Math.floor(W * DPR));
    canvas.height = Math.max(1, Math.floor(H * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    scale = Math.min(W, H) / (2 * DOM);
    ctx.clearRect(0, 0, W, H);
    if (P.length !== count()) build();
    renderField();
  }

  function integrate() {
    var dt = 0.02 * current.speed, sq = Math.sqrt(dt) * current.sigma, mx = domX() * 1.15, my = domY() * 1.15;
    for (var i = 0; i < N; i++) {
      var p = P[i]; p.px = p.x; p.py = p.y;
      for (var s = 0; s < 2; s++) {
        var v = current.f(p.x, p.y);
        p.x += v[0] * dt / 2 + sq * randn();
        p.y += v[1] * dt / 2 + sq * randn();
      }
      if (pointer.active) {
        var mxp = (pointer.x - W / 2) / scale, myp = (H / 2 - pointer.y) / scale;
        var dx = mxp - p.x, dy = myp - p.y, d2 = dx * dx + dy * dy, R = 2.2;
        if (d2 < R * R && d2 > 0.01) { var d = Math.sqrt(d2), f = (1 - d / R) * 0.05; p.x += dx / d * f; p.y += dy / d * f; }
      }
      p.life -= 1;
      if (p.x < -mx || p.x > mx || p.y < -my || p.y > my || p.life <= 0) seed(p);
    }
  }

  function draw() {
    ctx.fillStyle = "rgba(6,9,18,0.16)";
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(field, 0, 0, W, H);
    for (var i = 0; i < N; i++) {
      var p = P[i], x0 = sx(p.px), y0 = sy(p.py), x1 = sx(p.x), y1 = sy(p.y);
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

  function setSystem(sys) {
    current = sys; build(); renderField(); ctx.clearRect(0, 0, W, H);
    var nm = document.querySelector(".dyn-name"), eq = document.querySelector(".dyn-eq"), nt = document.querySelector(".dyn-note");
    if (nm) nm.textContent = sys.name;
    if (eq) eq.textContent = sys.eq;
    if (nt) nt.textContent = sys.note;
    document.querySelectorAll(".dyn-btn").forEach(function (b) {
      var on = b.dataset.sys === sys.id;
      b.classList.toggle("active", on); b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (reduce) staticFrame();
  }

  var controls = document.querySelector(".dyn-controls");
  if (controls) {
    ["ODE", "SDE"].forEach(function (kind) {
      var grp = document.createElement("div");
      grp.className = "dyn-group";
      grp.innerHTML = '<span class="dyn-group-label">' + kind + "</span>";
      SYSTEMS.filter(function (s) { return s.kind === kind; }).forEach(function (s) {
        var b = document.createElement("button");
        b.className = "dyn-btn"; b.dataset.sys = s.id; b.textContent = s.name;
        b.type = "button"; b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () { setSystem(s); });
        grp.appendChild(b);
      });
      controls.appendChild(grp);
    });
  }

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
  document.addEventListener("visibilitychange", function () {
    if (reduce) return; if (document.hidden) stop(); else start();
  });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(function (ents) {
      visible = ents[0].isIntersecting;
      if (reduce) return;
      if (visible) start(); else stop();
    }, { threshold: 0.02 }).observe(canvas);
  }

  resize(); setSystem(SYSTEMS[0]);
  if (reduce) staticFrame(); else start();
})();
