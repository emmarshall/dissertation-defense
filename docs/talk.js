(() => {
  'use strict';

  const TEMPO = 1.35;
  const DUR = 1.25;
  const EASE = 'cubic-bezier(.2,.8,.2,1)';
  const POP = 'cubic-bezier(.34,1.56,.64,1)';
  const OUT_CUBIC = 'cubic-bezier(.33,1,.68,1)';
  const KENBURNS_S = 6;

  const PRESETS = {
    rise:    [{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none' }, 0.6, EASE],
    drop:    [{ opacity: 0, transform: 'translateY(-50px)' }, { opacity: 1, transform: 'none' }, 0.55, EASE],
    left:    [{ opacity: 0, transform: 'translateX(-40px)' }, { opacity: 1, transform: 'none' }, 0.5, EASE],
    nudge:   [{ opacity: 0, transform: 'translateX(-30px)' }, { opacity: 1, transform: 'none' }, 0.4, EASE],
    drive:   [{ opacity: 0, transform: 'translateX(-160px)' }, { opacity: 1, transform: 'none' }, 0.9, EASE],
    slidein: [{ opacity: 0, transform: 'translateX(80px) rotate(4deg)' }, { opacity: 1, transform: 'none' }, 0.7, EASE],
    fade:    [{ opacity: 0 }, { opacity: 1 }, 0.5, EASE],
    gray:    [{ filter: 'grayscale(0) opacity(1)' }, { filter: 'grayscale(1) opacity(.7)' }, 0.4, EASE],
    out:     [{ opacity: 1 }, { opacity: 0 }, 0.4, EASE],
    pale:    [{ opacity: 1 }, { opacity: 0.3 }, 0.4, EASE],
    dim:     [{ color: '#393D47' }, { color: '#8a8c92' }, 0.5, EASE],
    grow:    [{ opacity: 0, transform: 'scale(.9)' }, { opacity: 1, transform: 'none' }, 0.6, EASE],
    bar:     [{ opacity: 1, transform: 'scaleY(0)' }, { opacity: 1, transform: 'none' }, 0.9, EASE],
    fly1:    [{ opacity: 0, transform: 'translate(632px, -460px) scale(2.36)' }, { opacity: 1, transform: 'none' }, 0.9, EASE],
    fly2:    [{ opacity: 0, transform: 'translate(-25px, -460px) scale(2.36)' }, { opacity: 1, transform: 'none' }, 0.9, EASE],
    barx:    [{ opacity: 1, transform: 'scaleX(0)' }, { opacity: 1, transform: 'none' }, 0.9, EASE],
    tilt:    [{ opacity: 0, transform: 'translateY(60px) rotate(-6deg)' }, { opacity: 1, transform: 'rotate(-6deg)' }, 0.6, EASE],
    card:    [{ opacity: 0, transform: 'translateY(50px) rotate(-4deg)' }, { opacity: 1, transform: 'rotate(-2deg)' }, 0.6, EASE],
    stamp:   [{ opacity: 0, transform: 'scale(1.9) rotate(-8deg)' }, { opacity: 1, transform: 'scale(1) rotate(-2deg)' }, 0.35, 'cubic-bezier(.2,1.3,.4,1)'],
  };

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const outCubic = (p) => 1 - Math.pow(1 - p, 3);
  const num = (el, name, dflt) => (el.dataset[name] !== undefined ? parseFloat(el.dataset[name]) : dflt);
  const at = (el, name, dflt) => num(el, name, dflt) * TEMPO;
  const stepOf = (el) => { const s = el.closest('[data-step]'); return s ? parseInt(s.dataset.step, 10) || 0 : 0; };

  const GROUPS = 3, GROUP_GAP = 0.4, KEEP = 0.3, UNGROUPED = new Set(['m00', 'm60', 'm80', 'm81', 'm01', 'm88']);
  function grouping(sec) {
    if (UNGROUPED.has(sec.id)) return null;
    const by = new Map();
    sec.querySelectorAll('[data-in]').forEach((el) => {
      const k = stepOf(el), x = parseFloat(el.dataset.in);
      if (!isFinite(x) || (k === 0 && x <= KEEP)) return;
      if (!by.has(k)) by.set(k, new Set());
      by.get(k).add(x);
    });
    const maps = new Map();
    for (const [k, set] of by) {
      const xs = Array.from(set).sort((a, b) => a - b);
      const cuts = xs.slice(1).map((x, i) => [x - xs[i], i + 1]).sort((a, b) => b[0] - a[0] || a[1] - b[1])
        .slice(0, GROUPS - 1).map((g) => g[1]);
      const group = k > 0 ? xs.map(() => 0) : xs.map((x, i) => cuts.filter((c) => c <= i).length);
      maps.set(k, { xs, group, base: k === 0 ? Math.min(xs[0], 0.4) : xs[0] });
    }
    return (k, raw) => {
      const m = maps.get(k);
      if (!m || (k === 0 && raw <= KEEP)) return raw;
      let i = 0;
      while (i + 1 < m.xs.length && m.xs[i + 1] <= raw + 1e-9) i++;
      return m.base + m.group[i] * GROUP_GAP;
    };
  }

  const slides = new Map();
  let running = null;

  function build(sec) {
    const steps = new Map();
    const groupTime = grouping(sec);
    const at = (el, name, dflt) => {
      const raw = num(el, name, dflt);
      return (name === 'rule' || name === 'play' || !groupTime ? raw : groupTime(stepOf(el), raw)) * TEMPO + (name === 'in' ? num(el, 'after', 0) : 0);
    };
    const step = (k) => { if (!steps.has(k)) steps.set(k, { anims: [], tickers: [], end: 0 }); return steps.get(k); };

    const track = (el, frames) => {
      frames = frames.slice().sort((a, b) => a[0] - b[0]);
      const T = frames[frames.length - 1][0];
      if (!(T > 0)) return;
      const s = step(stepOf(el));
      s.end = Math.max(s.end, T);
      const kf = [];
      if (frames[0][0] > 0) kf.push({ ...frames[0][1], offset: 0 });
      for (const [t, css, ease] of frames) kf.push({ ...css, offset: clamp01(t / T), easing: ease || EASE });
      const a = el.animate(kf, { duration: T * 1000, fill: 'both' });
      a.pause();
      a.currentTime = 0;
      s.anims.push(a);
    };
    const enter = (el, t, from, to, d, ease) => track(el, [[0, from], [t, from, ease], [t + d * DUR, to]]);

    const addRule = (el) => {
      let r = el.querySelector(':scope > .rule');
      if (!r) { r = document.createElement('span'); r.className = 'rule'; el.appendChild(r); }
      return r;
    };

    const rules = [];
    sec.querySelectorAll('.headline').forEach((h) => {
      if (h.dataset.rule !== undefined) {
        const t = at(h, 'rule', 0);
        const rl = addRule(h), s0 = step(stepOf(rl)), n0 = s0.anims.length;
        track(rl, [[0, { transform: 'scaleX(0)' }], [t, { transform: 'scaleX(0)' }, OUT_CUBIC], [t + 0.5 * DUR, { transform: 'scaleX(1)' }]]);
        if (s0.anims.length > n0) rules.push(s0.anims[s0.anims.length - 1]);
      }
    });

    sec.querySelectorAll('[data-in]').forEach((el) => {
      const name = el.dataset.anim || 'rise';
      const t = at(el, 'in', 0);
      if (name === 'pop') {
        const rot = el.dataset.rot || '0deg';
        enter(el, t, { opacity: 0, transform: `scale(.55) rotate(${rot})` }, { opacity: 1, transform: `scale(1) rotate(${rot})` }, num(el, 'dur', 0.45), POP);
        return;
      }
      if (name === 'travel') {
        const fx = num(el, 'fx', 0), fy = num(el, 'fy', 0), fs = num(el, 'fs', 1), vx = num(el, 'vx', 0), vy = num(el, 'vy', 0), vs = num(el, 'vs', 1);
        const d = num(el, 'dur', 1.3) * DUR, at0 = `translate(${fx}px, ${fy}px) scale(${fs * 0.6})`, t1 = t + 0.18 * d, via = el.dataset.vx !== undefined;
        const cx = 2 * vx - fx / 2, cy = 2 * vy - fy / 2, cs = 2 * vs - (fs + 1) / 2, fr = [[0, { opacity: 0, transform: at0 }], [t, { opacity: 0, transform: at0 }, 'ease-out'],
                   [t1, { opacity: 1, transform: `translate(${fx}px, ${fy}px) scale(${fs})` }, 'linear']];
        for (let i = 1; i <= 24; i++) {
          const u = i / 24, e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(2 - 2 * u, 3) / 2, m = 1 - e;
          const x = via ? m * m * fx + 2 * m * e * cx : m * fx, y = via ? m * m * fy + 2 * m * e * cy : m * fy, s = via ? m * m * fs + 2 * m * e * cs + e * e : fs + (1 - fs) * e;
          fr.push([t1 + u * (t + d - t1), { opacity: 1, transform: i === 24 ? 'none' : `translate(${x}px, ${y}px) scale(${s})` }, 'linear']);
        }
        track(el, fr);
        return;
      }
      if (name === 'move') {
        enter(el, t, { transform: 'none' }, { transform: `translate(${num(el, 'dx', 0)}px, ${num(el, 'dy', 0)}px)` }, num(el, 'dur', 0.7), EASE);
        return;
      }
      if (name === 'clip') {
        const tilt = parseFloat(getComputedStyle(el).getPropertyValue('--tilt')) || 0;
        enter(el, t, { opacity: 0, transform: `translateY(70px) scale(1.12) rotate(${3 * tilt}deg)` }, { opacity: 1, transform: `rotate(${tilt}deg)` }, num(el, 'dur', 0.55), 'cubic-bezier(.2, 1.25, .4, 1)');
        return;
      }
      if (name === 'morph') {
        const ch = el.closest('.lk-chart');
        const fl = ch ? parseFloat(getComputedStyle(ch).getPropertyValue('--floor')) || 0 : 0;
        const to = parseFloat(el.style.getPropertyValue('--v')), fr = parseFloat(el.dataset.from);
        const s = to - fl > 0 && isFinite(fr) ? Math.max(0, fr - fl) / (to - fl) : 1;
        enter(el, t, { transform: `scaleY(${s})` }, { transform: 'none' }, num(el, 'dur', 0.9), EASE);
        return;
      }
      if (name === 'morphx') {
        const ch = el.closest('.hb-chart');
        const lo = ch ? parseFloat(getComputedStyle(ch).getPropertyValue('--lo')) || 0 : 0;
        const to = parseFloat(el.style.getPropertyValue('--v')), fr = parseFloat(el.dataset.from);
        const s = to - lo > 0 && isFinite(fr) ? Math.max(0, fr - lo) / (to - lo) : 1;
        enter(el, t, { transform: `scaleX(${s})` }, { transform: 'none' }, num(el, 'dur', 0.9), EASE);
        return;
      }
      const p = PRESETS[name];
      if (!p) { console.warn('[talk] unknown data-anim: ' + name); return; }
      enter(el, t, p[0], p[1], num(el, 'dur', p[2]), p[3]);
    });

    sec.querySelectorAll('.kenburns').forEach((el) =>
      track(el, [[0, { transform: 'scale(1)' }, 'linear'], [KENBURNS_S, { transform: 'scale(1.07)' }]]));

    sec.querySelectorAll('[data-line]').forEach((el) => {
      const t = at(el, 'line', 0);
      track(el, [[0, { transform: 'scaleX(0)' }], [t, { transform: 'scaleX(0)' }, 'linear'], [t + num(el, 'dur', 2.9), { transform: 'scaleX(1)' }]]);
    });

    sec.querySelectorAll('[data-hl]').forEach((el) => {
      const t = at(el, 'hl', 0);
      track(el, [[0, { backgroundSize: '0% 100%' }], [t, { backgroundSize: '0% 100%' }, 'ease-in-out'], [t + 0.45 * DUR, { backgroundSize: '100% 100%' }]]);
    });

    sec.querySelectorAll('[data-count]').forEach((el) => {
      const text = el.dataset.final || el.textContent.trim();
      el.dataset.final = text;
      const to = parseFloat(text.replace(/[^0-9.\-]/g, ''));
      const dec = (text.split('.')[1] || '').replace(/[^0-9]/g, '').length;
      const suffix = text.endsWith('%') ? '%' : '';
      const from = num(el, 'countFrom', 0);
      const t0 = at(el, 'count', 0);
      const d = num(el, 'countDur', 1.1) * DUR;
      if (Number.isNaN(to)) { console.warn('[talk] count target is not a number: ' + text); return; }
      const s = step(stepOf(el));
      s.end = Math.max(s.end, t0 + d);
      const ease = el.dataset.countEase === 'linear' ? (p) => p : outCubic;
      const tick = (t) => {
        el.textContent = (from + (to - from) * ease(clamp01((t - t0) / d))).toFixed(dec) + suffix;
      };
      tick.el = el;
      s.tickers.push(tick);
    });

    sec.querySelectorAll('canvas.anim').forEach((c) => {
      const dir = c.dataset.dir;
      const files = (c.dataset.frames || '').split(',').filter(Boolean);
      const imgs = files.map((f) => { const im = new Image(); im.src = dir + '/' + f; return im; });
      const start = at(c, 'play', 0);
      const fps = num(c, 'fps', 30);
      const ctx = c.getContext('2d');
      const holder = c.closest('[data-anim-holds]');
      const holds = holder ? holder.dataset.animHolds.split(',').map(Number).filter((x) => x > 0).sort((a, b) => a - b) : [];
      const total = imgs.length / fps;
      const bounds = [0].concat(holds.filter((x) => x < total), [total]);
      const base = stepOf(c);
      const auto = holder && holder.dataset.animAuto !== undefined ? (parseFloat(holder.dataset.animAuto) || 0) : null;
      if (auto !== null) {
        const segs = []; let acc = start;
        for (let i = 0; i + 1 < bounds.length; i++) { const len = bounds[i + 1] - bounds[i]; segs.push({ t0: acc, from: bounds[i], len }); acc += len + (i + 2 < bounds.length ? auto : 0); }
        const s = step(base);
        s.end = Math.max(s.end, acc);
        let shown = -1;
        const tick = (t) => {
          let g = segs[0];
          for (const x of segs) if (t >= x.t0) g = x;
          const local = Math.min(Math.max(t - g.t0, 0), g.len);
          const k = Math.min(imgs.length - 1, Math.floor((g.from + local) * fps + 1e-6));
          const im = imgs[k];
          if (k !== shown && im && im.complete && im.naturalWidth) { ctx.drawImage(im, 0, 0); shown = k; }
        };
        tick.el = c;
        s.tickers.push(tick);
        return;
      }
      for (let i = 0; i + 1 < bounds.length; i++) {
        const from = bounds[i], len = bounds[i + 1] - from, t0 = i === 0 ? start : 0;
        const s = step(base + i);
        s.end = Math.max(s.end, t0 + len);
        let shown = -1;
        const tick = (t) => {
          const local = t < t0 ? 0 : Math.min(t - t0, len);
          const k = Math.min(imgs.length - 1, Math.floor((from + local) * fps + 1e-6));
          const im = imgs[k];
          if (k !== shown && im && im.complete && im.naturalWidth) { ctx.drawImage(im, 0, 0); shown = k; }
        };
        tick.el = c;
        s.tickers.push(tick);
      }
    });

    step(0);
    return { steps, fitted: false, frozen: new Set(), rules };
  }

  function fit(sec) {
    sec.querySelectorAll('.headline[data-max]').forEach((h) => {
      const max = parseFloat(h.dataset.max);
      let size = parseFloat(getComputedStyle(h).fontSize);
      while (h.offsetWidth > max && size > 56) { size -= 2; h.style.fontSize = size + 'px'; }
    });
  }

  function seekStep(st, k, t) {
    const s = st.steps.get(k);
    if (!s) return;
    for (const a of s.anims) if (!st.frozen.has(a)) a.currentTime = Math.min(t * 1000, a.effect.getTiming().duration);
    for (const f of s.tickers) if (!st.frozen.has(f)) f(t);
  }
  const finishStep = (st, k) => { const s = st.steps.get(k); if (s) seekStep(st, k, s.end + 1); };

  function stop(finish) {
    if (!running) return;
    cancelAnimationFrame(running.raf);
    if (finish) { const st = slides.get(running.sec); if (st) finishStep(st, running.k); }
    running = null;
  }

  function run(sec, k) {
    stop(true);
    const st = slides.get(sec);
    const s = st && st.steps.get(k);
    if (!s) return;
    seekStep(st, k, 0);
    const t0 = performance.now();
    const tick = () => {
      const t = (performance.now() - t0) / 1000;
      seekStep(st, k, t);
      if (t <= s.end + 0.5) running.raf = requestAnimationFrame(tick);
      else running = null;
    };
    running = { sec, k, t0, raf: requestAnimationFrame(tick) };
  }

  const markers = (sec) => Array.from(sec.querySelectorAll('.talk-step'));

  function play(sec) {
    stop(false);
    const st = slides.get(sec);
    if (!st) return;
    if (!st.fitted) { fit(sec); st.fitted = true; }
    st.frozen.clear();
    for (const k of st.steps.keys()) seekStep(st, k, 0);
    const shown = markers(sec).filter((m) => m.classList.contains('visible')).map((m) => parseInt(m.dataset.talkStep, 10));
    if (shown.length) {
      finishStep(st, 0);
      for (const k of shown) finishStep(st, k);
    } else {
      run(sec, 0);
    }
  }

  function finishAll() {
    stop(false);
    for (const [sec, st] of slides) {
      if (!st.fitted && sec.offsetWidth) { fit(sec); st.fitted = true; }
      for (const k of st.steps.keys()) finishStep(st, k);
    }
  }

  const isMain = (s) => s && s.classList && s.classList.contains('main');

  const headText = (s) => { const h = s && s.querySelector && s.querySelector('.headline'); return h ? h.textContent.replace(/\s+/g, ' ').trim() : ''; };
  function keepRule(prev, cur) {
    const st = slides.get(cur);
    if (!st || !st.rules || !st.rules.length || !isMain(prev) || !headText(cur) || headText(prev) !== headText(cur)) return;
    for (const a of st.rules) { a.currentTime = a.effect.getTiming().duration; st.frozen.add(a); }
  }

  function freeze(sec, matched) {
    const st = slides.get(sec);
    if (!st || !matched.length) return;
    const hit = (el) => !!el && matched.some((m) => m === el || m.contains(el) || el.contains(m));
    for (const s of st.steps.values()) {
      for (const a of s.anims) {
        if (hit(a.effect && a.effect.target)) { a.currentTime = a.effect.getTiming().duration; st.frozen.add(a); }
      }
      for (const f of s.tickers) {
        if (hit(f.el)) { f(1e9); st.frozen.add(f); }
      }
    }
  }

  const STAGE_SCALE = 0.666667;
  const onStage = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left / STAGE_SCALE, y: r.top / STAGE_SCALE, width: r.width / STAGE_SCALE, height: r.height / STAGE_SCALE };
  };

  const HINDSIGHT_FLIGHT_IDS = ['pw-hindsight-foreseeability', 'pw-hindsight-inevitability'];
  let hindsightFlightCleanup = null;
  function hindsightArtworkPairs(from, to, pairs) {
    if (hindsightFlightCleanup) hindsightFlightCleanup();
    const sensemakingBridge = (from.id === 'm07' && to.id === 'm10') || (from.id === 'm10' && to.id === 'm07');
    const thresholdBridge = (from.id === 'm03' && to.id === 'm27') || (from.id === 'm27' && to.id === 'm03');
    const abortionContextBridge = (from.id === 'm10' && to.id === 'm43') || (from.id === 'm43' && to.id === 'm10');
    if (!sensemakingBridge && !thresholdBridge && !abortionContextBridge) return pairs;
    const flightIDs = thresholdBridge ? ['pc-threshold-bridge'] :
      abortionContextBridge ? ['pw-legal-judgment'] : HINDSIGHT_FLIGHT_IDS;
    const flights = flightIDs.map((id) => {
      const fromWrap = from.querySelector('[data-id="' + id + '"]');
      const toWrap = to.querySelector('[data-id="' + id + '"]');
      return { fromWrap, toWrap, fromImg: fromWrap && fromWrap.querySelector('img'), toImg: toWrap && toWrap.querySelector('img') };
    });
    if (flights.some((f) => !f.fromImg || !f.toImg)) return pairs;

    const opened = new Map();
    for (const f of flights) {
      for (let el = f.toImg.parentElement; el; el = el.parentElement) {
        const style = getComputedStyle(el);
        if (/hidden|clip/.test(style.overflowX + ' ' + style.overflowY)) {
          opened.set(el, el.getAttribute('data-aa-hindsight-flight-open'));
          el.setAttribute('data-aa-hindsight-flight-open', '');
        }
        if (el === f.toWrap) break;
      }
    }
    const sheet = document.createElement('style');
    sheet.textContent = '.reveal .slides [data-aa-hindsight-flight-open] { overflow: visible !important; }';
    document.head.appendChild(sheet);
    let timer = 0;
    hindsightFlightCleanup = () => {
      clearTimeout(timer);
      for (const [el, original] of opened) {
        if (original === null) el.removeAttribute('data-aa-hindsight-flight-open');
        else el.setAttribute('data-aa-hindsight-flight-open', original);
      }
      sheet.remove();
      hindsightFlightCleanup = null;
    };
    timer = setTimeout(hindsightFlightCleanup, (Number(Reveal.getConfig().autoAnimateDuration) || .9) * 1000 + 180);

    const remaining = pairs.filter((p) => !flights.some((f) =>
      f.fromWrap.contains(p.from) || f.toWrap.contains(p.to)));
    for (const f of flights) {
      let units = null;
      let thresholdGeometry = null;
      const measure = (el) => {
        if (!units) {
          const target = f.toImg.getBoundingClientRect();
          const revealScale = Reveal.getScale() || 1;
          const style = getComputedStyle(f.toImg);
          const width = parseFloat(style.width) || f.toImg.offsetWidth || target.width;
          const height = parseFloat(style.height) || f.toImg.offsetHeight || target.height;
          units = { x: target.width / width / revealScale, y: target.height / height / revealScale };
          if (thresholdBridge || abortionContextBridge) {
            const aspect = 278.8 / 202.600001;
            const content = (r) => {
              const w = Math.min(r.width, r.height * aspect), h = w / aspect;
              return { x: r.left + (r.width - w) / 2, y: r.top + (r.height - h) / 2, width: w, height: h };
            };
            const source = content(f.fromImg.getBoundingClientRect());
            const targetContent = content(target);
            const scale = source.width / targetContent.width;
            thresholdGeometry = {
              from: { left: source.x - scale * (targetContent.x - target.left),
                      top: source.y - scale * (targetContent.y - target.top), width: source.width, height: source.height },
              to: { left: target.left, top: target.top, width: targetContent.width, height: targetContent.height }
            };
          }
        }
        const rect = thresholdGeometry ? (el === f.fromImg ? thresholdGeometry.from : thresholdGeometry.to) : el.getBoundingClientRect();
        return { x: rect.left / units.x, y: rect.top / units.y,
                 width: rect.width / units.x, height: rect.height / units.y };
      };
      remaining.push({ from: f.fromImg, to: f.toImg, options: { scale: true, measure } });
    }
    return remaining;
  }

  function matcher(from, to) {
    let pairs = this.getAutoAnimatePairs(from, to)
      .filter((p) => !p.to.closest('.sem2-card, .sem2, .s2-scrim, .tl-period, .hb-chart, .vb-chart, .fg-r, .qx-big, #m19-pc, #m55-p2'))
      .filter((p) => !p.from.closest('.qx-big, .vb-chart'))
      .filter((p) => p.to.dataset.id || !/^(P|LI|H[1-6])$/.test(p.to.tagName) || p.to.textContent.trim() !== '');
    pairs = hindsightArtworkPairs(from, to, pairs);
    if ((from.id === 'm10' && to.id === 'm43') || (from.id === 'm43' && to.id === 'm10')) {
      pairs = pairs.filter((p) => p.to.tagName === 'IMG' && p.to.closest('[data-id="pw-legal-judgment"]'));
    }
    if ((from.id === 'm03' && to.id === 'm27') || (from.id === 'm27' && to.id === 'm03')) {
      pairs = pairs.filter((p) => p.to.tagName !== 'IMG' || p.to.closest('[data-id="pc-threshold-bridge"]'));
    }
    if (from.id === 'm27' && to.id === 'm18' && !to.querySelector('.talk-step[data-talk-step="1"].visible')) {
      pairs = pairs.filter((p) => !p.to.closest('#m18-pcg, #m18-pc'));
    }
    if ((from.id === 'm11' && to.id === 'm51') || (from.id === 'm51' && to.id === 'm11')) {
      const labels = pairs.filter((p) => p.to.matches('.s1d-t[data-id="s1-lab-exp"], .s1d-t[data-id="s1-lab-unexp"]'));
      pairs = pairs.filter((p) => !p.to.matches('img.s1d-ic') ||
        !labels.some((label) => label.from.contains(p.from) && label.to.contains(p.to)));
    }
    const styles = Reveal.getConfig().autoAnimateStyles;
    for (const p of pairs) {
      if (((from.id === 'm06' && to.id === 'm26') || (from.id === 'm26' && to.id === 'm06')) &&
          p.to.classList.contains('component-node')) {
        p.options = Object.assign({}, p.options, { scale: false, styles: styles.concat(['width', 'height']) });
      } else if (p.to.dataset.aaMeasure === 'stage') {
        p.options = Object.assign({}, p.options, { scale: false, measure: onStage });
      } else if (p.to.classList.contains('ag-box')) {
        p.options = Object.assign({}, p.options, { scale: false, styles: styles.concat(['width', 'height']) });
      } else if (p.to.closest('.ag-box')) {
        p.options = Object.assign({}, p.options, { scale: false });
      }
    }
    if (isMain(to)) freeze(to, pairs.map((p) => p.to));
    return pairs;
  }
  const printing = () => /print-pdf/gi.test(location.search) || document.documentElement.classList.contains('print-pdf');

  function boot() {
    document.querySelectorAll('.reveal .slides section.main').forEach((sec) => slides.set(sec, build(sec)));
    window.__talk = { slides, play, finishAll };
    Reveal.configure({ autoAnimateMatcher: matcher, slideNumber: (slide) => [Reveal.getIndices(slide).h + 1],
                       keyboard: { 32: 'right', 33: 'left', 34: 'right' } });

    if (printing()) { finishAll(); return; }
    const cur = Reveal.getCurrentSlide();
    if (isMain(cur)) play(cur);

    Reveal.on('slidechanged', (ev) => {
      if (Reveal.isOverview && Reveal.isOverview()) return;
      if (isMain(ev.currentSlide)) { play(ev.currentSlide); keepRule(ev.previousSlide, ev.currentSlide); }
      else stop(false);
    });
    Reveal.on('fragmentshown', (ev) => {
      const sec = Reveal.getCurrentSlide();
      if (!isMain(sec)) return;
      for (const f of ev.fragments) if (f.classList.contains('talk-step')) run(sec, parseInt(f.dataset.talkStep, 10));
    });
    Reveal.on('fragmenthidden', (ev) => {
      const sec = Reveal.getCurrentSlide();
      const st = isMain(sec) && slides.get(sec);
      if (!st) return;
      stop(true);
      for (const f of ev.fragments) if (f.classList.contains('talk-step')) seekStep(st, parseInt(f.dataset.talkStep, 10), 0);
    });
    Reveal.on('overviewshown', finishAll);
    Reveal.on('overviewhidden', () => { const s = Reveal.getCurrentSlide(); if (isMain(s)) play(s); });
    Reveal.on('pdf-ready', finishAll);
  }

  function whenReady(cb) {
    const go = () => (document.fonts ? document.fonts.ready : Promise.resolve()).then(cb);
    if (window.Reveal && Reveal.isReady && Reveal.isReady()) go();
    else if (window.Reveal && Reveal.on) Reveal.on('ready', go);
    else window.addEventListener('load', () => whenReady(cb), { once: true });
  }
  whenReady(() => { try { boot(); } catch (err) { console.error('[talk]', err); } });
})();
