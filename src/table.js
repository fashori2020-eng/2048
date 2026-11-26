  /* ======================= 7. TABLE / SCENE EXTRAS ======================= */
  var tableGroup = new T.Group();
  scene.add(tableGroup);

  var MAT = {
    cloth: new T.MeshStandardMaterial({ map: clothTexture(), color: 0xffffff, roughness: 0.93, metalness: 0.0 }),
    cushion: new T.MeshStandardMaterial({ color: 0x0a6247, roughness: 0.9 }),
    wood: new T.MeshStandardMaterial({ map: woodTexture('#6b4122', 'rgba(0,0,0,0.5)'), color: 0xffffff, roughness: 0.42, metalness: 0.14 }),
    woodDark: new T.MeshStandardMaterial({ map: woodTexture('#3b2313', 'rgba(0,0,0,0.66)'), roughness: 0.5, metalness: 0.1 }),
    leather: new T.MeshStandardMaterial({ color: 0x241610, roughness: 0.66, metalness: 0.16 }),
    pocket: new T.MeshStandardMaterial({ color: 0x050607, roughness: 0.96, side: T.DoubleSide }),
    brass: new T.MeshStandardMaterial({ color: 0xc9a355, roughness: 0.3, metalness: 0.95 }),
    pearl: new T.MeshStandardMaterial({ color: 0xf3ead6, roughness: 0.28, metalness: 0.12 })
  };
  MAT.cushion.map = MAT.cloth.map;
  MAT.cushion.map.repeat.set(3, 3);

  function roundRectPath(shp, w, h, r) {
    var x = -w / 2, y = -h / 2;
    shp.moveTo(x + r, y);
    shp.lineTo(x + w - r, y); shp.quadraticCurveTo(x + w, y, x + w, y + r);
    shp.lineTo(x + w, y + h - r); shp.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    shp.lineTo(x + r, y + h); shp.quadraticCurveTo(x, y + h, x, y + h - r);
    shp.lineTo(x, y + r); shp.quadraticCurveTo(x, y, x + r, y);
    return shp;
  }

  function plateShape(w, h, corner, holeR) {
    var s = new T.Shape();
    roundRectPath(s, w, h, corner);
    if (holeR) {
      POOL.POCKETS.forEach(function (p) {
        var hole = new T.Path();
        hole.absarc(p.x, p.z, holeR, 0, Math.PI * 2, true);
        s.holes.push(hole);
      });
    }
    return s;
  }

  /* --- پارچهٔ میز با سوراخ جیب‌ها --- */
  (function cloth() {
    var s = plateShape(CLOTH_X * 2, CLOTH_Z * 2, 0.11, POCKET_R);
    var g = new T.ShapeGeometry(s, 20);
    g.rotateX(-Math.PI / 2);
    var m = new T.Mesh(g, MAT.cloth);
    m.receiveShadow = true;
    tableGroup.add(m);
    // پوشش زیر پارچه (برای این‌که از شکاف جیب سیاهی دیده نشود)
    var under = new T.Mesh(new T.PlaneGeometry(CLOTH_X * 2, CLOTH_Z * 2),
      new T.MeshStandardMaterial({ color: 0x061a13, roughness: 1 }));
    under.rotation.x = -Math.PI / 2;
    under.position.y = -0.012;
    tableGroup.add(under);
  })();

  /* --- تخته‌سنگ --- */
  (function slate() {
    var s = plateShape(CLOTH_X * 2 - 0.02, CLOTH_Z * 2 - 0.02, 0.1, POCKET_R - 0.003);
    var g = new T.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false, curveSegments: 18 });
    g.rotateX(Math.PI / 2);
    g.translate(0, -0.004, 0);
    var m = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0x12181d, roughness: 0.92 }));
    m.receiveShadow = true;
    tableGroup.add(m);
  })();

  /* --- جیب‌ها --- */
  POOL.POCKETS.forEach(function (p) {
    var cup = new T.Mesh(new T.CylinderGeometry(p.r, p.r * 0.8, 0.2, 24, 1, true), MAT.pocket);
    cup.position.set(p.x, -0.105, p.z);
    tableGroup.add(cup);
    var bottom = new T.Mesh(new T.CircleGeometry(p.r * 0.8, 20),
      new T.MeshStandardMaterial({ color: 0x000000, roughness: 1 }));
    bottom.rotation.x = -Math.PI / 2; bottom.position.set(p.x, -0.205, p.z);
    tableGroup.add(bottom);
    var rim = new T.Mesh(new T.TorusGeometry(p.r * 0.985, 0.0095, 8, 32), MAT.leather);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(p.x, 0.002, p.z);
    rim.castShadow = true;
    tableGroup.add(rim);
    // حلقهٔ برنجی تزئینی
    var ring = new T.Mesh(new T.TorusGeometry(p.r * 0.985 + 0.012, 0.0032, 6, 32), MAT.brass);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(p.x, 0.004, p.z);
    tableGroup.add(ring);
  });

  /* --- بالشتک‌ها --- */
  function cushionGeometry(len) {
    var s = new T.Shape();
    s.moveTo(0, 0);
    s.lineTo(CUSH_D, 0);
    s.lineTo(CUSH_D, CUSH_H);
    s.lineTo(0.040, CUSH_H);
    s.lineTo(0.012, CUSH_H * 0.78);
    s.lineTo(0, CUSH_H * 0.62);
    s.closePath();
    var g = new T.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 2 });
    g.translate(0, 0, -len / 2);
    return g;
  }

  function addCushion(len, x, z, rotY) {
    var m = new T.Mesh(cushionGeometry(len), MAT.cushion);
    m.position.set(x, 0.0015, z);
    m.rotation.y = rotY;
    m.castShadow = true; m.receiveShadow = true;
    tableGroup.add(m);
    return m;
  }

  var mouthHalf = POOL.GAP * 0.5;
  var sideLen = EZ - 2 * mouthHalf;      // طول هر نیمهٔ بالشتک طولی
  var shortLen = PW - 2 * mouthHalf;     // طول بالشتک عرضی

  addCushion(sideLen, EX, EZ / 2, 0);
  addCushion(sideLen, EX, -EZ / 2, 0);
  addCushion(sideLen, -EX, EZ / 2, Math.PI);
  addCushion(sideLen, -EX, -EZ / 2, Math.PI);
  addCushion(shortLen, 0, EZ, -Math.PI / 2);
  addCushion(shortLen, 0, -EZ, Math.PI / 2);

  /* --- ریل‌های چوبی --- */
  function addRail(len, x, z, rotY) {
    var s = new T.Shape();
    roundRectPath(s, RAIL_W, RAIL_H, 0.014);
    var g = new T.ExtrudeGeometry(s, {
      depth: len, bevelEnabled: true, bevelSize: 0.007, bevelThickness: 0.007,
      bevelSegments: 2, curveSegments: 3
    });
    g.translate(0, 0, -len / 2);
    var m = new T.Mesh(g, MAT.wood);
    m.position.set(x, RAIL_CY, z);
    m.rotation.y = rotY;
    m.castShadow = true; m.receiveShadow = true;
    tableGroup.add(m);
    return m;
  }
  var railXCenter = EX + CUSH_D + RAIL_W / 2;
  var longRailLen = EZ - mouthHalf;
  var railZC = (EZ + mouthHalf) / 2;
  addRail(longRailLen, railXCenter, railZC, 0);
  addRail(longRailLen, railXCenter, -railZC, 0);
  addRail(longRailLen, -railXCenter, railZC, 0);
  addRail(longRailLen, -railXCenter, -railZC, 0);
  addRail(2 * (EX - mouthHalf), 0, EZ + CUSH_D + RAIL_W / 2, Math.PI / 2);
  addRail(2 * (EX - mouthHalf), 0, -(EZ + CUSH_D + RAIL_W / 2), Math.PI / 2);

  /* --- نشانه‌های الماسی ریل --- */
  (function diamonds() {
    var geo = new T.CircleGeometry(0.0072, 14);
    for (var i = 1; i <= 7; i++) {
      if (i === 4) continue;
      var z = -EZ + (PL / 8) * i;
      [railXCenter, -railXCenter].forEach(function (x) {
        var m = new T.Mesh(geo, MAT.pearl);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x, RAIL_CY + RAIL_H / 2 + 0.0015, z);
        tableGroup.add(m);
      });
    }
    for (var j = 1; j <= 3; j++) {
      var x2 = -EX + (PW / 4) * j;
      [EZ + CUSH_D + RAIL_W / 2, -(EZ + CUSH_D + RAIL_W / 2)].forEach(function (z2) {
        var m = new T.Mesh(geo, MAT.pearl);
        m.rotation.x = -Math.PI / 2;
        m.position.set(x2, RAIL_CY + RAIL_H / 2 + 0.0015, z2);
        tableGroup.add(m);
      });
    }
  })();

  /* --- بدنه، پایه‌ها، زمین --- */
  (function frame() {
    // دامن میز با سوراخ جیب‌ها تا توپ‌ها بتوانند بیفتند
    var apShape = plateShape(OUT_X * 2 - 0.02, OUT_Z * 2 - 0.02, 0.115, 0.1);
    var apGeo = new T.ExtrudeGeometry(apShape, { depth: 0.2, bevelEnabled: false, curveSegments: 16 });
    apGeo.rotateX(Math.PI / 2);
    apGeo.translate(0, -0.012, 0);
    var ap = new T.Mesh(apGeo, MAT.woodDark);
    ap.castShadow = true; ap.receiveShadow = true;
    tableGroup.add(ap);

    // نوار برنجی دور میز (با سوراخ جیب)
    var trimShape = plateShape(OUT_X * 2 + 0.012, OUT_Z * 2 + 0.012, 0.12, 0.1);
    var trimGeo = new T.ExtrudeGeometry(trimShape, { depth: 0.014, bevelEnabled: false, curveSegments: 16 });
    trimGeo.rotateX(Math.PI / 2);
    trimGeo.translate(0, -0.006, 0);
    tableGroup.add(new T.Mesh(trimGeo, MAT.brass));

    var lipGeo = new T.ExtrudeGeometry(plateShape(OUT_X * 2 - 0.06, OUT_Z * 2 - 0.06, 0.11, 0.1),
      { depth: 0.03, bevelEnabled: false, curveSegments: 16 });
    lipGeo.rotateX(Math.PI / 2);
    lipGeo.translate(0, -0.3, 0);
    tableGroup.add(new T.Mesh(lipGeo, MAT.leather));

    var legH = -FLOOR_Y - 0.34;
    var legGeo = new T.CylinderGeometry(0.09, 0.062, legH, 14);
    var footGeo = new T.CylinderGeometry(0.062, 0.08, 0.06, 14);
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
      var lx = s[0] * (OUT_X - 0.24), lz = s[1] * (OUT_Z - 0.32);
      var leg = new T.Mesh(legGeo, MAT.woodDark);
      leg.position.set(lx, FLOOR_Y + legH / 2 + 0.02, lz);
      leg.castShadow = true; leg.receiveShadow = true;
      tableGroup.add(leg);
      var foot = new T.Mesh(footGeo, MAT.brass);
      foot.position.set(lx, FLOOR_Y + 0.03, lz);
      tableGroup.add(foot);
      var cap = new T.Mesh(new T.CylinderGeometry(0.082, 0.082, 0.03, 14), MAT.brass);
      cap.position.set(lx, -0.31, lz);
      tableGroup.add(cap);
    });

    var fl = new T.PlaneGeometry(52, 52);
    fl.rotateX(-Math.PI / 2);
    var fm = new T.Mesh(fl, new T.MeshStandardMaterial({
      map: floorTexture(), color: 0x8f9aa8, roughness: 0.72, metalness: 0.18
    }));
    fm.position.y = FLOOR_Y;
    fm.receiveShadow = true;
    scene.add(fm);

    var rug = new T.Mesh(new T.PlaneGeometry(5.1, 7.1), new T.MeshStandardMaterial({ color: 0x16222c, roughness: 0.97 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.y = FLOOR_Y + 0.005;
    rug.receiveShadow = true;
    scene.add(rug);
  })();

  /* --- آویزهای نور --- */
  (function lamps() {
    var shadeGeo = new T.CylinderGeometry(0.30, 0.47, 0.17, 26, 1, true);
    var shadeMat = new T.MeshStandardMaterial({
      color: 0x1a2330, metalness: 0.65, roughness: 0.38, side: T.DoubleSide
    });
    var glowGeo = new T.CircleGeometry(0.31, 26);
    var glowMat = new T.MeshBasicMaterial({ color: 0xfff3da });
    var wireMat = new T.MeshStandardMaterial({ color: 0x0f1216, roughness: 0.85 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s2) {
      var lx = s2[0] * 2.05, lz = s2[1] * 2.5;
      var sh = new T.Mesh(shadeGeo, shadeMat);
      sh.position.set(lx, 2.35, lz);
      sh.scale.setScalar(0.8);
      scene.add(sh);
      var gl = new T.Mesh(glowGeo, glowMat);
      gl.rotation.x = Math.PI / 2;
      gl.position.set(lx, 2.27, lz);
      gl.scale.setScalar(0.8);
      scene.add(gl);
      var wire = new T.Mesh(new T.CylinderGeometry(0.005, 0.005, 1.6, 6), wireMat);
      wire.position.set(lx, 3.15, lz);
      scene.add(wire);
    });
  })();

  /* --- افکت موج --- */
  var ripples = [], rippleGeo = new T.RingGeometry(0.02, 0.028, 26, 1);
  for (var ri = 0; ri < 10; ri++) {
    var rm = new T.Mesh(rippleGeo, new T.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide
    }));
    rm.rotation.x = -Math.PI / 2;
    rm.position.y = 0.0055;
    rm.visible = false;
    scene.add(rm);
    ripples.push({ mesh: rm, t: 1, life: 0.42, max: 1 });
  }
  var ripIdx = 0;
  function addRipple(x, z, v) {
    var r = ripples[ripIdx = (ripIdx + 1) % ripples.length];
    r.t = 0; r.max = clamp(v / 2.6, 0.35, 1);
    r.mesh.position.set(x, 0.0055, z);
    r.mesh.visible = true;
  }
  function updateRipples(dt) {
    for (var i = 0; i < ripples.length; i++) {
      var r = ripples[i];
      if (r.t >= 1) { r.mesh.visible = false; continue; }
      r.t = Math.min(1, r.t + dt / r.life);
      var s = 1 + r.t * (3 + r.max * 6);
      r.mesh.scale.setScalar(s);
      r.mesh.material.opacity = (1 - r.t) * 0.16 * r.max;
    }
  }
