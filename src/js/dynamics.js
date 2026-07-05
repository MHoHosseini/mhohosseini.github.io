/* =========================================================================
   dynamics.js — an interactive ODE / SDE phase-flow for the landing panel.
   Choose a system; watch an ensemble of particles propagate under it,
   integrated with Euler–Maruyama. Perturbations use the site's particle
   palette. Vanilla, no dependencies. Reduced-motion → a static snapshot.
   ========================================================================= */
(function () {
  "use strict";

  var canvas = document.getElementById("dynamics");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0, DOM = 3.4; // math domain: [-DOM, DOM]^2
  var COLORS = ["56,225,214", "76,141,255", "166,137,251"];

  function randn() { // Box–Muller
    var u = 1 - Math.random(), v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // Each system: velocity field f(x,y) -> [dx,dy], plus a stochastic sigma.
  var SYSTEMS = [
    { id: "spiral", kind: "ODE", name: "Spiral sink",
      eq: "ẋ = −¼x − y, ẏ = x − ¼y",
      note: "A rotating flow spiralling to equilibrium — a cyclone in phase space.",
      sigma: 0.05, speed: 1.0,
      f: function (x, y) { return [-0.25 * x - y, x - 0.25 * y]; } },

    { id: "vanderpol", kind: "ODE", name: "Van der Pol",
      eq: "ẋ = y, ẏ = μ(1−x²)y − x",
      note: "A nonlinear oscillator relaxing onto a limit cycle.",
      sigma: 0.04, speed: 0.75,
      f: function (x, y) { return [y, 1.6 * (1 - x * x) * y - x]; } },

    { id: "pendulum", kind: "ODE", name: "Pendulum",
      eq: "θ̇ = ω, ω̇ = −sinθ − 0.15ω",
      note: "A damped pendulum settling through its phase portrait.",
      sigma: 0.05, speed: 0.9,
      f: function (x, y) { return [y, -Math.sin(x) - 0.15 * y]; } },

    { id: "ou", kind: "SDE", name: "Ornstein–Uhlenbeck",
      eq: "dx = −θx dt + σ dW",
      note: "Mean-reverting diffusion with a Gaussian stationary law.",
      sigma: 0.75, speed: 1.0,
      f: function (x, y) { return [-0.8 * x, -0.8 * y]; } },

    { id: "doublewell", kind: "SDE", name: "Double well",
      eq: "dx = (x − x³) dt + σ dW",
      note: "Bistable diffusion hopping between two potential wells.",
      sigma: 0.55, speed: 1.0,
      f: function (x, y) { return [x - x * x * x, -1.4 * y]; } },

    { id: "brownian", kind: "SDE", name: "Brownian motion",
      eq: "dx = σ dW",
      note: "Pure diffusion — noise with no drift, the scaffold of it all.",
      sigma: 0.62, speed: 1.0,
      f: function () { return [0, 0]; } }
  ];

  var current = SYSTEMS[0];
  var N = 0, P = [];
  var t = 0, raf = null;

  function count() { return window.innerWidth < 640 ? 90 : 150; }

  function seed(p) {
    p.x = (Math.random() * 2 - 1) * DOM;
    p.y = (Math.random() * 2 - 1) * DOM;
    p.px = p.x; p.py = p.y;
    p.c = COLORS[(Math.random() * COLORS.length) | 0];
    p.life = 40 + Math.random() * 160;
  }

  function build() {
    N = count(); P = [];
    for (var i = 0; i < N; i++) { var p = {}; seed(p); P.push(p); }
  }

  function resize() {
    var rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = Math.max(1, Math.floor(W * DPR));
    canvas.height = Math.max(1, Math.floor(H * DPR));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (P.length !== count()) build();
  }

  function sx(x) { return (x / DOM * 0.5 + 0.5) * W; }
  function sy(y) { return (0.5 - y / DOM * 0.5) * H; } // flip y

  function integrate() {
    var dt = 0.02 * current.speed, sq = Math.sqrt(dt) * current.sigma;
    var sub = 2;
    for (var i = 0; i < N; i++) {
      var p = P[i];
      p.px = p.x; p.py = p.y;
      for (var s = 0; s < sub; s++) {
        var v = current.f(p.x, p.y);
        p.x += v[0] * dt / sub + sq * randn();
        p.y += v[1] * dt / sub + sq * randn();
      }
      p.life -= 1;
      var m = DOM * 1.15;
      if (p.x < -m || p.x > m || p.y < -m || p.y > m || p.life <= 0) seed(p);
    }
  }

  function draw() {
    // fade previous frame → particle trails
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = "rgba(7,10,20,0.16)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineWidth = 1.4;
    for (var i = 0; i < N; i++) {
      var p = P[i];
      var x0 = sx(p.px), y0 = sy(p.py), x1 = sx(p.x), y1 = sy(p.y);
      ctx.strokeStyle = "rgba(" + p.c + ",0.5)";
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.fillStyle = "rgba(" + p.c + ",0.9)";
      ctx.beginPath(); ctx.arc(x1, y1, 1.1, 0, 6.2832); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function loop() { t += 1; integrate(); draw(); raf = requestAnimationFrame(loop); }
  function start() { if (!raf && !reduce) raf = requestAnimationFrame(loop); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  function staticFrame() {
    ctx.clearRect(0, 0, W, H);
    // integrate silently for a while to draw settled trajectories
    for (var k = 0; k < 260; k++) { integrate(); draw(); }
  }

  function setSystem(sys) {
    current = sys;
    build();
    ctx.clearRect(0, 0, W, H);
    var nm = document.querySelector(".dyn-name"), eq = document.querySelector(".dyn-eq"),
        nt = document.querySelector(".dyn-note");
    if (nm) nm.textContent = sys.name;
    if (eq) eq.textContent = sys.eq;
    if (nt) nt.textContent = sys.note;
    document.querySelectorAll(".dyn-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.sys === sys.id);
      if (b.dataset.sys === sys.id) b.setAttribute("aria-pressed", "true");
      else b.setAttribute("aria-pressed", "false");
    });
    if (reduce) staticFrame();
  }

  // ---- build controls ----
  var controls = document.querySelector(".dyn-controls");
  if (controls) {
    ["ODE", "SDE"].forEach(function (kind) {
      var grp = document.createElement("div");
      grp.className = "dyn-group";
      grp.innerHTML = '<span class="dyn-group-label">' + kind + '</span>';
      SYSTEMS.filter(function (s) { return s.kind === kind; }).forEach(function (s) {
        var b = document.createElement("button");
        b.className = "dyn-btn"; b.dataset.sys = s.id; b.textContent = s.name;
        b.setAttribute("aria-pressed", "false");
        b.addEventListener("click", function () { setSystem(s); });
        grp.appendChild(b);
      });
      controls.appendChild(grp);
    });
  }

  // ---- lifecycle ----
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () { DPR = Math.min(window.devicePixelRatio || 1, 2); resize(); if (reduce) staticFrame(); }, 160);
  });
  document.addEventListener("visibilitychange", function () {
    if (reduce) return;
    if (document.hidden) stop(); else start();
  });

  resize();
  setSystem(SYSTEMS[0]);
  if (reduce) staticFrame(); else start();
})();
