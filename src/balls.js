  /* ======================= 6. BALLS / CUE / AIM (نمایش) ======================= */
  var R = POOL.R;

  var ballGeo = new T.SphereGeometry(R, 32, 20);
  var matCache = {};

  function ballMaterial(n) {
    if (matCache[n]) return matCache[n];
    var stripe = n > 8;
    var color = n === 0 ? 0xfbf7ee : BALL_COLORS[n];
    var m = new T.MeshPhysicalMaterial({
      map: n === 0 ? null : ballTexture(n, color, stripe),
      color: n === 0 ? 0xfbf7ee : 0xffffff,
      roughness: n === 0 ? 0.16 : 0.14,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.06,
      envMapIntensity: 1.2
    });
    matCache[n] = m;
    return m;
  }

  var blobTex = (function () {
    var g = canvas2d(128, 128), x = g.x;
    var rg = x.createRadialGradient(64, 64, 2, 64, 64, 62);
    rg.addColorStop(0, 'rgba(0,0,0,0.62)');
    rg.addColorStop(0.5, 'rgba(0,0,0,0.26)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = rg; x.fillRect(0, 0, 128, 128);
    return new T.CanvasTexture(g.c);
  })();
  var blobGeo = new T.PlaneGeometry(1, 1);
  var blobMat = new T.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.5, depthWrite: false });
  var blobMatGhost = new T.MeshBasicMaterial({ map: blobTex, transparent: true, opacity: 0.22, depthWrite: false });

  var ballGroup = new T.Group();
  scene.add(ballGroup);
  var ballView = [];   // موازی با POOL.balls

  function buildBallMeshes() {
    for (var i = 0; i < ballView.length; i++) {
      if (ballView[i]) { ballGroup.remove(ballView[i].mesh); ballGroup.remove(ballView[i].blob); }
    }
    ballView.length = 0;
    POOL.balls.forEach(function (b) {
      var mesh = new T.Mesh(ballGeo, ballMaterial(b.n));
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.position.set(b.x, R, b.z);
      ballGroup.add(mesh);
      var blob = new T.Mesh(blobGeo, blobMat);
      blob.rotation.x = -Math.PI / 2;
      blob.scale.set(R * 2.7, R * 2.7, 1);
      blob.position.set(b.x, 0.0035, b.z);
      blob.renderOrder = 1;
      ballGroup.add(blob);
      ballView.push({ mesh: mesh, blob: blob, fall: null, spinAxis: new T.Vector3(1, 0, 0) });
    });
  }

  var _q = new T.Quaternion();
  var _axis = new T.Vector3();

  function syncBallVisuals(dt) {
    for (var i = 0; i < POOL.balls.length; i++) {
      var b = POOL.balls[i], v = ballView[i];
      if (!v) continue;
      if (b.active) {
        v.mesh.position.set(b.x, R + 0.0001, b.z);
        if (v.fall) { v.mesh.scale.setScalar(1); v.fall = null; v.mesh.visible = true; v.blob.visible = true; }
        var sp = Math.hypot(b.vx, b.vz);
        if (sp > 0.004 && dt > 0) {
          _axis.set(b.vz, 0, -b.vx).normalize();
          var ang = (sp * dt) / R;
          _q.setFromAxisAngle(_axis, ang);
          v.mesh.quaternion.premultiply(_q);
        }
        v.blob.position.set(b.x, 0.0035, b.z);
        var op = clamp(1 - (Math.abs(b.x) / POOL.EX) * 0.25, 0.5, 1);
        v.blob.scale.set(R * 2.7 * op, R * 2.7 * op, 1);
      } else {
        v.blob.visible = false;
        if (!v.fall) {
          var p = POOL.POCKETS[b.pocketInfo ? b.pocketInfo.idx : 0];
          v.fall = { t: 0, x: b.x, z: b.z, px: p.x, pz: p.z };
        }
        var f = v.fall;
        f.t = Math.min(1, f.t + dt * 2.6);
        var e = f.t * f.t;
        v.mesh.position.set(
          lerp(f.x, f.px, Math.min(1, f.t * 2.2)),
          R - e * 0.20,
          lerp(f.z, f.pz, Math.min(1, f.t * 2.2))
        );
        v.mesh.scale.setScalar(1 - e * 0.35);
        v.mesh.visible = f.t < 1;
      }
    }
  }

  function resetBallVisuals() {
    for (var i = 0; i < POOL.balls.length; i++) {
      var b = POOL.balls[i], v = ballView[i];
      if (!v) continue;
      v.fall = null; v.mesh.visible = true; v.mesh.scale.setScalar(1);
      v.mesh.position.set(b.x, R, b.z);
      v.mesh.quaternion.identity();
      v.blob.visible = true;
      v.blob.position.set(b.x, 0.0035, b.z);
    }
  }

  function ballViewOf(n) {
    for (var i = 0; i < POOL.balls.length; i++) if (POOL.balls[i].n === n) return ballView[i];
    return null;
  }

  /* ---------- cue stick ---------- */
  var cueStick = new T.Group();
  cueStick.rotation.order = 'YXZ';
  scene.add(cueStick);

  var cueMat = {
    wood: new T.MeshStandardMaterial({ color: 0x9c6635, roughness: 0.38, metalness: 0.1, map: woodTexture('#9c6635', 'rgba(0,0,0,0.35)') }),
    dark: new T.MeshStandardMaterial({ color: 0x1d1109, roughness: 0.48, metalness: 0.14 }),
    shock: new T.MeshStandardMaterial({ color: 0x0e1a22, roughness: 0.62, metalness: 0.25 }),
    wrap: new T.MeshStandardMaterial({ color: 0x17202a, roughness: 0.9, metalness: 0.04 }),
    ferrule: new T.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.32 }),
    tip: new T.MeshStandardMaterial({ color: 0x2f74c0, roughness: 0.8 }),
    ring: MAT.brass
  };

  function cueSegment(d, h, rNear, rFar, mat) {
    // محور استوانه به Z و امتداد در -Z
    var g = new T.CylinderGeometry(rNear, rFar, h, 24, 1, false);
    g.rotateX(Math.PI / 2);
    g.translate(0, 0, -h / 2 - d);
    var m = new T.Mesh(g, mat);
    m.castShadow = true;
    cueStick.add(m);
    return m;
  }
  cueSegment(-0.002, 0.0075, 0.0061, 0.0061, cueMat.tip);
  cueSegment(0.0055, 0.016, 0.0063, 0.0065, cueMat.ferrule);
  cueSegment(0.0215, 1.02, 0.0065, 0.0093, cueMat.wood);
  cueSegment(1.0415, 0.009, 0.0096, 0.0096, cueMat.ring);
  cueSegment(1.0505, 0.35, 0.0099, 0.0119, cueMat.dark);
  cueSegment(1.4005, 0.150, 0.0121, 0.0129, cueMat.wrap);
  cueSegment(1.5505, 0.030, 0.0131, 0.0112, cueMat.shock);
  cueStick.visible = false;

  var aim = { angle: 0, power: 45, spinX: 0, spinY: 0 };
  var stroke = { active: false, t: 0, dur: 0.16, back: 0.22, applied: false };

  /* ---------- aim dots ---------- */
  var aimGroup = new T.Group();
  scene.add(aimGroup);

  var dotGeo = new T.SphereGeometry(1, 10, 8);
  var aimDots = [], tgtDots = [];
  var dotMat = new T.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0.9, depthWrite: false });
  var tgtMat = new T.MeshBasicMaterial({ color: 0x8ff0ff, transparent: true, opacity: 0.5, depthWrite: false });
  var DOT_N = 34;
  for (var di = 0; di < DOT_N; di++) {
    var dm = new T.Mesh(dotGeo, dotMat);
    dm.visible = false; dm.renderOrder = 3;
    aimGroup.add(dm); aimDots.push(dm);
  }
  for (var ti = 0; ti < 12; ti++) {
    var tm = new T.Mesh(dotGeo, tgtMat);
    tm.visible = false; tm.renderOrder = 3;
    aimGroup.add(tm); tgtDots.push(tm);
  }
  var ghostRing = new T.Mesh(
    new T.TorusGeometry(R * 1.02, 0.0024, 6, 40),
    new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false })
  );
  ghostRing.rotation.x = Math.PI / 2;
  ghostRing.visible = false;
  ghostRing.renderOrder = 3;
  aimGroup.add(ghostRing);

  var placeGhost = new T.Mesh(ballGeo, ballMaterial(0));
  placeGhost.material = ballMaterial(0).clone();
  placeGhost.material.transparent = true;
  placeGhost.material.opacity = 0.55;
  placeGhost.material.depthWrite = false;
  placeGhost.visible = false;
  scene.add(placeGhost);
  var placeRing = new T.Mesh(
    new T.TorusGeometry(R * 1.5, 0.003, 6, 32),
    new T.MeshBasicMaterial({ color: 0x69f0ae, transparent: true, opacity: 0.9, depthWrite: false })
  );
  placeRing.rotation.x = Math.PI / 2;
  placeRing.visible = false;
  scene.add(placeRing);

  var aimMode = 2; // 2=کامل · 1=کوتاه · 0=خاموش

  function clearAim() {
    for (var i = 0; i < aimDots.length; i++) aimDots[i].visible = false;
    for (var j = 0; j < tgtDots.length; j++) tgtDots[j].visible = false;
    ghostRing.visible = false;
  }

  function updateAimVisuals() {
    var cue = POOL.cue();
    var show = cue.active && (UI.state === 'aim' || UI.state === 'ai') && aimMode > 0;
    if (!show) { clearAim(); cueStick.visible = false; return; }
    var ox = cue.x, oz = cue.z;
    var dx = Math.sin(aim.angle), dz = Math.cos(aim.angle);
    var pr = POOL.predict(ox, oz, dx, dz);
    var maxLen = aimMode === 2 ? pr.t : Math.min(pr.t, 0.6);
    var playerTurn = UI.state === 'aim';
    var cnt = playerTurn ? Math.min(DOT_N, Math.max(2, Math.floor(maxLen / 0.062))) : 0;
    for (var i = 0; i < DOT_N; i++) {
      var d = aimDots[i];
      if (i >= cnt) { d.visible = false; continue; }
      var f = (i + 0.5) / cnt;
      d.position.set(ox + dx * maxLen * f, 0.0062, oz + dz * maxLen * f);
      d.scale.setScalar(lerp(0.0044, 0.0021, f));
      d.visible = true;
    }
    var showGhost = playerTurn && aimMode === 2 && pr.kind === 'ball';
    ghostRing.visible = showGhost;
    if (showGhost) {
      ghostRing.position.set(pr.x, 0.0055, pr.z);
      var L = 0.72;
      for (var j = 0; j < tgtDots.length; j++) {
        var td = tgtDots[j];
        var f2 = (j + 1) / tgtDots.length;
        var x2 = pr.ball.x + pr.tx * L * f2, z2 = pr.ball.z + pr.tz * L * f2;
        var inside = Math.abs(x2) < POOL.EX - R && Math.abs(z2) < POOL.EZ - R;
        td.visible = inside;
        td.position.set(x2, 0.0058, z2);
        td.scale.setScalar(lerp(0.0040, 0.0016, f2));
      }
    } else {
      for (var k = 0; k < tgtDots.length; k++) tgtDots[k].visible = false;
    }

    /* چوب */
    var pull = stroke.active ? 0.02 + stroke.back * (stroke.t < 0.5 ? stroke.t * 2 : (1 - (stroke.t - 0.5) * 2)) : 0.02;
    var base = 0.014 + (1 - aim.power / 100) * 0.05 + pull;
    cueStick.position.set(ox - dx * base, R + 0.004, oz - dz * base);
    cueStick.rotation.y = aim.angle;
    cueStick.rotation.x = -0.035;
    cueStick.visible = stroke.active || UI.state === 'aim' || UI.state === 'ai';
  }

  /* انیمیشن ضربهٔ چوب */
  function startStroke(power, cb) {
    stroke.active = true; stroke.t = 0; stroke.applied = false;
    stroke.dur = 0.14 + power * 0.0016;
    stroke.cb = cb;
  }
  function updateStroke(dt) {
    if (!stroke.active) return;
    stroke.t += dt / (stroke.dur * 2);
    if (stroke.t >= 0.5 && !stroke.applied) {
      stroke.applied = true;
      if (stroke.cb) stroke.cb();
    }
    if (stroke.t >= 1) { stroke.active = false; }
  }
