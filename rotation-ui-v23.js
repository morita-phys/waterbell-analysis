'use strict';
let rotationAngle=0,rotationBusy=false,rotationToken=0;
const rotationPanel=document.createElement('div');rotationPanel.className='auto-panel';rotationPanel.innerHTML='<b>カメラの傾きを補正（全コマ共通）</b><p>円盤の左端・右端を指定してから水平にします。先に拡大し、矢印キーで端を合わせてください。円盤自体が水平だった実験を想定しています。</p><button id="levelDisk">円盤の左右端を水平にする</button><label>元画像からの回転角 °（時計回り＋） <input id="rotationDegrees" type="number" value="0" min="-180" max="180" step="0.1"></label><button id="applyRotation">指定角度を全コマに適用</button><button id="resetRotation">回転補正を解除</button><p id="rotationStatus" role="status">回転補正なし。画像ファイル自体は変更しません。</p><p>既存の測定点も同じ角度で変換します。抽出範囲と未採用候補はクリアします。補正後に輪郭・中心軸・速度方向を再確認してください。</p>';
$('scale').after(rotationPanel);
function setRotationBusy(value){rotationBusy=value;for(const id of ['levelDisk','applyRotation','resetRotation','rotationDegrees'])$(id).disabled=value;}
function rotatedCanvas(image,g){let canvas=document.createElement('canvas');canvas.width=g.width;canvas.height=g.height;let c=canvas.getContext('2d');c.fillStyle='#141c22';c.fillRect(0,0,g.width,g.height);c.translate(g.width/2,g.height/2);c.rotate(g.degrees*Math.PI/180);c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';c.drawImage(image,-g.sourceWidth/2,-g.sourceHeight/2);return canvas;}
async function applyImageRotation(degrees){
 if(rotationBusy)return;
 if(!frames.length){$('rotationStatus').textContent='先に画像を読み込んでください。';return;}
 if(!Number.isFinite(degrees)||degrees < -180||degrees > 180){$('rotationStatus').textContent='角度は−180〜180°で入力してください。';return;}
 if(Math.abs(degrees-rotationAngle)<1e-10){$('rotationStatus').textContent='既にこの角度を適用しています。';return;}
 if(tracks.size||contour.length||manual){if(!confirm('画像群と測定点を回転します。未採用候補と抽出範囲はクリアします。保存済みの結果行は変更しません。続けますか？'))return;}
 const token=++rotationToken,sources=frames.map(f=>f.rotationOriginal||f.img),old=WBRotation.geometry(sources[0].width,sources[0].height,rotationAngle),next=WBRotation.geometry(sources[0].width,sources[0].height,degrees);
 if(next.width*next.height*frames.length>120000000){$('rotationStatus').textContent='画像群が大きすぎます。1回の画像枚数を減らしてください。';return;}
 setRotationBusy(true);
 const controlState=[...document.querySelectorAll('button,input,select,textarea')].filter(el=>!rotationPanel.contains(el)).map(el=>[el,el.disabled]);controlState.forEach(([el])=>el.disabled=true);
 const toNext=p=>WBRotation.convert(p,old,next);let images=[];
 try{
  for(let i=0;i<sources.length;i++){if(token!==rotationToken)return;$('rotationStatus').textContent=`全コマを回転中… ${i+1}/${sources.length}`;images.push(Math.abs(degrees)<1e-12?sources[i]:rotatedCanvas(sources[i],next));await new Promise(resolve=>setTimeout(resolve,0));}
  if(token!==rotationToken)return;
  // Sample the original images each time, never repeatedly resample a rotated raster.
  for(let i=0;i<frames.length;i++){frames[i].rotationOriginal=sources[i];frames[i].img=images[i];}
  let origin=null;if($('x0').value!==''&&$('y0').value!=='')origin={x:+$('x0').value,y:+$('y0').value};else if(left&&right)origin={x:left.x+(right.x-left.x)/2,y:left.y+(right.y-left.y)/2};
  if(left)left=toNext(left);if(right)right=toNext(right);contour=contour.map(toNext);for(let [n,p] of tracks)tracks.set(n,{...p,...toNext(p)});if(manual)manual=toNext(manual);
  if(origin){origin=toNext(origin);$('x0').value=origin.x;$('y0').value=origin.y;}else $('x0').value=$('y0').value='';
  autoROI=null;autoCandidate=null;trackSeed=null;trackEnd=null;clearTracking('回転補正を変更しました。自動追跡を使う場合は開始点と終了コマを登録し直してください。');
  rotationAngle=degrees;$('rotationDegrees').value=String(Number(degrees.toFixed(8)));pointer=null;keyboardLoupe=false;drag=null;
  const thumbs=$('thumbs').querySelectorAll('img');frames.forEach((f,i)=>{let small=document.createElement('canvas');small.width=132;small.height=Math.max(1,Math.round(f.img.height/f.img.width*132));small.getContext('2d').drawImage(f.img,0,0,small.width,small.height);if(thumbs[i])thumbs[i].src=small.toDataURL('image/jpeg',.65);});
  $('autoStatus').textContent='回転補正を変更しました。必要に応じて抽出範囲を再指定してください。';
  setMode('pan');update();fit();$('rotationStatus').textContent=`適用済み：${degrees.toFixed(3)}°（全${frames.length}コマ）。座標・速度・角度は補正後の画像基準です。補正後に結果を保存し直してください。`;
 }catch(err){$('rotationStatus').textContent='回転できません：'+err.message;}
 finally{controlState.forEach(([el,disabled])=>{if(el.isConnected)el.disabled=disabled;});if(token===rotationToken){setRotationBusy(false);syncAuto();renderTracking();}}
}
$('levelDisk').onclick=()=>{try{applyImageRotation(WBRotation.levelAngle(left,right,rotationAngle));}catch(err){$('rotationStatus').textContent=err.message;}};
$('applyRotation').onclick=()=>{if($('rotationDegrees').value===''){$('rotationStatus').textContent='角度を入力してください。';return;}applyImageRotation(+$('rotationDegrees').value);};
$('resetRotation').onclick=()=>applyImageRotation(0);
// While the raster batch is being prepared, block point editing/frame shortcuts.
cv.addEventListener('pointerdown',e=>{if(rotationBusy){e.preventDefault();e.stopImmediatePropagation();}},true);
cv.addEventListener('pointermove',e=>{if(rotationBusy){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('keydown',e=>{if(rotationBusy&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Escape'].includes(e.key)){e.preventDefault();e.stopImmediatePropagation();}},true);
const beforeRotationReset=reset;reset=function(){rotationToken++;rotationAngle=0;setRotationBusy(false);$('rotationDegrees').value='0';$('rotationStatus').textContent='回転補正なし。新しい画像群は元の向きで読み込みます。';beforeRotationReset();};
const beforeRotationSave=$('save').onclick;$('save').onclick=()=>{if(rotationBusy)return;let count=rows.length;beforeRotationSave();if(rows.length>count)rows.at(-1).notes+=` | camera_rotation_deg=${rotationAngle.toFixed(6)}; pixel_coordinates=rotation_corrected; image_rotation_is_not_perspective_correction`;};
keyboardPanel.querySelector('span').textContent='1回＝補正後画像の1 px / Shift＋矢印＝10 px / Alt＋←→＝コマ送り / Esc＝パンへ';
