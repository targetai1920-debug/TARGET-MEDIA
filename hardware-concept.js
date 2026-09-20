/* Prototype-only scroll choreography. No page flow, product logic or form
   handler is changed — this only reads DOM state and drives the hardware
   field's transform/opacity via GSAP's scrub timeline (no manual scroll
   listeners, no per-frame polling).

   The visible front of each of the nine layers is a mechanical crop of a
   supplied photograph. CSS-built reverse surfaces are intentionally an
   approximation, not a claim to document unseen hardware. Every motion
   phase is scrubbed, including reverse scroll. */
(function () {
  'use strict';

  var field  = document.getElementById('hwField');
  var axis   = document.getElementById('hwAxis');
  var arcA   = document.getElementById('hwArcA');
  var arcB   = document.getElementById('hwArcB');
  var sparks = document.getElementById('hwSparks');
  var board  = document.getElementById('hwBoard');
  var camera = document.getElementById('hwCamera');
  var lens   = document.getElementById('hwLens');
  var led    = document.getElementById('hwLed');
  var connector = document.getElementById('hwConnector');
  var chip   = document.getElementById('hwChip');
  var pins   = document.getElementById('hwPins');
  var ports  = document.getElementById('hwPorts');
  var hdmi   = document.getElementById('hwHdmi');
  var topEl     = document.getElementById('top');
  var productEl = document.getElementById('product');
  var clarityEl = document.getElementById('clarity');
  var footerEl  = document.querySelector('footer');
  var instrument = document.querySelector('#heroStage .instrument');
  var sparkline = document.getElementById('sparklinePath');

  if (!field || !axis || !arcA || !arcB || !sparks || !board || !camera || !lens || !led || !connector || !chip || !pins || !ports || !hdmi || !topEl || !productEl) return;
  // The query option is a prototype-only QA switch; the actual user
  // preference remains authoritative on a normal URL.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).get('motion') === 'reduce') return;
  if (!window.gsap || !window.ScrollTrigger) return;

  gsap.registerPlugin(ScrollTrigger);

  var details = [lens, led, connector, chip, pins, ports, hdmi];
  var allPlanes = [board, camera, ...details];
  // ---- Physical solids ------------------------------------------------
  // Every object is a small real solid with true perspective: the untouched
  // photographic FRONT, a constructed mirrored REAR and, for the two main
  // objects, side WALLS that follow the real outline (the camera also carries
  // its real lens module as a raised block). Nothing photographed is replaced:
  // the camera front is that same photo split into a base and the lens-module
  // crop, which reproduce it exactly when the solid is flat.
  //
  // Each face is a plain flat layer that receives its OWN matrix3d, computed
  // here with the very same perspective(1100px) * rotateY * rotateX GSAP used
  // before (checked numerically). No preserve-3d contexts, masks or filters:
  // the compositor draws one quad per visible face instead of an offscreen
  // pass per face, and back faces are culled by backface-visibility.
  //
  // A solid's extras (rear, walls, raised lens) are only attached once all of
  // its face images are decoded, and depth then grows from 0 to 1 (m.g). At g = 0 the
  // solid is exactly the flat photo, so entering 3D never pops or jumps, even
  // mid-scroll; until then, or for any solid whose assets fail to load, its flat photo stays.
  var ASSET = 'assets/hardware/', VER = '?v=15', PERSP = 1100, RAD = Math.PI / 180;
  // Outlines are in texture pixels. The board outline is traced from the
  // photo's own alpha (closed silhouette without the thin header pins), the
  // camera outline excludes the protruding lens block.
  var SPEC = {
    // k = solid depth as a fraction of its width. edge = texture of the side walls.
    hwBoard:  { rear: 'hw-board-rear',  k: .04, edge: 'pcbblue',  poly: [[9,288],[25,276],[15,273],[14,261],[27,256],[65,78],[129,74],[130,66],[145,65],[428,65],[433,74],[470,74],[477,49],[486,49],[487,62],[502,57],[507,74],[515,58],[514,9],[539,9],[555,29],[557,50],[628,53],[630,79],[638,82],[646,115],[643,163],[652,167],[671,232],[659,301],[640,302],[639,320],[625,325],[27,325],[10,309]], tw: 680, th: 338 },
    hwCamera: { rear: 'hw-camera-rear', k: .05, edge: 'pcbblack', poly: [[10,247],[593,12],[670,77],[649,92],[58,327]], tw: 680, th: 337,
                // the lens module: the SAME photo split into the raised top face (its true square footprint), the flat
                // painted side bands (they fade out) and side walls textured with those bands rectified, all over a PCB base
                lens: { base: 'hw-camera-base', top: 'hw-lensmod-top', bands: 'hw-lensmod-bands', walls: 'lensmod', ox: 295, oy: 73, w: 142, ar: 143 / 142, k: .07, quad: [[5,35],[80,5],[133,76],[48,100]],
                        // the real lens barrel: the same pixels, raised again on a knurled elliptic cylinder
                        barrel: { top: 'hw-camera-barrel', ox: 16, oy: 14, w: 98, h: 81, k: .025, edge: 'knurl', poly: [[20.2,68.8],[19.3,54.4],[25.4,40.1],[37.5,28.0],[53.8,19.9],[71.8,17.0],[88.7,19.8],[102.0,27.9],[109.6,40.0],[110.5,54.4],[104.4,68.7],[92.3,80.8],[76.0,88.9],[58.0,91.8],[41.1,89.0],[27.8,80.9]] } } },
    hwLens:      { rear: 'hw-lens-rear',      k: .33, tw: 142, module: { top: 'hw-lensdet-top', bands: 'hw-lensdet-bands', walls: 'lensdet', quad: [[5,35],[80,5],[133,76],[48,100]] } },
    hwLed:       { rear: 'hw-led-rear',       k: .12, edge: 'pcbblue', tw: 85,  poly: [[4,54],[11,44],[11,23],[62,4],[64,13],[22,29],[42,75]] },
    hwConnector: { rear: 'hw-connector-rear', k: .18, edge: 'plastic',   tw: 87,  poly: [[4,20],[22,13],[54,68],[74,62],[73,78],[82,80],[46,104],[25,92]] },
    hwChip:      { rear: 'hw-chip-rear',      k: .06, edge: 'pcbblack', tw: 181, poly: [[5,45],[90,5],[175,50],[176,54],[102,118],[94,120],[8,51]] },
    hwPins:      { rear: 'hw-pins-rear',      k: .07, edge: 'plastic',   tw: 395, poly: [[6,48],[21,31],[358,40],[377,27],[389,71],[6,70]] },
    hwPorts:     { rear: 'hw-ports-rear',     k: .20, edge: 'steel',   tw: 144, poly: [[0,23],[9,0],[58,12],[101,0],[122,11],[144,105],[12,127]] },
    hwHdmi:      { rear: 'hw-hdmi-rear',      k: .12, edge: 'steel',   tw: 331, poly: [[4,89],[11,4],[321,9],[326,96],[157,101],[28,98],[7,96]] }
  };
  // 4x4 column-major helpers (same layout as CSS matrix3d)
  function mul(a, b) {
    var o = new Array(16), c, r;
    for (c = 0; c < 4; c++) for (r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    return o;
  }
  function T(x, y, z) { return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1]; }
  function Rx(a) { var c = Math.cos(a * RAD), s = Math.sin(a * RAD); return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1]; }
  function Ry(a) { var c = Math.cos(a * RAD), s = Math.sin(a * RAD); return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1]; }
  function Rz(a) { var c = Math.cos(a * RAD), s = Math.sin(a * RAD); return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  function Sy(k) { return [1, 0, 0, 0, 0, k, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  var PM = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1 / PERSP, 0, 0, 0, 1];
  // Allocation-free o = a * b for the per-frame path (o must not alias a or b)
  function mulTo(o, a, b) {
    var a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3], a4 = a[4], a5 = a[5], a6 = a[6], a7 = a[7],
        a8 = a[8], a9 = a[9], a10 = a[10], a11 = a[11], a12 = a[12], a13 = a[13], a14 = a[14], a15 = a[15];
    for (var c = 0; c < 16; c += 4) {
      var b0 = b[c], b1 = b[c + 1], b2 = b[c + 2], b3 = b[c + 3];
      o[c]     = a0 * b0 + a4 * b1 + a8 * b2 + a12 * b3;
      o[c + 1] = a1 * b0 + a5 * b1 + a9 * b2 + a13 * b3;
      o[c + 2] = a2 * b0 + a6 * b1 + a10 * b2 + a14 * b3;
      o[c + 3] = a3 * b0 + a7 * b1 + a11 * b2 + a15 * b3;
    }
    return o;
  }
  function r6(v) { return Math.round(v * 1e6) / 1e6; }
  function fmt(m) {
    return 'matrix3d(' + r6(m[0]) + ',' + r6(m[1]) + ',' + r6(m[2]) + ',' + r6(m[3]) + ',' + r6(m[4]) + ',' + r6(m[5]) + ',' + r6(m[6]) + ',' + r6(m[7]) + ',' +
      r6(m[8]) + ',' + r6(m[9]) + ',' + r6(m[10]) + ',' + r6(m[11]) + ',' + r6(m[12]) + ',' + r6(m[13]) + ',' + r6(m[14]) + ',' + r6(m[15]) + ')';
  }
  var FIN = new Float64Array(16), LIGHT = [-.55, -.83], I4 = T(0, 0, 0), RZ180 = Rz(180);

  // Face images start fetching immediately but only join the DOM once all are decoded.
  var jobs = [];
  function need(name, cls) {
    var im = new Image(), job = { im: im, ok: false };
    im.className = 'hw-face ' + cls; im.alt = ''; im.decoding = 'async'; im.draggable = false;
    im.setAttribute('aria-hidden', 'true');
    im.src = ASSET + name + '.webp' + VER;
    job.done = (im.decode ? im.decode() : new Promise(function (res, rej) { im.onload = res; im.onerror = rej; }))
      .then(function () { job.ok = true; }, function () { job.ok = false; });
    jobs.push(job);
    return job;
  }
  // geo(m, s): static box in solid pixels; F(m): face-local placement using the current depth m.g
  function addFace(m, el, kind, flow, fade, geo, F) { var f = { el: el, kind: kind, flow: flow, fade: fade, geo: geo, F: F, vis: true, bw: 0, bh: 0 }; m.faces.push(f); return f; }
  // Wall textures. Backgrounds are written as LITERAL inline values, never through var()/calc(): a wall's transform
  // changes every scroll tick, and var()-based or two-layer backgrounds made Blink repaint every wall on every tick
  // (measured: ~50 paints per frame; a single literal layer does not). Geometry is exactly what the stylesheet had.
  var STRIP = { pcbblue: 'hw-edge-pcb-blue', pcbblack: 'hw-edge-pcb-black', steel: 'hw-edge-steel', plastic: 'hw-edge-plastic', knurl: 'hw-edge-knurl' };
  var QUAD = { f: '0 0', l: '100% 0', b: '0 100%', r: '100% 100%' };   // lens-module atlas: front, left / back, right
  function wallTex(name) {
    var a = /^(lensmod|lensdet)-([fblr])$/.exec(name);
    return a ? { file: 'hw-' + a[1] + '-walls', quad: QUAD[a[2]] } : { file: STRIP[name] };
  }
  function wallBackground(f) {
    var t = f.tex, st = f.el.style, url = 'url(' + ASSET + t.file + '.webp' + VER + ')';
    if (t.quad) {   // photographic side: the atlas quadrant, with a contact shadow toward the base (needs a gradient layer)
      st.backgroundImage = 'linear-gradient(rgba(6,7,14,0),rgba(6,7,14,.3)),' + url;
      st.backgroundSize = '100% 100%,200% 200%'; st.backgroundPosition = '0 0,' + t.quad; st.backgroundRepeat = 'no-repeat,repeat-x'; st.boxShadow = '';
    } else {        // tiled edge strip scaled to the wall height, darkened by a uniform cast
      st.backgroundImage = url; st.backgroundSize = 'auto 100%'; st.backgroundPosition = '0 0'; st.backgroundRepeat = 'repeat-x';
      st.boxShadow = f.shade > 0 ? 'inset 0 0 0 999px rgba(6,7,14,' + f.shade + ')' : '';
    }
  }
  // One wall per outline edge, standing on the mid-plane and facing outward.
  function addWalls(m, cfg, kind, thick, zc, edge) {   // edge: one class, or one per outline edge
    var poly = cfg.poly, n = poly.length, i, area = 0;
    for (i = 0; i < n; i++) area += poly[i][0] * poly[(i + 1) % n][1] - poly[(i + 1) % n][0] * poly[i][1];
    var sign = area > 0 ? 1 : -1;   // winding decides "outward", so concave outlines work too
    var ox = cfg.ox || 0, oy = cfg.oy || 0;
    for (i = 0; i < n; i++) (function (p, q, ei) {
      var dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
      if (len < 1.5) return;
      var mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      // rotateX(90deg) after rotateZ(a) turns the visible face toward (dy,-dx)/len
      var outward = sign > 0;
      var w = document.createElement('span');
      w.className = 'hw-wall'; w.setAttribute('aria-hidden', 'true');
      // Static model-space lighting (light from the upper left): walls facing away from it get a darker cast,
      // so neighbouring walls read as separate planes instead of one flat ribbon.
      var lit = Math.max(0, (dy * LIGHT[0] - dx * LIGHT[1]) / len * sign);
      var shade = cfg.flat ? 0 : +(.5 * Math.pow(1 - lit, 1.3)).toFixed(2);   // photographic walls carry their own baked light
      m.solid.appendChild(w);
      var ang = Math.atan2(dy, dx) * 180 / Math.PI;
      var wf = addFace(m, w, kind, false, true, function (mm, s) {
        var t = thick(mm);
        return { x: (mx + ox) * s - len * s / 2, y: (my + oy) * s - t / 2, w: len * s, h: t };
      }, function (mm) {
        // Rz(180) on the outward-turning walls keeps every wall texture upright (top = world up) and reading left-to-right seen from outside
        return mul(T(0, 0, zc(mm)), mul(Rz(ang), mul(Rx(outward ? 90 : -90), mul(outward ? RZ180 : I4, Sy(Math.max(mm.g, .001))))));
      });
      wf.tex = wallTex(typeof edge === 'string' ? edge : edge[ei]); wf.shade = shade;
    })(poly[i], poly[(i + 1) % n], i);
  }
  // Non-flow faces are laid out as integer TEXTURE-pixel boxes at left/top 0 and
  // placed + scaled entirely by their matrix: fractional CSS boxes get pixel-snapped
  // by the browser, which drifted the raised lens block up to ~1 texture pixel off
  // the photo it must line up with.
  function faceLocal(m, f) {
    var g = f.g0, k = f.flow ? 1 : m.s, o = T(g.w / 2, g.h / 2, 0), oi = T(-g.w / 2, -g.h / 2, 0);
    f.Lf = mul(T(g.x, g.y, 0), mul(o, mul(f.F(m), mul(oi, [k, 0, 0, 0, 0, k, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]))));
  }
  function layoutModel(m) {
    // Fractional layout size (offsetWidth rounds, which would drift the lens block off the photo by up to a pixel)
    var cs = getComputedStyle(m.solid);
    var w = /px$/.test(cs.width) ? parseFloat(cs.width) : 0, h = /px$/.test(cs.height) ? parseFloat(cs.height) : 0;
    if (!(w > 0 && h > 0)) { m.w = 0; return; }   // not laid out yet (or display:none): keep the flat photo
    m.w = w; m.h = h;
    var spec = m.spec, s = m.s = spec.tw ? m.w / spec.tw : 1;
    m.d = m.w * (spec.k || .05); m.lh = spec.lens ? m.w * spec.lens.k : 0; m.lb = spec.lens ? m.w * spec.lens.barrel.k : 0;
    m.faces.forEach(function (f) {
      var g = f.g0 = f.geo(m, s);
      f.bw = f.flow ? g.w : g.w / s; f.bh = f.flow ? g.h : g.h / s;
      if (!f.flow) { var st = f.el.style; st.left = '0'; st.top = '0'; st.width = f.bw + 'px'; st.height = f.bh + 'px'; if (f.tex) wallBackground(f); }
      f.vis = true; f.el.style.visibility = '';
    });
    m.key = ''; m.gDone = -1; renderModel(m);
  }
  function renderModel(m) {
    if (!m.w) return;
    // A plane that is fully transparent is not drawn: don't pay for ~10-60 matrix writes per scroll tick on it.
    // It is marked stale and caught up by catchUp() (below) the moment its opacity leaves 0.
    if (m.plane.style.opacity === '0') { m.key = ''; m.stale = true; return; }
    var key = m.rx.toFixed(3) + ',' + m.ry.toFixed(3);
    if (key === m.key && m.g === m.gDone) return;
    m.key = key;
    var cx = m.w / 2, cy = m.h / 2, i, f;
    if (m.g !== m.gDone) {   // depth changed: refresh face placement (and fade the extras in while it grows)
      m.gDone = m.g;
      for (i = 0; i < m.faces.length; i++) { f = m.faces[i]; faceLocal(m, f); if (f.fade) f.el.style.opacity = f.fade > 0 ? (m.g < 1 ? m.g.toFixed(3) : '') : (m.g < 1 ? (1 - m.g).toFixed(3) : '0'); }
    }
    var W = mul(T(cx, cy, 0), mul(mul(PM, mul(Ry(m.ry), Rx(m.rx))), T(-cx, -cy, 0)));
    for (i = 0; i < m.faces.length; i++) {
      f = m.faces[i];
      if (f.fade < 0 && m.g >= 1) continue;   // painted side bands are fully faded out: nothing to move
      mulTo(FIN, W, f.Lf);
      // Orientation of the projected box (origin, +x, +y corners): a back-facing face is culled by the
      // browser anyway, so skip formatting/writing its matrix and just keep it hidden until it turns.
      var w0 = FIN[15], w1 = FIN[3] * f.bw + FIN[15], w2 = FIN[7] * f.bh + FIN[15], front = true;
      if (w0 > .05 && w1 > .05 && w2 > .05) {
        var x0 = FIN[12] / w0, y0 = FIN[13] / w0;
        front = ((FIN[0] * f.bw + FIN[12]) / w1 - x0) * ((FIN[5] * f.bh + FIN[13]) / w2 - y0) -
                ((FIN[1] * f.bw + FIN[13]) / w1 - y0) * ((FIN[4] * f.bh + FIN[12]) / w2 - x0) > 0;
      }
      if (front) { f.el.style.transform = fmt(FIN); if (!f.vis) { f.vis = true; f.el.style.visibility = ''; } }
      else if (f.vis) { f.vis = false; f.el.style.visibility = 'hidden'; }
    }
    if (m.hasBlock) {
      // painter's order between the base, the raised lens block and the rear
      var facing = Math.cos(m.rx * RAD) * Math.cos(m.ry * RAD) > 0;
      if (facing !== m.facing) {
        m.facing = facing;
        for (i = 0; i < m.faces.length; i++) { f = m.faces[i]; var z = ZORDER[f.kind]; f.el.style.zIndex = z ? z[facing ? 0 : 1] : ''; }
      }
    }
  }
  // painter's order [front-facing, back-facing] for the faces stacked on the camera board
  var ZORDER = { front: [1, 0], bands: [2, 0], rear: [0, 7], lens: [3, 1], lensTop: [4, 0], barrel: [5, 1], barrelTop: [6, 0] };
  var models = allPlanes.map(function (plane) {
    var spec = SPEC[plane.id] || {};
    var front = plane.querySelector('img');
    var solid = document.createElement('div');
    solid.className = 'hw-solid';
    plane.appendChild(solid);
    solid.appendChild(front);
    front.classList.add('hw-face', 'hw-face--front');
    var m = { plane: plane, solid: solid, spec: spec, faces: [], rx: 0, ry: 0, g: 0, gDone: -1, key: '', w: 0, h: 0, d: 0, lh: 0, hasBlock: false, facing: null, rearJob: null, lb: 0, stale: false };
    addFace(m, front, 'front', true, false, function (mm) { return { x: 0, y: 0, w: mm.w, h: mm.h }; },
      function (mm) { return T(0, 0, mm.d * mm.g / 2); });
    if (spec.rear) m.rearJob = need(spec.rear, 'hw-face--rear');
    if (spec.module) { m.modTop = need(spec.module.top, 'hw-face--lens'); m.modBands = need(spec.module.bands, 'hw-face--front'); }
    return m;
  });
  var EDGE_FILE = { pcbblue: 'hw-edge-pcb-blue', pcbblack: 'hw-edge-pcb-black', steel: 'hw-edge-steel', plastic: 'hw-edge-plastic', knurl: 'hw-edge-knurl' }, edgeJobs = {};
  Object.keys(EDGE_FILE).forEach(function (k) { edgeJobs[k] = need(EDGE_FILE[k], 'hw-edge'); });
  var atlasJobs = { lensmod: need('hw-lensmod-walls', 'hw-edge'), lensdet: need('hw-lensdet-walls', 'hw-edge') };
  var camModel = models[1], camLens = SPEC.hwCamera.lens;
  var baseJob = need(camLens.base, 'hw-face--front'), topJob = need(camLens.top, 'hw-face--lens'), bandsJob = need(camLens.bands, 'hw-face--lens'), barrelJob = need(camLens.barrel.top, 'hw-face--lens');
  // A solid only becomes 3D if EVERY asset it needs decoded (its rear; for the
  // camera also the base, lens and barrel crops; every solid its wall texture). Otherwise that solid keeps its original
  // flat photo: no walls, no rear, no depth animation.
  function solidReady(m) {
    var ok = (!m.rearJob || m.rearJob.ok) && (!m.spec.edge || edgeJobs[m.spec.edge].ok);
    if (m === camModel) ok = ok && baseJob.ok && topJob.ok && bandsJob.ok && barrelJob.ok && atlasJobs[camLens.walls].ok && edgeJobs[camLens.barrel.edge].ok;
    if (m.spec.module) ok = ok && m.modTop.ok && m.modBands.ok && atlasJobs[m.spec.module.walls].ok;
    return ok;
  }
  // quad A,B,C,D = the module top face; edges AB back, BC right, CD front, DA left (front/left carry the photographed sides)
  function wallClasses(prefix) { return [prefix + '-b', prefix + '-r', prefix + '-f', prefix + '-l']; }
  function assemble() {
    var live = models.filter(solidReady);
    live.forEach(function (m) {
      var spec = m.spec;
      if (m.rearJob) {
        m.solid.appendChild(m.rearJob.im);
        addFace(m, m.rearJob.im, 'rear', false, true, function (mm) { return { x: 0, y: 0, w: mm.w, h: mm.h }; },
          function (mm) { return mul(Ry(180), T(0, 0, mm.d * mm.g / 2)); });
      }
      if (spec.module) {
        // The lens module as a solid of its own: bands (flat painted sides) replace the photo in flow and fade out,
        // the top face stays at the front plane, the four walls carry the rectified photo of the sides.
        var M = spec.module;
        m.faces[0].el.replaceWith(m.modBands.im); m.faces[0].el = m.modBands.im; m.faces[0].kind = 'bands'; m.faces[0].fade = -1;
        m.solid.appendChild(m.modTop.im);
        addFace(m, m.modTop.im, 'lensTop', false, 0, function (mm) { return { x: 0, y: 0, w: mm.w, h: mm.h }; }, function (mm) { return T(0, 0, mm.g * mm.d / 2); });
        addWalls(m, { poly: M.quad, flat: true }, 'lens', function (mm) { return mm.d; }, function () { return 0; }, wallClasses(M.walls));
        m.hasBlock = true; m.facing = null;
      } else if (spec.poly) addWalls(m, spec, 'slab', function (mm) { return mm.d; }, function () { return 0; }, spec.edge);
      if (m === camModel) {
        // The real lens module as a raised block: the SAME photograph split into the base (PCB, module region cut out),
        // the painted side bands (flat, they fade out), the raised top face and walls textured with the rectified sides.
        var L = camLens, geoL = function (mm, s) { return { x: L.ox * s, y: L.oy * s, w: L.w * s, h: L.w * s * L.ar }; };
        m.faces[0].el.replaceWith(baseJob.im); m.faces[0].el = baseJob.im; m.faces[0].vis = true;
        m.solid.appendChild(bandsJob.im);
        addFace(m, bandsJob.im, 'bands', false, -1, geoL, function (mm) { return T(0, 0, mm.g * mm.d / 2); });
        m.solid.appendChild(topJob.im);
        addFace(m, topJob.im, 'lensTop', false, 0, geoL, function (mm) { return T(0, 0, mm.g * (mm.d / 2 + mm.lh)); });
        addWalls(m, { poly: L.quad, ox: L.ox, oy: L.oy, flat: true }, 'lens', function (mm) { return mm.lh; }, function (mm) { return mm.g * (mm.d / 2 + mm.lh / 2); }, wallClasses(L.walls));
        // ...and the lens barrel: the same pixels again, on a knurled cylinder standing on the module top
        var B = L.barrel;
        m.solid.appendChild(barrelJob.im);
        addFace(m, barrelJob.im, 'barrelTop', false, 0, function (mm, s) { return { x: (L.ox + B.ox) * s, y: (L.oy + B.oy) * s, w: B.w * s, h: B.h * s }; },
          function (mm) { return T(0, 0, mm.g * (mm.d / 2 + mm.lh + mm.lb)); });
        addWalls(m, { poly: B.poly, ox: L.ox, oy: L.oy }, 'barrel', function (mm) { return mm.lb; }, function (mm) { return mm.g * (mm.d / 2 + mm.lh + mm.lb / 2); }, B.edge);
        m.hasBlock = true; m.facing = null;
      }
    });
    // Everything is attached at depth 0 (identical to the flat photos), then depth eases in.
    live.forEach(layoutModel);
    live.forEach(function (m, i) {
      gsap.to(m, { g: 1, duration: .9, delay: i * .05, ease: 'power2.out', onUpdate: function () { renderModel(m); } });
    });
  }
  Promise.all(jobs.map(function (j) { return j.done; })).then(assemble);
  // A fully transparent plane skips its matrix work (see renderModel). The timelines that fade planes in call this on
  // every update, so a plane is caught up in the very tick its opacity leaves 0. No always-on ticker: nothing runs
  // while the page is not scrolling.
  function catchUp() {
    for (var i = 0; i < models.length; i++) if (models[i].stale && models[i].plane.style.opacity !== '0') { models[i].stale = false; renderModel(models[i]); }
  }
  var layoutAll = function () { models.forEach(layoutModel); };
  layoutAll();
  models.forEach(function (m) {   // the front photo defines each solid's box: re-layout when it decodes
    var f = m.faces[0].el;
    if (!f.complete) f.addEventListener('load', function () { layoutModel(m); }, { once: true });
  });
  if ('ResizeObserver' in window) { var ro = new ResizeObserver(layoutAll); ro.observe(field); }
  else addEventListener('resize', layoutAll);
  var emitter = document.createElement('span');
  var photon = document.createElement('span');
  emitter.className = 'hw-emitter';
  photon.className = 'hw-photon';
  lens.appendChild(emitter);
  field.appendChild(photon);
  // Fixed positions keep the glints anchored to the physical composition;
  // they neither fetch assets nor generate a random layout on every visit.
  [[17,34,2,3.8],[29,69,2,5.1],[38,16,3,4.6],[54,10,2,5.4],
   [71,23,2,4.2],[83,41,3,5.7],[87,64,2,4.8],[68,79,2,5.2],
   [50,88,2,4.5],[30,57,2,6.1],[14,58,2,4.9],[77,13,2,5.6]
  ].forEach(function (spec, index) {
    var spark = document.createElement('i');
    spark.className = 'hw-spark' + (index === 2 || index === 5 || index === 8 ? ' hw-spark--flare' : '');
    spark.style.setProperty('--x', spec[0] + '%');
    spark.style.setProperty('--y', spec[1] + '%');
    spark.style.setProperty('--size', spec[2] + 'px');
    spark.style.setProperty('--duration', spec[3] + 's');
    spark.style.setProperty('--delay', (-index * .63) + 's');
    sparks.appendChild(spark);
  });
  document.addEventListener('visibilitychange', function () {
    sparks.classList.toggle('is-paused', document.hidden);
  });
  var spread = () => Math.min(300, innerWidth * .22);
  var lift = () => Math.min(135, innerHeight * (innerWidth <= 680 ? .09 : .16));
  var rise = () => innerWidth <= 680 ? 0 : 85;
  var compact = matchMedia('(max-width: 680px)').matches;
  var alpha = value => compact ? value * .48 : value;
  var boardRest = compact
    ? { xPercent: -34, yPercent: -36, scale: .82, opacity: .21 }
    : { xPercent: -32, yPercent: -34, scale: .86, opacity: .44 };
  var cameraRest = compact
    ? { xPercent: -64, yPercent: -60, scale: .78, opacity: .25 }
    : { xPercent: -66, yPercent: -62, scale: .82, opacity: .49 };

  // Phase 1 — the resting "system established" shot (must match the CSS
  // baseline in hardware-concept.css exactly, so JS taking over never pops).
  // Remove the fallback CSS transform first; otherwise GSAP parses and
  // compounds its percentage translation, pushing the camera off-screen.
  gsap.set(allPlanes, { transform: 'none' });
  gsap.set(board, boardRest);
  gsap.set(camera, cameraRest);
  gsap.set(details, { xPercent: -50, yPercent: -50, x: 0, y: 0, rotation: 0, scale: .72, opacity: 0 });
  gsap.set(axis, { opacity: 0 });
  gsap.set(sparks, { opacity: .55 });
  gsap.set([arcA, arcB], { opacity: .1 });
  gsap.set(models, { rx: 0, ry: 0 });
  gsap.set(models[1], { rx: 10, ry: -24 });
  models.forEach(renderModel);

  var tl = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: catchUp,
    scrollTrigger: {
      trigger: topEl,
      start: 'top top',
      endTrigger: productEl,
      end: 'bottom bottom',
      scrub: 0.6,
      invalidateOnRefresh: true
    }
  });

  // Establish -> lens macro: the original device recedes into a crop of
  // the actual photographed lens. Only camera moves; the page does not pin.
  tl.addLabel('establish', 0)
    .to(camera, { xPercent: -50, yPercent: -50, scale: 1.12, opacity: .13, duration: .13 }, 'establish')
    .to(board, { xPercent: -50, yPercent: -44, scale: .7, opacity: .06, duration: .13 }, 'establish')
    .to(lens, { scale: 1.2, opacity: alpha(.79), duration: .12 }, 'establish+=0.01')
    .to(sparks, { opacity: .68, duration: .13 }, 'establish')
    .addLabel('explode', .14)

    // Explode into nine visible photographic planes, staggered along one
    // central depth axis. Crops never imply that a hidden side was captured.
    .to(camera, { xPercent: -50, yPercent: -50, x: () => -spread() * .55, y: () => -rise() - lift() * .1, scale: .84, opacity: .12, duration: .2 }, 'explode')
    .to(board, { xPercent: -50, yPercent: -50, x: () => spread() * .58, y: () => -rise() + lift() * .08, scale: .88, opacity: .17, duration: .2 }, 'explode')
    .to(axis, { opacity: compact ? .3 : .8, duration: .18 }, 'explode')
    .to([arcA, arcB], { opacity: compact ? .19 : .38, duration: .18 }, 'explode')
    .to(sparks, { opacity: .96, duration: .18 }, 'explode')
    .to(lens, { x: () => -spread() * 1.02, y: () => -rise() - lift() * 1.12, rotation: -6, scale: .87, opacity: alpha(.75), duration: .18 }, 'explode')
    .to(led, { x: () => -spread() * 1.06, y: () => -rise() + lift() * .75, rotation: -4, scale: .88, opacity: alpha(.62), duration: .16 }, 'explode+=0.02')
    .to(connector, { x: () => -spread() * .28, y: () => -rise() - lift() * 1.3, rotation: 5, scale: .86, opacity: alpha(.64), duration: .15 }, 'explode+=0.04')
    .to(chip, { x: () => spread() * .2, y: () => -rise() - lift() * .48, rotation: 7, scale: .96, opacity: alpha(.76), duration: .15 }, 'explode+=0.06')
    .to(pins, { x: () => spread() * .86, y: () => -rise() - lift() * 1.12, rotation: -2, scale: .84, opacity: alpha(.62), duration: .14 }, 'explode+=0.08')
    .to(ports, { x: () => spread() * 1.05, y: () => -rise() + lift() * .2, rotation: 4, scale: .9, opacity: alpha(.68), duration: .14 }, 'explode+=0.1')
    .to(hdmi, { x: () => spread() * .48, y: () => -rise() + lift() * 1.08, rotation: -3, scale: .88, opacity: alpha(.62), duration: .14 }, 'explode+=0.12')
    .addLabel('chipFocus', .4)

    // Focus travels through the real SoC and header details, then the
    // photographed connector stack. The remaining layers fall softly back.
    .to([lens, led, connector], { opacity: alpha(.12), scale: .72, duration: .14 }, 'chipFocus')
    .to(sparks, { opacity: .7, duration: .14 }, 'chipFocus')
    .to(chip, { scale: 1.32, opacity: alpha(.72), x: () => spread() * .06, y: () => -rise() - lift() * .25, duration: .16 }, 'chipFocus')
    .to(pins, { scale: 1.04, opacity: alpha(.42), duration: .14 }, 'chipFocus')
    .addLabel('portsFocus', .57)
    .to([chip, pins], { opacity: alpha(.12), scale: .78, duration: .14 }, 'portsFocus')
    .to(ports, { x: () => spread() * .52, y: () => -rise() - lift() * .18, scale: 1.14, opacity: alpha(.78), duration: .14 }, 'portsFocus')
    .to(hdmi, { x: () => spread() * .02, y: () => -rise() + lift() * .68, scale: 1.13, opacity: alpha(.44), duration: .14 }, 'portsFocus')
    .to(camera, { opacity: .08, scale: .72, duration: .14 }, 'portsFocus')
    .to(board, { opacity: .1, scale: .8, duration: .14 }, 'portsFocus')
    .addLabel('reassemble', .78)

    // Fold every photographic layer back onto the two whole objects. The
    // same scrub timeline reverses exactly when the reader scrolls upward.
    .to(details, { x: 0, y: 0, xPercent: -50, yPercent: -50, rotation: 0, scale: .72, opacity: 0, duration: .19 }, 'reassemble')
    .to(axis, { opacity: 0, duration: .19 }, 'reassemble')
    .to([arcA, arcB], { opacity: .16, duration: .19 }, 'reassemble')
    .to(sparks, { opacity: .52, duration: .19 }, 'reassemble')
    .to(camera, { ...cameraRest, x: 0, y: 0, duration: .19 }, 'reassemble')
    .to(board, { ...boardRest, x: 0, y: 0, duration: .19 }, 'reassemble');

  // A short causal beat in three legible, secondary stops: the real
  // photographed lens ignites, a mote of light hops to the real SoC/board
  // crop (never past it), and — completely separately — the hero readout
  // answers on its OWN scroll entrance, never a fixed pixel guess.
  //
  // Why two separate triggers instead of one long beam-to-card journey:
  // the readout scrolls in normal document flow while this field is
  // fixed, so a beam chasing it across a wide scroll range either arrives
  // late (card already scrolling off) or crosses behind the fixed nav —
  // both were confirmed on a real 1440x900 pass. Splitting it removes
  // both failure modes. The lens/chip leg uses a small DESIGNED offset
  // rather than measuring either element's box: at rest, every detail
  // plane (lens, chip, ports, ...) shares the same centred
  // translate(-50%,-50%) origin, so their boxes coincide almost exactly
  // and a box-to-box hop would barely move. A fixed offset reads clearly
  // as a hop between two points near the cluster's centre, costs zero
  // position reads (no per-frame or even one-time getBoundingClientRect),
  // and the readout leg needs no beam or measurement at all — just its
  // own CSS variable, driven by its own scroll-into-view trigger.
  // A fixed viewport-relative fraction, not a read of tl.scrollTrigger's
  // own start/end: those pixel values are not reliably resolved yet on
  // this same synchronous tick (ScrollTrigger measures layout on its own
  // refresh cycle), so reading them here previously produced NaN and
  // collapsed this trigger's range to 0. 'explode' (label .14 of the main
  // timeline) lands at roughly 30-44% of one viewport height on this
  // page's real hero/product proportions at both mobile and desktop
  // widths — .24 stays safely inside that under every breakpoint tested.
  var ignitionRangePx = Math.max(150, Math.min(260, innerHeight * .24));

  var hopFrom = { x: -Math.min(64, innerWidth * .05), y: Math.min(36, innerHeight * .04) };
  var hopTo   = { x: 0, y: 0 };

  gsap.set(emitter, { opacity: 0, scale: .5 });
  gsap.set(photon, { opacity: 0, scale: .5, x: hopFrom.x, y: hopFrom.y });

  var ignition = gsap.timeline({
    defaults: { ease: 'none' },
    onUpdate: catchUp,
    scrollTrigger: {
      // Plain absolute numbers, like the readout trigger below, rather
      // than 'top top' + a relative '+=' offset: the latter combination
      // re-resolves 'start' against whatever the scroll position happens
      // to be at the next refresh, which produced a corrupted, fully
      // negative window after ordinary scrolling in testing. topEl's top
      // is always page position 0, so this is exactly equivalent when
      // resolution is correct, and immune when it is not.
      trigger: topEl, start: 0,
      end: () => ignitionRangePx,
      scrub: .4, invalidateOnRefresh: true
    }
  });
  ignition
    .to(emitter, { opacity: .95, scale: 1.15, duration: .18, ease: 'power2.out' }, .06)
    .to(emitter, { opacity: .22, scale: .85, duration: .22, ease: 'power1.inOut' }, .34)
    .to(photon, { opacity: .92, scale: 1, duration: .05, ease: 'power2.out' }, .3)
    .to(photon, { x: hopTo.x, y: hopTo.y, duration: .3, ease: 'power1.inOut' }, .32)
    .to(photon, { opacity: 0, scale: .55, duration: .09, ease: 'power2.in' }, .62)
    .to(chip, { opacity: alpha(.5), scale: .84, duration: .12, ease: 'power2.out' }, .6)
    .to(chip, { opacity: 0, scale: .72, duration: .2, ease: 'power1.inOut' }, .74)
    .to(emitter, { opacity: 0, duration: .12 }, .82);

  // The readout's own brief response — tied to ITS OWN scroll position,
  // so it never chases a panel that is off-screen (e.g. below the fold
  // on a tall mobile hero). Percentage markers ("top 15%"/"top -25%")
  // read fine in isolation but ignore how far along the ignition beat
  // already is: on desktop/1024 the card sits near the top of the hero
  // at load, so those markers solved to a start only ~15-17px in — deep
  // inside the ignition window (0-2xxpx) — and a real 1440x900 pass
  // confirmed the two visibly raced (chip mid-pulse while the card was
  // already near-peak). This reads the card's resting top ONCE at
  // setup (not a per-frame cost — the card does not move on its own,
  // only the page scrolls under it) and derives explicit pixel bounds:
  // always at least `ignitionRangePx` plus a clear buffer past the
  // chip's own beat, and only earlier-than-that-center-point on a tall
  // mobile hero where the card needs real scrolling to appear at all —
  // so the reading order (lens -> chip -> card) holds on every
  // breakpoint, and it is still purely scroll-position-driven and
  // exactly reversible.
  if (instrument && sparkline) {
    gsap.set(instrument, { '--hw-response': 0 });
    var instTop0 = instrument.getBoundingClientRect().top;
    var readoutMinStart = ignitionRangePx + 70;
    var readoutCenterReach = Math.max(0, instTop0 - innerHeight * .38);
    var readoutStartPx = Math.max(readoutMinStart, readoutCenterReach);
    var readoutEndPx = readoutStartPx + Math.max(220, innerHeight * .3);
    var readout = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: topEl, start: () => readoutStartPx, end: () => readoutEndPx,
        scrub: .45, invalidateOnRefresh: true
      }
    });
    readout
      .to(instrument, { '--hw-response': 1, duration: .4, ease: 'power2.out' }, .28)
      .to(sparkline, { filter: 'drop-shadow(0 0 8px rgba(255,192,215,.85))', duration: .4, ease: 'power2.out' }, .28)
      .to(instrument, { '--hw-response': 0, duration: .3, ease: 'power1.inOut' }, .66)
      .to(sparkline, { filter: 'drop-shadow(0 0 0px rgba(0,0,0,0))', duration: .3, ease: 'power1.inOut' }, .66);
  }

  // The volume of every part continues to turn for the entire document.
  // Front textures remain the actual photo; the reverse is a visibly
  // stylised construction because no rear photographs were supplied.
  if (footerEl) {
    var orbit = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: topEl, start: 'top top', endTrigger: footerEl,
        end: 'bottom bottom', scrub: 0.8, invalidateOnRefresh: true
      }
    });
    orbit.to(models, {
      ry: function (index) { return [720, -900, 1080, -720, 840, -900, 720, -840, 960][index]; },
      rx: function (index) { return [-65, 85, -45, 70, -55, 80, -60, 65, -70][index]; },
      duration: 1,
      onUpdate: function () { models.forEach(renderModel); }
    }, 0);
  }

  // A quiet second expansion gives the moving parts presence behind later
  // sections without changing any page copy, cards or document height.
  if (clarityEl && footerEl) {
    var continuation = gsap.timeline({
      defaults: { ease: 'none' },
      onUpdate: catchUp,
      scrollTrigger: {
        trigger: clarityEl, start: 'top bottom', endTrigger: footerEl,
        end: 'bottom bottom', scrub: 0.75, invalidateOnRefresh: true
      }
    });
    continuation
      .to([arcA, arcB], { opacity: compact ? .12 : .27, duration: .2 }, 0)
      .to(sparks, { opacity: .66, duration: .2 }, 0)
      .to(board, { xPercent: -50, yPercent: -50, x: () => spread() * .35, y: () => -lift() * .24, scale: .82, opacity: alpha(.37), duration: .18 }, 0)
      .to(camera, { xPercent: -50, yPercent: -50, x: () => -spread() * .38, y: () => lift() * .16, scale: .8, opacity: alpha(.42), duration: .18 }, 0)
      .to(lens, { x: () => -spread() * .78, y: () => -lift() * .85, scale: .82, opacity: alpha(.45), duration: .16 }, .06)
      .to(chip, { x: () => spread() * .8, y: () => -lift() * .55, scale: .88, opacity: alpha(.42), duration: .16 }, .09)
      .to([led, connector, pins, ports, hdmi], { opacity: alpha(.26), duration: .14 }, .14)
      .to(led, { x: () => -spread() * .9, y: () => lift() * .58, duration: .2 }, .14)
      .to(connector, { x: () => -spread() * .2, y: () => -lift() * .95, duration: .2 }, .14)
      .to(pins, { x: () => spread() * .54, y: () => -lift() * .95, duration: .2 }, .14)
      .to(ports, { x: () => spread() * .85, y: () => lift() * .3, duration: .2 }, .14)
      .to(hdmi, { x: () => spread() * .32, y: () => lift() * .92, duration: .2 }, .14)
      .to([board, camera], { x: 0, y: 0, opacity: alpha(.3), duration: .2 }, .42)
      .to(sparks, { opacity: .48, duration: .18 }, .42)
      .to(details, { x: 0, y: 0, scale: .7, opacity: alpha(.12), duration: .18 }, .49)
      .to(board, { x: () => spread() * 1.32, y: () => -lift() * 1.45, opacity: alpha(.46), duration: .2 }, .76)
      .to(camera, { x: () => -spread() * 1.32, y: () => -lift() * 1.2, opacity: alpha(.48), duration: .2 }, .76)
      .to(lens, { x: () => -spread() * .6, y: () => -lift() * 1.7, opacity: alpha(.36), duration: .18 }, .78)
      .to(chip, { x: () => spread() * .72, y: () => -lift() * 1.76, opacity: alpha(.33), duration: .18 }, .78)
      .to(ports, { x: () => spread() * 1.5, y: () => lift() * .3, opacity: alpha(.32), duration: .18 }, .78);
    continuation.to(sparks, { opacity: .76, duration: .18 }, .78);
  }
})();
