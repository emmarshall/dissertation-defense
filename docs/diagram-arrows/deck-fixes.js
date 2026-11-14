(() => {
  let report, data, sections, styleRules, scope, attrs, path, NS;
  const bind = (api) => ({ report, data, sections, styleRules, scope, attrs, path, NS } = api);
  function cloneDiagram(source, state) {
    const node=source.cloneNode(true);
    node.querySelectorAll('.fragment').forEach(el=>{
      const i=Number(el.dataset.fragmentIndex||0);
      let show=el.classList.contains('fade-out')?state<i:el.classList.contains('fade-in-then-out')?state===i:state>=i;
      if(el.classList.contains('nd-fact-dim')){show=true;el.style.opacity=state>=i?'0.18':'1';}
      else {el.style.visibility=show?'visible':'hidden';el.style.opacity=show?'1':'0';}
      el.classList.remove('fragment','visible','current-fragment');
    });
    [node,...node.querySelectorAll('[id],[data-id],[data-in],[data-anim]')].forEach(el=>{
      if(el.id)el.dataset.sourceId=el.id;el.removeAttribute('id');el.removeAttribute('data-id');el.removeAttribute('data-in');el.removeAttribute('data-anim');
    });
    node.querySelectorAll('img[data-src]').forEach(img=>img.src=img.dataset.src);
    if(node.matches('.nd-canvas'))Object.assign(node.style,{position:'relative',left:'0',top:'0',margin:'0 auto',transform:'none'});
    return node;
  }
  function composites() {
    const mappings=[
      ['single-path-narrative-1.png','D03',-1],['single-path-narrative-2.png','D03',0],['single-path-narrative-3.png','D03',1],
      ['navy-v1/hindsight.png','D08',-1],['cmt-surprise-1.png','D09',-1],['cmt-surprise-2.png','D09',0],
      ['outcome-bias-definition-2.png','D09-outcome',-1],['moral-judgments-1.png','D09-moral',-1],['moral-judgements-2.png','D09-moral',0],
      ['images/overall-model.svg','m10',1],['images/outcome-bias-definition-2.svg','D09-outcome',-1],['images/moral-judgments-1.svg','D09-moral',-1]
    ];
    sections().filter(s=>/backup/.test(s.id)).forEach(section=>section.querySelectorAll('img').forEach(img=>{
      const src=img.getAttribute('src')||img.dataset.src||'',m=mappings.find(m=>src.endsWith(m[0]));if(!m)return;
      const source=document.querySelector(`section[id="${m[1]}"] ${m[1]==='m10'?'.pw':'.nd-canvas'}`);if(!source)return;
      const clone=cloneDiagram(source,m[2]);const wrap=document.createElement('div');wrap.className='ar-native-wrap';
      if(m[1]==='m10'){wrap.classList.add('ar-legacy-stage');Object.assign(clone.style,{position:'absolute',left:'0',top:'-140px',transform:'scale(0.6458333333)',transformOrigin:'0 0'});}
      if(img.classList.contains('fragment')) {wrap.className+=' '+img.className;wrap.dataset.fragmentIndex=img.dataset.fragmentIndex||'0';}
      wrap.append(clone);
      const original=img.closest('.canva-composition-viewport')||img.closest('p')||img;
      original.style.display='none';original.setAttribute('aria-hidden','true');original.insertAdjacentElement('afterend',wrap);
      report.composites.push({slide:section.id,original:src,source:m[1],state:m[2],arrows:clone.querySelectorAll('.ar-reviewed').length});
    }));
  }
  function terminology() {
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    let n;while((n=walker.nextNode())){
      if(n.parentElement.closest('script,style,#references,[role="doc-bibliography"]'))continue;
      if(/\baccounts?\b/i.test(n.nodeValue)){n.nodeValue=n.nodeValue.replace(/\baccounts\b/g,'explanations').replace(/\bAccounts\b/g,'Explanations').replace(/\baccount\b/g,'explanation').replace(/\bAccount\b/g,'Explanation');report.terminology++;}
    }
    document.querySelectorAll('[data-menu-title],[aria-label]').forEach(el=>['data-menu-title','aria-label'].forEach(a=>{if(el.hasAttribute(a))el.setAttribute(a,el.getAttribute(a).replace(/\baccounts?\b/gi,'model'));}));
    const backupHeading=document.querySelector('section[id="D09-composite-backup"] > h2');
    if(backupHeading && /sense-making/i.test(backupHeading.textContent))backupHeading.textContent='Backup: Previous composition — Sense-making';
  }
  function glyphs() {
    document.querySelectorAll('.org-v006-next-arrow,.concept-arrow').forEach(el=>{
      if(el.textContent.trim()!=='→')return;
      const svg=document.createElementNS(NS,'svg');attrs(svg,{viewBox:'0 0 100 40',width:'100%',height:'100%','aria-hidden':'true'});
      svg.append(path('M 8 20 L 88 20','#16182d',6,'ar-shaft'),path('M 73 13 L 88 20 L 73 27','#16182d',6,'ar-head'));el.replaceChildren(svg);el.classList.add('ar-glyph');
    });
  }
  (window.arrowReviewHooks = window.arrowReviewHooks || []).push(
    { stage: 'before', run(api) {
      bind(api);
        styleRules('canvases').concat(styleRules('objects')).forEach(rule=>scope(rule).forEach(s=>s.querySelectorAll(rule.selector).forEach(el=>{Object.assign(el.style,rule.style);report.objects.push({slide:s.id,selector:rule.selector});})));
        styleRules('insertions').forEach(rule=>scope(rule).forEach(s=>s.querySelectorAll(rule.selector).forEach(el=>el.innerHTML=rule.html.replaceAll('../components/','canva-graphics-v2/components/'))));
        styleRules('imageReplacements').forEach(rule=>document.querySelectorAll('img').forEach(img=>{
          ['src','data-src'].forEach(attr=>{if(img.getAttribute(attr)===rule.original){img.setAttribute(attr,rule.review);const link=img.closest('a.lightbox');if(link?.getAttribute('href')===rule.original)link.href=rule.review;report.images.push({original:rule.original,review:rule.review});}});
        }));
    } },
    { stage: 'after', run(api) { bind(api); composites();terminology();glyphs(); } });
  window.addEventListener('load',()=>setTimeout(()=>{ if (report) terminology(); },250));
})();
