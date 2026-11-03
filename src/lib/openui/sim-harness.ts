import { BD_GEO } from "./geo-bd";

/**
 * Sandbox harness for SimCanvas (v2). The model writes a short script against this API; the harness owns the
 * look (light glass design language), the canvas, controls, formulas, charts, timelines, physics and maps.
 *
 * Libraries are self-hosted under /vendor (see scripts/copy-vendor.mjs) and only included when the script uses them:
 *   KaTeX  -> formula()      Matter.js -> Matter / drawBodies()      Leaflet -> mapView()
 * The iframe is sandboxed without allow-same-origin, so it cannot touch the parent page.
 */

const CSS = String.raw`
:root{--ink:#0f2742;--mute:#5b7089;--line:#d6e6f5;--ice:#eaf6ff;--ice2:#cfe8fb;--blue:#3b82f6;--sky:#38bdf8;--glass:rgba(255,255,255,.62)}
*{box-sizing:border-box;margin:0}
html,body{background:transparent}
body{font:13px/1.45 'InterV','NotoBn',system-ui,sans-serif;color:var(--ink);padding:12px;-webkit-font-smoothing:antialiased}
.glass{background:var(--glass);backdrop-filter:blur(14px) saturate(1.5);-webkit-backdrop-filter:blur(14px) saturate(1.5);border:1px solid rgba(255,255,255,.85);border-radius:18px;box-shadow:0 10px 30px rgba(59,130,246,.12),inset 0 1px 0 rgba(255,255,255,.9)}
#stage{position:relative;padding:8px;animation:rise .5s cubic-bezier(.2,.8,.2,1) both}
#cv{width:100%;height:auto;aspect-ratio:9/5;display:block;border-radius:12px;background:linear-gradient(160deg,#fff,#eef8ff)}
#mapbox{display:none;width:100%;aspect-ratio:9/5;border-radius:12px;overflow:hidden}
#formula{margin-top:10px;padding:10px 14px;text-align:center;font-size:17px;display:none;animation:rise .5s .05s both}
#ctls{margin-top:10px;padding:6px 14px;animation:rise .5s .1s both}
#ctls:empty{display:none}
.ctl{display:grid;grid-template-columns:minmax(96px,170px) 1fr 84px;gap:12px;align-items:center;margin:9px 0}
.ctl .lab{font-weight:600;color:var(--ink)}
.ctl .val{font-variant-numeric:tabular-nums;color:#1d4ed8;font-weight:700;text-align:right}
input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:8px;border-radius:99px;outline:none;cursor:pointer;background:linear-gradient(90deg,#60a5fa var(--p,50%),#d9eafa var(--p,50%))}
input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:22px;height:22px;border-radius:50%;background:#fff;border:2px solid #3b82f6;box-shadow:0 3px 10px rgba(59,130,246,.45);transition:transform .15s}
input[type=range]::-webkit-slider-thumb:hover{transform:scale(1.15)}
input[type=range]::-moz-range-thumb{width:20px;height:20px;border-radius:50%;background:#fff;border:2px solid #3b82f6;box-shadow:0 3px 10px rgba(59,130,246,.45)}
.tog{display:flex;align-items:center;gap:10px;margin:9px 0;font-weight:600;cursor:pointer}
.tog input{display:none}.tog .sw{width:42px;height:24px;border-radius:99px;background:#d9eafa;position:relative;transition:background .25s}
.tog .sw:after{content:'';position:absolute;top:3px;left:3px;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 2px 6px rgba(15,39,66,.25);transition:transform .25s cubic-bezier(.3,.9,.3,1.2)}
.tog input:checked+.sw{background:linear-gradient(90deg,#60a5fa,#38bdf8)}.tog input:checked+.sw:after{transform:translateX(18px)}
.seg{display:flex;gap:4px;padding:4px;border-radius:99px;background:rgba(207,232,251,.55);flex-wrap:wrap}
.seg button{background:transparent;color:var(--mute);box-shadow:none;padding:6px 14px}
.seg button.on{background:#fff;color:#1d4ed8;box-shadow:0 3px 10px rgba(59,130,246,.25)}
#outs{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
#outs:empty{display:none}
.out{padding:7px 14px;border-radius:99px;background:var(--glass);border:1px solid rgba(255,255,255,.85);box-shadow:0 4px 14px rgba(59,130,246,.1);color:var(--mute);animation:rise .5s .15s both}
.out b{color:var(--ink);font-variant-numeric:tabular-nums;margin-left:4px}
#btns{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}
button{font:inherit;font-weight:600;color:#fff;border:0;border-radius:99px;padding:8px 18px;cursor:pointer;background:linear-gradient(135deg,#60a5fa,#38bdf8);box-shadow:0 6px 16px rgba(56,189,248,.4);transition:transform .15s,box-shadow .2s}
button:hover{transform:translateY(-2px);box-shadow:0 10px 22px rgba(56,189,248,.5)}button:active{transform:scale(.96)}
button.ghost{background:rgba(255,255,255,.8);color:#1d4ed8;box-shadow:0 4px 12px rgba(59,130,246,.18)}
#err{display:none;margin-top:10px;padding:10px 14px;border-radius:12px;background:#fff1f2;color:#be123c;white-space:pre-wrap}
.katex{font-size:1.08em}.leaflet-container{font-family:inherit}
@keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
`;

const MARKUP = String.raw`<div id="wrap"><div id="stage" class="glass"><canvas id="cv" width="1440" height="800"></canvas><div id="mapbox"></div></div><div id="formula" class="glass"></div><div id="ctls" class="glass"></div><div id="outs"></div><div id="btns"><button id="pp" class="ghost">Pause</button><button id="rs" class="ghost">Restart</button></div><div id="err"></div></div>`;

const HARNESS = String.raw`
try{parent.postMessage({simReady:1},'*')}catch(e){}
window.addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='SCRIPT'){try{parent.postMessage({simLibError:t.src},'*')}catch(x){}}},true);
var cv=document.getElementById('cv'),ctx=cv.getContext('2d'),W=720,H=400,DPR=2;ctx.scale(DPR,DPR);
var P={},M={x:0,y:0,down:false},_fn=null,_paused=false,_outs=[],_tp=0,_last=performance.now(),_formula=null,_fcache='',_drag=null,_first=true;
var PI=Math.PI;
var C={ink:'#0f2742',mute:'#5b7089',line:'#d6e6f5',grid:'#e3effa',bg:'#ffffff',ice:'#eaf6ff',blue:'#3b82f6',sky:'#38bdf8',teal:'#14b8a6',green:'#22c55e',amber:'#f59e0b',orange:'#fb923c',rose:'#f43f5e',pink:'#ec4899',violet:'#8b5cf6',slate:'#94a3b8'};
var PAL=[C.blue,C.teal,C.amber,C.rose,C.violet,C.sky,C.green,C.orange];
function lerp(a,b,t){return a+(b-a)*t}function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function map(v,a,b,c,d){return c+(v-a)/(b-a)*(d-c)}function ease(t){t=clamp(t,0,1);return t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2}
function rand(a,b){return a+Math.random()*(b-a)}function fmt(n,d){return (+n).toFixed(d==null?1:d)}
function tint(c,a){var h=c.replace('#','');if(h.length==3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];var n=parseInt(h,16);return 'rgba('+(n>>16&255)+','+(n>>8&255)+','+(n&255)+','+a+')'}
function _err(e){try{parent.postMessage({simError:String(e&&e.message||e)},'*')}catch(x){}var d=document.getElementById('err');d.style.display='block';d.textContent='Simulation error: '+(e&&e.message||e)}
function _el(h){var d=document.createElement('div');d.innerHTML=h;return d.firstChild}
/* ---------- controls ---------- */
function slider(key,label,min,max,step,def,unit){P[key]=def;var r=_el('<div class="ctl"><span class="lab"></span><input type="range"><span class="val"></span></div>');r.children[0].textContent=label;var i=r.children[1],v=r.children[2];i.min=min;i.max=max;i.step=step;i.value=def;
function s(){var p=(i.value-min)/(max-min)*100;i.style.setProperty('--p',p+'%');v.textContent=(+i.value).toFixed(step<1?(String(step).split('.')[1]||'').length:0)+(unit?' '+unit:'')}s();i.oninput=function(){P[key]=+i.value;s()};document.getElementById('ctls').appendChild(r)}
function toggle(key,label,def){P[key]=!!def;var r=_el('<label class="tog"><input type="checkbox"><span class="sw"></span><span></span></label>');r.children[2].textContent=label;var i=r.children[0];i.checked=!!def;i.onchange=function(){P[key]=i.checked};document.getElementById('ctls').appendChild(r)}
function choice(key,label,options,def){P[key]=def||0;var r=_el('<div class="ctl"><span class="lab"></span><div class="seg"></div><span></span></div>');r.children[0].textContent=label;var seg=r.children[1];options.forEach(function(o,k){var b=document.createElement('button');b.textContent=o;b.onclick=function(){P[key]=k;[].forEach.call(seg.children,function(x,j){x.className=j==k?'on':''})};b.className=k==P[key]?'on':'';seg.appendChild(b)});document.getElementById('ctls').appendChild(r)}
function button(label,fn){var b=document.createElement('button');b.textContent=label;b.onclick=function(){try{fn()}catch(e){_err(e)}};document.getElementById('btns').appendChild(b)}
function readout(label,fn){var d=document.createElement('div');d.className='out';d.innerHTML=label+' <b></b>';document.getElementById('outs').appendChild(d);_outs.push([d.lastChild,fn])}
function formula(f){_formula=f;var d=document.getElementById('formula');d.style.display='block'}
function restart(){_tp=0}
function loop(fn){_fn=fn}
/* ---------- drawing ---------- */
function _ok(a){for(var i=0;i<a.length;i++){if(typeof a[i]==='number'&&!isFinite(a[i]))return false}return true}
function clear(grid){_lb=[];var g=ctx.createLinearGradient(0,0,W,H);g.addColorStop(0,'#ffffff');g.addColorStop(1,'#e9f5ff');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);if(grid!==false){ctx.fillStyle='rgba(59,130,246,.10)';for(var x=24;x<W;x+=36)for(var y=24;y<H;y+=36)ctx.fillRect(x,y,1.6,1.6)}ctx.shadowColor='transparent';ctx.shadowBlur=0}
function line(x1,y1,x2,y2,c,w,dash){if(!_ok(arguments))return;ctx.save();ctx.strokeStyle=c||C.ink;ctx.lineWidth=w||2;ctx.lineCap='round';if(dash)ctx.setLineDash(Array.isArray(dash)?dash:(typeof dash==='number'?[dash,dash]:[6,6]));ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.restore()}
function circle(x,y,r,c,fill){if(!_ok(arguments))return;ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,6.2832);if(fill===false){ctx.strokeStyle=c||C.ink;ctx.lineWidth=2;ctx.stroke()}else{ctx.fillStyle=c||C.blue;ctx.fill()}}
function ball(x,y,r,c){if(!_ok(arguments))return;c=c||C.blue;ctx.save();ctx.shadowColor='rgba(15,39,66,.28)';ctx.shadowBlur=r*.9;ctx.shadowOffsetY=r*.35;var g=ctx.createRadialGradient(x-r*.35,y-r*.4,r*.1,x,y,r);g.addColorStop(0,'#ffffff');g.addColorStop(.25,tint(c,.55));g.addColorStop(1,c);ctx.fillStyle=g;ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,6.2832);ctx.fill();ctx.restore()}
function rect(x,y,w,h,c,fill){if(!_ok(arguments))return;if(fill===false){ctx.strokeStyle=c||C.ink;ctx.lineWidth=2;ctx.strokeRect(x,y,w,h)}else{ctx.fillStyle=c||C.slate;ctx.fillRect(x,y,w,h)}}
function _rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function box(x,y,w,h,c,label){if(!_ok(arguments))return;c=c||C.blue;ctx.save();ctx.shadowColor='rgba(15,39,66,.22)';ctx.shadowBlur=14;ctx.shadowOffsetY=5;var g=ctx.createLinearGradient(x,y,x,y+h);g.addColorStop(0,tint(c,.75));g.addColorStop(1,c);ctx.fillStyle=g;_rr(x,y,w,h,Math.min(12,h/3,w/3));ctx.fill();ctx.restore();if(label)text(label,x+w/2,y+h/2+4,'#fff',13,'center',700)}
function text(s,x,y,c,size,align,weight){if(!_ok(arguments))return;ctx.fillStyle=c||C.ink;ctx.font=(weight||500)+' '+(size||13)+"px InterV,NotoBn,system-ui,sans-serif";ctx.textAlign=align||'left';ctx.fillText(String(s),x,y)}
var _lb=[];
function label(s,x,y,c){if(!_ok(arguments))return;ctx.save();ctx.font="600 12px InterV,NotoBn,system-ui,sans-serif";var w=ctx.measureText(String(s)).width+20,h=26,offs=[0,-30,30,-60,60,-90,90,-120,120],px=clamp(x,w/2+8,W-w/2-8),py=clamp(y,16,H-16);for(var k=0;k<offs.length;k++){var ty=clamp(y+offs[k],16,H-16),ok=true;for(var j=0;j<_lb.length;j++){var r=_lb[j];if(Math.abs(px-r[0])<(w+r[2])/2+4&&Math.abs(ty-r[1])<h+4){ok=false;break}}if(ok){py=ty;break}}_lb.push([px,py,w]);ctx.shadowColor='rgba(59,130,246,.25)';ctx.shadowBlur=10;ctx.shadowOffsetY=3;ctx.fillStyle='rgba(255,255,255,.92)';_rr(px-w/2,py-13,w,h,13);ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle=tint(c||C.blue,.5);ctx.lineWidth=1.2;ctx.stroke();ctx.fillStyle=c||C.ink;ctx.textAlign='center';ctx.fillText(String(s),px,py+4);ctx.restore()}
function arrow(x1,y1,x2,y2,c,lab){if(!_ok(arguments))return;c=c||C.blue;var a=Math.atan2(y2-y1,x2-x1);line(x1,y1,x2-7*Math.cos(a),y2-7*Math.sin(a),c,3);ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-12*Math.cos(a-.42),y2-12*Math.sin(a-.42));ctx.lineTo(x2-12*Math.cos(a+.42),y2-12*Math.sin(a+.42));ctx.closePath();ctx.fill();if(lab)label(lab,(x1+x2)/2-Math.sin(a)*16,(y1+y2)/2+Math.cos(a)*16,c)}
function spring(x1,y1,x2,y2,coils,c){if(!_ok(arguments))return;var n=coils||8,dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,ux=dx/L,uy=dy/L,nx=-uy,ny=ux;ctx.save();ctx.strokeStyle=c||C.slate;ctx.lineWidth=2.4;ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(x1,y1);for(var i=0;i<=n*2;i++){var t=(i+.5)/(n*2+1),a=(i==0||i==n*2)?0:(i%2?1:-1)*9;ctx.lineTo(x1+dx*t+nx*a,y1+dy*t+ny*a)}ctx.lineTo(x2,y2);ctx.stroke();ctx.restore()}
function lens(cx,cy,h,kind,c){if(!_ok(arguments))return;c=c||C.sky;ctx.save();ctx.shadowColor='rgba(59,130,246,.3)';ctx.shadowBlur=16;ctx.shadowOffsetY=4;var g=ctx.createLinearGradient(cx-16,0,cx+16,0);g.addColorStop(0,tint(c,.35));g.addColorStop(.5,tint(c,.8));g.addColorStop(1,tint(c,.35));ctx.fillStyle=g;ctx.beginPath();if(kind==='concave'){ctx.moveTo(cx-14,cy-h);ctx.lineTo(cx+14,cy-h);ctx.quadraticCurveTo(cx-6,cy,cx+14,cy+h);ctx.lineTo(cx-14,cy+h);ctx.quadraticCurveTo(cx+6,cy,cx-14,cy-h)}else{ctx.moveTo(cx,cy-h);ctx.quadraticCurveTo(cx+30,cy,cx,cy+h);ctx.quadraticCurveTo(cx-30,cy,cx,cy-h)}ctx.closePath();ctx.fill();ctx.shadowColor='transparent';ctx.strokeStyle=c;ctx.lineWidth=2;ctx.stroke();ctx.restore()}
function poly(pts,c,fill){pts=pts.map(function(p){return Array.isArray(p)?p:[p.x,p.y]});for(var q=0;q<pts.length;q++){if(!isFinite(pts[q][0]+pts[q][1]))return}ctx.beginPath();pts.forEach(function(p,i){i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])});ctx.closePath();if(fill===false){ctx.strokeStyle=c||C.ink;ctx.lineWidth=2;ctx.stroke()}else{ctx.fillStyle=c||C.blue;ctx.fill()}}
function ground(y,c){if(!_ok(arguments))return;var g=ctx.createLinearGradient(0,y,0,H);g.addColorStop(0,tint(c||C.sky,.28));g.addColorStop(1,tint(c||C.sky,.05));ctx.fillStyle=g;ctx.fillRect(0,y,W,H-y);line(0,y,W,y,c||C.sky,3)}
function wrapText(s,x,y,maxW,lh,c,size){if(!_ok(arguments))return;ctx.font='500 '+(size||13)+"px InterV,NotoBn,system-ui,sans-serif";var words=String(s).split(' '),ln='',yy=y;ctx.fillStyle=c||C.ink;ctx.textAlign='left';words.forEach(function(w){var t=ln?ln+' '+w:w;if(ctx.measureText(t).width>maxW&&ln){ctx.fillText(ln,x,yy);ln=w;yy+=lh}else ln=t});if(ln)ctx.fillText(ln,x,yy);return yy+lh}
function _ticks(a,b,n){var span=b-a||1,raw=span/(n||5),mag=Math.pow(10,Math.floor(Math.log10(raw))),r=raw/mag,st=(r<1.5?1:r<3?2:r<7?5:10)*mag,out=[];for(var v=Math.ceil(a/st)*st;v<=b+st*1e-6;v+=st)out.push(+v.toFixed(10));return out}
function axes(x0,x1,y0,y1,xl,yl,box){var X=box||[56,26,W-26,H-46];ctx.save();ctx.font="500 11px InterV,sans-serif";_ticks(x0,x1,6).forEach(function(v){var px=X[0]+(v-x0)/(x1-x0)*(X[2]-X[0]);line(px,X[1],px,X[3],C.grid,1);ctx.fillStyle=C.mute;ctx.textAlign='center';ctx.fillText(+v.toPrecision(4),px,X[3]+16)});_ticks(y0,y1,5).forEach(function(v){var py=X[3]-(v-y0)/(y1-y0)*(X[3]-X[1]);line(X[0],py,X[2],py,C.grid,1);ctx.fillStyle=C.mute;ctx.textAlign='right';ctx.fillText(+v.toPrecision(4),X[0]-8,py+4)});line(X[0],X[3],X[2],X[3],C.mute,1.5);line(X[0],X[1],X[0],X[3],C.mute,1.5);ctx.fillStyle=C.ink;ctx.font="600 12px InterV,NotoBn,sans-serif";ctx.textAlign='right';if(xl)ctx.fillText(xl,X[2],H-10);ctx.textAlign='left';if(yl)ctx.fillText(yl,X[0]+6,X[1]-8);ctx.restore()}
function plot(f,x0,x1,y0,y1,c,box){var X=box||[56,26,W-26,H-46];ctx.save();ctx.beginPath();ctx.rect(X[0],X[1],X[2]-X[0],X[3]-X[1]);ctx.clip();ctx.strokeStyle=c||C.blue;ctx.lineWidth=3;ctx.lineJoin='round';ctx.beginPath();for(var i=0;i<=240;i++){var x=x0+(x1-x0)*i/240,y=f(x),px=X[0]+(x-x0)/(x1-x0)*(X[2]-X[0]),py=X[3]-(y-y0)/(y1-y0)*(X[3]-X[1]);i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.stroke();ctx.restore()}
function chart(o){var X=o.box||[64,40,W-28,H-56],type=o.type||'line',S=o.series||[],labels=o.labels||[],mx=-1e99,mn=1e99;S.forEach(function(s){s.values.forEach(function(v){mx=Math.max(mx,v);mn=Math.min(mn,v)})});if(type=='bar')mn=Math.min(0,mn);var pad=(mx-mn)*.12||1;mx+=pad;if(type!='bar')mn-=pad;if(o.title)text(o.title,X[0],22,C.ink,14,'left',700);
var n=Math.max(1,labels.length||S[0].values.length);_ticks(mn,mx,5).forEach(function(v){var py=X[3]-(v-mn)/(mx-mn)*(X[3]-X[1]);line(X[0],py,X[2],py,C.grid,1);text(+v.toPrecision(4),X[0]-8,py+4,C.mute,11,'right')});line(X[0],X[3],X[2],X[3],C.mute,1.5);
var bw=(X[2]-X[0])/n;labels.forEach(function(l,i){text(l,X[0]+bw*(i+.5),X[3]+16,C.mute,11,'center')});
S.forEach(function(s,k){var col=s.color||PAL[k%PAL.length];if(type=='bar'){var g=bw*.7/S.length;s.values.forEach(function(v,i){var h=(v-Math.min(mn,0))/(mx-mn)*(X[3]-X[1]),x=X[0]+bw*i+bw*.15+g*k,y0=X[3]-(0-mn)/(mx-mn)*(X[3]-X[1]);var gr=ctx.createLinearGradient(0,y0-h,0,y0);gr.addColorStop(0,col);gr.addColorStop(1,tint(col,.55));ctx.fillStyle=gr;_rr(x,Math.min(y0,y0-h),g-3,Math.abs(h),4);ctx.fill()})}else{ctx.strokeStyle=col;ctx.lineWidth=3;ctx.lineJoin='round';ctx.beginPath();s.values.forEach(function(v,i){var px=X[0]+bw*(i+.5),py=X[3]-(v-mn)/(mx-mn)*(X[3]-X[1]);i?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.stroke();s.values.forEach(function(v,i){circle(X[0]+bw*(i+.5),X[3]-(v-mn)/(mx-mn)*(X[3]-X[1]),4,col)})}});
S.forEach(function(s,k){var col=s.color||PAL[k%PAL.length],lx=X[2]-110;circle(lx,22+k*18,5,col);text(s.name||('Series '+(k+1)),lx+12,26+k*18,C.ink,12)});if(o.yLabel)text(o.yLabel,X[0]+4,X[1]-6,C.mute,11)}
function timeline(ev,cur,box){var X=box||[50,40,W-50,100],a=ev[0].at,b=ev[ev.length-1].at,act=ev[0];ev.forEach(function(e){if(e.at<=cur)act=e});var py=X[1]+30;line(X[0],py,X[2],py,C.ice,10);line(X[0],py,X[0]+(cur-a)/(b-a)*(X[2]-X[0]),py,C.sky,10);ev.forEach(function(e,i){var px=X[0]+(e.at-a)/(b-a)*(X[2]-X[0]),on=e.at<=cur;ctx.save();ctx.shadowColor=on?'rgba(56,189,248,.6)':'transparent';ctx.shadowBlur=on?14:0;circle(px,py,e===act?11:7,on?C.blue:'#fff');ctx.restore();circle(px,py,e===act?11:7,on?C.blue:C.slate,false);text(e.at,px,py+(i%2?-18:30),on?C.ink:C.mute,11,'center',on?700:500)});
var cx=40,cy=py+60,cw=W-80,chh=H-cy-24;ctx.save();ctx.shadowColor='rgba(59,130,246,.2)';ctx.shadowBlur=18;ctx.shadowOffsetY=6;ctx.fillStyle='rgba(255,255,255,.95)';_rr(cx,cy,cw,chh,16);ctx.fill();ctx.restore();text(act.at+'  ·  '+act.label,cx+20,cy+30,C.blue,16,'left',700);if(act.detail)wrapText(act.detail,cx+20,cy+58,cw-40,20,C.ink,13);return act}
function drawBodies(eng,colors){if(typeof Matter==='undefined')return;Matter.Composite.allBodies(eng.world).forEach(function(b,i){var col=(colors&&colors[b.label])||(b.isStatic?'#cbd5e1':PAL[i%PAL.length]);ctx.save();if(!b.isStatic){ctx.shadowColor='rgba(15,39,66,.22)';ctx.shadowBlur=12;ctx.shadowOffsetY=4}var v=b.vertices;if(b.circleRadius){var g=ctx.createRadialGradient(b.position.x-b.circleRadius*.3,b.position.y-b.circleRadius*.4,1,b.position.x,b.position.y,b.circleRadius);g.addColorStop(0,'#fff');g.addColorStop(.3,tint(col,.6));g.addColorStop(1,col);ctx.fillStyle=g;ctx.beginPath();ctx.arc(b.position.x,b.position.y,b.circleRadius,0,6.2832);ctx.fill()}else{var gg=ctx.createLinearGradient(0,b.bounds.min.y,0,b.bounds.max.y);gg.addColorStop(0,tint(col,.7));gg.addColorStop(1,col);ctx.fillStyle=gg;ctx.beginPath();ctx.moveTo(v[0].x,v[0].y);for(var j=1;j<v.length;j++)ctx.lineTo(v[j].x,v[j].y);ctx.closePath();ctx.fill()}ctx.restore()})}
function stepEngine(eng,dt){var ms=Math.min(100,(dt||.016)*1000);while(ms>0){var s=Math.min(16.667,ms);Matter.Engine.update(eng,s);ms-=s}}
function mapView(lat,lng,zoom){var mb=document.getElementById('mapbox');mb.style.display='block';cv.style.display='none';var m=L.map(mb,{zoomControl:true,attributionControl:true}).setView([lat,lng],zoom||5);L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{attribution:'&copy; OpenStreetMap contributors &copy; CARTO',maxZoom:18}).addTo(m);return m}
['clear','line','circle','ball','rect','box','text','label','arrow','spring','poly','lens','ground','wrapText','axes','plot','chart','timeline','drawBodies'].forEach(function(n){var f=window[n];if(typeof f!=='function')return;window[n]=function(){try{return f.apply(this,arguments)}catch(e){if(!window.__warned){window.__warned=1;try{parent.postMessage({simWarn:n+': '+(e&&e.message)},'*')}catch(x){}}}}});
/* ---------- pointer ---------- */
function _pt(e){var r=cv.getBoundingClientRect();M.x=(e.clientX-r.left)/r.width*W;M.y=(e.clientY-r.top)/r.height*H}
cv.addEventListener('pointerdown',function(e){M.down=true;_pt(e);try{cv.setPointerCapture(e.pointerId)}catch(x){}if(_drag)_drag(M.x,M.y,'down')});
cv.addEventListener('pointermove',function(e){_pt(e);if(_drag)_drag(M.x,M.y,M.down?'drag':'move')});
cv.addEventListener('pointerup',function(e){M.down=false;_pt(e);if(_drag)_drag(M.x,M.y,'up')});
function onDrag(fn){_drag=fn}
/* ---------- main loop ---------- */
document.getElementById('pp').onclick=function(){_paused=!_paused;this.textContent=_paused?'Play':'Pause'};
document.getElementById('rs').onclick=restart;
try{var _lastH=0;new ResizeObserver(function(){var h=document.documentElement.scrollHeight;if(Math.abs(h-_lastH)>3){_lastH=h;parent.postMessage({simH:h},'*')}}).observe(document.body)}catch(e){}
function _renderFormula(){if(!_formula)return;var s=typeof _formula==='function'?_formula():_formula;if(s===_fcache)return;_fcache=s;var d=document.getElementById('formula');s=String(s).replace(/~(?=[a-zA-Z{,;!])/g,'\\');try{if(window.katex)katex.render(s,d,{throwOnError:false});else{d.textContent=s;try{parent.postMessage({simLib:'katex undefined'},'*')}catch(x){}}}catch(e){d.textContent=s;try{parent.postMessage({simLib:'katex threw: '+e.message},'*')}catch(x){}}}
function _tick(now){var dt=Math.min(.05,(now-_last)/1000);_last=now;if(_first){_first=false;try{parent.postMessage({simFrame:1},'*')}catch(e){}}if(!_paused)_tp+=dt;if(_fn){try{ctx.save();_fn(_tp,_paused?0:dt);ctx.restore()}catch(e){_fn=null;_err(e)}}_outs.forEach(function(o){try{var v=o[1]();o[0].textContent=typeof v==='number'?(Math.abs(v)>=100?v.toFixed(0):v.toFixed(2)):v}catch(e){}});try{_renderFormula()}catch(e){}requestAnimationFrame(_tick)}
`;


const HARNESS_BD = String.raw`
var _BD=__BD_DATA__;
function bdMap(box){var b=_BD.bbox,k=Math.cos((b[1]+b[3])/2*Math.PI/180),w=(b[2]-b[0])*k,h=b[3]-b[1],sc=Math.min((box[2]-box[0])/w,(box[3]-box[1])/h),ox=box[0]+((box[2]-box[0])-w*sc)/2,oy=box[1]+((box[3]-box[1])-h*sc)/2;return function(lat,lng){return [ox+(lng-b[0])*k*sc,oy+(b[3]-lat)*sc]}}
function _bdPath(pj){ctx.beginPath();_BD.outline.forEach(function(r){r.forEach(function(p,i){var q=pj(p[1],p[0]);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.closePath()})}
function bdOutline(pj,fill,stroke){_bdPath(pj);ctx.save();ctx.shadowColor='rgba(59,130,246,.3)';ctx.shadowBlur=18;ctx.shadowOffsetY=6;ctx.fillStyle=fill||'#dff1ff';ctx.fill();ctx.restore();ctx.strokeStyle=stroke||C.blue;ctx.lineWidth=2;ctx.lineJoin='round';ctx.stroke()}
function bdRegion(pj,name,color,alpha){var r=_BD.regions[name];if(!r)return;ctx.save();_bdPath(pj);ctx.clip();ctx.beginPath();r.forEach(function(p,i){var q=pj(p[0],p[1]);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.closePath();ctx.fillStyle=tint(color||C.teal,alpha==null?.55:alpha);ctx.fill();ctx.restore()}
function bdRiver(pj,name,color,w){var r=_BD.rivers[name];if(!r)return;ctx.save();_bdPath(pj);ctx.clip();ctx.strokeStyle=color||C.sky;ctx.lineWidth=w||3;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();r.forEach(function(p,i){var q=pj(p[0],p[1]);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1])});ctx.stroke();ctx.restore()}
function bdRivers(pj,color,w){Object.keys(_BD.rivers).forEach(function(n){bdRiver(pj,n,color,w)})}
function bdCity(pj,name,color){var c=_BD.cities[name];if(!c)return null;var q=pj(c[0],c[1]);circle(q[0],q[1],5,color||C.rose);circle(q[0],q[1],5,'#fff',false);label(name,q[0]+4,q[1]-16,color||C.ink);return q}
function bdPoint(pj,lat,lng){return pj(lat,lng)}
['bdOutline','bdRegion','bdRiver','bdRivers','bdCity'].forEach(function(n){var f=window[n];window[n]=function(){try{return f.apply(this,arguments)}catch(e){}}});
`;

export interface SimNeeds {
  katex: boolean;
  matter: boolean;
  leaflet: boolean;
  bd: boolean; // Bangladesh geography helpers (bdMap, bdOutline, ...)
}

/** Which optional libraries a script uses. */
export function detectNeeds(script: string): SimNeeds {
  return {
    katex: /\bformula\s*\(/.test(script),
    matter: /\bMatter\b|\bdrawBodies\b|\bstepEngine\b/.test(script),
    leaflet: /\bmapView\b/.test(script),
    bd: /\bbd[A-Z]\w*\s*\(/.test(script),
  };
}

/** Library source text, loaded by the parent page (sandboxed iframes can't fetch from the local server). */
export interface SimAssets {
  fontsCss: string;
  katexCss?: string;
  katexJs?: string;
  matterJs?: string;
  leafletCss?: string;
  leafletJs?: string;
}

const inlineJs = (js: string) => `<script>${js.replace(/<\/script/gi, "<\\/script")}</script>`;

export function buildSimHtml(script: string, a: SimAssets): string {
  const safe = script.replace(/<\/script/gi, "<\\/script");
  const css = [a.fontsCss, a.katexCss, a.leafletCss].filter(Boolean).join("\n");
  const bdCode = detectNeeds(script).bd ? HARNESS_BD.replace("__BD_DATA__", JSON.stringify(BD_GEO)) : "";
  const libs = [a.katexJs, a.matterJs, a.leafletJs].filter(Boolean).map((j) => inlineJs(j as string)).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${CSS}\n${css}</style></head><body>${MARKUP}${libs}<script>${HARNESS}${bdCode}
try{(function(){${safe}\n})()}catch(e){_err(e)}
requestAnimationFrame(_tick);
</script></body></html>`;
}
