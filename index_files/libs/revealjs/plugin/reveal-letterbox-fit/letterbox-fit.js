/* RevealLetterboxFit: measure natural content, scale it inside a separate
 * viewport, and scroll at the readability floor. Bleed art and speaker notes
 * remain outside the viewport. Visible asides are ordinary fitted content.
 */
window.RevealLetterboxFit = window.RevealLetterboxFit || (function () {
  var EXCLUDE = [
    '.image-left', '.image-right', '.background-color-div',
    '.background-image-div', '.background-video-div', '.background-iframe-div',
    '.tape-box', '.blob', '.notes', '.footer', '.slide-logo', '.slide-number', '.section-image'
  ].join(',');

  function getConfig(reveal) {
    var user = reveal.getConfig().letterboxFit || {};
    function number(value, fallback) {
      return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
    }
    var max = Math.max(0.1, Math.min(1, number(user.maxScale, 1)));
    return {
      enabled: user.enabled !== false,
      minScale: Math.max(0.1, Math.min(max, number(user.minScale, 0.55))),
      maxScale: max,
      tolerance: Math.max(0, number(user.tolerance, 1)),
      skipAutoAnimate: user.skipAutoAnimate !== false
    };
  }

  function isPrinting(reveal) {
    return /(?:\?|&)print-pdf(?:[=&]|$)/.test(window.location.search)
      || document.documentElement.classList.contains('print-pdf')
      || document.body.classList.contains('print-pdf')
      || reveal.getRevealElement().classList.contains('print-pdf');
  }

  function px(value) { return parseFloat(value) || 0; }

  function skipSection(section, cfg) {
    return section.classList.contains('stack')
      || section.classList.contains('plot-slide')
      || section.classList.contains('tabset-slide')
      || section.classList.contains('scrollable')
      || section.getAttribute('data-letterbox-fit') === 'false'
      || (cfg.skipAutoAnimate && section.hasAttribute('data-auto-animate'));
  }

  function ensureWrapper(section) {
    var existing = section.querySelector(':scope > .letterbox-fit');
    if (existing) return existing;
    var movable = Array.from(section.children).filter(function (child) {
      if (child.matches(EXCLUDE)) return false;
      var position = getComputedStyle(child).position;
      return position !== 'absolute' && position !== 'fixed';
    });
    if (!movable.length) return null;
    var viewport = document.createElement('div');
    viewport.className = 'letterbox-fit';
    var content = document.createElement('div');
    content.className = 'letterbox-fit-content';
    section.insertBefore(viewport, movable[0]);
    viewport.appendChild(content);
    movable.forEach(function (child) { content.appendChild(child); });
    return viewport;
  }

  function reset(viewport, section) {
    viewport.style.removeProperty('--letterbox-fit-scale');
    viewport.style.height = '';
    viewport.classList.remove('letterbox-fit-active');
    section.classList.remove('letterbox-fit-scroll');
    viewport.removeAttribute('tabindex');
    viewport.removeAttribute('role');
    viewport.removeAttribute('aria-label');
  }

  function fitOne(reveal, section) {
    if (!section) return;
    var cfg = getConfig(reveal);
    var viewport = section.querySelector(':scope > .letterbox-fit');
    if (isPrinting(reveal) || !cfg.enabled || skipSection(section, cfg)) {
      if (viewport) reset(viewport, section);
      return;
    }
    viewport = viewport || ensureWrapper(section);
    if (!viewport || !section.offsetWidth) return;
    reset(viewport, section);
    var content = viewport.firstElementChild;
    var slides = reveal.getSlidesElement();
    var ss = getComputedStyle(section);
    var vs = getComputedStyle(viewport);
    var gutter = px(vs.getPropertyValue('--letterbox-fit-gutter'));
    var availW = Math.min(slides.clientWidth, section.clientWidth)
      - px(ss.paddingLeft) - px(ss.paddingRight) - gutter;
    var availH = slides.clientHeight - px(ss.paddingTop) - px(ss.paddingBottom) - gutter;
    Array.from(section.children).forEach(function (child) {
      if (child === viewport) return;
      var cs = getComputedStyle(child);
      if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') return;
      availH -= child.offsetHeight + px(cs.marginTop) + px(cs.marginBottom);
    });
    // Content is a flow-root: child margins are included instead of collapsing
    // through the measured box. It keeps natural height even while scrolling.
    var naturalW = Math.max(content.offsetWidth, content.scrollWidth);
    var naturalH = Math.max(content.offsetHeight, content.scrollHeight);
    if (availW <= 0 || availH <= 0 || !naturalW || !naturalH) return;
    var scale = Math.min(cfg.maxScale, availW / naturalW, availH / naturalH);
    scale = Math.max(cfg.minScale, scale);
    viewport.style.setProperty('--letterbox-fit-scale', String(scale));
    viewport.style.height = Math.min(naturalH * scale, availH) + 'px';
    viewport.classList.add('letterbox-fit-active');
    if (naturalH * scale > availH + cfg.tolerance || naturalW * scale > availW + cfg.tolerance) {
      section.classList.add('letterbox-fit-scroll');
      viewport.tabIndex = 0;
      viewport.setAttribute('role', 'region');
      viewport.setAttribute('aria-label', 'Scrollable slide content');
    }
  }

  return {
    id: 'letterbox-fit',
    init: function (reveal) {
      var pending = false;
      function apply() {
        if (pending) return;
        pending = true;
        requestAnimationFrame(function () {
          pending = false;
          fitOne(reveal, reveal.getCurrentSlide());
        });
      }
      // Only actual Reveal slides are wrapped, never nested sections generated
      // for ordinary headings inside a slide.
      reveal.on('ready', apply);
      reveal.on('slidechanged', apply);
      reveal.on('resize', apply);
      reveal.on('slidetransitionend', apply);
      reveal.on('fragmentshown', apply);
      reveal.on('fragmenthidden', apply);
      reveal.getRevealElement().addEventListener('load', apply, true);
      document.addEventListener('shown.bs.tab', apply);
      document.addEventListener('tabby', apply);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(apply);
    }
  };
})();
