/*****************************************************************
** Modified for right-edge positioning without constraining content
** 
** A plugin for displaying attribution texts sideways along the right
** edge of the viewport without affecting slide content width.
**
******************************************************************/
window.RevealAttribution = window.RevealAttribution || {
  id: 'RevealAttribution',
  init: function(deck) {
      initAttribution(deck);
  }
};

const initAttribution = function(Reveal){
  var scale = 1;
  
  window.addEventListener('ready', function(event) {
    var attribution = document.getElementsByClassName("attribution");
    scale = 1 / (1 - Reveal.getConfig().margin);
    
    for (var i = 0; i < attribution.length; i++) {
      var content = attribution[i].innerHTML;
      attribution[i].innerHTML = "<span class='content'>" + content + "</span>";
      attribution[i].style.transform = 'translateY(-50%) rotate(-180deg) scale(' + scale + ')';
    }
    
    resizeCover();
  });
  
  window.addEventListener('resize', resizeCover);
  
  function resizeCover() {
    var attribution = document.getElementsByClassName("attribution");
    var yScale = window.innerHeight / Reveal.getConfig().height;
    var s = Math.max(1, yScale);
    
    for (var i = 0; i < attribution.length; i++) {
      attribution[i].style.transform = 'translateY(-50%) rotate(-180deg) scale(' + (s * scale) + ')';
    }
  }
};