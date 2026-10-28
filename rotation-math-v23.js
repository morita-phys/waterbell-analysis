(function(root){
'use strict';
// Rigid rotation only; positive angles are clockwise in image coordinates.
function geometry(width,height,degrees){if(![width,height,degrees].every(Number.isFinite)||width<=0||height<=0)throw Error('画像寸法・回転角が不正です');let radians=degrees*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);if(Math.abs(c)<1e-12)c=0;if(Math.abs(s)<1e-12)s=0;return {width:Math.ceil(Math.abs(width*c)+Math.abs(height*s)),height:Math.ceil(Math.abs(width*s)+Math.abs(height*c)),sourceWidth:width,sourceHeight:height,c,s,degrees};}
function forward(p,g){let x=p.x-g.sourceWidth/2,y=p.y-g.sourceHeight/2;return {x:g.width/2+g.c*x-g.s*y,y:g.height/2+g.s*x+g.c*y};}
function inverse(p,g){let x=p.x-g.width/2,y=p.y-g.height/2;return {x:g.sourceWidth/2+g.c*x+g.s*y,y:g.sourceHeight/2-g.s*x+g.c*y};}
function convert(p,oldGeometry,newGeometry){return forward(inverse(p,oldGeometry),newGeometry);}
function levelAngle(left,right,current=0){if(!left||!right||right.x-left.x<1)throw Error('円盤の左端・右端を正しい順で指定してください（横幅1 px以上）');return current-Math.atan2(right.y-left.y,right.x-left.x)*180/Math.PI;}
const api={geometry,forward,inverse,convert,levelAngle};if(typeof module!=='undefined')module.exports=api;else root.WBRotation=api;
})(globalThis);
