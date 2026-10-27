'use strict';
// Add-on for ver2. Original ver2 files remain unchanged.
let keyboardLoupe=false;
cv.tabIndex=0;cv.setAttribute('aria-label','解析画像。選択点を矢印キーで調整');
const keyboardPanel=document.createElement('div');
keyboardPanel.className='keyboard-panel';
keyboardPanel.innerHTML='<label><input id="pixelKeys" type="checkbox" checked> 矢印キーで選択点を微調整</label><span>1回＝原画像の1 px / Shift＋矢印＝10 px / Alt＋←→＝コマ送り / Esc＝パンへ</span><p id="pixelStatus" role="status"></p><button type="button" data-nudge="0,-1" aria-label="選択点を1ピクセル上へ">↑</button><button type="button" data-nudge="-1,0" aria-label="選択点を1ピクセル左へ">←</button><button type="button" data-nudge="1,0" aria-label="選択点を1ピクセル右へ">→</button><button type="button" data-nudge="0,1" aria-label="選択点を1ピクセル下へ">↓</button>';
$('viewport').before(keyboardPanel);
function pixelTarget(){
 if(!frame())return null;
 if(mode==='left'&&left)return {p:left,name:'円盤左端'};
 if(mode==='right'&&right)return {p:right,name:'円盤右端'};
 if(mode==='height'&&$('y0').value!=='')return {p:{x:$('x0').value===''?frame().img.width/2:+$('x0').value,y:+$('y0').value},name:'円盤上面高さ',vertical:true};
 if(mode==='track'&&tracks.has(frame().n))return {p:tracks.get(frame().n),name:'液滴中心（'+frame().n+'）'};
 if(mode==='contour'&&frame().n===shape&&selected>=0&&contour[selected])return {p:contour[selected],name:'輪郭点 '+(selected+1)};
 if(mode==='collision'&&manual)return {p:manual,name:'手動衝突点の高さ',vertical:true};
 return null;
}
function pixelHelp(){let t=pixelTarget();$('pixelStatus').textContent=t?`${t.name}：x=${fmt(t.p.x,2)}, y=${fmt(t.p.y,2)} px${t.vertical?'（↑↓で高さを調整）':''}`:'調整したい点のモードを選び、画像をクリックしてください。パンモードでは←→でコマ送りできます。';}
function nudgePixel(dx,dy){
 const t=pixelTarget();if(!t){$('pixelStatus').textContent='移動する点がありません。現在の画像で対象点をクリックしてください。';return;}
 if(t.vertical)dx=0;
 const nx=Math.min(frame().img.width-1,Math.max(0,t.p.x+dx)),ny=Math.min(frame().img.height-1,Math.max(0,t.p.y+dy));
 if(mode==='height')$('y0').value=ny;
 else {t.p.x=nx;t.p.y=ny;if(mode==='left'||mode==='right'){if(left&&right)$('x0').value=(left.x+right.x)/2;}if(mode==='contour'&&contourSource==='auto')contourSource='auto_edited';}
 keyboardLoupe=true;pointer={x:nx,y:ny};update();
}
const beforePixelDraw=draw;
draw=function(){const t=pixelTarget();if(keyboardLoupe&&t)pointer={...t.p};beforePixelDraw();if(t&&$('pixelKeys').checked){let x=ox+t.p.x*zoom,y=oy+t.p.y*zoom;ctx.save();ctx.strokeStyle='#ffcc00';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,10,0,Math.PI*2);ctx.stroke();ctx.restore();}pixelHelp();};
const beforePixelMode=setMode;setMode=function(m){keyboardLoupe=false;beforePixelMode(m);draw();};
const beforePixelChange=change;change=function(i){keyboardLoupe=false;beforePixelChange(i);};
const beforePixelReset=reset;reset=function(){keyboardLoupe=false;beforePixelReset();};
cv.addEventListener('pointermove',()=>{keyboardLoupe=false;},{capture:true});
cv.addEventListener('pointerdown',()=>{keyboardLoupe=false;},{capture:true});
$('pixelKeys').onchange=()=>{keyboardLoupe=false;cv.focus({preventScroll:true});draw();};
keyboardPanel.querySelectorAll('[data-nudge]').forEach(b=>b.onclick=()=>nudgePixel(...b.dataset.nudge.split(',').map(Number)));
document.addEventListener('keydown',e=>{
 if(e.isComposing||e.ctrlKey||e.metaKey||e.target.isContentEditable||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
 if(e.key==='Escape'){e.preventDefault();setMode('pan');return;}
 const arrows={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
 if(!arrows[e.key])return;
 if(e.altKey&&(e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();e.stopImmediatePropagation();change(idx+(e.key==='ArrowLeft'?-1:1));return;}
 const editing=['left','right','height','track','contour','collision'].includes(mode);
 if($('pixelKeys').checked&&editing){e.preventDefault();e.stopImmediatePropagation();let [dx,dy]=arrows[e.key],step=e.shiftKey?10:1;nudgePixel(dx*step,dy*step);}
},true);
draw();

