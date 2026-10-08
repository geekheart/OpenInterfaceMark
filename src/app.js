import { FONTS, fontFaceName, fontFamilyCSS, setTextMeasurer, imageTransform, toStage, fromStage, nearestAnchor, labelLayout, exportDimensions, COLORS, clamp, escapeXML as esc, rectangle, resizeRegion, labelBounds, exportBounds, annotationMarkup, shapeMarkup, demoRegions, exportSVG, validateProject, projectJSON } from './core.js';
import { t as tr, getLocale, setLocale, localeFromURL, translateUI } from './i18n.js';
setLocale(localeFromURL(window.location?.href));
const $ = s => document.querySelector(s);
const icons={cursor:'m4 3 7 18 2-8 8-2L4 3Z',rect:'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z',ellipse:'M21 12a9 7 0 1 1-18 0 9 7 0 1 1 18 0',pan:'M8 12V5a2 2 0 0 1 4 0v6-8a2 2 0 0 1 4 0v8-5a2 2 0 0 1 4 0v9c0 5-3 7-7 7-3 0-5-2-6-4l-4-6a2 2 0 0 1 3-2l2 2',undo:'M8 4 3 9l5 5M3 9h11a6 6 0 0 1 0 12',redo:'m16 4 5 5-5 5m5-5H10a6 6 0 0 0 0 12',eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0',plus:'M12 5v14M5 12h14',image:'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm-1 14 6-6 5 5 3-3 4 4M15 7h.01',download:'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',folder:'M3 5h7l2 3h9v12H3V5Z',shield:'M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Zm-4 9 3 3 5-5',fit:'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',copy:'M8 8h13v13H8V8ZM4 16H3V3h13v1',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7'};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[name]||icons.rect}"/></svg>`;
for(const [id,name] of Object.entries({'add-region':'plus','undo':'undo','redo':'redo','toggle-labels':'eye','fit':'fit','image-card-icon':'image'})) $('#'+id).innerHTML=icon(name);
for(const button of document.querySelectorAll('[data-tool]')) { button.innerHTML=icon({select:'cursor',rect:'rect',ellipse:'ellipse',pan:'pan'}[button.dataset.tool]); button.setAttribute('aria-label',button.title); }
$('#privacy-badge').innerHTML=icon('shield')+tr('图片仅在本地处理');
for(const [id,name] of Object.entries({'project-button':'folder','image-button':'image','export-button':'download'})) $('#'+id).insertAdjacentHTML('afterbegin',icon(name));
let doc=null, selected=null, tool='select', showLabels=true, dirty=false, loading=false, operation=0;
let history=[], future=[], view={x:-600,y:-400,width:7200,height:4176}, fitView={...view}, gesture=null, space=false;
let toastTimer, previewURL, snapEnabled=true, guides=[];
let statusMessage={key:'就绪',values:{}},toastMessage=null;
let exportSettings={background:'white',scale:1};
let activeFontFaces=[];
const measureContext=document.createElement('canvas').getContext('2d');
setTextMeasurer((text,size,family)=>{measureContext.font=`600 ${size}px ${fontFamilyCSS(family)}`;measureContext.textAlign='left';const m=measureContext.measureText(text);return {width:m.width,left:m.actualBoundingBoxLeft??0,right:m.actualBoundingBoxRight??m.width,ascent:m.actualBoundingBoxAscent??size,descent:m.actualBoundingBoxDescent??size*.3};});
async function prepareFontFaces(fonts=[]){return Promise.all(fonts.map(async f=>{const face=new FontFace(fontFaceName(f.id),`url("${f.src}")`);await face.load();return face;}));}
function previewSource(image){ if(previewURL)URL.revokeObjectURL(previewURL); const parts=image.src.split(',');const bytes=Uint8Array.from(atob(parts[1]),c=>c.charCodeAt(0));previewURL=URL.createObjectURL(new Blob([bytes],{type:parts[0].split(':')[1].split(';')[0]})); }
const canvas=$('#canvas');
const selectedRegion=()=>doc?.regions.find(r=>r.id===selected);
function toast(message,values={}) { toastMessage={key:message,values}; (document.querySelector('dialog[open]')||document.body).append($('#toast'));$('#toast').textContent=tr(message,values); $('#toast').hidden=false; clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').hidden=true,4000); }
function status(message,values={}) { statusMessage={key:message,values};$('#status').textContent=tr(message,values); }
function setLoading(value) { loading=value; $('#loading').hidden=!value; for(const id of ['export-button','add-region','save-project','image-settings-button']) $('#'+id).disabled=value||!doc; for(const control of document.querySelectorAll('#properties input,#properties select,#properties button,[data-tool]'))control.disabled=value; updateHistory(); }
function snapshot(){return {regions:structuredClone(doc.regions),scale:doc.image.scale??1,rotation:doc.image.rotation??0};}
function restore(state){doc.regions=state.regions;doc.image.scale=state.scale;doc.image.rotation=state.rotation;}
function checkpoint(before=snapshot()){ history.push(before); if(history.length>80) history.shift(); future=[]; dirty=true; updateHistory(); }
function updateHistory(){ $('#undo').disabled=!history.length||loading; $('#redo').disabled=!future.length||loading; }
function commitRegion(patch){ const r=selectedRegion(); if(!r)return; checkpoint(); Object.assign(r,patch); render(); }
function updatePanCursor(){const wrap=$('#canvas-wrap');wrap.classList.toggle('is-panning',gesture?.type==='pan');wrap.classList.toggle('pan-ready',space);}
function setTool(next){ tool=next; for(const b of document.querySelectorAll('[data-tool]')) { b.classList.toggle('active',b.dataset.tool===tool);b.setAttribute('aria-pressed',String(b.dataset.tool===tool)); } $('#canvas-wrap').dataset.tool=tool; $('#canvas-hint').textContent=tool==='rect'||tool==='ellipse'?tr('左键拖动绘制区域 · 右键拖动画布'):tool==='pan'?tr('拖动画布 · 按 V 返回选择'):tr('拖动标签调整引线 · 右键拖动画布'); }
function select(id){finishGesture(true);selected=id;render();}
function render(){ if(!doc)return; renderCanvas(); renderList(); renderProperties(); updateHistory(); }
function renderList(){
  $('#count').textContent=doc.regions.length;
  $('#region-list').innerHTML=doc.regions.length?doc.regions.map((r,i)=>`<div class="region-row ${r.id===selected?'selected':''}"><button class="region-select" data-select="${esc(r.id)}" aria-label="${tr('选择')} ${esc(r.code)} ${esc(r.title)}" aria-pressed="${r.id===selected}"><span class="region-shape ${r.kind}" style="--color:${r.color}"></span><span><strong>${esc(r.code)||tr('未设置编号')}</strong><small>${esc(r.title)||tr('未设置标签')}</small></span><span class="row-index">${String(i+1).padStart(2,'0')}</span></button></div>`).join(''):`<div class="empty-state">${tr('还没有标注')}<br>${tr('按 R 在图片上框选区域')}</div>`;
}
function field(label,key,value,type='text',attrs=''){return `<label class="field"><span>${tr(label)}</span><input data-field="${key}" type="${type}" value="${esc(value)}" ${attrs}/></label>`;}
function renderProperties(){
  const r=selectedRegion();
  if(!r){ $('#properties').innerHTML=`<div class="empty-state">${icon('cursor')}${tr('选择一个区域编辑属性')}<br>${tr('或按 R 绘制新区域')}</div>`;return; }
  $('#properties').innerHTML=`<div class="property-section first">
    <div class="section-label">${tr('标签内容')} <span>${tr(r.kind==='ellipse'?'椭圆区域':'矩形区域')}</span></div>
    ${field('编号','code',r.code,'text',`maxlength="40" placeholder="${tr('例如 J1')}"`)}
    ${field('标签名称','title',r.title,'text',`maxlength="160" placeholder="${tr('例如 USB-C 接口')}"`)}
    <label class="field"><span>${tr('标签字体')}</span><select data-field="fontFamily">${[['sans',FONTS.sans],...(doc.fonts||[]).map(f=>[f.id,{label:f.name}]),...(['serif','mono'].includes(r.fontFamily)?[[r.fontFamily,FONTS[r.fontFamily]]]:[])].map(([id,f])=>`<option value="${id}" ${(r.fontFamily||'sans')===id?'selected':''}>${esc(id.startsWith('font-')?f.label:tr(f.label))}</option>`).join('')}</select></label>
    <button class="button wide font-load-button" id="load-font">${tr('加载本地字体')}</button>
    <label class="field color-field"><span>${tr('文字颜色')}</span><input type="color" data-field="textColor" value="${r.textColor||r.color}"/><small>${r.textColor||tr('跟随边框颜色')}</small></label>
  </div><div class="property-section">
    <div class="section-label">${tr('区域位置与尺寸')} <span>px</span></div><div class="field-grid">
    ${field('X 位置','x',Math.round(r.x),'number','min="0" step="1"')}${field('Y 位置','y',Math.round(r.y),'number','min="0" step="1"')}${field('宽度 W','w',Math.round(r.w),'number','min="1" step="1"')}${field('高度 H','h',Math.round(r.h),'number','min="1" step="1"')}</div>
  </div><div class="property-section">
    <div class="section-label">${tr('标注样式')}</div><div class="colors">${COLORS.map(c=>`<button class="color-swatch ${r.color===c?'active':''}" style="--color:${c}" data-color="${c}" aria-label="${tr('颜色')} ${c}" aria-pressed="${r.color===c}"></button>`).join('')}<input type="color" class="custom-color" data-field="color" value="${r.color}" title="${tr('自定义颜色')}" aria-label="${tr('自定义颜色')}"/></div>
    <div class="field-grid">${field('线宽','stroke',r.stroke,'number','min="0.5" max="100" step="0.5"')}${field('字号','fontSize',r.fontSize,'number','min="4" max="400" step="1"')}${r.kind==='rect'?field('圆角','radius',r.radius,'number','min="0" max="1000" step="1"'):''}
    <label class="field"><span>${tr('标签方向')}</span><select id="label-side">${[['',tr('自由位置')],['left',tr('左侧')],['right',tr('右侧')],['top',tr('上方')],['bottom',tr('下方')]].map(([value,label])=>`<option value="${value}">${tr(label)}</option>`).join('')}</select></label></div>
    <label class="checkbox"><input type="checkbox" data-field="dashed" ${r.dashed?'checked':''}/>${tr('使用虚线引线')}</label>
  </div><div class="property-section leader-section">
    <div class="section-label">${tr('引线与对齐')}</div><p>${tr('拖动圆点改变引出位置；拖动菱形或虚线调整折线。')}</p>
    <label class="checkbox"><input id="snap-toggle" type="checkbox" ${snapEnabled?'checked':''}/>${tr('吸附对齐辅助线')}</label>
    <button id="reset-leader" class="button wide">${tr('恢复自动引线')}</button>
  </div><div class="property-actions"><button id="duplicate" class="button">${icon('copy')}${tr('复制')}</button><button id="delete" class="button danger">${icon('trash')}${tr('删除')}</button></div><p class="property-tip">${tr('按住 Alt 拖动可暂时关闭吸附。')}<br>${tr('方向键微调区域，Shift 加速。')}</p>`;
}
function renderCanvas(){
  if(!doc)return;
  canvas.setAttribute('viewBox',`${view.x} ${view.y} ${view.width} ${view.height}`);
  const unit=view.width/Math.max(canvas.clientWidth,1),h=unit*7,t=imageTransform(doc.image);
  canvas.innerHTML=`<defs><filter id="paper-shadow" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="12" stdDeviation="22" flood-color="#253d30" flood-opacity=".08"/></filter></defs><rect x="0" y="0" width="${t.width}" height="${t.height}" fill="white" filter="url(#paper-shadow)"/><image href="${previewURL}" width="${doc.image.width}" height="${doc.image.height}" transform="${t.matrix}" draggable="false"/><g>${doc.regions.map(r=>{
    const b=labelBounds(r,doc.image);
    return `<g data-region="${esc(r.id)}">${annotationMarkup(r,showLabels,doc.image)}<${r.kind==='ellipse'?'ellipse':'rect'} ${r.kind==='ellipse'?`cx="${r.x+r.w/2}" cy="${r.y+r.h/2}" rx="${r.w/2}" ry="${r.h/2}"`:`x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"`} data-hit="region" fill="transparent" transform="${t.matrix}" style="cursor:move"/>${showLabels?`<polyline data-hit="leader" points="${labelLayout(r,doc.image).points}" stroke="transparent" stroke-width="${unit*12}" fill="none" style="cursor:move;pointer-events:stroke"/><rect data-hit="label" x="${b.x-unit*5}" y="${b.y-unit*5}" width="${b.w+unit*10}" height="${b.h+unit*10}" fill="transparent" style="cursor:move"/>`:''}</g>`;
  }).join('')}</g>`;
  const r=selectedRegion();
  if(r&&tool==='select'){
    const handles=[['nw',r.x,r.y],['n',r.x+r.w/2,r.y],['ne',r.x+r.w,r.y],['e',r.x+r.w,r.y+r.h/2],['se',r.x+r.w,r.y+r.h],['s',r.x+r.w/2,r.y+r.h],['sw',r.x,r.y+r.h],['w',r.x,r.y+r.h/2]];
    const a=labelLayout(r,doc.image);
    canvas.insertAdjacentHTML('beforeend',`<g data-region="${esc(r.id)}"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" transform="${t.matrix}" stroke="#527d52" stroke-width="${unit/(doc.image.scale??1)}" stroke-dasharray="${unit*3} ${unit*3}" pointer-events="none"/>${handles.map(([handle,x,y])=>{const p=toStage({x,y},doc.image);return `<rect data-handle="${handle}" x="${p.x-h/2}" y="${p.y-h/2}" width="${h}" height="${h}" rx="${unit}" fill="white" stroke="#527d52" stroke-width="${unit*1.2}" style="cursor:${handle}-resize"/>`;}).join('')}${showLabels?`<circle data-hit="anchor" cx="${a.ax}" cy="${a.ay}" r="${unit*5}" fill="#f4f8e9" stroke="#527d52" stroke-width="${unit*1.6}" style="cursor:crosshair"><title>${tr('拖动引线起点')}</title></circle><rect data-hit="leader" x="${a.bend.x-unit*4}" y="${a.bend.y-unit*4}" width="${unit*8}" height="${unit*8}" transform="rotate(45 ${a.bend.x} ${a.bend.y})" fill="#527d52" stroke="white" stroke-width="${unit}" style="cursor:${a.horizontal?'ew-resize':'ns-resize'}"><title>${tr('拖动虚线折点')}</title></rect>`:''}</g>`);
  }
  if(gesture?.type==='draw'&&gesture.preview){const p=gesture.preview;canvas.insertAdjacentHTML('beforeend',shapeMarkup({...p,kind:gesture.kind,color:'#628652',stroke:unit*2/(doc.image.scale??1),radius:0},`transform="${t.matrix}" stroke-dasharray="${unit*5} ${unit*3}"`));}
  for(const guide of guides)canvas.insertAdjacentHTML('beforeend',guide.axis==='x'?`<line x1="${guide.value}" x2="${guide.value}" y1="${view.y}" y2="${view.y+view.height}" stroke="#759557" stroke-width="${unit}" stroke-dasharray="${unit*4} ${unit*4}" pointer-events="none"/>`:`<line y1="${guide.value}" y2="${guide.value}" x1="${view.x}" x2="${view.x+view.width}" stroke="#759557" stroke-width="${unit}" stroke-dasharray="${unit*4} ${unit*4}" pointer-events="none"/>`);
  $('#zoom-value').textContent=`${Math.round(fitView.width/view.width*100)}%`;
}
function snapPoint(original,ignoreId,disabled=false){
  guides=[];if(!snapEnabled||disabled)return original;const p=toStage(original,doc.image),t=imageTransform(doc.image),threshold=view.width/Math.max(canvas.clientWidth,1)*7;
  const candidates=[{x:t.width/2,y:t.height/2}];
  for(const r of doc.regions){const a=labelLayout(r,doc.image);candidates.push({x:a.ax,y:a.ay});if(r.id!==ignoreId)candidates.push({x:a.labelX,y:a.labelY},a.bend);}
  for(const axis of ['x','y']){let nearest=null,distance=threshold;for(const c of candidates){const d=Math.abs(c[axis]-p[axis]);if(d<distance){distance=d;nearest=c[axis];}}if(nearest!==null){p[axis]=nearest;guides.push({axis,value:nearest});}}
  return fromStage(p,doc.image);
}
function fit(){if(!doc)return;const b=exportBounds(doc),padding=Math.max(b.width*.065,1); view={x:b.x-padding,y:b.y-padding,width:b.width+padding*2,height:b.height+padding*2};fitView={...view};renderCanvas();}
function applyDocument(next,faces=[]){finishGesture(true);for(const face of activeFontFaces)document.fonts.delete(face);activeFontFaces=faces;for(const face of faces)document.fonts.add(face);previewSource(next.image);doc=next;exportSettings={background:'white',scale:1,...next.exportSettings};selected=doc.regions[0]?.id||null;history=[];future=[];dirty=false;$('#image-name').textContent=doc.image.name;$('#image-size').textContent=`${doc.image.width} × ${doc.image.height} px`;$('#canvas-caption').textContent=doc.name;$('#coordinate').textContent=$('#image-size').textContent;setTool('select');fit();render();status('已载入 · {count} 个标注区域',{count:doc.regions.length});}
async function decodeImage(src){const image=new Image();image.src=src;await image.decode();if(!image.naturalWidth||image.naturalWidth>16000||image.naturalHeight>16000||image.naturalWidth*image.naturalHeight>64000000)throw new Error('图片过大，最多支持 6400 万像素，单边不超过 16000 像素。');return image;}
const readDataURL=blob=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('无法读取文件。'));reader.readAsDataURL(blob);});
async function loadDemo(){ finishGesture(true);const token=++operation;setLoading(true);try { const response=await fetch(new URL('../public/demo-board.png',import.meta.url));if(!response.ok)throw new Error('示例图片读取失败');const src=await readDataURL(await response.blob());const image=await decodeImage(src);if(token!==operation)return;applyDocument({name:'接口标注示例',image:{src,name:'接口标注示例.png',width:image.naturalWidth,height:image.naturalHeight},regions:demoRegions()});}catch(error){toast(error.message);}finally{if(token===operation)setLoading(false);} }
for(const button of document.querySelectorAll('[data-tool]')) button.onclick=()=>{finishGesture(true);setTool(button.dataset.tool);renderCanvas();};
$('#region-list').onclick=event=>{const b=event.target.closest('[data-select]');if(b)select(b.dataset.select);};
$('#fit').onclick=fit;
$('#add-region').onclick=()=>{finishGesture(true);setTool('rect');renderCanvas();};
new ResizeObserver(()=>renderCanvas()).observe($('#canvas-wrap'));
loadDemo();
function point(event){const matrix=canvas.getScreenCTM();return matrix?new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse()):{x:0,y:0};}
function zoom(factor,center){if(!doc)return;const next=clamp(view.width/factor,fitView.width/8,fitView.width*2),ratio=next/view.width;const p=center||{x:view.x+view.width/2,y:view.y+view.height/2};view={x:p.x+(view.x-p.x)*ratio,y:p.y+(view.y-p.y)*ratio,width:next,height:view.height*ratio};renderCanvas();}
$('#zoom-in').onclick=()=>zoom(1.25);$('#zoom-out').onclick=()=>zoom(.8);
canvas.addEventListener('wheel',event=>{if(loading)return;event.preventDefault();if(!gesture)zoom(event.deltaY<0?1.12:1/1.12,point(event));},{passive:false});
canvas.addEventListener('contextmenu',event=>event.preventDefault());
function beginGesture(state,event){gesture={...state,pointerId:event.pointerId,button:event.button};canvas.setPointerCapture(event.pointerId);updatePanCursor();}
canvas.addEventListener('pointerdown',event=>{
  if(!doc||loading||gesture||event.button<0||event.button>2||event.isPrimary===false)return;
  event.preventDefault();canvas.focus();const p=fromStage(point(event),doc.image);
  if(tool==='pan'||space||event.button===1||event.button===2){beginGesture({type:'pan',clientX:event.clientX,clientY:event.clientY,view:{...view},matrix:canvas.getScreenCTM().inverse()},event);return;}
  if(tool==='rect'||tool==='ellipse'){
    if(doc.regions.length>=300){toast('最多支持 300 个标注区域。');return;}
    if(p.x<0||p.y<0||p.x>doc.image.width||p.y>doc.image.height)return;
    beginGesture({type:'draw',kind:tool,start:p,preview:null},event);return;
  }
  const target=event.target.closest('[data-region]');
  if(target){selected=target.dataset.region;const r=selectedRegion();beginGesture({type:event.target.dataset.handle?'resize':['label','anchor','leader'].includes(event.target.dataset.hit)?event.target.dataset.hit:'move',handle:event.target.dataset.handle,start:p,region:structuredClone(r),before:snapshot()},event);render();}
  else {selected=null;render();}
});
canvas.addEventListener('pointermove',event=>{
  if(!doc||loading)return;const p=fromStage(point(event),doc.image);
  $('#coordinate').textContent=`X ${Math.round(p.x)} · Y ${Math.round(p.y)} px`;
  if(!gesture||event.pointerId!==gesture.pointerId)return;
  if(!(event.buttons&[1,4,2][gesture.button])){finishGesture();return;}
  if(gesture.type==='pan'){
    const delta=new DOMPoint(event.clientX-gesture.clientX,event.clientY-gesture.clientY).matrixTransform(new DOMMatrix([gesture.matrix.a,gesture.matrix.b,gesture.matrix.c,gesture.matrix.d,0,0]));
    view={...gesture.view,x:gesture.view.x-delta.x,y:gesture.view.y-delta.y};renderCanvas();return;
  }
  if(gesture.type==='draw'){gesture.preview=rectangle(gesture.start,p,doc.image);renderCanvas();return;}
  const r=selectedRegion(),base=gesture.region,dx=p.x-gesture.start.x,dy=p.y-gesture.start.y;if(!r)return;
  if(gesture.type==='label'){const snapped=snapPoint({x:base.labelX+dx,y:base.labelY+dy},r.id,event.altKey);r.labelX=clamp(snapped.x,-doc.image.width*3,doc.image.width*3);r.labelY=clamp(snapped.y,-doc.image.height*3,doc.image.height*3);}
  else if(gesture.type==='anchor'){const snapped=snapPoint(p,r.id,event.altKey);Object.assign(r,nearestAnchor(r,snapped));}
  else if(gesture.type==='leader'){const snapped=snapPoint(p,r.id,event.altKey);r.bendX=clamp(snapped.x,-doc.image.width*3,doc.image.width*3);r.bendY=clamp(snapped.y,-doc.image.height*3,doc.image.height*3);}
  else if(gesture.type==='move'){guides=[];r.x=clamp(base.x+dx,0,doc.image.width-base.w);r.y=clamp(base.y+dy,0,doc.image.height-base.h);r.labelX=clamp(base.labelX+r.x-base.x,-doc.image.width*3,doc.image.width*3);r.labelY=clamp(base.labelY+r.y-base.y,-doc.image.height*3,doc.image.height*3);if(Number.isFinite(base.bendX)){r.bendX=clamp(base.bendX+r.x-base.x,-doc.image.width*3,doc.image.width*3);r.bendY=clamp(base.bendY+r.y-base.y,-doc.image.height*3,doc.image.height*3);}}
  else Object.assign(r,resizeRegion(base,gesture.handle,dx,dy,doc.image));
  renderCanvas();
});
function finishGesture(cancel=false){
  if(!gesture)return;const current=gesture;gesture=null;guides=[];
  if(canvas.hasPointerCapture(current.pointerId))canvas.releasePointerCapture(current.pointerId);
  updatePanCursor();
  if(cancel){if(current.before)restore(current.before);else if(current.type==='pan')view=current.view;render();return;}
  if(current.type==='draw'&&current.preview){
    const p=current.preview,min=view.width/Math.max(canvas.clientWidth,1)*4/(doc.image.scale??1);
    if(p.w>=Math.max(1,min)&&p.h>=Math.max(1,min)){
      checkpoint();const fontSize=clamp(Math.round(doc.image.width*.012),14,120);let number=1;while(doc.regions.some(r=>r.code===`J${number}`))number++;
      const r={...p,id:crypto.randomUUID(),code:`J${number}`,title:tr('新标签'),kind:current.kind,fontFamily:'sans',textColor:null,anchorSide:'auto',anchorOffset:.5,bendX:null,bendY:null,color:'#ef4444',stroke:clamp(Math.round(doc.image.width*.002),2,30),fontSize,radius:Math.round(fontSize*.45),dashed:true,labelX:Math.min(doc.image.width*3,p.x+p.w+fontSize*2),labelY:p.y+p.h/2};doc.regions.push(r);selected=r.id;setTool('select');status('已添加 {code} · 可在右侧设置标签',{code:r.code});
    }
  } else if(current.before&&JSON.stringify(current.before)!==JSON.stringify(snapshot()))checkpoint(current.before);
  render();
}
canvas.addEventListener('pointerup',event=>{if(event.pointerId===gesture?.pointerId)finishGesture();});
// Mouse pointerup only fires after the final button is released; stop a chorded drag at its own button's release.
canvas.addEventListener('mouseup',event=>{if(gesture&&event.button===gesture.button)finishGesture();});
canvas.addEventListener('pointercancel',event=>{if(event.pointerId===gesture?.pointerId)finishGesture(true);});
canvas.addEventListener('lostpointercapture',event=>{if(event.pointerId===gesture?.pointerId)finishGesture(true);});
function restoreHistory(state){const transformChanged=state.scale!==(doc.image.scale??1)||state.rotation!==(doc.image.rotation??0);restore(state);if(transformChanged)fit();selected=doc.regions.some(r=>r.id===selected)?selected:doc.regions.at(-1)?.id||null;dirty=true;render();}
function undo(){if(loading)return;if(gesture){finishGesture(true);status('已取消当前拖动');return;}if(!history.length)return;future.push(snapshot());restoreHistory(history.pop());status('已撤销');}
function redo(){if(loading)return;if(gesture){finishGesture(true);status('已取消当前拖动');return;}if(!future.length)return;history.push(snapshot());restoreHistory(future.pop());status('已重做');}
function remove(){if(!selectedRegion()||loading)return;checkpoint();const index=doc.regions.findIndex(r=>r.id===selected);doc.regions.splice(index,1);selected=doc.regions[Math.min(index,doc.regions.length-1)]?.id||null;render();status('已删除区域 · 可撤销');}
function duplicate(){const r=selectedRegion();if(!r||loading)return;if(doc.regions.length>=300){toast('最多支持 300 个标注区域。');return;}checkpoint();const offset=Math.max(10,doc.image.width*.02),x=clamp(r.x+offset,0,doc.image.width-r.w),y=clamp(r.y+offset,0,doc.image.height-r.h);const copy={...r,id:crypto.randomUUID(),code:(r.code+tr(' 副本')).slice(0,40),x,y,labelX:clamp(r.labelX+x-r.x,-doc.image.width*3,doc.image.width*3),labelY:clamp(r.labelY+y-r.y,-doc.image.height*3,doc.image.height*3)};if(Number.isFinite(r.bendX)){copy.bendX=clamp(r.bendX+x-r.x,-doc.image.width*3,doc.image.width*3);copy.bendY=clamp(r.bendY+y-r.y,-doc.image.height*3,doc.image.height*3);}doc.regions.push(copy);selected=copy.id;render();}
$('#undo').onclick=undo;$('#redo').onclick=redo;
$('#toggle-labels').onclick=()=>{showLabels=!showLabels;$('#toggle-labels').setAttribute('aria-pressed',String(showLabels));$('#toggle-labels').title=showLabels?tr('隐藏标签'):tr('显示标签');renderCanvas();};
let fieldStart=null;
$('#properties').addEventListener('focusin',event=>{if(event.target.dataset.field)fieldStart={element:event.target,before:snapshot(),committed:false};});
$('#properties').addEventListener('input',event=>{
  const field=event.target,key=field.dataset.field;if(loading||!['code','title','textColor','color'].includes(key)||!selectedRegion())return;
  if(!fieldStart||fieldStart.element!==field)fieldStart={element:field,before:snapshot(),committed:false};
  if(!fieldStart.committed){checkpoint(fieldStart.before);fieldStart.committed=true;}
  selectedRegion()[key]=field.value;renderCanvas();renderList();
});
$('#properties').addEventListener('change',event=>{
  if(loading)return;const field=event.target,key=field.dataset.field,r=selectedRegion();if(!r)return;
  if(field.id==='snap-toggle'){snapEnabled=field.checked;return;}
  if(field.id==='label-side'){
    const corners=[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x,y:r.y+r.h},{x:r.x+r.w,y:r.y+r.h}].map(p=>toStage(p,doc.image));
    const left=Math.min(...corners.map(p=>p.x)),right=Math.max(...corners.map(p=>p.x)),top=Math.min(...corners.map(p=>p.y)),bottom=Math.max(...corners.map(p=>p.y)),distance=r.fontSize*(doc.image.scale??1)*2.5;
    const positions={left:{x:left-distance,y:(top+bottom)/2},right:{x:right+distance,y:(top+bottom)/2},top:{x:(left+right)/2,y:top-distance-r.fontSize*(doc.image.scale??1)},bottom:{x:(left+right)/2,y:bottom+distance}};
    if(positions[field.value]){const p=fromStage(positions[field.value],doc.image);commitRegion({labelX:clamp(p.x,-doc.image.width*3,doc.image.width*3),labelY:clamp(p.y,-doc.image.height*3,doc.image.height*3),bendX:null,bendY:null});}return;
  }
  if(!key||['code','title'].includes(key))return;
  if(['color','textColor'].includes(key)&&fieldStart?.committed){renderProperties();return;}
  const value=['color','textColor','fontFamily'].includes(key)?field.value:key==='dashed'?field.checked:Number(field.value);
  const candidate={...r,[key]:value};
  try {if(field.type==='number'&&(!field.value.trim()||!field.checkValidity()))throw new Error('请输入范围内的有效数值。');validateProject({format:'open-interface-mark',version:1,...doc,regions:[candidate]});commitRegion({[key]:value});}
  catch(error){toast(error.message);field.value=r[key];}
});
$('#properties').onclick=event=>{const b=event.target.closest('button');if(!b||loading)return;if(b.dataset.color)commitRegion({color:b.dataset.color});if(b.id==='load-font')$('#font-input').click();if(b.id==='duplicate')duplicate();if(b.id==='delete')remove();if(b.id==='reset-leader')commitRegion({anchorSide:'auto',anchorOffset:.5,bendX:null,bendY:null});};
window.addEventListener('keydown',event=>{
  if(event.defaultPrevented||event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),dialog')||document.querySelector('dialog[open]')||event.isComposing)return;
  if(event.key==='Escape'){event.preventDefault();finishGesture(true);setTool('select');renderCanvas();return;}
  if(event.key==='?'&&!event.metaKey&&!event.ctrlKey&&!event.altKey){event.preventDefault();openShortcuts();return;}
  if(!doc||loading)return;
  if((event.metaKey||event.ctrlKey)&&!event.altKey&&event.key.toLowerCase()==='z'){event.preventDefault();if(!event.repeat)event.shiftKey?redo():undo();return;}
  if((event.metaKey||event.ctrlKey)&&!event.altKey&&event.key.toLowerCase()==='y'){event.preventDefault();if(!event.repeat)redo();return;}
  if((event.metaKey||event.ctrlKey)&&!event.altKey&&!event.shiftKey&&['d','s'].includes(event.key.toLowerCase())){event.preventDefault();if(!event.repeat&&!gesture){event.key.toLowerCase()==='d'?duplicate():saveProject();}return;}
  if(event.metaKey||event.ctrlKey||event.altKey)return;
  if(event.code==='Space'){if(event.target.closest('button,a'))return;event.preventDefault();space=true;updatePanCursor();return;}
  const shortcuts={v:'select',r:'rect',e:'ellipse',h:'pan'};if(shortcuts[event.key.toLowerCase()]){event.preventDefault();finishGesture(true);setTool(shortcuts[event.key.toLowerCase()]);renderCanvas();return;}
  if(gesture){if(['Delete','Backspace','0','+','=','-','_'].includes(event.key)||event.key.startsWith('Arrow'))event.preventDefault();return;}
  if(event.key==='Delete'||event.key==='Backspace'){event.preventDefault();remove();}
  if(event.key==='0')fit();
  if(['+','=','-','_'].includes(event.key)){event.preventDefault();zoom(['+','='].includes(event.key)?1.25:.8);}
  const r=selectedRegion();if(r&&event.key.startsWith('Arrow')){event.preventDefault();const step=event.shiftKey?10:1,p=toStage({x:r.x,y:r.y},doc.image);p.x+=event.key==='ArrowRight'?step:event.key==='ArrowLeft'?-step:0;p.y+=event.key==='ArrowDown'?step:event.key==='ArrowUp'?-step:0;const next=fromStage(p,doc.image),x=clamp(next.x,0,doc.image.width-r.w),y=clamp(next.y,0,doc.image.height-r.h);commitRegion({x,y,...(Number.isFinite(r.bendX)?{bendX:clamp(r.bendX+x-r.x,-doc.image.width*3,doc.image.width*3),bendY:clamp(r.bendY+y-r.y,-doc.image.height*3,doc.image.height*3)}:{}),labelX:clamp(r.labelX+x-r.x,-doc.image.width*3,doc.image.width*3),labelY:clamp(r.labelY+y-r.y,-doc.image.height*3,doc.image.height*3)});}
});
window.addEventListener('keyup',event=>{if(event.code==='Space'){space=false;updatePanCursor();}});
window.addEventListener('blur',()=>{space=false;finishGesture(true);updatePanCursor();});
function openShortcuts(){finishGesture(true);space=false;updatePanCursor();$('#shortcuts-dialog').showModal();}
$('#shortcuts-button').onclick=openShortcuts;
function download(blob,name){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
const safeName=()=>doc.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,100)||'OpenInterfaceMark';
function saveProject(){if(!doc)return;doc.exportSettings={...exportSettings};download(new Blob([projectJSON(doc)],{type:'application/json'}),`${safeName()}.oim.json`);dirty=false;toast('项目已下载，可通过 JSON 恢复图片与标注。');}
async function allowReplace(){
  if(!dirty)return true;const dialog=$('#confirm-dialog');if(dialog.open)return false;dialog.returnValue='cancel';dialog.showModal();
  const value=await new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true}));
  if(value==='save'){saveProject();return true;}return value==='replace';
}
async function importFile(file){
  if(!file)return;finishGesture(true);const token=++operation;setLoading(true);
  try {
    let next,faces=[];
    if(file.name.toLowerCase().endsWith('.json')||file.type==='application/json'){
      if(file.size>160000000)throw new Error('项目文件过大，最大支持 160 MB。');
      let data;try{data=JSON.parse(await file.text());}catch{throw new Error('无法解析 JSON，请选择有效的项目文件。');}
      next=validateProject(data);const image=await decodeImage(next.image.src);if(image.naturalWidth!==next.image.width||image.naturalHeight!==next.image.height)throw new Error('项目声明的尺寸与内嵌图片不一致。');faces=await prepareFontFaces(next.fonts);
    } else {
      if(!['image/png','image/jpeg','image/webp'].includes(file.type))throw new Error('请选择 PNG、JPEG、WebP 图片或项目 JSON。');
      if(file.size>32000000)throw new Error('图片文件过大，最大支持 32 MB。');
      const src=await readDataURL(file),image=await decodeImage(src);next={name:file.name.replace(/\.[^.]+$/,'').slice(0,120),image:{src,name:file.name.slice(0,240),width:image.naturalWidth,height:image.naturalHeight},regions:[]};
    }
    if(token!==operation)return;if(!await allowReplace()||token!==operation)return;
    applyDocument(next,faces);toast(next.regions.length?'项目已恢复。':'图片已载入，按 R 开始框选。');
  }catch(error){if(token===operation)toast(error.message||'文件读取失败，当前项目已保留。');}
  finally{if(token===operation)setLoading(false);}
}
$('#image-button').onclick=()=>$('#image-input').click();
$('#image-input').onchange=event=>{importFile(event.target.files[0]);event.target.value='';};
$('#project-input').onchange=event=>{importFile(event.target.files[0]);event.target.value='';};
$('#project-button').onclick=()=>$('#project-dialog').showModal();
$('#save-project').onclick=saveProject;
$('#open-project').onclick=()=>{$('#project-dialog').close();$('#project-input').click();};
$('#demo-button').onclick=async()=>{if(await allowReplace())loadDemo();};
let dragDepth=0;
window.addEventListener('dragover',event=>{event.preventDefault();});
window.addEventListener('drop',event=>{event.preventDefault();dragDepth=0;$('#canvas-wrap').classList.remove('drag-over');const files=event.dataTransfer.files;if(files.length>1){toast('请一次导入一张图片或一个项目。');return;}importFile(files[0]);});
$('#canvas-wrap').addEventListener('dragenter',event=>{event.preventDefault();dragDepth++;$('#canvas-wrap').classList.add('drag-over');});
$('#canvas-wrap').addEventListener('dragleave',()=>{if(--dragDepth<=0)$('#canvas-wrap').classList.remove('drag-over');});
window.addEventListener('paste',event=>{if(event.target.closest('input,textarea,select'))return;const file=[...event.clipboardData.items].find(i=>i.kind==='file'&&i.type.startsWith('image/'))?.getAsFile();if(file){event.preventDefault();importFile(file);}});
let exportOperation=0;
$('#export-dialog').addEventListener('close',()=>exportOperation++);
function updateExportDialog(preview=false,skip){
  const format=$('input[name="format"]:checked').value,b=exportBounds(doc),size=exportDimensions(b,exportSettings.scale,format);
  $('#download-export').textContent=tr('下载 {format}',{format:format.toUpperCase()});
  if(skip!=='export-scale')$('#export-scale').value=Number((exportSettings.scale*100).toFixed(3));
  if(skip!=='export-width')$('#export-width').value=size.width;$('#export-width').max=b.width;if(skip!=='export-height')$('#export-height').value=size.height;$('#export-height').max=b.height;
  $('#export-background').value=format==='jpg'?'white':exportSettings.background;$('#export-background').disabled=format==='jpg';$('#transparent-note').hidden=format==='jpg'||exportSettings.background!=='transparent';
  $('#export-note').textContent=tr('{width} × {height} px · 等比缩小 · 最大 {maxWidth} × {maxHeight} px',{width:size.width,height:size.height,maxWidth:b.width,maxHeight:b.height})+(size.capped?tr(' · 已按浏览器画布上限缩小'):'');
  if(format==='jpg')$('#export-note').textContent+=tr(' · JPG 白色背景');
  if(preview)$('#export-preview').innerHTML=exportSVG({...doc,image:{...doc.image,src:previewURL}},{...exportSettings,background:format==='jpg'?'white':exportSettings.background,format});
}
$('#export-button').onclick=()=>{if(!doc||loading)return;updateExportDialog(true);$('#export-dialog').showModal();};
for(const radio of document.querySelectorAll('input[name="format"]'))radio.onchange=()=>{exportOperation++;updateExportDialog(true);};
for(const field of document.querySelectorAll('.export-settings input,.export-settings select'))field.oninput=field.onchange=event=>{
  exportOperation++;const b=exportBounds(doc);
  if(field.id==='export-background')exportSettings.background=field.value;
  else {const value=Number(field.value);let scale=field.id==='export-scale'?value/100:field.id==='export-width'?value/b.width:value/b.height;
    if((!field.value.trim()||!Number.isFinite(scale)||scale<=0||scale>1)&&event.type==='input')return;
    if(!field.value.trim()||!Number.isFinite(scale)||scale<=0||scale>1){toast('导出仅支持等比缩小，请输入不超过原尺寸的数值。');updateExportDialog();return;}
    exportSettings.scale=scale;
  }
  doc.exportSettings={...exportSettings};dirty=true;updateExportDialog(true,field.id);
};
$('#download-export').onclick=async()=>{
  if([...document.querySelectorAll('.export-settings input')].some(i=>!i.value.trim()||!i.checkValidity())){toast('请先输入有效的导出尺寸，尺寸不能超过原图标注范围。');return;}
  const exportToken=++exportOperation,button=$('#download-export'),current=doc,format=$('input[name="format"]:checked').value;
  const settings={...exportSettings,background:format==='jpg'?'white':exportSettings.background},size=exportDimensions(exportBounds(doc),settings.scale,format),name=safeName();button.disabled=true;button.textContent=tr('正在生成文件…');let url;
  try {
    const exportDoc=structuredClone(doc);
    const svg=exportSVG(exportDoc,{...settings,format,excludeText:format!=='svg'});
    if(format==='svg')download(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}),`${name}-${tr('标注')}.svg`);
    else {
      const image=new Image();url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));image.src=url;await image.decode();
      if(exportToken!==exportOperation||!$('#export-dialog').open)return;
      const output=document.createElement('canvas');output.width=size.width;output.height=size.height;const ctx=output.getContext('2d');if(!ctx)throw new Error('浏览器无法创建导出画布，请尝试 SVG。');if(settings.background==='white'){ctx.fillStyle='#fff';ctx.fillRect(0,0,size.width,size.height);}ctx.drawImage(image,0,0,size.width,size.height);
      const bounds=exportBounds(exportDoc),k=Math.min(size.width/bounds.width,size.height/bounds.height),ox=(size.width-bounds.width*k)/2,oy=(size.height-bounds.height*k)/2;
      ctx.save();ctx.translate(ox-bounds.x*k,oy-bounds.y*k);ctx.scale(k,k);ctx.textBaseline='alphabetic';
      for(const r of exportDoc.regions){const a=labelLayout(r,exportDoc.image);ctx.font=`600 ${a.fontSize}px ${fontFamilyCSS(r.fontFamily)}`;ctx.fillStyle=r.textColor||r.color;ctx.textAlign=a.align==='middle'?'center':a.align;ctx.fillText(r.code,a.labelX,a.labelY);ctx.fillText(r.title,a.labelX,a.labelY+a.fontSize*1.3);}ctx.restore();
      const blob=await new Promise(resolve=>output.toBlob(resolve,format==='jpg'?'image/jpeg':'image/png',.92));output.width=output.height=0;if(!blob)throw new Error('图片生成失败，请尝试 SVG。');if(exportToken!==exportOperation||!$('#export-dialog').open)return;if(current!==doc)throw new Error('项目已切换，请重新导出。');download(blob,`${name}-${tr('标注')}.${format}`);
    }
    $('#export-dialog').close();toast('{format} 标注图已下载。',{format:format.toUpperCase()});status('已导出 {format} · {width} × {height} px',{format:format.toUpperCase(),width:size.width,height:size.height});
  }catch(error){toast(error.message||'导出失败，请尝试 SVG。');}
  finally{if(url)URL.revokeObjectURL(url);button.disabled=false;updateExportDialog();}
};
$('#font-input').onchange=async event=>{
  const file=event.target.files[0];event.target.value='';if(!file||!doc)return;
  const current=doc,regionId=selected;
  try {
    const extension=file.name.split('.').pop().toLowerCase();if(!['ttf','otf','woff','woff2'].includes(extension))throw new Error('请选择 TTF、OTF、WOFF 或 WOFF2 字体。');
    if(file.size>32000000)throw new Error('单个字体最多 32 MB。');if((doc.fonts||[]).length>=8)throw new Error('项目最多加载 8 个本地字体。');
    const bytes=new Uint8Array(await file.arrayBuffer()),tag=String.fromCharCode(...bytes.slice(0,4));if(!(tag==='OTTO'||tag==='wOFF'||tag==='wOF2'||bytes[0]===0&&bytes[1]===1&&bytes[2]===0&&bytes[3]===0))throw new Error('字体文件签名无效。');
    const src=await readDataURL(new Blob([bytes],{type:`font/${extension}`}));const font={id:'font-'+crypto.randomUUID(),name:file.name.slice(0,120),src};
    validateProject({format:'open-interface-mark',version:1,...current,fonts:[...(current.fonts||[]),font]});
    const faces=await prepareFontFaces([font]);if(doc!==current)return;validateProject({format:'open-interface-mark',version:1,...doc,fonts:[...(doc.fonts||[]),font]});checkpoint();doc.fonts=[...(doc.fonts||[]),font];activeFontFaces.push(...faces);for(const face of faces)document.fonts.add(face);
    const r=doc.regions.find(r=>r.id===regionId);if(r)r.fontFamily=font.id;render();toast('已加载字体：{name}',{name:font.name});
  }catch(error){toast(error.message||'字体加载失败，原设置已保留。');}
};
let imageDraft={scale:1,rotation:0};
function updateImageDialog(skip){
  if(skip!=='image-width')$('#image-width').value=Math.max(1,Math.round(doc.image.width*imageDraft.scale));if(skip!=='image-height')$('#image-height').value=Math.max(1,Math.round(doc.image.height*imageDraft.scale));if(skip!=='image-scale')$('#image-scale').value=Number((imageDraft.scale*100).toFixed(3));if(skip!=='image-rotation')$('#image-rotation').value=Number(imageDraft.rotation.toFixed(2));
  $('#image-width').max=doc.image.width;$('#image-height').max=doc.image.height;
  const t=imageTransform({...doc.image,...imageDraft});$('#image-transform-note').textContent=tr('原图 {width} × {height} px；旋转后图片范围 {rotatedWidth} × {rotatedHeight} px。',{width:doc.image.width,height:doc.image.height,rotatedWidth:Math.ceil(t.width),rotatedHeight:Math.ceil(t.height)});
  $('#image-transform-preview').innerHTML=`<svg viewBox="0 0 ${t.width} ${t.height}" aria-label="${tr('图片变换预览')}"><image href="${previewURL}" width="${doc.image.width}" height="${doc.image.height}" transform="${t.matrix}"/></svg>`;
}
$('#image-settings-button').onclick=()=>{if(!doc||loading)return;finishGesture(true);imageDraft={scale:doc.image.scale??1,rotation:doc.image.rotation??0};updateImageDialog();$('#image-dialog').showModal();};
for(const input of document.querySelectorAll('#image-dialog input'))input.oninput=input.onchange=event=>{
  input.setCustomValidity('');const n=Number(input.value);if((!input.value.trim()||!Number.isFinite(n)||input.id==='image-rotation'&&(n < -180||n>180))&&event.type==='input')return;
  if(!input.value.trim()||!Number.isFinite(n)){toast('请输入有效数值。');updateImageDialog();return;}
  if(input.id==='image-rotation'){if(n < -180||n>180){toast('旋转角度须在 -180°–180° 之间。');updateImageDialog();return;}imageDraft.rotation=n;}
  else {const scale=input.id==='image-scale'?n/100:input.id==='image-width'?n/doc.image.width:n/doc.image.height;if((scale<.05||scale>1)&&event.type==='input'){input.setCustomValidity(tr('图片比例须在5%到100%之间'));return;}if(scale<.05||scale>1){toast('图片比例须在原图的 5%–100% 之间。放大查看请使用画布缩放。');updateImageDialog();return;}imageDraft.scale=scale;}
  updateImageDialog(input.id);
};
for(const button of document.querySelectorAll('[data-rotate]'))button.onclick=()=>{imageDraft.rotation=((imageDraft.rotation+Number(button.dataset.rotate)+540)%360)-180;updateImageDialog();};
$('#image-reset').onclick=()=>{imageDraft={scale:1,rotation:0};updateImageDialog();};
$('#apply-image').onclick=()=>{if([...document.querySelectorAll('#image-dialog input')].some(i=>!i.value.trim()||!i.checkValidity())){toast('请先输入范围内的图片尺寸和旋转角度。');return;}finishGesture(true);checkpoint();Object.assign(doc.image,imageDraft);fit();render();$('#image-dialog').close();status('图片 {scale}% · 旋转 {rotation}°',{scale:Math.round(imageDraft.scale*100),rotation:imageDraft.rotation});};
window.addEventListener('pagehide',event=>{if(!event.persisted){if(previewURL)URL.revokeObjectURL(previewURL);for(const face of activeFontFaces)document.fonts.delete(face);}});
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue='';}});
// Optional browser agent interface. Shares validation, undo and visible UI state.
const modelContext=document.modelContext;
if(modelContext?.registerTool){
  const lifecycle=new AbortController();
  const register=tool=>{try{Promise.resolve(modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Unsupported experimental implementation: the editor remains usable. */}};
  register({name:'list_annotations',title:'查看图片标注',description:'读取当前图片尺寸及所有标注区域，不返回图片内容。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute(){if(!doc||loading)throw new Error(tr('图片尚未准备好'));return {name:doc.name,image:{width:doc.image.width,height:doc.image.height},regions:structuredClone(doc.regions)};}});
  register({name:'update_annotation',title:'修改已有标注',description:'按 ID 修改当前图片上的一个已有区域或标签，更新画布并可撤销。所有尺寸与坐标均为原图像素。',inputSchema:{type:'object',properties:{id:{type:'string'},changes:{type:'object',properties:{code:{type:'string'},title:{type:'string'},x:{type:'number'},y:{type:'number'},w:{type:'number'},h:{type:'number'},labelX:{type:'number'},labelY:{type:'number'},color:{type:'string'},fontSize:{type:'number'},stroke:{type:'number'},radius:{type:'number'},dashed:{type:'boolean'}},additionalProperties:false}},required:['id','changes'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute(input){
    if(!doc||loading||gesture)throw new Error(tr('请等待当前操作完成'));const r=doc.regions.find(r=>r.id===input?.id);if(!r||!input.changes||typeof input.changes!=='object'||Array.isArray(input.changes))throw new Error(tr('标注 ID 或修改内容无效'));
    const keys=['code','title','x','y','w','h','labelX','labelY','color','fontSize','stroke','radius','dashed','textColor','fontFamily','anchorSide','anchorOffset','bendX','bendY'];if(Object.keys(input.changes).some(k=>!keys.includes(k)))throw new Error(tr('包含不支持的字段'));
    const validated=validateProject({format:'open-interface-mark',version:1,...doc,regions:[{...r,...input.changes}]}).regions[0];checkpoint();Object.assign(r,validated);selected=r.id;render();return structuredClone(r);
  }});
  window.addEventListener('pagehide',event=>{if(!event.persisted)lifecycle.abort();});
}

function applyLocale() {
  document.documentElement.lang=getLocale();
  translateUI(document);
  $('#language-select').value=getLocale();
  $('#privacy-badge').innerHTML=icon('shield')+tr('图片仅在本地处理');
  $('#loading').textContent=tr('正在读取图片…');
  for(const button of document.querySelectorAll('[data-tool]')) button.setAttribute('aria-label',button.title);
  $('#toggle-labels').title=tr(showLabels?'隐藏标签':'显示标签');
  $('#toggle-labels').setAttribute('aria-label',tr('显示标签'));
  setTool(tool);
  $('#status').textContent=tr(statusMessage.key,statusMessage.values);
  if(toastMessage&&!$('#toast').hidden)$('#toast').textContent=tr(toastMessage.key,toastMessage.values);
  render();
  setLoading(loading);
  if(doc&&$('#export-dialog').open)updateExportDialog();
  if(doc&&$('#image-dialog').open)updateImageDialog();
}
$('#language-select').addEventListener('change',event=>{
  finishGesture(true);
  setLocale(event.target.value);
  const url=new URL(window.location.href);url.searchParams.set('lang',getLocale());
  window.history.replaceState(null,'',url);
  applyLocale();
});
applyLocale();
