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
  var solids = allPlanes.map(function (plane) {
    var image = plane.querySelector('img');
    var solid = document.createElement('div');
    var core = document.createElement('span');
    var back = document.createElement('span');
    solid.className = 'hw-solid';
    core.className = 'hw-core';
    back.className = 'hw-back';
    solid.style.setProperty('--hw-shape', 'url("' + image.getAttribute('src') + '")');
    plane.appendChild(solid);
    solid.appendChild(back);
    solid.appendChild(core);
    solid.appendChild(image);
    return solid;
  });
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
  gsap.set(solids, { rotationX: 0, rotationY: 0, transformPerspective: 1100 });

  var tl = gsap.timeline({
    defaults: { ease: 'none' },
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
    orbit.to(solids, {
      rotationY: function (index) { return [720, -900, 1080, -720, 840, -900, 720, -840, 960][index]; },
      rotationX: function (index) { return [-65, 85, -45, 70, -55, 80, -60, 65, -70][index]; },
      duration: 1
    }, 0);
  }

  // A quiet second expansion gives the moving parts presence behind later
  // sections without changing any page copy, cards or document height.
  if (clarityEl && footerEl) {
    var continuation = gsap.timeline({
      defaults: { ease: 'none' },
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
