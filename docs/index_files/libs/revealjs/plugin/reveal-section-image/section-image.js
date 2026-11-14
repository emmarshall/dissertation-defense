// Centered slides have a vertical offset. Cancel it for the corner image only;
// the title, other content, and outer letterbox frame keep their own geometry.
window.RevealSectionImage = {
  id: 'section-image',
  init: function (reveal) {
    function position(section) {
      if (section && section.querySelector(':scope > .section-image')) {
        var top = section.offsetTop + 'px';
        if (section.style.getPropertyValue('--section-image-slide-top') !== top) {
          section.style.setProperty('--section-image-slide-top', top);
        }
      }
    }
    function update() {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { position(reveal.getCurrentSlide()); });
      });
    }
    reveal.on('ready', update);
    reveal.on('resize', update);
    reveal.on('slidechanged', update);
    reveal.on('slidetransitionend', update);
    reveal.on('pdf-ready', function () { reveal.getSlides().forEach(position); });
    // Reveal can recenter a slide after the resize event, including after
    // fonts and fitted content settle. Observe its inline positioning too.
    if (window.MutationObserver) {
      var observer = new MutationObserver(update);
      reveal.getRevealElement().querySelectorAll('section > .section-image').forEach(function (image) {
        observer.observe(image.parentElement, { attributes: true, attributeFilter: ['style'] });
      });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(update);
  }
};
