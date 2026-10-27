(function(root){
'use strict';
function gray(image,x,y){const k=(y*image.width+x)*4,d=image.data;return .2126*d[k]+.7152*d[k+1]+.0722*d[k+2];}
function sample(image,x,y){let x0=Math.floor(x),y0=Math.floor(y),a=x-x0,b=y-y0;if(x0<0||y0<0||x0+1>=image.width||y0+1>=image.height)return NaN;return gray(image,x0,y0)*(1-a)*(1-b)+gray(image,x0+1,y0)*a*(1-b)+gray(image,x0,y0+1)*(1-a)*b+gray(image,x0+1,y0+1)*a*b;}
function patch(image,p,r){let v=[];for(let y=-r;y<=r;y++)for(let x=-r;x<=r;x++)v.push(sample(image,p.x+x,p.y+y));return v;}
function correlation(a,b){if(a.some(x=>!Number.isFinite(x))||b.some(x=>!Number.isFinite(x)))return -1;let am=a.reduce((s,x)=>s+x,0)/a.length,bm=b.reduce((s,x)=>s+x,0)/b.length,d=0,aa=0,bb=0;for(let i=0;i<a.length;i++){let x=a[i]-am,y=b[i]-bm;d+=x*y;aa+=x*x;bb+=y*y;}return aa*bb>1e-6?d/Math.sqrt(aa*bb):-1;}
function components(image,center,search,contrast){
 let x0=Math.max(1,Math.floor(center.x-search)),y0=Math.max(1,Math.floor(center.y-search)),x1=Math.min(image.width-2,Math.ceil(center.x+search)),y1=Math.min(image.height-2,Math.ceil(center.y+search)),w=x1-x0+1,h=y1-y0+1;
 if(w<3||h<3)throw Error('探索範囲が画像の外です');
 let values=new Float32Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)values[y*w+x]=gray(image,x0+x,y0+y);
 let sorted=Array.from(values).sort((a,b)=>a-b),bg=sorted[Math.floor(sorted.length*.8)],threshold=bg-contrast,seen=new Uint8Array(w*h),out=[];
 for(let i=0;i<values.length;i++){if(seen[i]||values[i]>=threshold)continue;let stack=[i],area=0,weight=0,sx=0,sy=0,minX=w,maxX=0,minY=h,maxY=0,border=false;seen[i]=1;while(stack.length){let k=stack.pop(),x=k%w,y=Math.floor(k/w),q=Math.max(1,bg-values[k]);area++;weight+=q;sx+=(x0+x)*q;sy+=(y0+y)*q;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(x===0||y===0||x===w-1||y===h-1)border=true;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){let xx=x+dx,yy=y+dy;if(xx<0||yy<0||xx>=w||yy>=h)continue;let j=yy*w+xx;if(!seen[j]&&values[j]<threshold){seen[j]=1;stack.push(j);}}}out.push({x:sx/weight,y:sy/weight,area,width:maxX-minX+1,height:maxY-minY+1,border,bg});}
 return out;
}
function initialize(image,seed,options={}){
 const radius=options.radius??5,search=options.search??12,contrast=options.contrast??35;
 if(![seed.x,seed.y,radius,search,contrast].every(Number.isFinite)||radius<2||radius>20||search<3||search>60||contrast<3||contrast>100)throw Error('液滴半径2〜20、探索半径3〜60、明暗差3〜100で設定してください');
 let candidates=components(image,seed,Math.max(search,radius*2),contrast).filter(p=>!p.border&&p.area>=3&&p.width<=radius*2+3&&p.height<=radius*2+3&&Math.hypot(p.x-seed.x,p.y-seed.y)<=radius);
 candidates.sort((a,b)=>Math.hypot(a.x-seed.x,a.y-seed.y)-Math.hypot(b.x-seed.x,b.y-seed.y));
 if(!candidates.length)throw Error('開始点付近に独立した液滴を検出できません。中心・半径・明暗差を調整してください');
 let p=candidates[0],templateRadius=Math.max(2,Math.ceil(radius*.75)),template=patch(image,p,templateRadius);
 if(template.some(x=>!Number.isFinite(x)))throw Error('液滴が画像の端に近すぎます');
 if(candidates[1]&&Math.hypot(candidates[1].x-seed.x,candidates[1].y-seed.y)-Math.hypot(p.x-seed.x,p.y-seed.y)<1)throw Error('開始点付近に複数の液滴候補があります。中心に近い位置を指定してください');
 return {radius,search,contrast,templateRadius,template,reference:p,initial:{...p,score:1},history:[]};
}
function step(image,state,frame){
 const hist=state.history;if(!hist.length)throw Error('開始フレームがありません');let last=hist.at(-1),gap=frame-last.frame;if(gap!==1)throw Error('欠番・重複があります。連続する画像だけで追跡してください');
 let vx=0,vy=0;if(hist.length>=2){let prev=hist.at(-2),dt=last.frame-prev.frame;vx=(last.x-prev.x)/dt;vy=(last.y-prev.y)/dt;}
 const predicted={x:last.x+vx,y:last.y+vy},ref=state.reference;
 let candidates=components(image,predicted,state.search,state.contrast).filter(p=>!p.border&&p.area>=3&&p.area>=ref.area*.4&&p.area<=ref.area*2.3&&p.width<=Math.max(ref.width*1.8,ref.width+3)&&p.height<=Math.max(ref.height*1.8,ref.height+3)&&Math.hypot(p.x-predicted.x,p.y-predicted.y)<=state.search);
 candidates=candidates.map(p=>({...p,score:correlation(state.template,patch(image,p,state.templateRadius)),distance:Math.hypot(p.x-predicted.x,p.y-predicted.y)})).filter(p=>p.score>=.6).sort((a,b)=>(b.score-.025*b.distance)-(a.score-.025*a.distance));
 if(!candidates.length)throw Error('独立した液滴を確実に追えません（接触・重なり・明暗差不足の可能性）。ここで停止しました');
 if(candidates[1]&&Math.abs((candidates[0].score-.025*candidates[0].distance)-(candidates[1].score-.025*candidates[1].distance))<.10)throw Error('複数候補を区別できません。ここで停止しました');
 let p=candidates[0];if(p.score<.72&&hist.length>1)throw Error('液滴の見え方が変わりました。候補を確認して手動で続けてください');
 const point={frame,x:p.x,y:p.y,score:p.score,area:p.area};state.history.push(point);return point;
}
const api={initialize,step,correlation};if(typeof module!=='undefined')module.exports=api;else root.WBTrack=api;
})(globalThis);



