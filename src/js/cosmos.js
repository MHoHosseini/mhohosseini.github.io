/* =========================================================================
   Cosmos — a latent-space observatory background.
   A vanilla 2D-canvas particle/constellation field with flow-field drift,
   gentle cursor attraction, and a slow "diffusion" breathing of structure.
   No dependencies. Respects prefers-reduced-motion. Pauses when hidden.
   ========================================================================= */
(function () {
  "use strict";

  var canvas = document.getElementById("cosmos");
  if (!canvas) return;
  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  var W = 0, H = 0;
  var nodes = [];
  var pointer = { x: -9999, y: -9999, active: false };
  var t = 0;
  var raf = null;

  var COLORS = ["56,225,214", "76,141,255", "166,137,251"]; // cyan, blue, violet

  function rand(a, b) { return a + Math.random() * (b - a); }

  function nodeCount() {
    var area = window.innerWidth * window.innerHeight;
    // roughly one node per ~14k px², capped for performance / mobile
    var n = Math.round(area / 14000);
    var cap = window.innerWidth < 720 ? 46 : 110;
    return Math.max(26, Math.min(n, cap));
  }

  function makeNode() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: rand(-0.15, 0.15),
      vy: rand(-0.15, 0.15),
      r: rand(0.7, 1.9),
      c: COLORS[(Math.random() * COLORS.length) | 0],
      bright: Math.random() < 0.16 // a few "signal" stars
    };
  }

  function resize() {
    var w = window.innerWidth, h = window.innerHeight;
    W = w; H = h;
    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var target = nodeCount();
    if (nodes.length === 0) {
      for (var i = 0; i < target; i++) nodes.push(makeNode());
    } else {
      while (nodes.length < target) nodes.push(makeNode());
      while (nodes.length > target) nodes.pop();
    }
  }

  // Smooth, cheap flow-field angle — evolves slowly with time (curl-like drift)
  function flow(x, y) {
    var s = 0.0016;
    return (
      Math.sin(x * s + t * 0.0006) +
      Math.cos(y * s * 1.3 - t * 0.0005) +
      Math.sin((x + y) * s * 0.7 + t * 0.0003)
    ) * 1.9;
  }

  function step() {
    // slow "diffusion" breathing: link distance condenses (denoise) and
    // disperses (noise) over a long cycle
    var breathe = 0.5 + 0.5 * Math.sin(t * 0.00016);
    var linkDist = 118 + breathe * 34;
    var linkDist2 = linkDist * linkDist;

    ctx.clearRect(0, 0, W, H);

    var i, n;
    // integrate motion
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      var a = flow(n.x, n.y);
      n.vx += Math.cos(a) * 0.008;
      n.vy += Math.sin(a) * 0.008;

      // gentle cursor attraction
      if (pointer.active) {
        var dx = pointer.x - n.x, dy = pointer.y - n.y;
        var d2 = dx * dx + dy * dy;
        var R = 190;
        if (d2 < R * R && d2 > 1) {
          var d = Math.sqrt(d2);
          var f = (1 - d / R) * 0.06;
          n.vx += (dx / d) * f;
          n.vy += (dy / d) * f;
        }
      }

      n.vx *= 0.94; n.vy *= 0.94; // damping
      var sp = Math.hypot(n.vx, n.vy), max = 0.9;
      if (sp > max) { n.vx = n.vx / sp * max; n.vy = n.vy / sp * max; }
      n.x += n.vx; n.y += n.vy;

      // wrap around edges
      var m = 30;
      if (n.x < -m) n.x = W + m; else if (n.x > W + m) n.x = -m;
      if (n.y < -m) n.y = H + m; else if (n.y > H + m) n.y = -m;
    }

    // spatial grid for O(n) edges
    var cell = linkDist;
    var cols = Math.max(1, Math.ceil(W / cell));
    var grid = {};
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      var gx = (n.x / cell) | 0, gy = (n.y / cell) | 0;
      var key = gx + "," + gy;
      (grid[key] || (grid[key] = [])).push(i);
    }

    // edges
    ctx.lineWidth = 1;
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      var cgx = (n.x / cell) | 0, cgy = (n.y / cell) | 0;
      for (var ox = -1; ox <= 1; ox++) {
        for (var oy = -1; oy <= 1; oy++) {
          var bucket = grid[(cgx + ox) + "," + (cgy + oy)];
          if (!bucket) continue;
          for (var b = 0; b < bucket.length; b++) {
            var j = bucket[b];
            if (j <= i) continue;
            var m2 = nodes[j];
            var ddx = n.x - m2.x, ddy = n.y - m2.y;
            var dd = ddx * ddx + ddy * ddy;
            if (dd < linkDist2) {
              var alpha = (1 - dd / linkDist2) * 0.22 * (0.6 + breathe * 0.4);
              ctx.strokeStyle = "rgba(" + n.c + "," + alpha.toFixed(3) + ")";
              ctx.beginPath();
              ctx.moveTo(n.x, n.y);
              ctx.lineTo(m2.x, m2.y);
              ctx.stroke();
            }
          }
        }
      }
    }

    // nodes
    for (i = 0; i < nodes.length; i++) {
      n = nodes[i];
      if (n.bright) {
        ctx.beginPath();
        ctx.fillStyle = "rgba(" + n.c + ",0.10)";
        ctx.arc(n.x, n.y, n.r * 4.5, 0, 6.2832);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.fillStyle = "rgba(" + n.c + "," + (n.bright ? 0.95 : 0.6) + ")";
      ctx.arc(n.x, n.y, n.r, 0, 6.2832);
      ctx.fill();
    }
  }

  function loop() {
    t += 16;
    step();
    raf = requestAnimationFrame(loop);
  }

  function start() { if (!raf) raf = requestAnimationFrame(loop); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }

  // ---- events ----
  var rt;
  window.addEventListener("resize", function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      resize();
      if (reduce) { step(); }
    }, 160);
  });

  window.addEventListener("pointermove", function (e) {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
  }, { passive: true });
  window.addEventListener("pointerleave", function () { pointer.active = false; });
  window.addEventListener("blur", function () { pointer.active = false; });

  document.addEventListener("visibilitychange", function () {
    if (reduce) return;
    if (document.hidden) stop(); else start();
  });

  // ---- init ----
  resize();
  if (reduce) {
    // single static constellation frame, no animation
    t = 4000;
    step();
  } else {
    start();
  }
})();
