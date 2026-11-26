/* =========================================================================
   POOL SIM  —  موتور مستقل بیلیارد (بدون وابستگی به سه‌بعدی یا DOM)
   فیزیک، جیب‌ها، قوانین ۸ بال و حریف هوش مصنوعی. قابل اجرا در Node برای تست.
   ========================================================================= */
(function (root) {
  'use strict';

  var POOL = {};

  /* ---------- ابعاد (متر) ---------- */
  var R = POOL.R = 0.0286;
  var D = POOL.D = R * 2;
  var PW = POOL.PW = 2.24;
  var PL = POOL.PL = 4.48;
  var EX = POOL.EX = PW / 2;
  var EZ = POOL.EZ = PL / 2;
  var GAP = POOL.GAP = 0.086;
  var CAPTURE = POOL.CAPTURE = 0.050;
  var POCKETS = POOL.POCKETS = [
    { x: EX, z: EZ, r: 0.086 }, { x: -EX, z: EZ, r: 0.086 },
    { x: EX, z: -EZ, r: 0.086 }, { x: -EX, z: -EZ, r: 0.086 },
    { x: EX, z: 0, r: 0.080 }, { x: -EX, z: 0, r: 0.080 }
  ];

  /* ---------- تنظیمات فیزیک ---------- */
  var MU = 0.42, MU2 = 0.40, E_BALL = 0.955, E_CUSH = 0.70, CUSH_TAN = 0.86;
  var STOP_V = 0.010, MAX_V = 6.4, FIXED = 1 / 240;
  POOL.FIXED = FIXED;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }
  function d2(ax, az, bx, bz) { var x = ax - bx, z = az - bz; return Math.sqrt(x * x + z * z); }

  /* ---------- callbacks (اتصال به صدا و افکت) ---------- */
  POOL.onClack = function (v, x, z) {};
  POOL.onCushion = function (v, x, z) {};
  POOL.onPocket = function (n, x, z) {};

  /* ---------- وضعیت ---------- */
  var S = POOL.state = {
    balls: [], running: false, time: 0,
    firstContact: null, thisShot: [], shotOpen: true, shotGroup: null,
    shotMyRemaining: 0, shotWasBreak: false, pottedCount: 0
  };
  POOL.balls = S.balls;

  POOL.groupOf = function (n) {
    if (!n) return null;
    if (n === 8) return 'eight';
    return n < 8 ? 'solid' : 'stripe';
  };
  POOL.otherGroup = function (g) { return g === 'solid' ? 'stripe' : 'solid'; };
  POOL.speedOf = function (b) { return Math.sqrt(b.vx * b.vx + b.vz * b.vz); };

  POOL.remaining = function (g) {
    var c = 0;
    for (var i = 0; i < S.balls.length; i++) {
      var b = S.balls[i];
      if (!b.active || !b.n) continue;
      if (POOL.groupOf(b.n) === g) c++;
    }
    return c;
  };

  /* ---------- چیدمان ---------- */
  POOL.reset = function () {
    S.balls.length = 0;
    S.running = false; S.time = 0; S.firstContact = null; S.thisShot.length = 0;
    var cue = { n: 0, x: 0, z: PL / 4, vx: 0, vz: 0, active: true, pocketed: false, spin: 0, spinSide: 0, rot: null };
    S.balls.push(cue);
    var order = [
      [1],
      [2, 9],
      [3, 8, 10],
      [4, 11, 5, 12],
      [6, 13, 7, 15, 14]
    ];
    var dz = D * 0.8661, apexZ = -PL / 4;
    for (var i = 0; i < order.length; i++) {
      for (var j = 0; j < order[i].length; j++) {
        S.balls.push({
          n: order[i][j],
          x: (j - i / 2) * (D + 0.0002) + rnd(-0.00035, 0.00035),
          z: apexZ - i * dz + rnd(-0.00035, 0.00035),
          vx: 0, vz: 0, active: true, pocketed: false, spin: 0, spinSide: 0, rot: null
        });
      }
    }
    return cue;
  };

  POOL.cue = function () { return S.balls[0]; };

  POOL.isStopped = function () {
    for (var i = 0; i < S.balls.length; i++) {
      var b = S.balls[i];
      if (b.active && POOL.speedOf(b) > STOP_V) return false;
    }
    return true;
  };

  POOL.stopAll = function () {
    for (var i = 0; i < S.balls.length; i++) { S.balls[i].vx = 0; S.balls[i].vz = 0; S.balls[i].spin = 0; }
    S.running = false;
  };

  /* ---------- جیب ---------- */
  function pocketBall(b, idx) {
    if (!b.active) return;
    b.active = false; b.pocketed = true;
    var sp = POOL.speedOf(b);
    b.vx *= 0.2; b.vz *= 0.2;
    S.thisShot.push(b.n);
    b.pocketInfo = { idx: idx, sp: sp };
    POOL.onPocket(b.n, b.x, b.z);
  }

  /* ---------- برخورد توپ-توپ ---------- */
  function collide(a, b) {
    var dx = b.x - a.x, dz = b.z - a.z;
    var dd = dx * dx + dz * dz;
    if (dd > D * D || dd < 1e-12) return 0;
    var d = Math.sqrt(dd), nx = dx / d, nz = dz / d;
    var rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (rel > 0) return 0;
    var impact = -rel;
    var ma = a.n === 0 ? 0.99 : 1, mb = b.n === 0 ? 0.99 : 1;
    var j = (1 + E_BALL) * impact / (1 / ma + 1 / mb);
    a.vx -= j * nx / ma; a.vz -= j * nz / ma;
    b.vx += j * nx / mb; b.vz += j * nz / mb;
    var pen = D - d;
    a.x -= nx * pen * 0.5; a.z -= nz * pen * 0.5;
    b.x += nx * pen * 0.5; b.z += nz * pen * 0.5;
    if (impact > 0.06) {
      if ((a.n === 0 || b.n === 0) && S.firstContact === null) {
        S.firstContact = a.n === 0 ? b.n : a.n;
      }
      // انتقال اثر چرخش (follow / draw)
      var cue = a.n === 0 ? a : b.n === 0 ? b : null;
      if (cue && Math.abs(cue.spin) > 0.001) {
        var sgn = cue === a ? 1 : -1;
        var boost = clamp(cue.spin, -1.2, 1.6) * 0.55;
        var vx2 = cue.vx + nx * boost * sgn, vz2 = cue.vz + nz * boost * sgn;
        var sp2 = Math.hypot(vx2, vz2);
        if (sp2 > 0.0001) { var f = Math.max(0, sp2) / sp2; cue.vx = vx2 * f; cue.vz = vz2 * f; }
        cue.spin *= 0.25;
      }
      POOL.onClack(impact, (a.x + b.x) / 2, (a.z + b.z) / 2);
    }
    return impact;
  }

  /* ---------- حرکت و دیواره‌ها ---------- */
  function stepBall(b, dt) {
    if (!b.active) return;
    var sp = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
    if (sp < 1e-7) { b.vx = 0; b.vz = 0; return; }

    // اسپین رو به جلو (follow) یا عقب (draw)
    if (b.spin && Math.abs(b.spin) > 0.002) {
      var along = (b.vx * (b.vx / sp) + b.vz * (b.vz / sp));
      var acc = b.spin * 1.1;
      var nv = along + acc * dt;
      if (nv > 0.02) { b.vx = (b.vx / sp) * nv; b.vz = (b.vz / sp) * nv; }
      b.spin *= Math.exp(-dt * 2.6);
    }

    var dec = (MU + MU2 * sp) * dt;
    if (dec >= sp) { b.vx = 0; b.vz = 0; }
    else { var k = (sp - dec) / sp; b.vx *= k; b.vz *= k; }

    sp = Math.sqrt(b.vx * b.vx + b.vz * b.vz);
    if (sp > MAX_V) { var q = MAX_V / sp; b.vx *= q; b.vz *= q; }

    b.x += b.vx * dt;
    b.z += b.vz * dt;

    var mouth = GAP * 0.52;
    if (Math.abs(b.z) < EZ - mouth) {
      if (b.x + R > EX && b.vx > 0) {
        b.x = EX - R; var s1 = -b.vx; b.vx = -b.vx * E_CUSH; b.vz *= CUSH_TAN;
        if (s1 > 0.28) POOL.onCushion(s1, b.x, b.z);
      } else if (b.x - R < -EX && b.vx < 0) {
        b.x = -EX + R; var s2 = b.vx; b.vx = -b.vx * E_CUSH; b.vz *= CUSH_TAN;
        if (-s2 > 0.28) POOL.onCushion(-s2, b.x, b.z);
      }
    }
    if (Math.abs(b.x) < EX - mouth) {
      if (b.z + R > EZ && b.vz > 0) {
        b.z = EZ - R; var s3 = b.vz; b.vz = -b.vz * E_CUSH; b.vx *= CUSH_TAN;
        if (s3 > 0.28) POOL.onCushion(s3, b.x, b.z);
      } else if (b.z - R < -EZ && b.vz < 0) {
        b.z = -EZ + R; var s4 = -b.vz; b.vz = -b.vz * E_CUSH; b.vx *= CUSH_TAN;
        if (s4 > 0.28) POOL.onCushion(s4, b.x, b.z);
      }
    }

    for (var i = 0; i < POCKETS.length; i++) {
      var p = POCKETS[i];
      if (d2(b.x, b.z, p.x, p.z) < CAPTURE) { pocketBall(b, i); break; }
    }
  }

  POOL.step = function (dt) {
    var i, j, n = S.balls.length;
    for (i = 0; i < n; i++) stepBall(S.balls[i], dt);
    for (i = 0; i < n; i++) {
      var a = S.balls[i];
      if (!a.active) continue;
      for (j = i + 1; j < n; j++) {
        var b = S.balls[j];
        if (!b.active) continue;
        if (Math.abs(a.x - b.x) > D || Math.abs(a.z - b.z) > D) continue;
        collide(a, b);
      }
    }
    // آزادسازی توپ‌های گيرکرده در گوشه‌ها
    for (i = 0; i < n; i++) {
      var c = S.balls[i];
      if (!c.active) continue;
      var lim = R * 0.35;
      if (Math.abs(c.x) > EX - lim && Math.abs(c.z) > EZ - lim) {
        c.x += (c.x > 0 ? -1 : 1) * 0.55 * dt;
        c.z += (c.z > 0 ? -1 : 1) * 0.55 * dt;
      }
    }
  };

  /* ---------- ضربه ---------- */
  POOL.speedForPower = function (p) {
    p = clamp(p, 0, 100);
    return 0.55 + Math.pow(p / 100, 1.12) * 5.9;
  };

  POOL.beginShot = function () {
    S.running = true; S.time = 0;
    S.firstContact = null; S.thisShot.length = 0;
    S.shotOpen = POOL.rules.open;
    S.shotGroup = POOL.rules.groups[POOL.rules.turn];
    S.shotWasBreak = POOL.rules.breakShot;
    S.shotMyRemaining = S.shotGroup ? POOL.remaining(S.shotGroup) : 0;
  };

  POOL.shoot = function (angle, power, spinX, spinY) {
    var cue = POOL.cue();
    POOL.beginShot();
    var sp = POOL.speedForPower(power);
    var dx = Math.sin(angle), dz = Math.cos(angle);
    cue.vx = dx * sp; cue.vz = dz * sp;
    // پیچ جانبی: مؤلفهٔ عمود بر مسیر
    var side = (spinX || 0) * sp * 0.14;
    cue.vx += dz * side; cue.vz -= dx * side;
    cue.spin = (spinY || 0) * clamp(sp * 0.35, 0.1, 1.5);
    cue.spinSide = (spinX || 0) * sp * 0.35;
    return sp;
  };

  POOL.finishShot = function () {
    S.running = false;
    POOL.stopAll();
  };

  /* ---------- پیش‌بینی مسیر (برای خط نشانه) ---------- */
  function wallHit(ox, oz, dx, dz) {
    var best = { t: 1e9 };
    function chk(t, id) {
      if (!(t > 0) || t >= best.t) return;
      var px = ox + dx * t, pz = oz + dz * t;
      if ((id === 'x' && Math.abs(pz) > EZ - GAP * 0.5)) return;
      if ((id === 'z' && Math.abs(px) > EX - GAP * 0.5)) return;
      best = { t: t, x: px, z: pz, id: id };
    }
    if (dx > 1e-9) chk((EX - R - ox) / dx, 'x');
    if (dx < -1e-9) chk((-EX + R - ox) / dx, 'x');
    if (dz > 1e-9) chk((EZ - R - oz) / dz, 'z');
    if (dz < -1e-9) chk((-EZ + R - oz) / dz, 'z');
    return best;
  }

  function pocketRay(ox, oz, dx, dz) {
    var best = { t: 1e9 };
    for (var i = 0; i < POCKETS.length; i++) {
      var p = POCKETS[i];
      var cx = p.x - ox, cz = p.z - oz;
      var t = cx * dx + cz * dz;
      if (t < 0) continue;
      var d = cx * cx + cz * cz - t * t;
      var rr = CAPTURE * CAPTURE;
      if (d > rr) continue;
      var th = t - Math.sqrt(rr - d);
      if (th >= 0 && th < best.t) best = { t: th, x: ox + dx * th, z: oz + dz * th, pocket: i };
    }
    return best;
  }

  POOL.predict = function (ox, oz, dx, dz) {
    var res = { t: 14, kind: 'none', ball: null, x: 0, z: 0 };
    for (var i = 1; i < S.balls.length; i++) {
      var b = S.balls[i];
      if (!b.active) continue;
      var cx = b.x - ox, cz = b.z - oz;
      var t = cx * dx + cz * dz;
      if (t < -D) continue;
      var p2 = cx * cx + cz * cz - t * t;
      var rr = 4 * R * R;
      if (p2 > rr) continue;
      var th = t - Math.sqrt(Math.max(0, rr - p2));
      if (th < 0) continue;
      if (th < res.t) { res.t = th; res.ball = b; res.kind = 'ball'; }
    }
    var w = wallHit(ox, oz, dx, dz);
    if (w.t < res.t) { res.t = w.t; res.ball = null; res.kind = 'wall'; res.x = w.x; res.z = w.z; }
    var pk = pocketRay(ox, oz, dx, dz);
    if (pk.t < res.t) { res.t = pk.t; res.ball = null; res.kind = 'pocket'; res.x = pk.x; res.z = pk.z; res.pocket = pk.pocket; }
    if (res.ball) {
      res.x = ox + dx * res.t; res.z = oz + dz * res.t;
      var nx = res.ball.x - res.x, nz = res.ball.z - res.z;
      var nl = Math.sqrt(nx * nx + nz * nz) || 1;
      res.tx = nx / nl; res.tz = nz / nl;
    }
    return res;
  };

  /* ---------- جای‌گذاری معتبر توپ سفید ---------- */
  POOL.validSpot = function (x, z) {
    if (Math.abs(x) > EX - R - 0.006 || Math.abs(z) > EZ - R - 0.006) return false;
    for (var i = 0; i < POCKETS.length; i++) {
      if (d2(x, z, POCKETS[i].x, POCKETS[i].z) < POCKETS[i].r + R * 0.6) return false;
    }
    for (var j = 1; j < S.balls.length; j++) {
      var b = S.balls[j];
      if (b.active && d2(x, z, b.x, b.z) < D + 0.0012) return false;
    }
    return true;
  };

  POOL.placeCue = function (x, z) {
    var cue = POOL.cue();
    cue.x = x; cue.z = z; cue.vx = 0; cue.vz = 0;
    cue.active = true; cue.pocketed = false;
    S.firstContact = null;
  };

  /* =====================================================================
     قوانین ۸ بال
     ===================================================================== */
  var RULES = POOL.rules = {
    mode: '2p',          // 2p | practice
    turn: 0,
    groups: [null, null], // solid | stripe
    open: true,
    breakShot: true,
    shotCount: 0,
    winners: null
  };

  POOL.newGame = function (mode) {
    RULES.mode = mode || '2p';
    RULES.turn = 0;
    RULES.groups = [null, null];
    RULES.open = true;
    RULES.breakShot = true;
    RULES.shotCount = 0;
    RULES.winners = null;
    POOL.reset();
    return RULES;
  };

  POOL.targetsFor = function (who) {
    var g = RULES.groups[who];
    var out = [];
    for (var i = 1; i < S.balls.length; i++) {
      var b = S.balls[i];
      if (!b.active) continue;
      if (!g) { if (b.n !== 8) out.push(b); }
      else {
        if (POOL.remaining(g) === 0) { if (b.n === 8) out.push(b); }
        else if (POOL.groupOf(b.n) === g) out.push(b);
      }
    }
    return out;
  };

  POOL.resolveShot = function () {
    var shooter = RULES.turn;
    var opp = 1 - shooter;
    var pk = S.thisShot.slice();
    var res = {
      shooter: shooter, pocketed: pk, foul: false, reason: '', reasonFa: '',
      continueTurn: false, winner: null, ballInHand: false, assign: false,
      rerack: false, legal: true
    };
    var pre = {
      open: S.shotOpen,
      group: S.shotGroup,
      myRemaining: S.shotMyRemaining,
      wasBreak: S.shotWasBreak
    };
    var scr = pk.indexOf(0) >= 0;
    var eight = pk.indexOf(8) >= 0;
    var nonEight = pk.filter(function (n) { return n !== 0 && n !== 8; });
    var fc = S.firstContact; // شمارهٔ اولین توپی که سفید لمس کرده

    RULES.shotCount++;
    RULES.breakShot = false;

    if (RULES.mode === 'practice') {
      if (scr) { res.foul = true; res.reason = 'scratch'; res.reasonFa = 'توپ سفید در جیب افتاد'; res.ballInHand = true; }
      if (eight) {
        res.winner = 'reset';
        res.reasonFa = 'توپ ۸ در جیب افتاد — چیدمان نو';
      }
      return res;
    }

    /* ---- تعیین گروه در میز باز ---- */
    if (RULES.open && !pre.wasBreak && nonEight.length) {
      var g = POOL.groupOf(nonEight[0]);
      RULES.groups[shooter] = g;
      RULES.groups[opp] = POOL.otherGroup(g);
      RULES.open = false;
      res.assign = true;
    }

    /* ---- foul ها ---- */
    if (fc === null) { res.foul = true; res.reason = 'no-contact'; res.reasonFa = 'توپ سفید به هیچ توپی نخورد'; }
    else if (pre.open && !res.assign) {
      if (fc === 8) { res.foul = true; res.reason = 'hit-eight-open'; res.reasonFa = 'در میز باز نباید اول به ۸ بزنید'; }
    } else {
      var myG = pre.group || RULES.groups[shooter];
      var on8 = pre.myRemaining === 0;
      if (pre.open && res.assign) myG = RULES.groups[shooter];
      if (myG) {
        if (on8 && !pre.open) {
          if (fc !== 8) { res.foul = true; res.reason = 'must-hit-8'; res.reasonFa = 'باید اول به توپ ۸ بزنید'; }
        } else if (POOL.groupOf(fc) !== myG) {
          res.foul = true; res.reason = 'wrong-first'; res.reasonFa = 'اول به توپ گروه حریف زدید';
        }
      }
    }
    if (scr && !res.foul) { res.foul = true; res.reason = 'scratch'; res.reasonFa = 'توپ سفید در جیب افتاد'; }
    if (scr) { res.foul = true; res.ballInHand = true; if (res.reason !== 'scratch') res.reasonFa = 'توپ سفید در جیب افتاد'; }

    /* ---- توپ ۸ ---- */
    if (eight) {
      if (pre.wasBreak && RULES.shotCount === 1) {
        res.rerack = true;
        res.reasonFa = 'توپ ۸ در ضربهٔ شکستن — چیدمان دوباره';
        RULES.groups = [null, null]; RULES.open = true; RULES.breakShot = true;
        return res;
      }
      var legalEight = !pre.open && pre.group && pre.myRemaining === 0 && !res.foul;
      res.winner = legalEight ? shooter : opp;
      res.reason = legalEight ? 'eight-legal' : 'eight-early';
      res.reasonFa = legalEight ? 'توپ ۸ سالم در جیب افتاد' : 'توپ ۸ زودتر از موعد در جیب افتاد';
      res.legal = legalEight;
      RULES.winners = res.winner;
      return res;
    }

    /* ---- ادامهٔ نوبت ---- */
    var myPocketed = 0;
    for (var i = 0; i < pk.length; i++) {
      var n = pk[i];
      if (!n || n === 8) continue;
      if (RULES.open) { myPocketed++; continue; }
      if (POOL.groupOf(n) === RULES.groups[shooter]) myPocketed++;
    }
    if (res.foul) {
      RULES.turn = opp;
      res.ballInHand = true;
      res.continueTurn = false;
    } else if (myPocketed > 0 || (pre.wasBreak && nonEight.length > 0)) {
      res.continueTurn = true;
    } else {
      RULES.turn = opp;
    }

    // سفید در جیب: غیرفعال می‌ماند تا جای‌گذاری
    if (scr) { res.ballInHand = true; }
    return res;
  };

  /* =====================================================================
     هوش مصنوعی حریف
     ===================================================================== */
  var DIFF = [
    { name: 'آسان', aimErr: 2.5, powErr: 0.22, sample: 0.55, planErr: 0.5 },
    { name: 'متوسط', aimErr: 1.05, powErr: 0.12, sample: 0.25, planErr: 0.18 },
    { name: 'سخت', aimErr: 0.35, powErr: 0.05, sample: 0.06, planErr: 0.03 }
  ];
  POOL.DIFF = DIFF;

  function segDist(px, pz, ax, az, bx, bz) {
    var dx = bx - ax, dz = bz - az;
    var l2 = dx * dx + dz * dz;
    var t = l2 > 1e-9 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0;
    t = clamp(t, 0, 1);
    var qx = ax + dx * t, qz = az + dz * t;
    var ex = px - qx, ez = pz - qz;
    return Math.sqrt(ex * ex + ez * ez);
  }

  function pathClear(ax, az, bx, bz, ignore, rad) {
    var rr = rad === undefined ? D - 0.0015 : rad;
    for (var i = 1; i < S.balls.length; i++) {
      var b = S.balls[i];
      if (!b.active || b === ignore) continue;
      if (i === ignore) continue;
      if (segDist(b.x, b.z, ax, az, bx, bz) < rr) return false;
    }
    return true;
  }

  function planFrom(cx, cz, who, cfg) {
    var targets = POOL.targetsFor(who);
    if (!targets.length) return null;
    var best = null;
    for (var ti = 0; ti < targets.length; ti++) {
      var t = targets[ti];
      if (d2(cx, cz, t.x, t.z) < D * 1.02) continue;
      for (var pi = 0; pi < POCKETS.length; pi++) {
        var p = POCKETS[pi];
        var ux = p.x - t.x, uz = p.z - t.z;
        var up = Math.sqrt(ux * ux + uz * uz);
        if (up < 0.05) continue;
        ux /= up; uz /= up;
        var gx = t.x - ux * D, gz = t.z - uz * D;
        if (Math.abs(gx) > EX - R || Math.abs(gz) > EZ - R) continue;
        var ax = gx - cx, az = gz - cz;
        var ad = Math.sqrt(ax * ax + az * az);
        if (ad < 0.02) continue;
        ax /= ad; az /= ad;
        // زاویهٔ برش
        var cut = ax * ux + az * uz;
        if (cut < 0.24) continue;
        // مسیر سفید تا نقطهٔ شبح و مسیر توپ تا جیب
        if (!pathClear(cx, cz, gx, gz, t)) continue;
        if (!pathClear(t.x, t.z, p.x, p.z, t, D - 0.002)) continue;
        // اطمینان از این‌که سفید ابتدا به توپ هدف می‌خورد
        var pr = hitTest(cx, cz, ax, az);
        if (!pr || pr.ball !== t) continue;
        var dp = d2(t.x, t.z, p.x, p.z);
        var score = Math.pow(cut, 1.7) / (1 + ad * 0.55) / (1 + dp * 0.28) / (p.r > 0.082 ? 1.25 : 1);
        if (cfg) score *= (1 + gauss() * cfg.planErr);
        if (!best || score > best.score) {
          best = {
            score: score, ball: t, pocket: p, angle: Math.atan2(ax, az),
            aimDist: ad, potDist: dp, cut: cut
          };
        }
      }
    }
    return best;
  }

  // اولین برخورد مسیر با توپ‌ها (برای AI)
  function hitTest(ox, oz, dx, dz) {
    var best = null, bt = 1e9;
    for (var i = 1; i < S.balls.length; i++) {
      var b = S.balls[i];
      if (!b.active) continue;
      var cx = b.x - ox, cz = b.z - oz;
      var t = cx * dx + cz * dz;
      if (t < 0) continue;
      var q = cx * cx + cz * cz - t * t;
      var rr = 4 * R * R;
      if (q > rr) continue;
      var th = t - Math.sqrt(Math.max(0, rr - q));
      if (th < 0) continue;
      if (th < bt) { bt = th; best = { ball: b, t: th }; }
    }
    return best;
  }

  POOL.hitTest = hitTest;
  POOL.planFrom = planFrom;

  /* نقشهٔ کلی نوبت AI */
  POOL.aiPlan = function (who, diff) {
    var cfg = DIFF[clamp(diff || 0, 0, 2)];
    var cue = POOL.cue();
    var needPlace = !cue.active;
    var place = null;

    if (needPlace) {
      // انتخاب محل قرارگیری: نمونه‌گیری
      var best = null;
      var tries = 70;
      for (var i = 0; i < tries; i++) {
        var x, z;
        if (i < 30) {
          var tg = POOL.targetsFor(who);
          var t = tg[i % Math.max(1, tg.length)];
          if (!t) { x = rnd(-EX + 0.2, EX - 0.2); z = rnd(-EZ + 0.2, EZ - 0.2); }
          else {
            var ang = rnd(0, Math.PI * 2), dd = rnd(0.45, 1.15);
            x = t.x + Math.sin(ang) * dd; z = t.z + Math.cos(ang) * dd;
          }
        } else {
          x = rnd(-EX + 0.3, EX - 0.3); z = rnd(-EZ + 0.3, EZ - 0.3);
        }
        if (!POOL.validSpot(x, z)) continue;
        var pl = planFrom(x, z, who, cfg);
        var sc = pl ? pl.score : -1;
        if (!best || sc > best.score) best = { score: sc, x: x, z: z, plan: pl };
        if (pl && diff >= 1 && pl.score > 0.5) break;
      }
      if (!best) return null;
      place = { x: best.x, z: best.z };
      var p0 = best.plan || planFrom(best.x, best.z, who, cfg);
      if (p0) return makePlan(p0, cfg, place);
      // فقط ضربهٔ امنیتی
      return safetyPlan(best.x, best.z, who, cfg, place);
    }

    var plan = planFrom(cue.x, cue.z, who, cfg);
    if (plan) return checkedPlan(makePlan(plan, cfg, null), cue, who, cfg);
    return safetyPlan(cue.x, cue.z, who, cfg, null);
  };

  /* اطمینان از این‌که ضربه حتماً به توپ مجاز برخورد می‌کند */
  function checkedPlan(p, cue, who, cfg) {
    var dx = Math.sin(p.angle), dz = Math.cos(p.angle);
    var hit = hitTest(cue.x, cue.z, dx, dz);
    var g = RULES.groups[who];
    var ok = !!hit;
    if (ok && g) {
      var on8 = POOL.remaining(g) === 0;
      if (on8) ok = hit.ball.n === 8;
      else ok = POOL.groupOf(hit.ball.n) === g;
    } else if (ok) {
      ok = hit.ball.n !== 8 || RULES.open;
    }
    if (ok) return p;
    // ضربهٔ امنیتی مطمئن: مستقیم به نزدیک‌ترین توپ مجاز
    var tg = POOL.targetsFor(who);
    var best = null, bd = 1e9;
    for (var i = 0; i < tg.length; i++) {
      var d = d2(cue.x, cue.z, tg[i].x, tg[i].z);
      if (d < bd) { bd = d; best = tg[i]; }
    }
    if (!best) return p;
    var ang = Math.atan2(best.x - cue.x, best.z - cue.z);
    ang += gauss() * (cfg.aimErr * 0.22) * Math.PI / 180;
    return { angle: ang, power: clamp(26 + bd * 9, 22, 58), spinX: 0, spinY: 0, place: p.place, safe: true, pot: null };
  }

  function makePlan(p, cfg, place) {
    var dist = p.aimDist + p.potDist;
    var power = clamp(26 + dist * 12 + (1 - p.cut) * 24, 20, 92);
    power *= (1 + gauss() * cfg.powErr);
    power = clamp(power, 12, 100);
    var err = gauss() * cfg.aimErr * Math.PI / 180;
    return {
      angle: p.angle + err, power: power,
      spinX: -gauss() * 0.15, spinY: gauss() * 0.12,
      place: place, pot: p
    };
  }

  function safetyPlan(cx, cz, who, cfg, place) {
    var tg = POOL.targetsFor(who);
    if (!tg.length) return null;
    var best = null, bd = 1e9;
    for (var i = 0; i < tg.length; i++) {
      var d = d2(cx, cz, tg[i].x, tg[i].z);
      if (d < bd) { bd = d; best = tg[i]; }
    }
    if (!best) return null;
    var ang = Math.atan2(best.x - cx, best.z - cz);
    ang += gauss() * cfg.aimErr * 1.4 * Math.PI / 180;
    var power = clamp(22 + bd * 16, 18, 65);
    return { angle: ang, power: power, spinX: 0, spinY: 0, place: place, safe: true };
  }

  /* ---------- بررسی خودکار توپ‌های گیرکرده (برای تست) ---------- */
  POOL.diag = function () {
    var out = [];
    for (var i = 0; i < S.balls.length; i++) {
      var b = S.balls[i];
      if (!b.active) continue;
      if (Math.abs(b.x) > EX - R + 0.002 || Math.abs(b.z) > EZ - R + 0.002) out.push(b.n);
    }
    return out;
  };

  root.POOL = POOL;
})(typeof window !== 'undefined' ? window : globalThis);
