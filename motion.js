/*
  Target Media — motion layer.
  Purely presentational. Reads DOM state and animates it; never touches
  fetch calls, form fields, endpoints, or verification/booking logic —
  those live untouched in each page's own inline <script>, loaded before
  this file. Shared across index.html / apply.html / schedule.html, so
  every selector here is null-safe: a page missing an element simply
  skips that feature.

  Wrapped in an IIFE with its own `q`/`qa` so it never collides with the
  identifiers already declared in each page's business-logic script.
*/
(function(){
  'use strict';

  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => Array.from(r.querySelectorAll(s));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = window.matchMedia('(hover:hover) and (pointer:fine)').matches;
  const hasGSAP = typeof window.gsap !== 'undefined';

  document.documentElement.classList.add('js-ready');

  if (hasGSAP && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  // ------------------------------------------------------------------
  // 1. Section reveals — IntersectionObserver, no library needed.
  //    Elements are visible by default in CSS; only `.js-ready` scopes
  //    the hidden starting state, so a JS failure never hides content.
  // ------------------------------------------------------------------
  const revealTargets = qa('[data-reveal]');
  if (reduced) {
    revealTargets.forEach(el => el.classList.add('is-revealed'));
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.16, rootMargin: '0px 0px -8% 0px' });
    revealTargets.forEach(el => io.observe(el));
  } else {
    revealTargets.forEach(el => el.classList.add('is-revealed'));
  }

  // ------------------------------------------------------------------
  // 2. Hero gradient-text wipe — a small typographic flourish, timed
  //    just after the headline itself would have faded in.
  // ------------------------------------------------------------------
  const heroWipe = q('#heroWipe');
  if (heroWipe) {
    if (reduced) {
      heroWipe.classList.add('is-revealed');
    } else {
      setTimeout(() => heroWipe.classList.add('is-revealed'), 420);
    }
  }

  // ------------------------------------------------------------------
  // 3. SVG line-draw — any [data-draw] path/line draws itself in when
  //    its nearest [data-reveal] ancestor (or itself) becomes visible.
  // ------------------------------------------------------------------
  const drawables = qa('[data-draw]');
  if (drawables.length && !reduced) {
    drawables.forEach(el => {
      let len = 60;
      try { len = el.getTotalLength(); } catch (e) { /* non-geometry element, keep fallback */ }
      el.style.strokeDasharray = String(len);
      el.style.strokeDashoffset = String(len);
    });

    const drawNow = el => {
      const len = parseFloat(el.style.strokeDasharray) || 60;
      if (hasGSAP) {
        gsap.to(el, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.out' });
      } else {
        el.style.transition = 'stroke-dashoffset 1.1s ease-out';
        el.style.strokeDashoffset = '0';
      }
    };

    // group by containing <svg> (or the element itself, if none) so an
    // entire diagram draws together with a stagger, not path-by-path
    const groups = new Map();
    drawables.forEach(el => {
      const key = el.closest('svg') || el;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(el);
    });

    if ('IntersectionObserver' in window) {
      const drawIO = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            (groups.get(entry.target) || [entry.target]).forEach((el, i) => setTimeout(() => drawNow(el), i * 90));
            drawIO.unobserve(entry.target);
          }
        });
      }, { threshold: 0.3 });
      groups.forEach((_, key) => drawIO.observe(key));
    } else {
      drawables.forEach(drawNow);
    }
  }

  // ------------------------------------------------------------------
  // 4. Count-up numerals — small numeric readouts that arrive as data,
  //    not just appear as static text.
  // ------------------------------------------------------------------
  const counters = qa('[data-count-to]');
  if (counters.length) {
    const format = (val, kind) => {
      if (kind === 'pct1') return val.toFixed(1) + '%';
      return Math.round(val).toLocaleString('en-US');
    };
    const runCounter = el => {
      const target = parseFloat(el.getAttribute('data-count-to'));
      const kind = el.getAttribute('data-count-format') || 'int';
      if (reduced || !hasGSAP) { el.textContent = format(target, kind); return; }
      const obj = { v: 0 };
      gsap.to(obj, {
        v: target, duration: 1.3, ease: 'power2.out',
        onUpdate: () => { el.textContent = format(obj.v, kind); },
        onComplete: () => { el.textContent = format(target, kind); }
      });
    };
    if (reduced || !('IntersectionObserver' in window)) {
      counters.forEach(el => runCounter(el));
    } else {
      const cIO = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) { runCounter(entry.target); cIO.unobserve(entry.target); }
        });
      }, { threshold: 0.5 });
      counters.forEach(el => cIO.observe(el));
    }
  }

  // ------------------------------------------------------------------
  // 5. Funnel bars + insight bar — grow in on reveal instead of
  //    appearing at final height.
  // ------------------------------------------------------------------
  const bars = qa('.bar-fill[data-bar-to]');
  if (bars.length) {
    const growBar = (el, i) => {
      const target = el.getAttribute('data-bar-to') + '%';
      if (reduced || !hasGSAP) { el.style.height = target; return; }
      gsap.to(el, { height: target, duration: 0.9, delay: i * 0.08, ease: 'power2.out' });
    };
    const barCard = bars[0].closest('.metric-card');
    if (barCard && 'IntersectionObserver' in window && !reduced) {
      const bIO = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) { bars.forEach(growBar); bIO.unobserve(entry.target); }
        });
      }, { threshold: 0.35 });
      bIO.observe(barCard);
    } else {
      bars.forEach((el, i) => growBar(el, i));
    }
  }

  const insightBar = q('.insight-bar-fill[data-bar-to]');
  if (insightBar) {
    const run = () => {
      const target = insightBar.getAttribute('data-bar-to') + '%';
      if (reduced || !hasGSAP) { insightBar.style.width = target; return; }
      gsap.to(insightBar, { width: target, duration: 1, ease: 'power2.out' });
    };
    if ('IntersectionObserver' in window && !reduced) {
      const iIO = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) { run(); iIO.unobserve(entry.target); } });
      }, { threshold: 0.4 });
      iIO.observe(insightBar);
    } else run();
  }

  // ------------------------------------------------------------------
  // 6. Sticky story section — one step "active" at a time drives the
  //    pinned diagram's highlighted layer via data-active.
  // ------------------------------------------------------------------
  const storyVisual = q('#storyVisual');
  const storySteps = qa('.story-step', q('#storySteps') || document);
  if (storyVisual && storySteps.length && 'IntersectionObserver' in window) {
    const sIO = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          storySteps.forEach(s => s.classList.remove('is-active'));
          entry.target.classList.add('is-active');
          const step = entry.target.getAttribute('data-step');
          storyVisual.setAttribute('data-active', step);
          const sceneCounter = q('.story-scene-label b', storyVisual);
          if (sceneCounter) sceneCounter.textContent = '0' + step + ' / 03';
        }
      });
    }, { threshold: 0.6, rootMargin: '-20% 0px -20% 0px' });
    storySteps.forEach(s => sIO.observe(s));
  }

  // ------------------------------------------------------------------
  // 7. Cursor tilt on the hero instrument panel — restrained 3D
  //    perspective that tracks the pointer. Desktop-only.
  // ------------------------------------------------------------------
  if (canHover && !reduced && hasGSAP) {
    qa('[data-tilt]').forEach(el => {
      gsap.set(el, { transformPerspective: 800, transformStyle: 'preserve-3d' });
      el.style.willChange = 'transform';
      const quickX = gsap.quickTo(el, 'rotateY', { duration: 0.5, ease: 'power3.out' });
      const quickY = gsap.quickTo(el, 'rotateX', { duration: 0.5, ease: 'power3.out' });
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        quickX(px * 6);
        quickY(py * -6);
      });
      el.addEventListener('mouseleave', () => { quickX(0); quickY(0); });
    });
  }

  // ------------------------------------------------------------------
  // 8. Magnetic primary CTAs — small, capped pull toward the cursor.
  //    Kept to a couple of hero-scale buttons, not every button.
  // ------------------------------------------------------------------
  if (canHover && !reduced && hasGSAP) {
    qa('[data-magnetic]').forEach(el => {
      const strength = 14;
      const moveX = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
      const moveY = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left - r.width / 2) / (r.width / 2);
        const py = (e.clientY - r.top - r.height / 2) / (r.height / 2);
        moveX(px * strength);
        moveY(py * strength);
      });
      el.addEventListener('mouseleave', () => {
        gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: 'elastic.out(1,0.5)' });
      });
    });
  }

  // ------------------------------------------------------------------
  // 9. Pricing spotlight — cursor-tracked glow on the Monitor panel.
  // ------------------------------------------------------------------
  if (canHover && !reduced) {
    qa('[data-spotlight]').forEach(el => {
      el.addEventListener('mousemove', e => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
        el.classList.add('is-active');
      });
      el.addEventListener('mouseleave', () => el.classList.remove('is-active'));
    });
  }

  // ------------------------------------------------------------------
  // 10. Nav gains presence once the hero has scrolled past — no
  //     scroll-event listener, just an IntersectionObserver on the hero.
  // ------------------------------------------------------------------
  const nav = q('#mainNav');
  const heroEl = q('#top');
  if (nav && heroEl && 'IntersectionObserver' in window) {
    const navIO = new IntersectionObserver(entries => {
      entries.forEach(entry => nav.classList.toggle('is-scrolled', !entry.isIntersecting));
    }, { threshold: 0, rootMargin: '-72px 0px 0px 0px' });
    navIO.observe(heroEl);
  } else if (nav && !heroEl) {
    // apply.html / schedule.html: no hero, always show the scrolled state's stronger surface
    nav.classList.add('is-scrolled');
  }

  // ------------------------------------------------------------------
  // 11. Atmosphere parallax — each glow wrapper drifts at its own rate
  //     as the page scrolls, layered on top of its own idle CSS drift.
  // ------------------------------------------------------------------
  if (hasGSAP && window.ScrollTrigger && !reduced) {
    qa('.glow-wrap[data-parallax]').forEach(el => {
      const speed = parseFloat(el.getAttribute('data-parallax')) || 20;
      gsap.to(el, {
        y: speed * 6,
        ease: 'none',
        scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.6 }
      });
    });
  }

  // ------------------------------------------------------------------
  // 12. Signal rail — a thin scroll-progress line + travelling dot
  //     carrying the "measurement signal" motif down the whole page.
  // ------------------------------------------------------------------
  const rail = q('#signalRail');
  if (rail && hasGSAP && window.ScrollTrigger && !reduced) {
    const dot = q('.signal-rail-dot', rail);
    const progressLine = q('.signal-rail-progress', rail);
    const railLabel = q('.signal-rail-label', rail);
    gsap.set(dot, { top: '0%' });
    ScrollTrigger.create({
      trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0.3,
      onUpdate: self => {
        const pct = self.progress * 100;
        dot.style.top = pct + '%';
        if (progressLine) progressLine.style.height = Math.max(0, pct - 15) + '%';
        if (railLabel) railLabel.style.top = pct + '%';
      }
    });
    const scenes = ['top','product','clarity','intelligence','metrics','approach','pricing','approved','faq']
      .map(id => document.getElementById(id)).filter(Boolean);
    if (railLabel && scenes.length && 'IntersectionObserver' in window) {
      const sceneIO = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = scenes.indexOf(entry.target) + 1;
            if (idx > 0) railLabel.textContent = String(idx).padStart(2,'0');
          }
        });
      }, { threshold: 0, rootMargin: '-46% 0px -46% 0px' });
      scenes.forEach(el => sceneIO.observe(el));
    }
  }

  // ------------------------------------------------------------------
  // 13. Hero spatial field — a lightweight canvas scene behind the
  //     instrument. Signals move through a storefront-like field, with
  //     a small subset bending toward the measured threshold. Pointer
  //     input shifts depth rather than chasing the cursor literally.
  // ------------------------------------------------------------------
  const heroStage = q('#heroStage');
  const heroCanvas = q('#heroFieldCanvas');
  if (heroStage && heroCanvas && heroCanvas.getContext) {
    const hctx = heroCanvas.getContext('2d');
    let hw = 1, hh = 1, hdpr = 1, hraf = null;
    let px = 0, py = 0, tx = 0, ty = 0;
    const trails = Array.from({ length: 34 }, (_, i) => ({
      t: Math.random(), lane: Math.random(),
      speed: 0.0009 + Math.random() * 0.0015,
      bend: i % 4 === 0 ? 0.55 + Math.random() * 0.35 : 0,
      r: 0.9 + Math.random() * 1.7,
      a: 0.18 + Math.random() * 0.5
    }));

    function resizeHeroField(){
      const r = heroCanvas.getBoundingClientRect();
      hw = Math.max(1, r.width); hh = Math.max(1, r.height);
      hdpr = Math.min(window.devicePixelRatio || 1, 2);
      heroCanvas.width = Math.round(hw * hdpr);
      heroCanvas.height = Math.round(hh * hdpr);
      hctx.setTransform(hdpr,0,0,hdpr,0,0);
    }
    function drawHeroField(){
      hctx.clearRect(0,0,hw,hh);
      px += (tx-px) * 0.035; py += (ty-py) * 0.035;

      // perspective measurement grid
      hctx.save();
      hctx.translate(px * 12, py * 8);
      hctx.strokeStyle = 'rgba(169,156,255,.075)';
      hctx.lineWidth = 1;
      const horizon = hh * 0.54;
      for (let i=-6;i<=8;i++){
        const x = hw * .48 + i * hw * .075;
        hctx.beginPath(); hctx.moveTo(hw*.48, horizon); hctx.lineTo(x, hh*.92); hctx.stroke();
      }
      for (let i=0;i<7;i++){
        const k=i/6; const y=horizon + Math.pow(k,1.65)*(hh*.38);
        hctx.beginPath(); hctx.moveTo(hw*.05,y); hctx.lineTo(hw*.96,y); hctx.stroke();
      }
      hctx.restore();

      // moving signal paths
      trails.forEach((d, idx) => {
        if (!reduced) d.t = (d.t + d.speed) % 1;
        const x = hw * (1.02 - d.t * 1.02);
        const baseY = hh * (.32 + d.lane * .45);
        const doorX = hw * .35;
        const influence = d.bend ? Math.max(0, 1 - Math.abs(x-doorX)/(hw*.34)) : 0;
        const targetY = hh * .56;
        const y = baseY + (targetY-baseY) * influence * d.bend;
        const accent = d.bend > 0;
        const alpha = Math.max(.06, d.a * (0.55 + 0.45*Math.sin((d.t+idx)*Math.PI)));
        hctx.beginPath();
        hctx.fillStyle = accent ? `rgba(169,156,255,${alpha})` : `rgba(205,205,222,${alpha*.55})`;
        hctx.shadowBlur = accent ? 10 : 0;
        hctx.shadowColor = accent ? 'rgba(124,108,240,.75)' : 'transparent';
        hctx.arc(x + px*8, y + py*5, d.r, 0, Math.PI*2); hctx.fill();
        hctx.shadowBlur = 0;

        // short trailing segment gives direction without implying identity
        hctx.beginPath();
        hctx.moveTo(x + 4, y); hctx.lineTo(x + 22, baseY + (targetY-baseY) * Math.max(0,influence-.08) * d.bend);
        hctx.strokeStyle = accent ? `rgba(169,156,255,${alpha*.32})` : `rgba(205,205,222,${alpha*.12})`;
        hctx.lineWidth = .8; hctx.stroke();
      });
      if (!reduced) hraf=requestAnimationFrame(drawHeroField);
    }
    resizeHeroField();
    if ('ResizeObserver' in window) new ResizeObserver(resizeHeroField).observe(heroCanvas);
    if (canHover && !reduced) {
      heroStage.addEventListener('mousemove', e => {
        const r=heroStage.getBoundingClientRect();
        tx=((e.clientX-r.left)/r.width-.5); ty=((e.clientY-r.top)/r.height-.5);
      });
      heroStage.addEventListener('mouseleave',()=>{tx=0;ty=0});
      qa('[data-hero-float]',heroStage).forEach((el,i)=>{
        const depth=(i+1)*5;
        heroStage.addEventListener('mousemove',e=>{
          const r=heroStage.getBoundingClientRect();
          const nx=(e.clientX-r.left)/r.width-.5, ny=(e.clientY-r.top)/r.height-.5;
          if(hasGSAP) gsap.to(el,{x:nx*depth,y:ny*depth,duration:.8,ease:'power3.out',overwrite:true});
        });
      });
    }
    const scanBeam = q('.hero-beam', heroStage);
    const scanTween = (scanBeam && hasGSAP && !reduced)
      ? gsap.to(scanBeam, { y: 24, duration: 4.8, ease: 'sine.inOut', repeat: -1, yoyo: true })
      : null;

    if (reduced || !('IntersectionObserver' in window)) {
      drawHeroField();
    } else {
      const heroIO = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            if (!hraf) drawHeroField();
            if (scanTween) scanTween.resume();
          } else {
            if (hraf) { cancelAnimationFrame(hraf); hraf = null; }
            if (scanTween) scanTween.pause();
          }
        });
      }, { threshold: 0.03 });
      heroIO.observe(heroStage);
    }
  }

  // ------------------------------------------------------------------
  // 13b. Measurement reticles — a small field instrument follows the
  //      pointer only inside visual scenes. It never replaces the native
  //      cursor or touches form/CTA interaction.
  // ------------------------------------------------------------------
  if (canHover && !reduced) {
    [q('#heroStage'), q('#signalLab')].filter(Boolean).forEach((host, idx) => {
      const reticle = document.createElement('div');
      reticle.className = 'measurement-reticle';
      reticle.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.textContent = idx === 0 ? 'SAMPLE FIELD' : 'SIGNAL FIELD';
      reticle.appendChild(label);
      host.appendChild(reticle);
      host.addEventListener('mousemove', e => {
        const r = host.getBoundingClientRect();
        reticle.style.left = (e.clientX - r.left) + 'px';
        reticle.style.top = (e.clientY - r.top) + 'px';
        host.classList.add('reticle-on');
      });
      host.addEventListener('mouseleave', () => host.classList.remove('reticle-on'));
    });
  }

  // ------------------------------------------------------------------
  // 13. Approval "unlock" moment — observes the payment-unlock button's
  //     `hidden` attribute (set by the untouched business-logic script)
  //     and plays a small celebratory reveal the instant it appears.
  //     Purely reactive to DOM state; never calls the endpoint itself.
  // ------------------------------------------------------------------
  const paymentUnlock = q('#paymentUnlock');
  if (paymentUnlock && hasGSAP) {
    const mo = new MutationObserver(() => {
      if (!paymentUnlock.hidden) {
        if (reduced) return;
        gsap.fromTo(paymentUnlock,
          { scale: 0.92, opacity: 0 },
          { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(1.6)' }
        );
      }
    });
    mo.observe(paymentUnlock, { attributes: true, attributeFilter: ['hidden'] });
  }

  // ------------------------------------------------------------------
  // 14. Signal lab — raw signals travel left→right and physically
  //     compress into a narrow aggregate beam before resolving beside
  //     the single decision metric. Scroll progress changes how strongly
  //     the field converges, turning the section itself into the story.
  // ------------------------------------------------------------------
  const scatterCanvas = q('#scatterCanvas');
  const signalLab = q('#signalLab');
  if (scatterCanvas && signalLab && scatterCanvas.getContext) {
    const ctx = scatterCanvas.getContext('2d');
    const N = 92;
    let W=1,H=1,dpr=1,raf=null,progress=.62;
    const dots=Array.from({length:N},(_,i)=>({
      t:Math.random(),
      y:.18+Math.random()*.64,
      speed:.00055+Math.random()*.00105,
      wobble:Math.random()*Math.PI*2,
      r:1.1+Math.random()*2.1,
      accent:i%6===0
    }));
    function resizeSignalLab(){
      const r=scatterCanvas.getBoundingClientRect(); W=Math.max(1,r.width); H=Math.max(1,r.height);
      dpr=Math.min(window.devicePixelRatio||1,2);
      scatterCanvas.width=Math.round(W*dpr); scatterCanvas.height=Math.round(H*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
    }
    function drawSignalLab(){
      ctx.clearRect(0,0,W,H);
      const funnelX=W*.56, targetY=H*.5;
      // luminous compression beam
      const grad=ctx.createLinearGradient(W*.38,0,W*.82,0);
      grad.addColorStop(0,'rgba(124,108,240,0)'); grad.addColorStop(.5,'rgba(169,156,255,.20)'); grad.addColorStop(1,'rgba(169,156,255,0)');
      ctx.fillStyle=grad; ctx.fillRect(W*.36,targetY-1.5,W*.46,3);
      dots.forEach((d,i)=>{
        if(!reduced) d.t=(d.t+d.speed)%1;
        const x=W*(.04+d.t*.88);
        const rawY=H*d.y + Math.sin(d.wobble+d.t*9)*8;
        const after=Math.max(0,(x-W*.28)/(W*.58));
        const convergence=Math.min(1,after*(.65+progress*.7));
        const y=rawY+(targetY-rawY)*convergence*.86;
        const isAccent=d.accent || x>funnelX;
        const a=(x>W*.82? .18:.38)+(isAccent?.16:0);
        ctx.beginPath();
        ctx.fillStyle=isAccent?`rgba(169,156,255,${a})`:`rgba(199,199,216,${a*.72})`;
        ctx.shadowBlur=isAccent?9:0; ctx.shadowColor='rgba(124,108,240,.7)';
        ctx.arc(x,y,d.r*(1-convergence*.35),0,Math.PI*2);ctx.fill();ctx.shadowBlur=0;
        if(x>W*.3){
          ctx.beginPath();ctx.moveTo(x-16,y);ctx.lineTo(x-3,y);
          ctx.strokeStyle=isAccent?'rgba(169,156,255,.18)':'rgba(199,199,216,.08)';ctx.lineWidth=.8;ctx.stroke();
        }
      });
      if(!reduced) raf=requestAnimationFrame(drawSignalLab);
    }
    resizeSignalLab();
    if('ResizeObserver' in window)new ResizeObserver(resizeSignalLab).observe(scatterCanvas);
    if(hasGSAP && window.ScrollTrigger && !reduced){
      ScrollTrigger.create({trigger:signalLab,start:'top 85%',end:'bottom 20%',scrub:.5,onUpdate:self=>{progress=self.progress;}});
    }
    if(reduced||!('IntersectionObserver' in window)){drawSignalLab();}
    else{
      const io=new IntersectionObserver(entries=>entries.forEach(e=>{
        if(e.isIntersecting&&!raf)drawSignalLab();
        if(!e.isIntersecting&&raf){cancelAnimationFrame(raf);raf=null;}
      }),{threshold:.08}); io.observe(signalLab);
    }
  }

  // ------------------------------------------------------------------
  // 15b. Schedule page: a brief pop on the selected calendar day / time
  //      slot. The grid is re-rendered from scratch on every click by
  //      the untouched business script, so we watch for the resulting
  //      DOM mutation rather than a click handler of our own.
  // ------------------------------------------------------------------
  if (hasGSAP && !reduced) {
    [q('#calendarGrid'), q('#timeGrid')].filter(Boolean).forEach(grid => {
      const mo = new MutationObserver(() => {
        const selected = q('.is-selected', grid);
        if (selected) gsap.fromTo(selected, { scale: 0.88 }, { scale: 1, duration: 0.32, ease: 'back.out(2.2)' });
      });
      mo.observe(grid, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });
  }

  // ------------------------------------------------------------------
  // 15. FAQ open/close — a touch of spring-like settle on the answer
  //     icon beyond the base CSS rotate (kept intentionally minimal:
  //     the accordion mechanics themselves are untouched CSS/JS).
  // ------------------------------------------------------------------
  if (hasGSAP && !reduced) {
    qa('.faq-q').forEach(btn => {
      btn.addEventListener('click', () => {
        const plus = q('.faq-plus', btn);
        if (plus) gsap.fromTo(plus, { scale: 0.85 }, { scale: 1, duration: 0.35, ease: 'back.out(2)' });
      });
    });
  }
})();
