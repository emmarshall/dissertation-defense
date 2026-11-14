/* Repeat the quotation as decorative print behind .quote-box.quote-text-bg.
 * The source remains a single semantic blockquote. Repeated text is excluded
 * from selection and the accessibility tree; attribution is never repeated.
 */
window.RevealQuoteBackground = window.RevealQuoteBackground || {
  id: 'quote-background',
  init: function (reveal) {
    function fill(box) {
      var quote = box.querySelector(':scope > blockquote');
      if (!quote || !box.offsetWidth) return;
      var copy = quote.cloneNode(true);
      copy.querySelectorAll('.quote-source').forEach(function (source) { source.remove(); });
      // Strip quotation delimiters only in the decorative copy. Apostrophes
      // within words and all punctuation in the readable quotation survive.
      var text = copy.textContent
        .replace(/["“”„‟«»‹›]/g, '')
        .replace(/(^|\s)[‘'](.+?)[’'](?=\s|$|[.,;:!?])/g, '$1$2')
        .replace(/\s+/g, ' ').trim();
      if (!text) return;
      // Begin midway through the words, wrapping back to the beginning so
      // every repetition reads as a continuous excerpt of the same quotation.
      var words = text.split(' ');
      var midpoint = Math.floor(words.length / 2);
      text = words.slice(midpoint).concat(words.slice(0, midpoint)).join(' ');
      var background = box.querySelector(':scope > .box-text');
      if (!background) {
        background = document.createElement('div');
        background.className = 'box-text';
        box.insertBefore(background, box.firstChild);
      }
      background.setAttribute('aria-hidden', 'true');
      background.replaceChildren();
      var paragraph = document.createElement('p');
      background.appendChild(paragraph);
      // Continuous lines resemble the enlarged print in the reference. Use
      // layout dimensions (not transformed bounds) so slide fitting is safe.
      var repetitions = 0;
      while (paragraph.offsetHeight < background.clientHeight + 40 && repetitions < 200) {
        paragraph.appendChild(document.createTextNode((repetitions ? ' ' : '') + text));
        repetitions++;
      }
    }
    function apply() {
      reveal.getRevealElement().querySelectorAll('.quote-box.quote-text-bg').forEach(fill);
    }
    // A directly linked slide may not have measurable width until Reveal has
    // completed its first layout (including the slide-fitting plugin).
    function afterLayout() {
      requestAnimationFrame(function () { requestAnimationFrame(apply); });
    }
    reveal.on('ready', afterLayout);
    reveal.on('slidechanged', apply);
    reveal.on('slidetransitionend', apply);
    reveal.on('resize', afterLayout);
    reveal.on('pdf-ready', apply);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(afterLayout);
  }
};
