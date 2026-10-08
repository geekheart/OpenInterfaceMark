import test from 'node:test';
import assert from 'node:assert/strict';
import { rectangle, resizeRegion, labelBounds, exportBounds, demoRegions, exportSVG, validateProject, projectJSON } from '../src/core.js';
const doc=()=>({name:'测试项目',image:{name:'board.png',src:'data:image/png;base64,AAAA',width:6000,height:3376},regions:demoRegions()});
test('从任意方向绘制并约束在原图内',()=>{assert.deepEqual(rectangle({x:200,y:100},{x:-30,y:500},{width:600,height:400}),{x:0,y:100,w:200,h:300});});
test('缩放越过对侧时保留正尺寸，禁止跨越原图',()=>{const r={x:20,y:30,w:50,h:60};assert.deepEqual(resizeRegion(r,'nw',200,200,{width:100,height:100}),{x:69,y:89,w:1,h:1});assert.deepEqual(resizeRegion(r,'se',200,200,{width:100,height:100}),{x:20,y:30,w:80,h:70});});
test('项目导出导入完整往返，包括样式与外置标签',()=>{const d=doc();d.regions[0].labelX=7000;d.regions[0].title='接口 <A&B> "中文"';assert.deepEqual(validateProject(JSON.parse(projectJSON(d))),d);});
test('拒绝非法版本、脚本图片、越界坐标、重复标识和非有限值',()=>{
  const cases=[d=>d.version=2,d=>d.image.src='data:image/svg+xml;base64,PHN2Zz4=',d=>d.regions[0].x=-1,d=>d.regions[0].w=6001,d=>d.regions[0].labelX=Infinity,d=>d.regions[0].id=d.regions[1].id,d=>d.regions[0].kind='select'];
  for(const mutate of cases){const d=JSON.parse(projectJSON(doc()));mutate(d);assert.throws(()=>validateProject(d));}
});
test('导入仅提取声明字段，忽略额外原型或状态字段',()=>{const d=JSON.parse(projectJSON(doc()));d.injected='bad';d.regions[0].hidden=true;const result=validateProject(d);assert.equal(result.injected,undefined);assert.equal(result.regions[0].hidden,undefined);});
test('四个方向的外置标签都包含在导出范围内',()=>{const d=doc();for(const [labelX,labelY] of [[-500,500],[7100,600],[500,-300],[4000,4500]]){d.regions[0].labelX=labelX;d.regions[0].labelY=labelY;const b=exportBounds(d),t=labelBounds(d.regions[0]);assert.ok(b.x<=t.x&&b.y<=t.y);assert.ok(b.x+b.width>=t.x+t.w&&b.y+b.height>=t.y+t.h);}});
test('SVG 内嵌原图，转义标签，不导出选中样式与交互节点',()=>{const d=doc();d.regions[0].title='A&B <script> "中文"';const svg=exportSVG(d);assert.ok(svg.includes('data:image/png;base64,AAAA'));assert.ok(svg.includes('A&amp;B &lt;script&gt; &quot;中文&quot;'));assert.ok(!svg.includes('<script>'));assert.ok(!svg.includes('data-handle'));assert.ok(!svg.includes('blob:'));assert.equal((svg.match(/<text /g)||[]).length,6);});
test('椭圆区域与最小有效图片可以保存恢复',()=>{const d=doc();d.regions[0].kind='ellipse';assert.ok(exportSVG(d).includes('<ellipse'));assert.deepEqual(validateProject(JSON.parse(projectJSON(d))),d);const empty={name:'1px',image:{name:'1.png',src:'data:image/png;base64,AAAA',width:1,height:1},regions:[]};assert.deepEqual(validateProject(JSON.parse(projectJSON(empty))),empty);});
test('外置宽字符标签保留足够的导出与命中空间',()=>{const d=doc(),r=d.regions[0];r.labelX=7000;r.code='WWWWWWWW';r.title='';const b=labelBounds(r),e=exportBounds(d);assert.ok(b.w>=r.code.length*r.fontSize);assert.ok(e.x+e.width>=r.labelX+b.w);});

import { imageTransform, toStage, fromStage, nearestAnchor, labelLayout, exportDimensions } from '../src/core.js';
test('任意旋转缩放的坐标变换可逆，90度交换精确尺寸',()=>{
  for(const rotation of [0,90,-90,180,33])for(const scale of [1,.5,.05]){const im={width:6000,height:3376,rotation,scale};for(const p of [{x:0,y:0},{x:6000,y:3376},{x:2481.2,y:1900.8}]){const q=fromStage(toStage(p,im),im);assert.ok(Math.abs(q.x-p.x)<1e-8&&Math.abs(q.y-p.y)<1e-8);}}
  assert.equal(imageTransform({width:6000,height:3376,rotation:90}).width,3376);
  assert.equal(imageTransform({width:6000,height:3376,rotation:90}).height,6000);
});
test('旋转后引线仍为正交路径，起点与原图区域同步',()=>{
  const d=doc(),r=d.regions[0];r.anchorSide='right';r.anchorOffset=.25;r.bendX=5400;r.bendY=2000;
  for(const rotation of [0,90,33,-45]){const im={...d.image,rotation,scale:.7},a=labelLayout(r,im),origin=toStage({x:r.x+r.w,y:r.y+r.h*.25},im);assert.equal(a.ax,origin.x);assert.equal(a.ay,origin.y);for(let i=1;i<a.route.length;i++){const p=a.route[i-1],q=a.route[i];assert.ok(p.x===q.x||p.y===q.y);}}
});
test('手动锚点投影到边界并随区域缩放保留比例',()=>{
  const r={x:100,y:100,w:200,h:100};assert.deepEqual(nearestAnchor(r,{x:99,y:125}),{anchorSide:'left',anchorOffset:.25});
  const a=labelLayout({...doc().regions[0],...r,anchorSide:'left',anchorOffset:.25});assert.equal(a.ax,100);assert.equal(a.ay,125);
});
test('带旋转、缩放、字体、文字颜色、折点与导出选项的项目可往返',()=>{
  const d=doc();d.image.scale=.65;d.image.rotation=33;d.exportSettings={scale:.5,background:'transparent'};Object.assign(d.regions[0],{fontFamily:'serif',textColor:'#335577',anchorSide:'top',anchorOffset:.42,bendX:6200,bendY:900});assert.deepEqual(validateProject(JSON.parse(projectJSON(d))),d);
  const old=doc();assert.deepEqual(validateProject(JSON.parse(projectJSON(old))),old);
});
test('透明SVG保留原图片并省略背景，白底SVG明确绘制背景',()=>{
  const d=doc();d.image.rotation=33;d.regions[0].fontFamily='mono';d.regions[0].textColor='#335577';
  const transparent=exportSVG(d,{background:'transparent',scale:.5}),white=exportSVG(d,{background:'white'});
  assert.ok(!transparent.includes('<rect x="'+exportBounds(d).x+'" y="'+exportBounds(d).y+'" width="'+exportBounds(d).width+'"'));assert.ok(white.includes('fill="white"/><image'));
  assert.ok(transparent.includes('data:image/png;base64,AAAA'));assert.ok(transparent.includes('Courier New'));assert.ok(transparent.includes('fill="#335577"'));assert.ok(!transparent.includes('pattern'));
  assert.ok(transparent.includes('transform="matrix('));assert.ok(!/<text[^>]*transform=/.test(transparent));
});
test('导出尺寸仅等比缩小，不允许放大且遵守PNG画布限制',()=>{
  const b={width:6000,height:3376};assert.deepEqual(exportDimensions(b,.5),{width:3000,height:1688,scale:.5,capped:false});assert.throws(()=>exportDimensions(b,1.01));assert.throws(()=>exportDimensions(b,0));
  const large=exportDimensions({width:20000,height:10000},1);assert.ok(large.width<=16000&&large.width*large.height<=32000000&&large.capped);
});
test('手动折点及旋转图片完整包含在导出范围',()=>{
  const d=doc();d.image.rotation=33;d.regions[0].bendX=-400;d.regions[0].bendY=4200;const b=exportBounds(d),t=imageTransform(d.image);assert.ok(b.x<=0&&b.y<=0&&b.x+b.width>=t.width&&b.y+b.height>=t.height);for(const p of labelLayout(d.regions[0],d.image).route)assert.ok(p.x>=b.x&&p.y>=b.y&&p.x<=b.x+b.width&&p.y<=b.y+b.height);
});
test('拒绝畸形变换、字体、锚点、折点和放大导出参数',()=>{
  for(const mutate of [d=>d.image.rotation=NaN,d=>d.image.scale=2,d=>d.regions[0].fontFamily='url(evil)',d=>d.regions[0].anchorOffset=2,d=>d.regions[0].bendX=12,d=>d.exportSettings={background:'transparent',scale:2}]){const d=JSON.parse(projectJSON(doc()));mutate(d);assert.throws(()=>validateProject(d));}
});

test('远离矩形拖动锚点时投影到最近有限边，而非无限延长线',()=>{assert.deepEqual(nearestAnchor({x:0,y:0,w:100,h:100},{x:300,y:50}),{anchorSide:'right',anchorOffset:.5});});
test('外置手动引线极值留出完整线宽',()=>{const d=doc(),r=d.regions[0];r.bendX=-1000;r.bendY=1600;const b=exportBounds(d),a=labelLayout(r,d.image);assert.ok(b.x<=Math.min(...a.route.map(p=>p.x))-r.stroke*2.55);});
test('JPG始终使用白底并遵守栅格尺寸上限',()=>{const d=doc();assert.ok(exportSVG(d,{format:'jpg',background:'transparent'}).includes('fill="white"/><image'));assert.ok(exportDimensions({width:20000,height:10000},1,'jpg').capped);});
test('本地字体数据及引用能保存恢复，SVG内嵌所用字体',()=>{
  const d=doc();d.fonts=[{id:'font-test',name:'本地字体.ttf',src:'data:font/ttf;base64,AAEAAAA='}];d.regions[0].fontFamily='font-test';assert.deepEqual(validateProject(JSON.parse(projectJSON(d))),d);const svg=exportSVG(d);assert.ok(svg.includes('@font-face'));assert.ok(svg.includes('data:font/ttf;base64,AAEAAAA='));assert.ok(svg.includes('OIM_font_test'));assert.ok(!exportSVG(d,{excludeText:true}).includes('<text'));
});
test('拒绝无引用字体、重复字体ID及外部字体URL',()=>{
  for(const mutate of [d=>d.regions[0].fontFamily='font-missing',d=>d.fonts=[{id:'font-a',name:'A',src:'https://evil/font.ttf'}],d=>d.fonts=[{id:'font-a',name:'A',src:'data:font/ttf;base64,AAAA'},{id:'font-a',name:'A',src:'data:font/ttf;base64,AAAA'}]]){const d=JSON.parse(projectJSON(doc()));mutate(d);assert.throws(()=>validateProject(d));}
});
