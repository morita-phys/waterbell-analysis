'use strict';
// Review-first tracking add-on. Detection stays in original image pixels.
let trackSeed=null,trackEnd=null,trackCandidate=null,trackRunning=false,trackGeneration=0,trackRunKey='',trackMessage='最初の液滴中心を手動で指定し、開始点にしてください。';
const trackingPanel=document.createElement('div');trackingPanel.className='auto-panel';
trackingPanel.innerHTML='<b>液滴中心の自動追跡（候補を確認して採用）</b><p>最初のコマだけ液滴中心をクリックします。開始点を登録した後、最後の衝突前コマを表示して終了コマを登録してください。独立した液滴だけを追います。</p><button id="trackStart">① 現在の中心を開始点に</button><button id="trackEnd">② 現在を追跡終了コマに</button><p id="trackRange"></p><details><summary>検出設定（うまく追えないとき）</summary><label>液滴の概略半径 px <input id="trackRadius" type="number" value="5" min="2" max="20"></label><label>次コマの探索半径 px <input id="trackSearch" type="number" value="12" min="3" max="60"></label><label>背景との明暗差（3〜100） <input id="trackContrast" type="number" value="35" min="3" max="100"></label><p>明るい背景の暗い液滴を対象とします。明暗差を小さくすると薄い縁も拾いますが、膜とつながりやすくなります。</p></details><button id="trackRun">③ 自動追跡する</button><button id="trackApply" disabled>④ チェックした候補を採用</button><button id="trackDiscard">候補を破棄・追跡を中止</button><p id="trackStatus" role="status"></p><p>水色の丸は未採用の候補です。行の「表示」で各コマを拡大確認してください。採用するまで計算値は変わりません。チェックを外したコマ・範囲外の既存点はそのまま残ります。</p><div class="tablewrap"><table><thead><tr><th>採用</th><th>コマ</th><th>x px</th><th>y px</th><th>類似度</th><th>確認</th></tr></thead><tbody id="trackCandidates"></tbody></table></div><p>類似度は開始画像との見え方の一致度で、正解率ではありません。停止は接触時刻の自動判定ではありません。採用後も従来のクリック・矢印キーで修正できます。</p>';
const trackingHeading=[...document.querySelectorAll('aside h2')].find(el=>el.textContent.startsWith('4 '));trackingHeading.after(trackingPanel);
const trackPick=document.createElement('button');trackPick.textContent='開始コマの液滴中心をクリック';trackPick.onclick=()=>setMode('track');
trackingPanel.querySelector('p').after(trackPick);
const trackNavigation=document.createElement('p');trackNavigation.textContent='コマ移動はAlt＋←→。終了コマは衝突前に指定してください。';trackPick.after(trackNavigation);
function trackKey(){return JSON.stringify([frames.map(f=>f.url),trackSeed,trackEnd,[...tracks],+$('trackRadius').value,+$('trackSearch').value,+$('trackContrast').value]);}
function renderTracking(){
 $('trackRange').textContent=`開始：${trackSeed?.frame??'未指定'} / 終了：${trackEnd??'未指定'}`;
 $('trackStatus').textContent=trackMessage;
 $('trackApply').disabled=trackRunning||!trackCandidate||!trackCandidate.points.some(p=>p.use);
 $('trackRun').disabled=trackRunning;
 $('trackCandidates').replaceChildren();
 for(const p of trackCandidate?.points??[]){let tr=document.createElement('tr'),td=document.createElement('td'),cb=document.createElement('input');cb.type='checkbox';cb.checked=p.use;cb.onchange=()=>{p.use=cb.checked;$('trackApply').disabled=!trackCandidate.points.some(p=>p.use);draw();};td.append(cb);tr.append(td);for(const value of [p.frame,fmt(p.x,2),fmt(p.y,2),p.seed?'開始点':fmt(p.score,2)]){let td=document.createElement('td');td.textContent=value;tr.append(td);}let td2=document.createElement('td'),b=document.createElement('button');b.textContent='表示';b.onclick=()=>{change(frames.findIndex(f=>f.n===p.frame));pointer={x:p.x,y:p.y};draw();};td2.append(b);tr.append(td2);$('trackCandidates').append(tr);}
}
function clearTracking(message){trackGeneration++;trackRunning=false;trackCandidate=null;trackMessage=message;renderTracking();}
$('trackStart').onclick=()=>{let f=frame(),p=f&&tracks.get(f.n);if(!p){trackMessage='「現在コマの液滴中心」モードで、先に液滴中心をクリックしてください。';renderTracking();return;}clearTracking('開始点を登録しました。最後の衝突前コマを表示して終了コマを登録してください。');trackSeed={frame:f.n,x:p.x,y:p.y};trackEnd=null;renderTracking();};
$('trackEnd').onclick=()=>{if(!trackSeed||!frame()){trackMessage='先に開始点を登録してください。';renderTracking();return;}if(frame().n<=trackSeed.frame){trackMessage='終了コマは開始コマより後の、衝突前のコマを選んでください。';renderTracking();return;}trackEnd=frame().n;clearTracking('範囲を登録しました。終了コマまで液滴が独立していることを確認して追跡を実行してください。');};
for(const id of ['trackRadius','trackSearch','trackContrast'])$(id).oninput=()=>clearTracking('設定が変わりました。再実行してください。');
$('trackDiscard').onclick=()=>{clearTracking('候補を破棄しました。既存の追跡点は変更していません。');draw();};
function trackingImage(f,canvas){canvas.width=f.img.width;canvas.height=f.img.height;let g=canvas.getContext('2d',{willReadFrequently:true});g.drawImage(f.img,0,0);return g.getImageData(0,0,canvas.width,canvas.height);}
$('trackRun').onclick=async()=>{
 if(trackRunning)return;
 if(!trackSeed||trackEnd===null){trackMessage='開始点と終了コマの両方を登録してください。';renderTracking();return;}
 let p=tracks.get(trackSeed.frame);if(!p||p.x!==trackSeed.x||p.y!==trackSeed.y){clearTracking('開始点が移動・削除されました。開始点を登録し直してください。');return;}
 const source=frames.filter(f=>f.n>=trackSeed.frame&&f.n<=trackEnd),token=++trackGeneration,key=trackKey();
 trackRunning=true;trackCandidate=null;trackRunKey=key;trackMessage='追跡中…';renderTracking();
 const canvas=document.createElement('canvas');let state,stop=null;
 try{
  state=WBTrack.initialize(trackingImage(source[0],canvas),trackSeed,{radius:+$('trackRadius').value,search:+$('trackSearch').value,contrast:+$('trackContrast').value});
  state.history.push({...state.initial,frame:source[0].n,seed:true});
  for(const f of source.slice(1)){
   await new Promise(resolve=>setTimeout(resolve,0));if(token!==trackGeneration||key!==trackKey())return;
   try{WBTrack.step(trackingImage(f,canvas),state,f.n);}catch(err){stop={frame:f.n,message:err.message};break;}
   trackMessage=`追跡中… ${f.n} / ${trackEnd}`;$('trackStatus').textContent=trackMessage;
  }
  if(token!==trackGeneration||key!==trackKey())return;
  trackCandidate={key,points:state.history.map(p=>({...p,use:true})),stop};
  trackMessage=`候補 ${state.history.length}コマ（開始点を含む）。${stop?`${stop.frame}で停止：${stop.message}`:'指定した終了コマまで追跡しました。'}\n水色の位置を各コマで確認してから採用してください。`;
 }catch(err){trackMessage='追跡できません：'+err.message;}
 finally{if(token===trackGeneration){trackRunning=false;renderTracking();draw();}}
};
$('trackApply').onclick=()=>{
 if(!trackCandidate||trackCandidate.key!==trackKey()){clearTracking('測定点が変わりました。再実行してください。');return;}
 let chosen=trackCandidate.points.filter(p=>p.use);if(!chosen.length)return;
 let overwrite=chosen.filter(p=>tracks.has(p.frame)).length;
 if(overwrite&&!confirm(`${chosen.length}コマの中心候補を採用します。うち${overwrite}コマの既存点を置き換えます。よいですか？`))return;
 for(const p of chosen)tracks.set(p.frame,{x:p.x,y:p.y,use:true,origin:'auto_reviewed'});
 trackCandidate=null;trackMessage=`${chosen.length}コマを採用しました。速度計算用の点と衝突前の範囲を表で確認してください。3点未満では速度を算出できません。`;setMode('track');update();
};
const beforeTrackingDraw=draw;draw=function(){beforeTrackingDraw();if(!trackCandidate||!frame())return;let p=trackCandidate.points.find(p=>p.frame===frame().n);if(!p)return;ctx.save();let x=ox+p.x*zoom,y=oy+p.y*zoom;ctx.strokeStyle=p.use?'#00e9ff':'#aaa';ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(x,y,9,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.beginPath();ctx.moveTo(x-12,y);ctx.lineTo(x+12,y);ctx.moveTo(x,y-12);ctx.lineTo(x,y+12);ctx.stroke();ctx.restore();};
const beforeTrackingUpdate=update;update=function(){if((trackCandidate&&trackCandidate.key!==trackKey())||(trackRunning&&trackRunKey!==trackKey()))clearTracking('画像・追跡点・設定が変わりました。候補を再計算してください。');beforeTrackingUpdate();renderTracking();};
const beforeTrackingReset=reset;reset=function(){trackSeed=null;trackEnd=null;clearTracking('最初の液滴中心を手動で指定し、開始点にしてください。');beforeTrackingReset();};
const beforeTrackingSave=$('save').onclick;$('save').onclick=()=>{let n=rows.length;beforeTrackingSave();if(rows.length>n){let nums=[...tracks].filter(([,p])=>p.use&&p.origin==='auto_reviewed').map(([n])=>n);rows.at(-1).notes+=` | tracking_origin_auto_frames=${nums.join(';')} (manual corrections possible)`;}};
// After a successful shape selection, guide the next drag to the extraction ROI.
// A cancelled shape change must keep the current interaction mode.
const beforeShapeRange=$('shape').onclick;
$('shape').onclick=()=>{
 beforeShapeRange();
 if(frame()&&shape===frame().n){
  setMode('roi');
  $('autoStatus').textContent='形状画像を指定しました。画像上でベル右側の抽出範囲をドラッグしてください。未校正の場合は先に円盤を校正してください。';
 }
};
renderTracking();
