(function(root){
'use strict';
// All coordinates, including the crop, are ORIGINAL image pixels.
function extract(image,roi,options={}){
 const {width:W,height:H,data}=image;
 if(!W||!H||!data||data.length<W*H*4)throw Error('画像データが不正です');
 const x0=Math.max(2,Math.ceil(Math.min(roi.x1,roi.x2))),x1=Math.min(W-3,Math.floor(Math.max(roi.x1,roi.x2))),y0=Math.max(2,Math.ceil(Math.min(roi.y1,roi.y2))),y1=Math.min(H-3,Math.floor(Math.max(roi.y1,roi.y2)));
 const w=x1-x0+1,h=y1-y0+1;
 if(w<12||h<16)throw Error('抽出範囲が小さすぎます（幅12 px、高さ16 px以上）');
 if(w*h>1500000)throw Error('範囲が広すぎます。ベル右側だけに範囲を絞ってください');
 let count=options.count??12;if(!Number.isInteger(count)||count<8||count>20)throw Error('輪郭点数は8〜20の整数にしてください');
 const gray=(x,y)=>{let k=(y*W+x)*4;return .2126*data[k]+.7152*data[k+1]+.0722*data[k+2];};
 // Separable [1,2,1] smoothing, then a positive horizontal edge:
 // dark liquid boundary on the left, bright background on the right.
 const bw=w+4,bh=h+4,g=new Float32Array(bw*bh);
 for(let y=0;y<bh;y++)for(let x=0;x<bw;x++)g[y*bw+x]=gray(x0+x-2,y0+y-2);
 function sm(x,y){let sum=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)sum+=g[(y+2+j)*bw+x+2+i]*(i===0?2:1)*(j===0?2:1);return sum/16;}
 const edge=new Float32Array(w*h),rowMax=[];
 for(let y=0;y<h;y++){let max=0;for(let x=1;x<w-1;x++){let v=Math.max(0,(sm(x+1,y)-sm(x-1,y))/2);edge[y*w+x]=v;max=Math.max(max,v);}rowMax.push(max);}
 let sorted=[...rowMax].sort((a,b)=>a-b),scale=sorted[Math.floor(sorted.length*.7)];
 if(scale<1.2)throw Error('右側輪郭の明暗差を検出できません。範囲を絞るか手動指定してください');
 const step=4,back=new Int8Array(w*h);let prev=new Float64Array(w).fill(-1e20),curr=new Float64Array(w);
 const reward=(x,y)=>Math.min(3,edge[y*w+x]/scale);
 for(let x=2;x<w-2;x++)prev[x]=reward(x,0);
 for(let y=1;y<h;y++){curr.fill(-1e20);for(let x=2;x<w-2;x++){let best=-1e20,offset=0;for(let d=-step;d<=step;d++){let p=x+d;if(p<2||p>=w-2)continue;let v=prev[p]-.16*d*d;if(v>best){best=v;offset=d;}}curr[x]=best+reward(x,y);back[y*w+x]=offset;}[prev,curr]=[curr,prev];}
 let last=2;for(let x=3;x<w-2;x++)if(prev[x]>prev[last])last=x;
 let path=Array(h);for(let y=h-1;y>=0;y--){path[y]={x:last+x0,y:y+y0};if(y)last+=back[y*w+last];}
 let strong=0,border=0,sum=0;for(let y=0;y<h;y++){let x=path[y].x-x0,v=edge[y*w+x];if(v>=Math.max(1.2,scale*.22))strong++;if(x<=3||x>=w-4)border++;sum+=v;}
 const coverage=strong/h,borderFraction=border/h;
 if(coverage<.55)throw Error('輪郭が途切れています。範囲を短くするか、手動指定してください');
 if(borderFraction>.3)throw Error('候補が範囲の端に寄っています。輪郭の左右に余白をつけて再指定してください');
 // Small median filter removes single-row noise; resample to editable knots.
 let filtered=path.map((p,y)=>{let xs=path.slice(Math.max(0,y-2),Math.min(h,y+3)).map(p=>p.x).sort((a,b)=>a-b);return {x:xs[Math.floor(xs.length/2)],y:p.y};});
 const points=Array.from({length:count},(_,i)=>filtered[Math.round(i*(h-1)/(count-1))]);
 const warnings=[];if(coverage<.85)warnings.push('明暗差が弱い区間があります');if(borderFraction>.05)warnings.push('範囲の端に近い区間があります');
 return {points,path:filtered,coverage,borderFraction,meanEdge:sum/h,roi:{x1:x0,y1:y0,x2:x1,y2:y1},warnings};
}
const api={extract};if(typeof module!=='undefined')module.exports=api;else root.WBAuto=api;
})(globalThis);

