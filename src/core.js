export const FORMAT = 'open-interface-mark';
export const COLORS = ['#ef4444', '#f97316', '#eab308', '#10b981', '#3b82f6', '#8b5cf6'];
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const escapeXML = value => String(value).replace(/[<>&"']/g, c => ({ '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&apos;' }[c]));
export function rectangle(a, b, image) {
  const x1 = clamp(a.x, 0, image.width), x2 = clamp(b.x, 0, image.width);
  const y1 = clamp(a.y, 0, image.height), y2 = clamp(b.y, 0, image.height);
  return { x:Math.min(x1,x2), y:Math.min(y1,y2), w:Math.abs(x2-x1), h:Math.abs(y2-y1) };
}
export function resizeRegion(r, handle, dx, dy, image) {
  let {x,y,w,h} = r;
  const right=x+w, bottom=y+h;
  if (handle.includes('w')) { x=clamp(x+dx,0,right-1); w=right-x; }
  if (handle.includes('e')) w=clamp(w+dx,1,image.width-x);
  if (handle.includes('n')) { y=clamp(y+dy,0,bottom-1); h=bottom-y; }
  if (handle.includes('s')) h=clamp(h+dy,1,image.height-y);
  return {x,y,w,h};
}
export const FONTS = {
  sans: {label:'默认黑体', family:"'PingFang SC', 'Microsoft YaHei', Arial, sans-serif"},
  serif: {label:'衬线 · 宋体', family:"Georgia, 'Songti SC', SimSun, serif"},
  mono: {label:'等宽字体', family:"'Courier New', 'PingFang SC', monospace"},
};
export const fontFaceName=id=>'OIM_'+id.replace(/[^a-zA-Z0-9_]/g,'_');
export const fontFamilyCSS=id=>FONTS[id||'sans']?.family||`'${fontFaceName(id)}', 'PingFang SC', 'Microsoft YaHei', sans-serif`;
let measureLabelText;
export function setTextMeasurer(fn){measureLabelText=fn;}
export function fontStyleMarkup(doc){
  const used=new Set(doc.regions.map(r=>r.fontFamily));
  const css=(doc.fonts||[]).filter(f=>used.has(f.id)).map(f=>`@font-face{font-family:'${fontFaceName(f.id)}';src:url('${f.src}');}`).join('');
  return css?`<style>${css}</style>`:'';
}
export function imageTransform(image) {
  const angle=(image.rotation||0)*Math.PI/180, scale=image.scale??1;
  const cos=Math.cos(angle),sin=Math.sin(angle);
  const a=(Math.abs(cos)<1e-12?0:cos)*scale,b=(Math.abs(sin)<1e-12?0:sin)*scale,c=-b,d=a;
  const xs=[0,a*image.width,c*image.height,a*image.width+c*image.height];
  const ys=[0,b*image.width,d*image.height,b*image.width+d*image.height];
  const e=-Math.min(...xs),f=-Math.min(...ys);
  return {a,b,c,d,e,f,width:Math.max(...xs)+e,height:Math.max(...ys)+f,matrix:`matrix(${a} ${b} ${c} ${d} ${e} ${f})`};
}
export function toStage(p,image) {if(!image)return {...p};const t=imageTransform(image);return {x:t.a*p.x+t.c*p.y+t.e,y:t.b*p.x+t.d*p.y+t.f};}
export function fromStage(p,image) {const t=imageTransform(image),det=t.a*t.d-t.b*t.c;return {x:(t.d*(p.x-t.e)-t.c*(p.y-t.f))/det,y:(-t.b*(p.x-t.e)+t.a*(p.y-t.f))/det};}
export function nearestAnchor(r,p) {
  const left={x:r.x,y:clamp(p.y,r.y,r.y+r.h)},right={x:r.x+r.w,y:clamp(p.y,r.y,r.y+r.h)},top={x:clamp(p.x,r.x,r.x+r.w),y:r.y},bottom={x:clamp(p.x,r.x,r.x+r.w),y:r.y+r.h};
  const choices=[['left',left,(left.y-r.y)/r.h],['right',right,(right.y-r.y)/r.h],['top',top,(top.x-r.x)/r.w],['bottom',bottom,(bottom.x-r.x)/r.w]];
  choices.sort((a,b)=>Math.hypot(a[1].x-p.x,a[1].y-p.y)-Math.hypot(b[1].x-p.x,b[1].y-p.y));return {anchorSide:choices[0][0],anchorOffset:choices[0][2]};
}
export function labelLayout(r,image) {
  const cx=r.x+r.w/2,cy=r.y+r.h/2,dx=r.labelX-cx,dy=r.labelY-cy;
  let side=r.anchorSide||'auto',ax,ay;
  if(side==='auto')side=Math.abs(dx)/(r.w/2)>Math.abs(dy)/(r.h/2)?(dx<0?'left':'right'):(dy<0?'top':'bottom');
  const offset=r.anchorSide&&r.anchorSide!=='auto'?(r.anchorOffset??.5):null;
  if(side==='left'||side==='right'){ax=side==='left'?r.x:r.x+r.w;ay=offset===null?clamp(r.labelY,r.y,r.y+r.h):r.y+r.h*offset;}
  else {ax=offset===null?clamp(r.labelX,r.x,r.x+r.w):r.x+r.w*offset;ay=side==='top'?r.y:r.y+r.h;}
  if(r.kind==='ellipse'){const theta=Math.atan2((ay-cy)/(r.h/2),(ax-cx)/(r.w/2));ax=cx+Math.cos(theta)*r.w/2;ay=cy+Math.sin(theta)*r.h/2;}
  const anchor=toStage({x:ax,y:ay},image),label=toStage({x:r.labelX,y:r.labelY},image),size=r.fontSize*(image?.scale??1);
  const horizontal=Math.abs(label.x-anchor.x)>Math.abs(label.y-anchor.y);
  const align=horizontal?(label.x<anchor.x?'end':'start'):'middle';
  const ex=label.x+(align==='end'?size*.35:align==='start'?-size*.35:0);
  const ey=label.y+(align==='middle'?(label.y<anchor.y?size*1.4:-size*.65):0);
  const manual=Number.isFinite(r.bendX)&&Number.isFinite(r.bendY)?toStage({x:r.bendX,y:r.bendY},image):null;
  const bend=horizontal?{x:manual?.x??(anchor.x+ex)/2,y:(anchor.y+ey)/2}:{x:(anchor.x+ex)/2,y:manual?.y??(anchor.y+ey)/2};
  const route=horizontal?[anchor,{x:bend.x,y:anchor.y},{x:bend.x,y:ey},{x:ex,y:ey}]:[anchor,{x:anchor.x,y:bend.y},{x:ex,y:bend.y},{x:ex,y:ey}];
  return {ax:anchor.x,ay:anchor.y,labelX:label.x,labelY:label.y,fontSize:size,align,horizontal,bend,route,points:route.map(p=>`${p.x},${p.y}`).join(' ')};
}
function textWidth(s,size) {return [...s].reduce((v,c)=>v+(/[\u0000-\u00ff]/.test(c)?1.15:1.3)*size,0);}
export function labelBounds(r,image) {
  const a=labelLayout(r,image);
  if(measureLabelText){
    let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity;
    for(const [i,text] of [r.code,r.title].entries()){
      const m=measureLabelText(text,a.fontSize,r.fontFamily||'sans'),x=a.labelX-(a.align==='end'?m.width:a.align==='middle'?m.width/2:0),y=a.labelY+i*a.fontSize*1.3;
      left=Math.min(left,x-m.left);right=Math.max(right,x+m.right);top=Math.min(top,y-m.ascent);bottom=Math.max(bottom,y+m.descent);
    }
    const pad=a.fontSize*.12;return {x:left-pad,y:top-pad,w:Math.max(right-left,1)+2*pad,h:Math.max(bottom-top,1)+2*pad};
  }
  const width=Math.max(textWidth(r.code,a.fontSize),textWidth(r.title,a.fontSize));
  return {x:a.labelX-(a.align==='end'?width:a.align==='middle'?width/2:0),y:a.labelY-a.fontSize*.95,w:width,h:a.fontSize*2.6};
}
export function exportBounds(doc) {
  const t=imageTransform(doc.image);let x=0,y=0,right=t.width,bottom=t.height;
  for(const r of doc.regions){const b=labelBounds(r,doc.image),a=labelLayout(r,doc.image),p=Math.max(r.stroke*3,r.fontSize*.3)*(doc.image.scale??1);x=Math.min(x,b.x-p,...a.route.map(v=>v.x-p));y=Math.min(y,b.y-p,...a.route.map(v=>v.y-p));right=Math.max(right,b.x+b.w+p,...a.route.map(v=>v.x+p));bottom=Math.max(bottom,b.y+b.h+p,...a.route.map(v=>v.y+p));
    for(const corner of [{x:r.x,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x+r.w,y:r.y},{x:r.x,y:r.y+r.h}]){const c=toStage(corner,doc.image);x=Math.min(x,c.x-p);y=Math.min(y,c.y-p);right=Math.max(right,c.x+p);bottom=Math.max(bottom,c.y+p);}
  }
  return {x:Math.floor(x),y:Math.floor(y),width:Math.ceil(right)-Math.floor(x),height:Math.ceil(bottom)-Math.floor(y)};
}
export function exportDimensions(bounds,scale=1,format='png') {
  if(!Number.isFinite(scale)||scale<=0||scale>1)throw new Error('导出比例必须大于 0 且不超过 100%，仅支持缩小。');
  const cap=format!=='svg'?Math.min(1,Math.sqrt(32000000/(bounds.width*bounds.height)),16000/Math.max(bounds.width,bounds.height)):1;
  const actual=Math.min(scale,cap);return {width:Math.max(1,Math.floor(bounds.width*actual+1e-8)),height:Math.max(1,Math.floor(bounds.height*actual+1e-8)),scale:actual,capped:actual<scale};
}
export function shapeMarkup(r,extra='') {
  const style=`fill="none" stroke="${r.color}" stroke-width="${r.stroke}" ${extra}`;
  return r.kind==='ellipse'?`<ellipse cx="${r.x+r.w/2}" cy="${r.y+r.h/2}" rx="${r.w/2}" ry="${r.h/2}" ${style}/>`:`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="${Math.min(r.radius,r.w/2,r.h/2)}" ${style}/>`;
}
export function annotationMarkup(r,labels=true,image) {
  const a=labelLayout(r,image),stroke=r.stroke*(image?.scale??1),font=fontFamilyCSS(r.fontFamily);
  return `${shapeMarkup(r,image?`transform="${imageTransform(image).matrix}"`:'')}${labels?`<polyline points="${a.points}" fill="none" stroke="${r.color}" stroke-width="${stroke*.7}" ${r.dashed?`stroke-dasharray="${stroke*1.4} ${stroke*1.8}"`:''}/><circle cx="${a.ax}" cy="${a.ay}" r="${stroke*2.2}" fill="white" stroke="${r.color}" stroke-width="${stroke*.7}"/><text x="${a.labelX}" y="${a.labelY}" text-anchor="${a.align}" fill="${r.textColor||r.color}" font-family="${escapeXML(font)}" font-size="${a.fontSize}" font-weight="600"><tspan x="${a.labelX}">${escapeXML(r.code)}</tspan><tspan x="${a.labelX}" dy="1.3em">${escapeXML(r.title)}</tspan></text>`:''}`;
}
export function exportSVG(doc,options={}) {
  const b=exportBounds(doc),size=exportDimensions(b,options.scale??1,options.format||'svg');
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="${b.x} ${b.y} ${b.width} ${b.height}"><title>${escapeXML(doc.name)} — OpenInterfaceMark</title>${options.excludeText?'':fontStyleMarkup(doc)}${options.background==='transparent'&&options.format!=='jpg'?'':`<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="white"/>`}<image href="${escapeXML(doc.image.src)}" x="0" y="0" width="${doc.image.width}" height="${doc.image.height}" transform="${imageTransform(doc.image).matrix}"/>${doc.regions.map(r=>(options.excludeText?annotationMarkup(r,true,doc.image).replace(/<text[\s\S]*?<\/text>/g,''):annotationMarkup(r,true,doc.image))).join('')}</svg>`;
}
export function validateProject(input) {
  const fail = message => { throw new Error(message); };
  if (!input || input.format!==FORMAT || input.version!==1) fail('不是受支持的 OpenInterfaceMark 项目（需要版本 1）。');
  const im=input.image;
  if (!im || !Number.isInteger(im.width) || !Number.isInteger(im.height) || im.width<1 || im.height<1 || im.width>16000 || im.height>16000 || im.width*im.height>64000000) fail('图片尺寸无效，最多支持 6400 万像素，单边不超过 16000 像素。');
  if(typeof im.src!=='string' || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(im.src) || im.src.length>45000000) fail('项目必须包含有效的 PNG、JPEG 或 WebP 图片。');
  if(im.scale!==undefined&&(!Number.isFinite(im.scale)||im.scale<.05||im.scale>1))fail('图片缩放比例须在 5%–100% 之间。');
  if(im.rotation!==undefined&&(!Number.isFinite(im.rotation)||im.rotation < -180||im.rotation>180))fail('图片旋转须在 -180°–180° 之间。');
  const str=(v,max)=>typeof v==='string' && v.length<=max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
  if(!str(input.name,120)||!str(im.name,240)) fail('项目名或文件名无效。');
  if(!Array.isArray(input.regions)||input.regions.length>300) fail('项目最多包含 300 个标注区域。');
  const fonts=input.fonts??[];if(!Array.isArray(fonts)||fonts.length>8)fail('项目最多加载 8 个本地字体。');const fontIds=new Set();let fontBytes=0;
  for(const f of fonts){if(!f||!/^font-[a-zA-Z0-9-]{1,64}$/.test(f.id)||fontIds.has(f.id)||!str(f.name,120)||typeof f.src!=='string'||!/^data:font\/(ttf|otf|woff|woff2);base64,[A-Za-z0-9+/]+=*$/.test(f.src)||f.src.length>43000000)fail('本地字体格式无效或文件过大。');fontIds.add(f.id);fontBytes+=f.src.length;}if(fontBytes>88000000)fail('本地字体总量超过限制（约 64 MB）。');
  if(input.exportSettings!==undefined){const e=input.exportSettings;if(!e||!['white','transparent'].includes(e.background)||!Number.isFinite(e.scale)||e.scale<=0||e.scale>1)fail('导出设置无效，只支持白色/透明背景与等比缩小。');}
  const ids=new Set();
  const regions=input.regions.map(r=>{
    if(!r || !str(r.id,100) || !r.id || ids.has(r.id) || !['rect','ellipse'].includes(r.kind) || !str(r.code,40) || !str(r.title,160) || !/^#[0-9a-f]{6}$/i.test(r.color) || typeof r.dashed!=='boolean') fail('标注格式、编号或颜色无效。');
    ids.add(r.id);
    for(const k of ['x','y','w','h','labelX','labelY','stroke','fontSize','radius']) if(!Number.isFinite(r[k])) fail('标注坐标必须是有限数值。');
    if(r.x<0||r.y<0||r.w<1||r.h<1||r.x+r.w>im.width+0.01||r.y+r.h>im.height+0.01||Math.abs(r.labelX)>im.width*3||Math.abs(r.labelY)>im.height*3||r.stroke<0.5||r.stroke>100||r.fontSize<4||r.fontSize>400||r.radius<0||r.radius>1000) fail('标注区域越界或样式数值超出范围。');
    if(r.fontFamily!==undefined&&!Object.hasOwn(FONTS,r.fontFamily)&&!fontIds.has(r.fontFamily))fail('不支持的标签字体。');
    if(r.textColor!==undefined&&r.textColor!==null&&!/^#[0-9a-f]{6}$/i.test(r.textColor))fail('标签颜色无效。');
    if(r.anchorSide!==undefined&&!['auto','left','right','top','bottom'].includes(r.anchorSide))fail('引线锚点方向无效。');
    if(r.anchorOffset!==undefined&&(!Number.isFinite(r.anchorOffset)||r.anchorOffset<0||r.anchorOffset>1))fail('引线锚点位置无效。');
    if((r.bendX==null)!==(r.bendY==null))fail('引线折点坐标不完整。');
    for(const [k,limit] of [['bendX',im.width*3],['bendY',im.height*3]])if(r[k]!==undefined&&r[k]!==null&&(!Number.isFinite(r[k])||Math.abs(r[k])>limit))fail('引线折点坐标超出范围。');
    return Object.fromEntries(['id','kind','code','title','color','dashed','x','y','w','h','labelX','labelY','stroke','fontSize','radius','fontFamily','textColor','anchorSide','anchorOffset','bendX','bendY'].filter(k=>r[k]!==undefined).map(k=>[k,r[k]]));
  });
  return {name:input.name,image:{name:im.name,width:im.width,height:im.height,src:im.src,...(im.scale!==undefined?{scale:im.scale}:{}),...(im.rotation!==undefined?{rotation:im.rotation}:{})},regions,...(input.fonts?{fonts:fonts.map(f=>({id:f.id,name:f.name,src:f.src}))}:{}),...(input.exportSettings?{exportSettings:{background:input.exportSettings.background,scale:input.exportSettings.scale}}:{})};
}
export function projectJSON(doc) { return JSON.stringify({format:FORMAT,version:1,...doc},null,2); }
export function demoRegions() {
  const defaults={kind:'rect',color:'#ef4444',stroke:12,fontSize:58,radius:32,dashed:true};
  return [
    {code:'J1',title:'MIPI DSI FPC',x:4530,y:1245,w:280,h:1265,labelX:5130,labelY:1640},
    {code:'J2',title:'MIPI CSI FPC',x:4075,y:1210,w:220,h:1345,labelX:5130,labelY:2020},
    {code:'J3',title:'FUSB接口',x:840,y:1990,w:440,h:550,labelX:565,labelY:2210},
    {code:'J4',title:'HUSB接口',x:840,y:1270,w:440,h:530,labelX:565,labelY:1510},
    {code:'J6',title:'排针接口',x:845,y:2570,w:4030,h:132,labelX:2850,labelY:3000,radius:12},
    {code:'J7',title:'排针接口',x:845,y:1070,w:4030,h:132,labelX:2850,labelY:685,radius:12},
  ].map((r,i)=>({...defaults,...r,id:`demo-${i+1}`}));
}
