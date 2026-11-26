  /* ======================= 8. AUDIO HOOKS ======================= */
  POOL.onClack = function (v, x, z) {
    sfx.clack(v, x, z);
    cam.shake = Math.max(cam.shake, clamp(v * 0.0012, 0, 0.006));
    addRipple(x, z, v * 0.7);
  };
  POOL.onCushion = function (v, x, z) {
    sfx.cushion(v, x, z);
    addRipple(x, z, v * 0.5);
  };
  POOL.onPocket = function (n, x, z) { sfx.pocket(x, z); };

  /* ======================= 9. CAMERA ======================= */
  var cam = {
    mode: 'orbit', theta: 0, phi: 0.58, r: 7.0, userZoom: false,
    target: new T.Vector3(0, 0.0, 0.1),
    pos: new T.Vector3(0, 3.0, 4.6),
    look: new T.Vector3(0, 0, 0.1),
    dp: new T.Vector3(), dl: new T.Vector3(),
    shake: 0, userMoved: false
  };

  var _ray = new T.Raycaster();
  var _ndc = new T.Vector2();
  var _plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
  var _hit = new T.Vector3();

  function screenToTable(clientX, clientY) {
    var rect = canvasEl.getBoundingClientRect();
    _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    _ray.setFromCamera(_ndc, camera);
    if (_ray.ray.intersectPlane(_plane, _hit)) return { x: _hit.x, z: _hit.z };
    return null;
  }

  /* --- قاب‌بندی خودکار میز در نمای مداری --- */
  var fitCache = { key: '', r: 7 };
  var FIT_CORNERS = [
    [-OUT_X, 0.06, -OUT_Z], [OUT_X, 0.06, -OUT_Z], [-OUT_X, 0.06, OUT_Z], [OUT_X, 0.06, OUT_Z],
    [-OUT_X, FLOOR_Y + 0.2, 0], [OUT_X, FLOOR_Y + 0.2, 0]
  ];
  var _fv = new T.Vector3();
  function fitRadius(phi, theta) {
    var th = theta === undefined ? cam.theta : theta;
    var key = Math.round(phi * 16) + '_' + Math.round(th * 8) + '_' + Math.round(camera.aspect * 50);
    if (fitCache.key === key) return fitCache.r;
    var best = 3;
    var cp = Math.cos(phi), sp = Math.sin(phi), r = 2.0;
    for (; r < 17; r += 0.08) {
      camera.position.set(
        cam.target.x + Math.sin(th) * cp * r,
        cam.target.y + sp * r,
        cam.target.z + Math.cos(th) * cp * r
      );
      camera.lookAt(cam.target);
      camera.updateMatrixWorld(true);
      var ok = true;
      for (var i = 0; i < FIT_CORNERS.length; i++) {
        var c = FIT_CORNERS[i];
        _fv.set(c[0], c[1], c[2]).project(camera);
        if (Math.abs(_fv.x) > 0.93 || Math.abs(_fv.y) > 0.90 || _fv.z > 1) { ok = false; break; }
      }
      if (ok) break;
    }
    best = r;
    fitCache.key = key;
    fitCache.r = best;
    return fitCache.r;
  }

  function defaultPhi() {
    var a = camera.aspect;
    if (a >= 1.5) return 0.62;
    if (a >= 1.0) return 0.72;
    return 1.15;
  }

  function computeDesired() {
    if (cam.mode === 'top') {
      cam.dp.set(cam.target.x, 5.6 + cam.r * 0.35, cam.target.z + 0.02);
      cam.dl.set(cam.target.x, 0, cam.target.z);
      return;
    }
    if (cam.mode === 'aim') {
      var cue = POOL.cue();
      var cx = cue.x, cz = cue.z;
      if (!cue.active) { cx = 0; cz = PL / 4; }
      var dx = Math.sin(aim.angle), dz = Math.cos(aim.angle);
      var back = 0.95 + (1 - aim.power / 100) * 0.3;
      cam.dp.set(cx - dx * back, 0.62, cz - dz * back);
      cam.dl.set(cx + dx * 1.5, 0.01, cz + dz * 1.5);
      return;
    }
    if (!cam.userZoom) cam.r = fitRadius(cam.phi, cam.theta);
    var cp = Math.cos(cam.phi), sp = Math.sin(cam.phi);
    cam.dp.set(
      cam.target.x + Math.sin(cam.theta) * cp * cam.r,
      Math.max(FLOOR_Y + 0.18, cam.target.y + sp * cam.r),
      cam.target.z + Math.cos(cam.theta) * cp * cam.r
    );
    cam.dl.set(cam.target.x, 0.02, cam.target.z);
  }

  function updateCamera(dt) {
    computeDesired();
    var k = 1 - Math.pow(0.0015, dt);
    if (cam.mode === 'aim') k = 1 - Math.pow(0.0006, dt);
    if (cam.mode === 'top') k = 1 - Math.pow(0.002, dt);
    cam.pos.lerp(cam.dp, Math.min(1, k * 1.5));
    cam.look.lerp(cam.dl, Math.min(1, k * 1.9));
    camera.position.copy(cam.pos);
    if (cam.shake > 0.0004) {
      camera.position.x += rnd(-1, 1) * cam.shake;
      camera.position.y += rnd(-1, 1) * cam.shake * 0.7;
      cam.shake *= Math.pow(0.015, dt);
    }
    camera.lookAt(cam.look);
  }

  function setCamMode(m) {
    cam.mode = m;
    $('btnCam').textContent = m === 'aim' ? '🎯' : '🎥';
    $('btnCam').classList.toggle('active', m === 'aim');
    cam.shake = 0;
  }

  /* ======================= 10. UI ======================= */
  var statPower = 45;      // قدرت انتخاب‌شده با اسلایدر/کلید
  var UI = {
    state: 'menu',        // menu | aim | shooting | ai | place | over | paused
    mode: '2p',
    diff: 1,
    ballsLeft: 0,
    lastResult: null
  };

  var dom = {};

  function cacheDom() {
    ['p1group', 'p2group', 'p1rem', 'p2rem', 'p1ball', 'p2ball', 'cardP1', 'cardP2',
      'hint', 'shotbar', 'shotfill', 'power', 'powerFill', 'powerNum', 'powerRange',
      'sliderNum', 'aimDeg', 'spinPad', 'spinX', 'spinY', 'btnShoot', 'btnAimMode',
      'btnCam', 'btnSound', 'btnHelp', 'toast', 'foulFlash', 'ovMenu', 'ovPause',
      'ovHelp', 'ovResult', 'resTitle', 'resSub', 'btnStart', 'btnResume',
      'btnRestart', 'btnMenu', 'btnAgain', 'btnToMenu', 'btnHelpClose'].forEach(function (id) {
      dom[id] = $(id);
    });
  }

  var toastTimer = null;
  function toast(msg, kind) {
    dom.toast.textContent = msg;
    dom.toast.className = 'show ' + (kind || '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { dom.toast.className = ''; }, 2200);
  }
  function hint(msg) {
    if (dom.hint.textContent !== msg) dom.hint.textContent = msg;
  }
  function flashFoul() {
    dom.foulFlash.classList.add('on');
    setTimeout(function () { dom.foulFlash.classList.remove('on'); }, 380);
  }

  var GROUP_FA = { solid: 'توپ‌های ساده', stripe: 'توپ‌های راه‌دار' };

  function ballClass(n) {
    if (!n) return 'solid';                 // باگ ندارد؛ برای سفید
    if (n === 8) return 'p8';
    return n < 8 ? 'solid' : 'stripe';
  }

  function updateHUD() {
    var r = POOL.rules;
    for (var who = 0; who < 2; who++) {
      var g = r.groups[who];
      var grp = dom['p' + (who + 1) + 'group'];
      var rem = dom['p' + (who + 1) + 'rem'];
      var bl = dom['p' + (who + 1) + 'ball'];
      var card = dom['cardP' + (who + 1)];
      card.classList.toggle('active', UI.mode === '2p' && r.turn === who && UI.state !== 'menu' && UI.state !== 'over');
      if (UI.mode === 'practice') {
        grp.textContent = who === 0 ? 'تمرین آزاد' : '—';
        bl.className = 'pball';
        bl.style.setProperty('--c', '#fff');
        rem.textContent = who === 0 ? String(POOL.balls.filter(function (b) { return b.active && b.n; }).length) : '—';
        continue;
      }
      if (!g) {
        grp.textContent = 'گروه باز';
        bl.className = 'pball';
        bl.style.setProperty('--c', '#ddd');
        rem.textContent = '۷';
      } else {
        var remN = POOL.remaining(g);
        var onEight = remN === 0;
        grp.textContent = GROUP_FA[g];
        bl.className = 'pball ' + (onEight ? 'p8' : g);
        bl.style.setProperty('--c', g === 'solid' ? '#ffd400' : '#0a4bd6');
        rem.textContent = onEight ? '۸' : String(remN);
      }
    }
  }

  function updatePowerUI() {
    dom.powerFill.style.height = aim.power + '%';
    dom.powerNum.textContent = Math.round(aim.power);
    if (dom.powerRange.value !== String(Math.round(aim.power))) dom.powerRange.value = Math.round(aim.power);
    dom.sliderNum.textContent = Math.round(aim.power);
  }

  function updateAimReadout() {
    var deg = (aim.angle * 180 / Math.PI + 360) % 360;
    dom.aimDeg.textContent = Math.round(deg);
  }

  /* ---------- spin pad ---------- */
  var spinCtx = null;
  function drawSpin() {
    var pad = dom.spinPad;
    if (!spinCtx) spinCtx = pad.getContext('2d');
    var x = spinCtx, W = pad.width, H = pad.height, cx = W / 2, cy = H / 2, r = W / 2 - 3;
    x.clearRect(0, 0, W, H);
    var g = x.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.65, '#e8e6df');
    g.addColorStop(1, '#bab7ae');
    x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fillStyle = g; x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 2; x.stroke();
    x.strokeStyle = 'rgba(0,0,0,0.12)'; x.lineWidth = 1;
    x.beginPath(); x.arc(cx, cy, r * 0.6, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(cx, cy, r * 0.3, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(cx - r, cy); x.lineTo(cx + r, cy);
    x.moveTo(cx, cy - r); x.lineTo(cx, cy + r); x.stroke();
    var px = cx + aim.spinX * r * 0.82, py = cy - aim.spinY * r * 0.82;
    x.beginPath(); x.arc(px, py, 7, 0, Math.PI * 2);
    x.fillStyle = '#d81f26'; x.fill();
    x.strokeStyle = '#fff'; x.lineWidth = 2; x.stroke();
    x.beginPath(); x.arc(px, py, 2.2, 0, Math.PI * 2);
    x.fillStyle = 'rgba(255,255,255,0.85)'; x.fill();
    dom.spinX.textContent = aim.spinX.toFixed(2);
    dom.spinY.textContent = aim.spinY.toFixed(2);
  }

  function setSpinFromEvent(e) {
    var rect = dom.spinPad.getBoundingClientRect();
    var cx = rect.left + rect.width / 2, cy = rect.top + rect.height / 2;
    var rx = (e.clientX - cx) / (rect.width / 2 - 4);
    var ry = (e.clientY - cy) / (rect.height / 2 - 4);
    var len = Math.hypot(rx, ry);
    if (len > 0.92) { rx *= 0.92 / len; ry *= 0.92 / len; }
    aim.spinX = rx;
    aim.spinY = -ry;
    drawSpin();
  }

  /* ======================= 11. GAME FLOW ======================= */
  var game = {
    shots: 0,
    aiTimer: 0,
    aiState: null,
    ghostGhost: null
  };

  function showOverlay(id) {
    ['ovMenu', 'ovPause', 'ovHelp', 'ovResult'].forEach(function (k) {
      dom[k].classList.toggle('hidden', k !== id);
    });
  }
  function hideOverlays() { showOverlay(null); }

  function newGame(mode) {
    UI.mode = mode;
    POOL.newGame(mode);
    buildBallMeshes();
    resetBallVisuals();
    game.shots = 0;
    game.aiState = null;
    UI.state = 'aim';
    UI.lastResult = null;
    aim.power = statPower;
    aim.spinX = 0; aim.spinY = 0;
    aim.angle = Math.PI;                    // رو به توپ‌ها
    placeGhost.visible = false; placeRing.visible = false;
    hideOverlays();
    updateHUD();
    updatePowerUI();
    drawSpin();
    setCamMode('orbit');
    cam.userZoom = false;
    cam.theta = 0; cam.phi = defaultPhi();
    cam.target.set(0, 0, 0.08);
    cam.r = fitRadius(cam.phi, cam.theta);
    sfx.unlock();
    hint(UI.mode === 'practice'
      ? 'تمرین آزاد — نشانه بگیرید، ماوس را بکشید و رها کنید'
      : 'نوبت شما — نشانه بگیرید، ماوس را بکشید و رها کنید (یا Space)');
  }

  /* ---------------- ضربه‌زدن ---------------- */
  function canShoot() {
    return (UI.state === 'aim') && !stroke.active;
  }

  function fireShot(angle, power, spinX, spinY) {
    if (!canShoot()) return;
    var cue = POOL.cue();
    if (!cue.active) return;
    UI.state = 'shooting';
    dom.btnShoot.disabled = true;
    dom.shotbar.classList.add('on');
    dom.shotfill.style.width = '0%';
    sfx.cue(power / 100);
    startStroke(power, function () {
      var sp = POOL.shoot(angle, power, spinX, spinY);
      cam.shake = Math.max(cam.shake, 0.0016 + power * 0.00002);
    });
    var t0 = performance.now();
    game.shotTimer = 0;
    game.shotMax = 0;
    game.shotStart = t0;
    game.watchDots = 0;
  }

  function endShot() {
    var res = POOL.resolveShot();
    UI.lastResult = res;
    dom.btnShoot.disabled = false;
    dom.shotbar.classList.remove('on');
    updateHUD();

    if (res.winner !== null && res.winner !== undefined && res.winner !== 'reset') {
      finishGame(res.winner, res);
      return;
    }
    if (res.rerack || res.winner === 'reset') {
      POOL.reset();
      buildBallMeshes();
      resetBallVisuals();
      UI.state = 'aim';
      toast('توپ ۸ در ضربهٔ شکستن — چیدمان نو', 'good');
      updateHUD();
      return;
    }
    if (res.assign && POOL.rules.groups[0]) {
      toast('گروه شما: ' + GROUP_FA[POOL.rules.groups[0]] + ' — حریف: ' + GROUP_FA[POOL.rules.groups[1]], 'good');
    } else if (res.pocketed.length) {
      var names = res.pocketed.map(function (n) { return n ? ('توپ ' + n) : 'توپ سفید'; }).join('، ');
      if (res.foul) toast('خطا: ' + res.reasonFa, 'bad');
      else toast(names + ' جیب شد!', 'good');
    } else if (res.foul) {
      toast('خطا: ' + res.reasonFa, 'bad');
    }
    if (res.foul) flashFoul();

    if (res.ballInHand) {
      beginBallInHand();
      return;
    }
    if (UI.mode === 'practice') {
      UI.state = 'aim';
      return;
    }
    if (res.continueTurn) {
      if (POOL.rules.turn === 1) startAITurn();
      else { UI.state = 'aim'; hint('ادامهٔ نوبت شما — ضربهٔ بعدی'); }
    } else {
      nextTurn();
    }
  }

  function nextTurn() {
    updateHUD();
    if (UI.mode === 'practice') { UI.state = 'aim'; return; }
    if (POOL.rules.turn === 1) {
      startAITurn();
    } else {
      game.aiPlan = null;
      UI.state = 'aim';
      setCamMode('orbit');
      hint('نوبت شما — نشانه بگیرید، بکشید و رها کنید');
    }
  }

  function finishGame(winner, res) {
    UI.state = 'over';
    var humanWon = (UI.mode === 'practice') ? true : winner === 0;
    if (UI.mode === 'practice') {
      dom.resTitle.textContent = 'تمرین تمام شد';
      dom.resSub.textContent = 'دوباره بچینید و تمرین کنید.';
    } else if (humanWon) {
      dom.resTitle.textContent = '🏆 پیروز شدید!';
      dom.resSub.textContent = 'توپ ۸ سالم جیب شد. بازی خوبی بود!';
      sfx.win();
    } else {
      dom.resTitle.textContent = 'باخت — حریف برنده شد';
      dom.resSub.textContent = res && res.reasonFa ? res.reasonFa : 'توپ ۸ را حریف جیب کرد.';
      sfx.lose();
    }
    showOverlay('ovResult');
    updateHUD();
  }

  /* ---------------- قرار دادن توپ سفید ---------------- */
  function beginBallInHand() {
    var cue = POOL.cue();
    cue.active = false;
    var v = ballView[0];
    if (v) { v.mesh.visible = false; v.blob.visible = false; }
    UI.state = 'place';
    if (UI.mode === 'practice') {
      hint('توپ سفید را روی میز بگذارید (کلیک)');
      placeGhost.visible = false;
    } else if (POOL.rules.turn === 0) {
      hint('توپ در دست — محل توپ سفید را کلیک کنید');
    } else {
      hint('حریف در حال جای‌گذاری توپ سفید…');
    }
    if (UI.mode === '2p' && POOL.rules.turn === 1) {
      /* حریف خودش توپ سفید را جای‌گذاری می‌کند (در startAITurn) */
      game.aiPlan = null;
      game.aiTimer = 0.6;
      UI.state = 'ai';
      setCamMode('aim');
    }
  }

  function placeCueAt(x, z) {
    if (!POOL.validSpot(x, z)) { toast('این نقطه مناسب نیست', 'bad'); return false; }
    POOL.placeCue(x, z);
    var v = ballView[0];
    if (v) { v.mesh.visible = true; v.blob.visible = true; v.mesh.position.set(x, R, z); }
    placeGhost.visible = false;
    placeRing.visible = false;
    UI.state = 'aim';
    if (UI.mode === '2p' && POOL.rules.turn === 1) {
      startAITurn();
    } else {
      hint('نوبت شما — نشانه بگیرید و ضربه بزنید');
    }
    updateHUD();
    return true;
  }

  /* ---------------- نوبت حریف ---------------- */
  function startAITurn() {
    if (UI.mode === 'practice') { UI.state = 'aim'; return; }
    var cueB = POOL.cue();
    if (!cueB.active && !POOL.validSpot(0, PL / 4)) {
      // اگر توپ سفید جای معتبری ندارد، نزدیک‌ترین نقطه پیدا شود
      var found = false;
      for (var rr = 0.3; rr < 2.2 && !found; rr += 0.2) {
        for (var aa = 0; aa < 12 && !found; aa++) {
          var xx = Math.sin(aa / 12 * Math.PI * 2) * rr;
          var zz = PL / 4 + Math.cos(aa / 12 * Math.PI * 2) * rr;
          if (POOL.validSpot(xx, zz)) { POOL.placeCue(xx, zz); found = true; }
        }
      }
      if (!found) POOL.placeCue(0, PL / 4);
    }
    var plan = POOL.aiPlan(1, UI.diff);
    if (!plan) {
      // ضربهٔ اضطراری: به سمت نزدیک‌ترین توپ مجاز
      var tg = POOL.targetsFor(1);
      var cue0 = POOL.cue();
      var ang0 = tg.length ? Math.atan2(tg[0].x - cue0.x, tg[0].z - cue0.z) : Math.PI;
      plan = { angle: ang0, power: 45, spinX: 0, spinY: 0, place: null };
    }
    if (plan.place) {
      POOL.placeCue(plan.place.x, plan.place.z);
      var v = ballView[0];
      if (v) { v.mesh.visible = true; v.blob.visible = true; v.mesh.position.set(plan.place.x, R, plan.place.z); }
    }
    aim.angle = plan.angle;
    aim.power = plan.power;
    aim.spinX = plan.spinX; aim.spinY = plan.spinY;
    updatePowerUI(); drawSpin(); updateAimReadout();
    UI.state = 'ai';
    game.aiPlan = plan;
    game.aiTimer = 0.85;
    hint('حریف در حال نشانه‌گیری…');
    setCamMode('aim');
  }

  /* ---------------- هدایت نوبت AI ---------------- */
  function updateAI(dt) {
    if (UI.state !== 'ai') return;
    game.aiTimer -= dt;
    if (game.aiTimer > 0) return;
    var plan = game.aiPlan;
    if (!plan) { startAITurn(); return; }
    if (plan.__fired) return;
    var cue = POOL.cue();
    if (!cue.active) { startAITurn(); return; }
    plan.__fired = true;
    UI.state = 'aim';                 // اجازهٔ اجرای ضربه
    fireShot(plan.angle, plan.power, plan.spinX, plan.spinY);
    if (UI.state === 'aim') {         // ضربه اجرا نشد: بازگشت به حالت AI
      UI.state = 'ai';
      game.aiTimer = 0.4;
      if (game.aiRetries === undefined) game.aiRetries = 0;
      if (++game.aiRetries > 5) { game.aiRetries = 0; plan.__fired = false; }
    } else {
      game.aiRetries = 0;
    }
  }

  function onSimDone() {
    if (UI.state !== 'shooting') return;
    endShot();
  }

  /* ======================= 12. INPUT ======================= */
  var drag = null;
  var pull = { active: false, power: 0, aim: 0, x0: 0, y0: 0 };

  function bindInput() {
    var c = canvasEl;

    function aimAtScreen(cx, cy) {
      var pt = screenToTable(cx, cy);
      var cue = POOL.cue();
      if (pt && cue.active) {
        aim.angle = Math.atan2(pt.x - cue.x, pt.z - cue.z);
        updateAimReadout();
      }
    }

    c.addEventListener('pointerdown', function (e) {
      sfx.unlock();
      if (UI.state === 'place') {
        var pt0 = screenToTable(e.clientX, e.clientY);
        if (pt0) placeCueAt(pt0.x, pt0.z);
        return;
      }
      if (UI.state !== 'aim' || !canShoot()) return;
      c.setPointerCapture(e.pointerId);
      var orbit = (e.button === 1 || e.button === 2 || e.shiftKey);
      drag = {
        id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0, orbit: orbit,
        touch: e.pointerType === 'touch'
      };
      if (!orbit && !drag.touch) {
        pull.active = true;
        pull.x0 = e.clientX; pull.y0 = e.clientY;
        pull.power = 0; pull.aim = aim.angle;
        aimAtScreen(e.clientX, e.clientY);
        pull.aim = aim.angle;
      }
    });

    c.addEventListener('pointermove', function (e) {
      if (!drag || drag.id !== e.pointerId) {
        if (UI.state === 'aim') aimAtScreen(e.clientX, e.clientY);
        else if (UI.state === 'place') updatePlaceGhost(e.clientX, e.clientY);
        return;
      }
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      drag.x = e.clientX; drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);

      if (drag.orbit) {
        cam.theta = wrapA(cam.theta - dx * 0.008);
        cam.phi = clamp(cam.phi + dy * 0.006, 0.08, 1.44);
        cam.userMoved = true; cam.userTheta = true; cam.userPhi = true;
        return;
      }
      if (drag.touch) { aimAtScreen(e.clientX, e.clientY); return; }
      if (pull.active) {
        // کشیدن در خلاف جهت نشانه‌گیری = قدرت ضربه
        var bx = Math.sin(pull.aim), bz = Math.cos(pull.aim);
        // جهت معکوس روی صفحه: از توپ به عقب
        var cue = POOL.cue();
        var pBall = worldToScreen(cue.x, 0.02, cue.z);
        var pBack = worldToScreen(cue.x - bx * 0.6, 0.02, cue.z - bz * 0.6);
        var sx = pBall && pBack ? (pBack.x - pBall.x) : 0;
        var sy = pBall && pBack ? (pBack.y - pBall.y) : 1;
        var sl = Math.hypot(sx, sy) || 1;
        sx /= sl; sy /= sl;
        var proj = (e.clientX - pull.x0) * sx + (e.clientY - pull.y0) * sy;
        pull.power = clamp(proj / 2.1, 0, 100);
        if (pull.power > 0) {
          aim.power = Math.max(statPower, pull.power);
          aim.power = pull.power;            // قدرت = میزان کشیدن
          updatePowerUI();
        }
      }
    });

    c.addEventListener('pointerup', function (e) {
      if (!drag || drag.id !== e.pointerId) { drag = null; return; }
      var d = drag; drag = null;
      if (d.orbit) return;
      if (d.touch) return;
      if (pull.active) {
        var pw = pull.power;
        pull.active = false; pull.power = 0;
        if (pw > 4) {
          aim.power = clamp(pw, 6, 100);
          updatePowerUI();
          fireShot(pull.aim, aim.power, aim.spinX, aim.spinY);
        } else {
          aim.power = statPower;
          updatePowerUI();
        }
      }
    });

    c.addEventListener('pointercancel', function () { drag = null; pull.active = false; });
    c.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    c.addEventListener('wheel', function (e) {
      e.preventDefault();
      cam.r = clamp(cam.r * (1 + e.deltaY * 0.0011), 1.9, 14);
      cam.userZoom = true;
      cam.userMoved = true;
    }, { passive: false });

    /* ------- اسلایدر قدرت ------- */
    dom.powerRange.addEventListener('input', function () {
      statPower = parseFloat(dom.powerRange.value);
      aim.power = statPower;
      updatePowerUI();
    });
    dom.btnShoot.addEventListener('click', function () {
      if (UI.state === 'place') { toast('ابتدا توپ سفید را روی میز بگذارید'); return; }
      if (canShoot()) fireShot(aim.angle, aim.power, aim.spinX, aim.spinY);
    });

    /* ------- دایرهٔ چرخش ------- */
    var spinning = false;
    dom.spinPad.addEventListener('pointerdown', function (e) {
      spinning = true;
      dom.spinPad.setPointerCapture(e.pointerId);
      setSpinFromEvent(e);
    });
    dom.spinPad.addEventListener('pointermove', function (e) { if (spinning) setSpinFromEvent(e); });
    dom.spinPad.addEventListener('pointerup', function () { spinning = false; });
    dom.spinPad.addEventListener('pointercancel', function () { spinning = false; });
    dom.spinPad.addEventListener('dblclick', function () {
      aim.spinX = 0; aim.spinY = 0; drawSpin();
    });

    /* ------- دکمه‌ها ------- */
    dom.btnAimMode.addEventListener('click', function () {
      aimMode = (aimMode + 2) % 3;
      var names = ['خاموش', 'کوتاه', 'کامل'];
      dom.btnAimMode.textContent = 'خط نشانه: ' + names[aimMode];
      dom.btnAimMode.classList.toggle('active', aimMode > 0);
      sfx.click();
    });
    dom.btnCam.addEventListener('click', function () {
      setCamMode(cam.mode === 'aim' ? 'orbit' : 'aim');
      sfx.click();
    });
    dom.btnSound.addEventListener('click', function () {
      var on = sfx.toggle();
      dom.btnSound.textContent = on ? '🔊' : '🔇';
      dom.btnSound.classList.toggle('off', !on);
    });
    dom.btnHelp.addEventListener('click', function () {
      UI.prevState = UI.state;
      if (UI.state !== 'paused') UI.state = 'paused';
      showOverlay('ovHelp');
    });
    dom.btnHelpClose.addEventListener('click', function () {
      hideOverlays();
      if (UI.state === 'paused') UI.state = UI.prevState || 'aim';
    });

    /* ------- منو ------- */
    Array.prototype.forEach.call(document.querySelectorAll('.mode'), function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.mode'), function (x) { x.classList.remove('sel'); });
        b.classList.add('sel');
        UI.mode = b.getAttribute('data-mode');
        sfx.click();
      });
    });
    Array.prototype.forEach.call(document.querySelectorAll('.dbtn'), function (b) {
      b.addEventListener('click', function () {
        Array.prototype.forEach.call(document.querySelectorAll('.dbtn'), function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        UI.diff = parseInt(b.getAttribute('data-diff'), 10);
        sfx.click();
      });
    });
    dom.btnStart.addEventListener('click', function () { sfx.click(); newGame(UI.mode); });
    dom.btnResume.addEventListener('click', function () { hideOverlays(); UI.state = UI.prevState || 'aim'; });
    dom.btnRestart.addEventListener('click', function () { newGame(UI.mode); });
    dom.btnMenu.addEventListener('click', function () { toMenu(); });
    dom.btnAgain.addEventListener('click', function () { newGame(UI.mode); });
    dom.btnToMenu.addEventListener('click', function () { toMenu(); });

    /* ------- کیبورد ------- */
    window.addEventListener('keydown', function (e) {
      var k = e.key;
      if (k === ' ' || k === 'Enter') {
        e.preventDefault();
        if (UI.state === 'aim' && canShoot()) fireShot(aim.angle, aim.power, aim.spinX, aim.spinY);
        else if (UI.state === 'menu') newGame(UI.mode);
        return;
      }
      if (k === 'ArrowUp') { statPower = clamp(statPower + (e.shiftKey ? 5 : 1.5), 5, 100); aim.power = statPower; updatePowerUI(); e.preventDefault(); }
      if (k === 'ArrowDown') { statPower = clamp(statPower - (e.shiftKey ? 5 : 1.5), 5, 100); aim.power = statPower; updatePowerUI(); e.preventDefault(); }
      if (k === 'ArrowLeft') { aim.angle = wrapA(aim.angle + 0.01); updateAimReadout(); e.preventDefault(); }
      if (k === 'ArrowRight') { aim.angle = wrapA(aim.angle - 0.01); updateAimReadout(); e.preventDefault(); }
      if (k === 'v' || k === 'V') setCamMode(cam.mode === 'aim' ? 'orbit' : 'aim');
      if (k === 'c' || k === 'C') setCamMode(cam.mode === 'top' ? 'orbit' : 'top');
      if (k === 'm' || k === 'M') { var on2 = sfx.toggle(); dom.btnSound.textContent = on2 ? '🔊' : '🔇'; }
      if (k === 'Escape') {
        if (UI.state === 'paused') { hideOverlays(); UI.state = UI.prevState || 'aim'; }
        else if (['aim', 'ai', 'place', 'shooting'].indexOf(UI.state) >= 0) { UI.prevState = UI.state; UI.state = 'paused'; showOverlay('ovPause'); }
      }
      if (k === 'w' || k === 'W') { cam.target.z = clamp(cam.target.z - 0.15, -2.4, 2.4); }
      if (k === 's' || k === 'S') { cam.target.z = clamp(cam.target.z + 0.15, -2.4, 2.4); }
      if (k === 'a' || k === 'A') { cam.target.x = clamp(cam.target.x - 0.15, -1.3, 1.3); }
      if (k === 'd' || k === 'D') { cam.target.x = clamp(cam.target.x + 0.15, -1.3, 1.3); }
      if (k === 'r' || k === 'R') { if (UI.state !== 'menu') newGame(UI.mode); }
    });

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      fitCache.key = '';
      if (!cam.userZoom) cam.r = fitRadius(cam.phi, cam.theta);
    });
  }

  var _v3 = new T.Vector3();
  function worldToScreen(x, y, z) {
    _v3.set(x, y, z).project(camera);
    if (_v3.z > 1) return null;
    var rect = canvasEl.getBoundingClientRect();
    return {
      x: rect.left + (_v3.x * 0.5 + 0.5) * rect.width,
      y: rect.top + (-_v3.y * 0.5 + 0.5) * rect.height
    };
  }

  function updatePlaceGhost(cx, cy) {
    var pt = screenToTable(cx, cy);
    if (!pt) { placeGhost.visible = false; placeRing.visible = false; return; }
    var ok = POOL.validSpot(pt.x, pt.z);
    placeGhost.visible = true;
    placeGhost.position.set(pt.x, R, pt.z);
    placeGhost.material.color.setHex(ok ? 0xffffff : 0xff5252);
    placeGhost.material.opacity = ok ? 0.55 : 0.3;
    placeRing.visible = true;
    placeRing.position.set(pt.x, 0.006, pt.z);
    placeRing.material.color.setHex(ok ? 0x69f0ae : 0xff5252);
  }

  function toMenu() {
    UI.state = 'menu';
    POOL.newGame('2p');
    buildBallMeshes();
    resetBallVisuals();
    aim.spinX = 0; aim.spinY = 0; aim.power = 45;
    drawSpin(); updatePowerUI();
    setCamMode('orbit');
    showOverlay('ovMenu');
    updateHUD();
  }
