/* arrow-review 0.1.0 (Emma Marshall, 2026-11-03): redraws the arrows that quarto-arrows' {{< arrow >}} shortcode
   draws (svg.nd-marker) with reviewed geometry and one arrowhead shape, and gives the component-diagram connectors
   (svg.connector-layer) the same heads. Split from the defense deck's diagram-arrows/render.js (integrated 2026-11-02).
   Geometry: window.arrowReviewTheory, window.arrowReviewSem, window.arrowReviewRoot, then any in window.arrowReviewGeometry;
   each is { arrows: [{ slides, label | arrowIndex, from, to, control | curve, width }], ... }.
   Hooks: (window.arrowReviewHooks = window.arrowReviewHooks || []).push({ stage: 'before' | 'after', run(api) {} });
   'before' runs before the arrows are redrawn, 'after' runs after; api = { report, data, sections, styleRules, scope, attrs, path, NS }.
   Runs once at DOMContentLoaded; then window.arrowReviewReport and <html data-arrow-review="ready">, and Reveal.sync(). */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const data = () => [window.arrowReviewTheory, window.arrowReviewSem, window.arrowReviewRoot].concat(window.arrowReviewGeometry || []).filter(Boolean);
  const report = { native: [], components: [], componentMotion: [], objects: [], images: [], composites: [], terminology: 0 };
  const sections = () => [...document.querySelectorAll('.reveal .slides section[id]')];
  const styleRules = key => data().flatMap(d => d[key] || []);
  const scope = rule => sections().filter(s => rule.slides.includes(s.id));
  function attrs(el, values) { Object.entries(values).forEach(([k,v]) => el.setAttribute(k,v)); return el; }
  function path(d, color, width, className) {return attrs(document.createElementNS(NS,'path'), {d,stroke:color,'stroke-width':width,fill:'none','stroke-linecap':'round','stroke-linejoin':'round',class:className});}
  const MARKER_SPEC = { width: 8.5, headLength: 20, headHalfSpread: 9 };
  function markerHead(from, to, width, control) {
    const tangent = [to[0]-(control||from)[0],to[1]-(control||from)[1]];
    const len = Math.hypot(...tangent), u = tangent.map(n=>n/len), n = [-u[1],u[0]], ratio=width/MARKER_SPEC.width;
    return [-1,1].map(sign=>[to[0]-MARKER_SPEC.headLength*ratio*u[0]+sign*MARKER_SPEC.headHalfSpread*ratio*n[0],to[1]-MARKER_SPEC.headLength*ratio*u[1]+sign*MARKER_SPEC.headHalfSpread*ratio*n[1]]);
  }
  function paint(svg, from, to, width, color, control, dashed) {
    const wings = markerHead(from, to, width, control);
    const pts=[from,to,...wings,...(control?[control]:[])];
    const min=[Math.min(...pts.map(p=>p[0]))-width,Math.min(...pts.map(p=>p[1]))-width];
    const size=[Math.max(...pts.map(p=>p[0]))-min[0]+width,Math.max(...pts.map(p=>p[1]))-min[1]+width];
    const outer=svg.parentElement;
    outer.style.left=min[0]+'px';outer.style.top=min[1]+'px';
    attrs(svg,{viewBox:`${min[0]} ${min[1]} ${size[0]} ${size[1]}`,width:size[0],height:size[1]});
    svg.replaceChildren();
    const shaft=path(`M ${from.join(' ')} ${control?'Q '+control.join(' ')+' ': 'L '}${to.join(' ')}`,color,width,'ar-shaft');
    if(dashed)shaft.style.strokeDasharray='11 8';
    const head=path(`M ${wings[0].join(' ')} L ${to.join(' ')} L ${wings[1].join(' ')}`,color,width,'ar-head');
    head.style.setProperty('stroke-dasharray','none','important');svg.append(shaft,head);
    svg.dataset.arFrom=from.join(',');svg.dataset.arTo=to.join(',');svg.dataset.arWidth=String(width);
    svg.dataset.arCurve=control?'quadratic':'straight';svg.classList.add('ar-reviewed');
  }
  function originalGeometry(svg) {
    const p=[...svg.children].find(n=>n.tagName.toLowerCase()==='path');if(!p)return null;
    const vals=(p.getAttribute('d').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)||[]).map(Number);
    const left=parseFloat(svg.parentElement.style.left)||0,top=parseFloat(svg.parentElement.style.top)||0;
    const start=[vals[0]+left, vals[1]+top],end=[vals.at(-2)+left, vals.at(-1)+top];
    const tangent=[end[0]-(vals.at(-4)+left),end[1]-(vals.at(-3)+top)],l=Math.hypot(...tangent);
    const width=Number(p.getAttribute('stroke-width')||6), marker=svg.querySelector('marker');
    const ext=marker?(Number(marker.getAttribute('markerWidth'))-Number(marker.getAttribute('refX')))*width:0;
    return {from:start,to:end.map((v,i)=>v+ext*tangent[i]/l),width,color:p.getAttribute('stroke')||'#16182d'};
  }
  function replaceArrows() {
    sections().forEach(section=>section.querySelectorAll('svg.nd-marker').forEach((svg,index)=>{
      if(svg.matches('.proc-marker:not(.proc-loop-marker)')){report.native.push({slide:section.id,index,status:'preserved hidden procedure connector'});return;}
      const geometry=originalGeometry(svg);if(!geometry)return;
      const label=svg.getAttribute('aria-label')||'';
      const rule=styleRules('arrows').find(r=>r.slides.includes(section.id)&&(r.arrowIndex===index || (r.label && (r.labelPrefix?label.startsWith(r.label):label===r.label))));
      const canvas=svg.closest('.nd-canvas'), scale=canvas?.style.transform.match(/scale\(([^)]+)\)/), targetWidth=svg.classList.contains('sem-native-arrow')?6/(scale?Number(scale[1]):1):svg.classList.contains('proc-loop-marker')?6:MARKER_SPEC.width/(scale?Number(scale[1]):1);
      const from=rule?.from||geometry.from,to=rule?.to||geometry.to;
      let control=rule?.control;
      if(!control && rule?.curve){const v=[to[0]-from[0],to[1]-from[1]];control=[(from[0]+to[0])/2-v[1]*rule.curve,(from[1]+to[1])/2+v[0]*rule.curve];}
      paint(svg,from,to,rule?.width||targetWidth,geometry.color,control,svg.classList.contains('sem-uncertain'));
      report.native.push({slide:section.id,index,label,from,to,width:rule?.width||targetWidth,curve:control||null,uncertain:svg.classList.contains('sem-uncertain')});
    }));
  }
  function replaceComponentArrows() {
    sections().filter(section=>section.classList.contains('component-diagram-slide')).forEach(section=>{
      const fit=section.querySelector('.component-diagram-fit');
      if(!fit)return;
      const transform=getComputedStyle(fit).transform;
      const matrix=transform==='none'?null:new DOMMatrixReadOnly(transform);
      const innerScale=matrix?Math.hypot(matrix.a,matrix.b):1;
      if(!(innerScale>0))return;
      const width=MARKER_SPEC.width/innerScale;
      const color=getComputedStyle(section).getPropertyValue('--hb-navy').trim()||'#16182d';
      section.querySelectorAll('svg.connector-layer').forEach(svg=>{
        svg.style.setProperty('--component-arrow-local-width',width+'px');
        svg.querySelectorAll('path.marker-shaft[data-edge]').forEach(shaft=>{
          const head=shaft.nextElementSibling;
          if(!head?.matches('path.marker-head'))return;
          const values=(shaft.getAttribute('d').match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi)||[]).map(Number);
          const from=values.slice(0,2),to=values.slice(-2);
          if(from.length!==2||to.length!==2||Math.hypot(to[0]-from[0],to[1]-from[1])===0)return;
          const wings=markerHead(from,to,width);
          attrs(shaft,{stroke:color,'stroke-width':width});
          attrs(head,{d:`M ${wings[0].join(' ')} L ${to.join(' ')} L ${wings[1].join(' ')}`,stroke:color,'stroke-width':width});
          head.style.setProperty('stroke-dasharray','none','important');
          report.components.push({slide:section.id,layer:svg.dataset.id,edge:shaft.dataset.edge,from,to,innerScale,localWidth:width,stageWidth:width*innerScale,headLength:MARKER_SPEC.headLength/innerScale,headHalfSpread:MARKER_SPEC.headHalfSpread/innerScale});
        });
        svg.classList.add('ar-component-reviewed');
      });
    });
  }
  function installComponentConnectorMotionGuard() {
    const reveal=window.Reveal;
    if(!reveal?.on)return;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const isComponent=slide=>slide?.classList.contains('component-diagram-slide');
    const printing=()=>/print-pdf/i.test(location.search)||document.documentElement.classList.contains('print-pdf');
    let generation=0,timer=0,frame=0,held=[],started=0;
    function reset(reason='navigation-reset') {
      generation++;
      clearTimeout(timer);cancelAnimationFrame(frame);timer=frame=0;
      if(held.length)report.componentMotion.push({state:'released',reason,slides:held.map(slide=>slide.id),elapsedMs:performance.now()-started});
      held.forEach(slide=>slide.classList.remove('component-connectors-moving'));held=[];
    }
    const settle=(token,reason)=>{if(token===generation)reset(reason);};
    const millis=value=>value.trim().endsWith('ms')?parseFloat(value):parseFloat(value)*1000;
    function transitionEnd(node) {
      const css=getComputedStyle(node);
      const durations=css.transitionDuration.split(',').map(millis),delays=css.transitionDelay.split(',').map(millis);
      return Math.max(0,...durations.map((duration,index)=>duration+delays[index%delays.length]));
    }
    reveal.on('slidechanged',()=>reset());
    reveal.on('autoanimate',event=>{
      reset('new-autoanimate');
      if(!isComponent(event.fromSlide)||!isComponent(event.toSlide)||reduced.matches||printing()||reveal.isOverview?.())return;
      const token=generation;started=performance.now();held=[event.fromSlide,event.toSlide];
      held.forEach(slide=>slide.classList.add('component-connectors-moving'));
      report.componentMotion.push({state:'hidden',from:event.fromSlide.id,to:event.toSlide.id});
      // Reveal schedules its pending -> running style update before this frame.
      frame=requestAnimationFrame(()=>{
        frame=0;if(token!==generation)return;
        const nodes=[...event.toSlide.querySelectorAll('.component-node[data-id],.input-node[data-id],.output-node[data-id]')];
        const duration=Math.max((Number(reveal.getConfig().autoAnimateDuration)||0)*1000,...nodes.map(transitionEnd));
        const motions=nodes.flatMap(node=>typeof node.getAnimations==='function'?node.getAnimations().filter(animation=>
          typeof animation.transitionProperty==='string'&&/^(transform|translate|scale|width|height|left|top)$/.test(animation.transitionProperty)):[]);
        // The timer covers browsers without CSS-transition promises; it also prevents stale holds.
        timer=setTimeout(()=>settle(token,'duration-watchdog'),duration+80);
        if(motions.length)Promise.allSettled(motions.map(animation=>animation.finished)).then(()=>{
          if(token===generation)frame=requestAnimationFrame(()=>settle(token,'entity-transitions-finished'));
        });
      });
    });
    ['overviewshown','overviewhidden','pdf-ready'].forEach(event=>reveal.on(event,()=>reset(event)));
    reduced.addEventListener?.('change',()=>reset('motion-preference-change'));
    window.addEventListener('beforeprint',()=>reset('beforeprint'));
    window.addEventListener('pagehide',()=>reset('pagehide'));
  }
  function hooks(stage, api) { (window.arrowReviewHooks || []).filter(h => h.stage === stage).forEach(h => h.run(api)); }
  function run() {
    const api = { report, data, sections, styleRules, scope, attrs, path, NS };
    hooks('before', api);
    replaceArrows();replaceComponentArrows();
    hooks('after', api);
    installComponentConnectorMotionGuard();window.arrowReviewReport=report;
    document.documentElement.dataset.arrowReview='ready';
    const sync=()=>window.Reveal?.sync();if(window.Reveal?.isReady())sync();else window.Reveal?.on('ready',sync);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run,{once:true});else run();
})();
