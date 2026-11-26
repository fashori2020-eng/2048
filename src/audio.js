  /* ======================= 8. AUDIO (WebAudio, بدون فایل خارجی) ======================= */
  var sfx = (function () {
    var ctx = null, master = null, noiseBuf = null, on = true;

    function init() {
      if (ctx) return true;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try { ctx = new AC(); } catch (e) { return false; }
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      var len = Math.floor(ctx.sampleRate * 1.2);
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    }

    function unlock() {
      if (!init()) return;
      if (ctx.state === 'suspended') ctx.resume();
    }

    function atten(x, z) {
      var d = Math.hypot(x || 0, z || 0);
      return clamp(1.15 - d * 0.16, 0.22, 1);
    }

    function noiseSrc() {
      var s = ctx.createBufferSource();
      s.buffer = noiseBuf;
      s.loop = true;
      return s;
    }

    function clack(v, x, z, mid) {
      if (!ctx || !on) return;
      var t = ctx.currentTime;
      var vol = clamp(v / 4.5, 0.04, 0.85) * atten(x, z) * (mid === undefined ? 1 : mid);
      // ضربهٔ تیز
      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      var f0 = 900 + clamp(v, 0, 5) * 520 + rnd(-90, 90);
      osc.frequency.setValueAtTime(f0, t);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.55, t + 0.055);
      var og = ctx.createGain();
      og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(vol * 0.9, t + 0.003);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      osc.connect(og).connect(master);
      osc.start(t); osc.stop(t + 0.11);
      // پاشنهٔ نویزی
      var n = noiseSrc();
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 2600 + v * 300; bp.Q.value = 1.1;
      var ng = ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.5, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      n.connect(bp).connect(ng).connect(master);
      n.start(t); n.stop(t + 0.06);
    }

    function cushion(v, x, z) {
      if (!ctx || !on) return;
      var t = ctx.currentTime;
      var vol = clamp(v / 5, 0.03, 0.6) * atten(x, z);
      var n = noiseSrc();
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 900;
      var ng = ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.55, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      n.connect(lp).connect(ng).connect(master);
      n.start(t); n.stop(t + 0.12);
      var o = ctx.createOscillator();
      o.type = 'sine'; o.frequency.setValueAtTime(180, t);
      o.frequency.exponentialRampToValueAtTime(110, t + 0.09);
      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(vol * 0.5, t);
      g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
      o.connect(g2).connect(master);
      o.start(t); o.stop(t + 0.13);
    }

    function pocket(x, z) {
      if (!ctx || !on) return;
      var t = ctx.currentTime;
      var vol = 0.42 * atten(x, z);
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(240, t);
      o.frequency.exponentialRampToValueAtTime(72, t + 0.22);
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + 0.34);
      // تلق‌تلق توپ در جیب
      for (var i = 0; i < 2; i++) {
        (function (k) {
          setTimeout(function () {
            if (!ctx || !on) return;
            var tt = ctx.currentTime;
            var o2 = ctx.createOscillator();
            o2.type = 'sine'; o2.frequency.value = 150 + k * 60;
            var g2 = ctx.createGain();
            g2.gain.setValueAtTime(vol * 0.35, tt);
            g2.gain.exponentialRampToValueAtTime(0.0001, tt + 0.1);
            o2.connect(g2).connect(master); o2.start(tt); o2.stop(tt + 0.12);
          }, 90 + k * 110);
        })(i);
      }
    }

    function cue(power) {
      if (!ctx || !on) return;
      var t = ctx.currentTime;
      var vol = clamp(0.2 + power * 0.5, 0.15, 0.75);
      var n = noiseSrc();
      var hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 1800;
      var ng = ctx.createGain();
      ng.gain.setValueAtTime(vol * 0.55, t);
      ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
      n.connect(hp).connect(ng).connect(master);
      n.start(t); n.stop(t + 0.05);
      var o = ctx.createOscillator();
      o.type = 'square'; o.frequency.setValueAtTime(320, t);
      o.frequency.exponentialRampToValueAtTime(160, t + 0.05);
      var g = ctx.createGain();
      g.gain.setValueAtTime(vol * 0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + 0.08);
    }

    function tone(freq, dur, type, vol, delay) {
      if (!ctx || !on) return;
      var t = ctx.currentTime + (delay || 0);
      var o = ctx.createOscillator();
      o.type = type || 'sine';
      o.frequency.value = freq;
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + dur + 0.05);
    }

    return {
      unlock: unlock,
      toggle: function () { on = !on; if (on) unlock(); return on; },
      isOn: function () { return on; },
      clack: clack, cushion: cushion, pocket: pocket, cue: cue,
      foul: function () { tone(140, 0.35, 'sawtooth', 0.13); tone(105, 0.4, 'sawtooth', 0.1, 0.12); },
      win: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone(f, 0.42, 'triangle', 0.16, i * 0.11); });
      },
      lose: function () {
        [392, 329.63, 261.63].forEach(function (f, i) { tone(f, 0.5, 'triangle', 0.14, i * 0.16); });
      },
      click: function () { tone(880, 0.05, 'sine', 0.08); }
    };
  })();
