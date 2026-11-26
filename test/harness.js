/* هارنس تست: فایل نهایی را در jsdom با یک مرورگر WebGL ساختگی اجرا می‌کند
   و کل چرخهٔ بازی را شبیه‌سازی می‌کند. اجرا: node test/harness.js */
const fs = require('fs');
const path = require('path');
let JSDOM, VirtualConsole;
try { ({ JSDOM, VirtualConsole } = require('jsdom')); }
catch (e) {
  ({ JSDOM, VirtualConsole } = require(process.env.JSDOM_PATH || '/tmp/pwtest/node_modules/jsdom'));
}

const html = fs.readFileSync(path.join(__dirname, '..', 'pool-3d.html'), 'utf8');

/* ---------- WebGL ساختگی ---------- */
const ENABLE = { depth: 1, blend: 1, cull: 1, stencil: 1, scissor: 1, polygonOffsetFill: 1, sampleCoverage: 1 };
const PARAM = { 7936: 1, 7937: 1, 7938: 1 };
const extProxy = new Proxy({ CC: 1, loseContext() {} }, {
  get(t, k) {
    if (k in t) return t[k];
    if (typeof k === 'string' && /^[A-Z0-9_]+$/.test(k)) return 1;
    return function () { return {}; };
  }
});
function fakeGL(canvas) {
  const attrs = { alpha: false, antialias: true, depth: true, stencil: true, premultipliedAlpha: true, preserveDrawingBuffer: false, failIfMajorPerformanceCaveat: false };
  const target = {
    canvas, drawingBufferWidth: canvas.width || 800, drawingBufferHeight: canvas.height || 600,
    getContextAttributes: () => attrs,
    getExtension: () => extProxy,
    getSupportedExtensions: () => ['OES_texture_float', 'EXT_color_buffer_float'],
    getParameter: (p) => ({ 7938: 'WebGL 2.0', 35724: 'WebGL GLSL', 7936: 'Fake', 7937: 'Fake', 7939: 'WebGL 2.0' }[p] || 4),
    getShaderPrecisionFormat: () => ({ rangeMin: 127, rangeMax: 127, precision: 23 }),
    getProgramParameter: () => true,
    getShaderParameter: () => true,
    getProgramInfoLog: () => '',
    getShaderInfoLog: () => '',
    getUniformLocation: () => ({}),
    getAttribLocation: () => 0,
    getActiveAttrib: () => ({ name: 'a', size: 1, type: 5126 }),
    getActiveUniform: () => ({ name: 'a', size: 1, type: 5126 }),
    getError: () => 0,
    isEnabled: (e) => !!ENABLE[e],
    checkFramebufferStatus: () => 36053,
    clientWaitSync: () => 0,
    getSyncParameter: () => 0
  };
  return new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (typeof k === 'string' && /^[A-Z0-9_]+$/.test(k)) return 1;
      return function () { return {}; };
    }
  });
}

/* بوم 2d ساختگی و ماندگار (شبیه‌سازی ساده با پشتیبانی از هر متد) */
const patched = [];
function makeCanvas2D(canvas) {
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'createPattern') return () => ({});
      if (k === 'getImageData') return (x, y, ww, hh) => ({ data: new Uint8ClampedArray(ww * hh * 4) });
      if (k === 'measureText') return () => ({ width: 10 });
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; }
  });
  Object.defineProperty(canvas, 'getContext', { value: () => ctx, configurable: true });
  return ctx;
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

const vc = new VirtualConsole();
const logs = [];
vc.on('jsdomError', (e) => logs.push('JSDOM ERROR: ' + (e.stack || e.message)));
vc.on('error', (...a) => logs.push('CONSOLE ERROR: ' + a.join(' ')));
vc.on('warn', (...a) => logs.push('WARN: ' + a.join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(window) {
    window.HTMLCanvasElement.prototype.getContext = function (type) {
      if (type === '2d') {
        if (!this.__ctx2d) this.__ctx2d = makeCanvas2D(this);
        return this.__ctx2d;
      }
      if (type === 'webgl2' || type === 'webgl' || type === 'experimental-webgl') return fakeGL(this);
      return null;
    };
    window.HTMLCanvasElement.prototype.toDataURL = () => 'data:,';
    window.addEventListener('unhandledrejection', (ev) => {
      logs.push('REJECTION: ' + (ev.reason && ev.reason.stack ? ev.reason.stack : ev.reason));
    });
    const _st = window.setTimeout;
    window.setTimeout = function (fn, ms) {
      return _st(function () {
        try { fn(); } catch (e) { logs.push('TIMEOUT ERROR: ' + (e && e.stack ? e.stack : e)); }
      }, ms);
    };
    window.AudioContext = undefined;
    window.webkitAudioContext = undefined;
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(window.performance.now()), 8);
    window.addEventListener('error', (ev) => {
      logs.push('WINDOW ERROR: ' + (ev.error && ev.error.stack ? ev.error.stack : ev.message));
    });
  }
});

const w = dom.window;

(async () => {
  await sleep(600);
  const P = w.POOL;
  const api = w.__pool;
  const report = [];
  function fail(msg) { report.push('FAIL: ' + msg); console.log('FAIL: ' + msg); }
  function ok(msg) { console.log('ok   ' + msg); }

  if (!P || !api) { console.log(logs.join('\n')); throw new Error('بازی راه‌اندازی نشد'); }
  ok('بوت شد، صحنه ساخته شد');

  // منو → شروع
  w.document.getElementById('btnStart').click();
  await sleep(200);
  if (api.UI.state !== 'aim') fail('وضعیت پس از شروع: ' + api.UI.state); else ok('بازی شروع شد');

  // --- ابزارهای کمکی ---
  async function waitFor(pred, ms) {
    const t = Date.now();
    while (Date.now() - t < ms) { if (pred()) return true; await sleep(20); }
    return false;
  }
  async function settle(ms) {
    await waitFor(() => api.UI.state !== 'shooting', ms || 8000);
    await sleep(60);
  }

  // ضربهٔ شکستن
  api.fire(Math.PI, 95, 0, 0);
  if (!(await waitFor(() => api.POOL.state.running, 3000))) fail('شبیه‌سازی شکستن شروع نشد');
  else { api.fastForward(); await sleep(80); ok('ضربهٔ شکستن شبیه‌سازی شد؛ وضعیت: ' + api.UI.state); }

  /* ================= شبیه‌سازی بازی کامل ۸ بال ================= */
  async function loopGame(maxShots, budgetMs) {
    const t0 = Date.now();
    let human = 0, ai = 0, place = 0;
    while (Date.now() - t0 < budgetMs && human + ai < maxShots) {
      const st = api.UI.state;
      if (st === 'over') break;
      if (st === 'shooting') {
        const who = P.rules.turn;
        if (P.state.running) { api.fastForward(); who === 0 ? human++ : ai++; }
        await sleep(12);
        continue;
      }
      if (st === 'ai' || st === 'shooting') { await sleep(12); continue; }
      if (st === 'place') {
        if (P.rules.turn === 1) { await sleep(12); continue; }
        let ok = false;
        for (let k = 0; k < 400 && !ok; k++) ok = api.placeCueAt((Math.random() - 0.5) * 2.0, (Math.random() - 0.5) * 4.0);
        place++;
        continue;
      }
      if (st === 'aim') {
        if (P.rules.turn === 1) { await sleep(12); continue; }
        if (!api.canShoot()) { await sleep(20); continue; }
        const cue = P.cue();
        const tg = P.targetsFor(0);
        let ang = Math.random() * Math.PI * 2;
        if (tg.length) {
          const b = tg[Math.floor(Math.random() * tg.length)];
          // هدف‌گیری تقریبی به سمت جیب برای واقعی‌تر بودن
          const pk = P.POCKETS[Math.floor(Math.random() * P.POCKETS.length)];
          const ux = pk.x - b.x, uz = pk.z - b.z, ul = Math.hypot(ux, uz) || 1;
          const gx = b.x - ux / ul * 2 * P.R, gz = b.z - uz / ul * 2 * P.R;
          ang = Math.atan2(gx - cue.x + (Math.random() - 0.5) * 0.03, gz - cue.z + (Math.random() - 0.5) * 0.03);
        }
        api.fire(ang, 32 + Math.random() * 55, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.3);
        if (!(await waitFor(() => P.state.running || api.UI.state !== 'aim', 4000))) fail('ضربهٔ بازیکن اجرا نشد');
        continue;
      }
      await sleep(20);
    }
    return { human, ai, place, ms: Date.now() - t0 };
  }

  const r1 = await loopGame(70, 150000);
  ok('بازی ۸ بال → ضربه‌های بازیکن: ' + r1.human + ' | حریف: ' + r1.ai + ' | جای‌گذاری: ' + r1.place +
     ' | مدت: ' + (r1.ms / 1000).toFixed(1) + 's | وضعیت: ' + api.UI.state +
     ' | نوبت: ' + P.rules.turn + ' | گروه‌ها: ' + JSON.stringify(P.rules.groups) +
     ' | برنده: ' + P.rules.winners);
  if (r1.human < 5) fail('تعداد ضربه‌های بازیکن کم است: ' + r1.human);
  if (r1.ai < 3) fail('حریف به‌اندازه کافی ضربه نزد: ' + r1.ai);

  // بررسی سالم بودن توپ‌ها
  let nan = 0, oob = 0;
  P.balls.forEach((b) => {
    if (!isFinite(b.x) || !isFinite(b.z)) nan++;
    if (b.active && (Math.abs(b.x) > P.EX - P.R + 0.001 || Math.abs(b.z) > P.EZ - P.R + 0.001)) oob++;
  });
  if (nan) fail('توپ با مختصات NaN: ' + nan);
  if (oob) fail('توپ بیرون از میز: ' + oob);
  if (!nan && !oob) ok('مختصات توپ‌ها سالم است');

  /* ================= سناریوی پایان بازی: جیب‌کردن توپ ۸ ================= */
  api.newGame('2p');
  await sleep(80);
  P.rules.groups = ['solid', 'stripe'];
  P.rules.open = false;
  P.rules.breakShot = false;   // این ضربه، ضربهٔ شکستن نیست
  P.rules.shotCount = 3;
  P.balls.forEach((b) => { if (b.n >= 1 && b.n <= 7) { b.active = false; b.pocketed = true; } });
  const eight = P.balls.find((b) => b.n === 8);
  const pk8 = P.POCKETS[4]; // جیب میانی راست
  eight.x = pk8.x - 0.16; eight.z = 0; eight.vx = 0; eight.vz = 0;
  eight.active = true; eight.pocketed = false;
  P.placeCue(pk8.x - 0.62, 0.001);
  // صبر تا پایان انیمیشن ضربهٔ قبلی
  if (!(await waitFor(() => api.canShoot(), 4000))) fail('ضربهٔ بعدی آماده نشد');
  const ang8 = Math.atan2(eight.x - P.cue().x, eight.z - P.cue().z);
  api.fire(ang8, 55, 0, 0);
  await waitFor(() => P.state.running, 3000);
  api.fastForward();
  await sleep(150);
  if (api.UI.state === 'over') ok('سناریوی برنده‌شدن با توپ ۸ اجرا شد (وضعیت over)');
  else fail('پایان بازی با توپ ۸ اجرا نشد؛ وضعیت: ' + api.UI.state + ' | جیب‌شده: ' + JSON.stringify(P.state.thisShot));
  const resVisible = !w.document.getElementById('ovResult').classList.contains('hidden');
  if (!resVisible) fail('صفحهٔ نتیجه نمایش داده نشد'); else ok('صفحهٔ نتیجه نمایش داده شد');

  /* ================= حالت تمرین ================= */
  await waitFor(() => api.canShoot(), 4000);
  api.newGame('practice');
  await sleep(150);
  await waitFor(() => api.canShoot(), 4000);
  P.rules.breakShot = false;
  api.fire(Math.PI, 25, 0, 0);
  await waitFor(() => P.state.running, 3000);
  api.fastForward();
  await sleep(150);
  ok('حالت تمرین: وضعیت پس از ضربه = ' + api.UI.state);

  /* ================= چرخش/قدرت/دوربین ================= */
  api.aim.spinX = 0.6; api.aim.spinY = -0.4;
  api.aim.power = 88;
  w.document.getElementById('powerRange').value = 70;
  await sleep(120);
  w.document.getElementById('powerRange').dispatchEvent(new w.Event('input'));
  if (Math.abs(api.aim.power - 70) > 0.01) fail('اسلایدر قدرت کار نمی‌کند: ' + api.aim.power);
  else ok('اسلایدر قدرت کار می‌کند');
  w.document.getElementById('btnAimMode').click();
  w.document.getElementById('btnAimMode').click();
  w.document.getElementById('btnAimMode').click();
  w.document.getElementById('btnCam').click();
  await sleep(100);
  api.setCam('top'); await sleep(100);
  api.setCam('orbit');

  /* ================= بازگشت به منو ================= */
  api.toMenu(); await sleep(150);
  if (api.UI.state !== 'menu') fail('بازگشت به منو'); else ok('بازگشت به منو');

  // فریم‌های اضافی برای آشکارسازی خطاهای زمان اجرا
  await sleep(400);

  const errs = logs.filter((l) => l.startsWith('JSDOM ERROR') || l.startsWith('CONSOLE ERROR'));
  if (errs.length) {
    console.log('\n--- خطاهای کنسول ---');
    console.log(errs.slice(0, 20).join('\n'));
  }
  console.log('\nنتیجه: ' + (report.length ? report.length + ' خطا' : 'همه تست‌ها موفق'));
  process.exit(report.length || errs.length ? 1 : 0);
})();
