  /* ======================= 13. MAIN LOOP ======================= */
  var lastT = performance.now();
  var acc = 0;
  var simAccum = 0;

  function updateShotUI(dt) {
    if (UI.state !== 'shooting') return;
    var cue = POOL.cue();
    var sp = cue.active ? Math.hypot(cue.vx, cue.vz) : 0;
    game.shotMax = Math.max(game.shotMax || 0, sp);
    var pct = game.shotMax > 0 ? clamp(sp / Math.max(0.6, game.shotMax), 0, 1) * 100 : 0;
    if (UI.state === 'shooting') dom.shotfill.style.width = pct + '%';
  }

  function frame(now) {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, (now - lastT) / 1000);
    lastT = now;
    if (!(dt > 0)) dt = 1 / 60;

    var paused = (UI.state === 'paused' || UI.state === 'menu' || UI.state === 'over');

    if (!paused) {
      if (POOL.state.running) {
        simAccum += dt;
        var guard = 0;
        while (simAccum >= POOL.FIXED && guard++ < 800) {
          POOL.step(POOL.FIXED);
          simAccum -= POOL.FIXED;
          if (!POOL.state.running) break;
        }
        POOL.state.time += dt;
        if (POOL.isStopped()) {
          POOL.finishShot();
          simAccum = 0;
          updateShotUI(dt);
          onSimDone();
        } else if (POOL.state.time > 16) {
          POOL.stopAll();
          POOL.finishShot();
          simAccum = 0;
          onSimDone();
        }
      }
    }

    updateStroke(dt);
    if (!paused) updateAI(dt);

    /* شبکهٔ ایمنی: جلوگیری از قفل‌شدن بازی */
    if (UI.state === 'shooting' && !POOL.state.running && !stroke.active) {
      game.stall = (game.stall || 0) + dt;
      if (game.stall > 1.5) { game.stall = 0; onSimDone(); }
    } else game.stall = 0;

    syncBallVisuals(paused ? 0 : dt);
    updateRipples(paused ? 0 : dt);

    if (UI.state === 'menu' && !cam.userMoved) cam.theta += dt * 0.06;

    updateAimVisuals();
    updateCamera(dt * (paused ? 0.6 : 1));
    if (UI.state === 'aim' || UI.state === 'place') updateAimReadout();

    renderer.render(scene, camera);
  }

  /* ======================= 14. BOOT ======================= */
  function boot() {
    cacheDom();
    POOL.newGame('2p');
    buildBallMeshes();
    resetBallVisuals();
    drawSpin();
    updatePowerUI();
    bindInput();
    updateHUD();

    // شروع از منو با دوربین آرام
    setCamMode('orbit');
    cam.theta = 0.5; cam.phi = 0.52; cam.r = 6.4;
    showOverlay('ovMenu');
    UI.state = 'menu';

    // حالت نمایشی: چند توپ در میز
    requestAnimationFrame(function (t) { lastT = t; requestAnimationFrame(frame); });

    // کلیدهای کمکی برای تست خودکار
    window.__pool = {
      POOL: POOL, game: game, UI: UI, aim: aim, cam: cam,
      THREE: T, scene: scene, camera: camera, renderer: renderer, tableGroup: tableGroup,
      fire: function (a, p, sx, sy) { fireShot(a, p, sx || 0, sy || 0); },
      newGame: newGame, endShot: endShot, placeCueAt: placeCueAt,
      canShoot: function () { return canShoot(); },
      strokeActive: function () { return stroke.active; },
      updateHUD: updateHUD, setCam: setCamMode, toMenu: toMenu,
      /* برای تست خودکار: پیش‌بردن کامل شبیه‌سازی بدون انتظار زمان واقعی */
      fastForward: function () {
        if (!POOL.state.running) return false;
        var guard = 0;
        while (!POOL.isStopped() && guard++ < 30000) POOL.step(POOL.FIXED);
        POOL.finishShot();
        simAccum = 0;
        onSimDone();
        return true;
      }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
