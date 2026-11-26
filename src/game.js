/* =========================================================================
   8-BALL 3D  |  fashori2020-eng/2048
   یک بازی بیلیارد سه‌بعدی کامل در یک فایل HTML — فیزیک، حریف هوش مصنوعی،
   قوانین ۸ بال، چرخش توپ، دوربین و صدا؛ همه بدون هیچ وابستگی خارجی.
   ========================================================================= */
(function () {
  'use strict';
  var T = window.THREE;
  var POOL = window.POOL;
  if (!T || !POOL) {
    document.getElementById('app').innerHTML =
      '<div style="color:#fff;padding:40px;font-family:sans-serif">خطا: کتابخانهٔ سه‌بعدی یا موتور بازی بارگذاری نشد.</div>';
    return;
  }

  /* ======================= 1. CONSTANTS ======================= */
  var SMALL = Math.min(window.innerWidth, window.innerHeight) < 620;
  var DPR = Math.min(window.devicePixelRatio || 1, SMALL ? 1.6 : 2);

  var R = 0.0286;                       // توپ ۲٫۲۵ اینچ
  var PW = 2.24, PL = 4.48;             // سطح بازی ۸۰×۱۶۰ اینچ (متر)
  var EX = PW / 2, EZ = PL / 2;
  var CUSH_D = 0.085, CUSH_H = 0.054;
  var RAIL_W = 0.14, RAIL_H = 0.055;
  var OUT_X = EX + CUSH_D + RAIL_W;     // 1.345  نیم‌عرض کل میز
  var OUT_Z = EZ + CUSH_D + RAIL_W;     // 2.465
  var CLOTH_X = EX + CUSH_D + 0.055, CLOTH_Z = EZ + CUSH_D + 0.055;
  var FLOOR_Y = -0.78;
  var RAIL_CY = 0.0015 + RAIL_H / 2;
  var POCKET_R = 0.074, CAPTURE = 0.050;
  var GAP = 0.086;                      // دهانهٔ جیب روی ریل

  var POCKETS = [
    { x: EX, z: EZ, r: 0.086 }, { x: -EX, z: EZ, r: 0.086 },
    { x: EX, z: -EZ, r: 0.086 }, { x: -EX, z: -EZ, r: 0.086 },
    { x: EX, z: 0, r: 0.080 }, { x: -EX, z: 0, r: 0.080 }
  ];

  var BALL_COLORS = {
    1: 0xffd400, 2: 0x0a4bd6, 3: 0xd81f26, 4: 0x6b1f9e, 5: 0xff7a00,
    6: 0x0c8f3f, 7: 0x8c1c13, 8: 0x111111, 9: 0xffd400, 10: 0x0a4bd6,
    11: 0xd81f26, 12: 0x6b1f9e, 13: 0xff7a00, 14: 0x0c8f3f, 15: 0x8c1c13
  };

  /* physics tuning */
  var MU = 0.42;            // اصطکاک غلتشی خطی
  var MU2 = 0.40;           // جملهٔ وابسته به سرعت
  var E_BALL = 0.955;       // ضریب بازگشت توپ-توپ
  var E_CUSH = 0.70;        // ضریب بازگشت بالشتک
  var CUSH_TAN = 0.86;      // حفظ سرعت مماسی روی بالشتک
  var STOP_V = 0.009;
  var MAX_V = 6.2;
  var FIXED = 1 / 240;

  /* ======================= 2. UTILS ======================= */
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function wrapA(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  function lerpA(a, b, t) { return a + wrapA(b - a) * t; }
  function dist2(ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
  function $(id) { return document.getElementById(id); }

  function canvas2d(w, h) {
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    return { c: c, x: c.getContext('2d') };
  }
  function tex(c, rx, ry) {
    var t = new T.CanvasTexture(c);
    t.encoding = T.sRGBEncoding;
    t.wrapS = t.wrapT = T.RepeatWrapping;
    if (rx) t.repeat.set(rx, ry);
    t.anisotropy = 4;
    return t;
  }

  /* ======================= 3. RENDERER / SCENE ======================= */
  var canvasEl = $('scene');
  var renderer = new T.WebGLRenderer({ canvas: canvasEl, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(DPR);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.outputEncoding = T.sRGBEncoding;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;

  var scene = new T.Scene();
  scene.background = new T.Color(0x06080b);
  scene.fog = new T.Fog(0x06080b, 10, 26);

  var camera = new T.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.05, 80);

  /* ---- environment map (procedural "room") ---- */
  (function buildEnv() {
    var g = canvas2d(1024, 512), x = g.x;
    var grad = x.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#1b2432'); grad.addColorStop(0.45, '#0d131c');
    grad.addColorStop(0.62, '#0a0e14'); grad.addColorStop(1, '#04060a');
    x.fillStyle = grad; x.fillRect(0, 0, 1024, 512);
    // سقف با پنل‌های نور
    x.globalAlpha = 0.55;
    for (var i = 0; i < 4; i++) {
      var px = 120 + i * 230;
      var lg = x.createLinearGradient(px, 40, px, 150);
      lg.addColorStop(0, '#fff6e2'); lg.addColorStop(1, 'rgba(255,240,210,0)');
      x.fillStyle = lg; x.fillRect(px, 30, 120, 130);
    }
    x.globalAlpha = 1;
    x.fillStyle = 'rgba(255,255,255,0.85)';
    x.fillRect(0, 120, 1024, 6);
    var t = new T.CanvasTexture(g.c);
    t.mapping = T.EquirectangularReflectionMapping;
    t.encoding = T.sRGBEncoding;
    var pmrem = new T.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    scene.environment = pmrem.fromEquirectangular(t).texture;
    t.dispose(); pmrem.dispose();
  })();

  /* ---- lights ---- */
  scene.add(new T.HemisphereLight(0x9db8e0, 0x0a1410, 0.42));

  var keySpot = new T.SpotLight(0xfff1dc, 1.55, 14, 0.86, 0.65, 1.1);
  keySpot.position.set(0, 5.4, 0.35);
  keySpot.target.position.set(0, 0, 0.1);
  keySpot.castShadow = true;
  keySpot.shadow.mapSize.set(SMALL ? 1024 : 2048, SMALL ? 1024 : 2048);
  keySpot.shadow.camera.near = 2.5;
  keySpot.shadow.camera.far = 9;
  keySpot.shadow.bias = -0.0006;
  keySpot.shadow.radius = 2.2;
  scene.add(keySpot, keySpot.target);

  var fill = new T.SpotLight(0x8fb4ff, 0.45, 16, 1.05, 0.9, 1.2);
  fill.position.set(-3.4, 4.2, -2.6); fill.target.position.set(0, 0, 0);
  fill.castShadow = false;
  scene.add(fill, fill.target);

  var warm = new T.PointLight(0xffb066, 0.35, 12, 1.6);
  warm.position.set(2.8, 2.4, 2.2);
  scene.add(warm);

  /* ======================= 4. TEXTURES ======================= */
  function clothTexture() {
    var g = canvas2d(256, 256), x = g.x;
    x.fillStyle = '#0c6b4c'; x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 9000; i++) {
      var a = Math.random() * 0.09;
      x.fillStyle = Math.random() > 0.5 ? 'rgba(255,255,255,' + a + ')' : 'rgba(0,0,0,' + a * 1.2 + ')';
      x.fillRect(Math.random() * 256, Math.random() * 256, 1.4, 1.4);
    }
    x.globalAlpha = 0.06;
    for (var j = 0; j < 40; j++) {
      x.fillStyle = '#000';
      x.fillRect(0, j * 6.4, 256, 0.7);
    }
    x.globalAlpha = 1;
    return tex(g.c, 5, 10);
  }

  function woodTexture(base, dark) {
    var g = canvas2d(256, 256), x = g.x;
    x.fillStyle = base; x.fillRect(0, 0, 256, 256);
    for (var i = 0; i < 90; i++) {
      var y0 = Math.random() * 256;
      x.strokeStyle = 'rgba(0,0,0,' + rnd(0.03, 0.13) + ')';
      x.lineWidth = rnd(0.4, 2.2);
      x.beginPath();
      for (var px = 0; px <= 256; px += 16) {
        var y = y0 + Math.sin((px / 256) * Math.PI * rnd(1, 3) + i) * rnd(1, 5);
        px === 0 ? x.moveTo(px, y) : x.lineTo(px, y);
      }
      x.stroke();
    }
    var grd = x.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, 'rgba(255,255,255,0.10)');
    grd.addColorStop(0.5, 'rgba(0,0,0,0)');
    grd.addColorStop(1, dark);
    x.fillStyle = grd; x.fillRect(0, 0, 256, 256);
    var t = tex(g.c);
    return t;
  }

  function floorTexture() {
    var g = canvas2d(512, 512), x = g.x;
    var rg = x.createRadialGradient(256, 256, 30, 256, 256, 380);
    rg.addColorStop(0, '#141a20'); rg.addColorStop(1, '#05070a');
    x.fillStyle = rg; x.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 2600; i++) {
      x.fillStyle = 'rgba(255,255,255,' + Math.random() * 0.03 + ')';
      x.fillRect(Math.random() * 512, Math.random() * 512, 1.5, 1.5);
    }
    return tex(g.c, 6, 6);
  }

  function ballTexture(num, color, stripe) {
    var W = 512, H = 256, g = canvas2d(W, H), x = g.x;
    var hex = '#' + ('000000' + color.toString(16)).slice(-6);
    x.fillStyle = stripe ? '#f7f5ef' : hex;
    x.fillRect(0, 0, W, H);
    if (stripe) {
      x.fillStyle = hex;
      x.fillRect(0, H * 0.30, W, H * 0.40);
      // لبه‌های نرم
      var grd = x.createLinearGradient(0, H * 0.30, 0, H * 0.70);
      grd.addColorStop(0, 'rgba(0,0,0,0.18)'); grd.addColorStop(0.12, 'rgba(0,0,0,0)');
      grd.addColorStop(0.88, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,0.18)');
      x.fillStyle = grd; x.fillRect(0, 0, W, H);
    }
    // سایهٔ قطبی
    var pg = x.createLinearGradient(0, 0, 0, H);
    pg.addColorStop(0, 'rgba(0,0,0,0.35)'); pg.addColorStop(0.28, 'rgba(255,255,255,0.05)');
    pg.addColorStop(0.72, 'rgba(0,0,0,0.06)'); pg.addColorStop(1, 'rgba(0,0,0,0.35)');
    x.fillStyle = pg; x.fillRect(0, 0, W, H);
    // دایره‌های شماره
    [0.25, 0.75].forEach(function (u) {
      var cx = u * W, cy = H * 0.5, r = 40;
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
      x.fillStyle = '#f8f7f2'; x.fill();
      x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2);
      x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 3; x.stroke();
      x.fillStyle = '#111'; x.font = 'bold 44px Arial, Helvetica, sans-serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(String(num), cx, cy + 2);
    });
    return tex(g.c);
  }

  function pingTexture() {
    var g = canvas2d(256, 256), x = g.x;
    var rg = x.createRadialGradient(128, 128, 10, 128, 128, 128);
    rg.addColorStop(0, '#0d1420'); rg.addColorStop(1, '#04060a');
    x.fillStyle = rg; x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(255,255,255,0.05)'; x.lineWidth = 2;
    x.beginPath(); x.arc(128, 128, 88, 0, Math.PI * 2); x.stroke();
    return tex(g.c);
  }

  /* جدول/صحنه در table.js ساخته می‌شود؛ helper مشترک: */
