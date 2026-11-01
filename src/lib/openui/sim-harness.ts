/**
 * Sandbox harness for SimCanvas. The model only writes a short script against this tiny API;
 * everything else (canvas, sliders, play/pause, error display) lives here.
 */
export function buildSimHtml(script: string): string {
  const safe = script.replace(/<\/script/gi, "<\\/script");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{box-sizing:border-box}body{margin:0;background:#0b1220;color:#e2e8f0;font:13px system-ui,sans-serif}
#wrap{padding:10px}canvas{width:100%;height:auto;border-radius:10px;background:#050a14;display:block;border:1px solid #1e293b}
.ctl{display:grid;grid-template-columns:minmax(90px,150px) 1fr 80px;gap:8px;align-items:center;margin:7px 0}
.ctl input[type=range]{accent-color:#6366f1;width:100%}.val{font-variant-numeric:tabular-nums;color:#a5b4fc;text-align:right}
#outs{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.out{background:#111c33;border:1px solid #243049;border-radius:8px;padding:5px 9px}.out b{color:#a5b4fc}
button{background:#4f46e5;color:#fff;border:0;border-radius:8px;padding:6px 12px;font-weight:600;cursor:pointer;margin-right:6px}button:hover{background:#6366f1}
#err{color:#fca5a5;background:#450a0a;border-radius:8px;padding:8px;margin-top:8px;display:none;white-space:pre-wrap}
</style></head><body><div id="wrap"><canvas id="cv" width="720" height="380"></canvas><div id="ctls"></div><div id="outs"></div><div id="btns"><button id="pp">Pause</button><button id="rs">Restart</button></div><div id="err"></div></div><script>
try{parent.postMessage({simReady:1},'*')}catch(e){}
var cv=document.getElementById('cv'),ctx=cv.getContext('2d'),W=720,H=380,P={},_fn=null,_t0=performance.now(),_last=_t0,_paused=false,_outs=[],_tp=0;
function _err(e){try{parent.postMessage({simError:String(e&&e.message||e)},'*')}catch(x){}var d=document.getElementById('err');d.style.display='block';d.textContent='Simulation error: '+(e&&e.message||e)}
function slider(key,label,min,max,step,def,unit){P[key]=def;var r=document.createElement('div');r.className='ctl';var l=document.createElement('span');l.textContent=label;var i=document.createElement('input');i.type='range';i.min=min;i.max=max;i.step=step;i.value=def;var v=document.createElement('span');v.className='val';function s(){v.textContent=(+i.value).toFixed(step<1?2:0)+(unit?' '+unit:'')}s();i.oninput=function(){P[key]=+i.value;s()};r.append(l,i,v);document.getElementById('ctls').appendChild(r)}
function toggle(key,label,def){P[key]=!!def;var r=document.createElement('label');r.className='ctl';var i=document.createElement('input');i.type='checkbox';i.checked=!!def;i.onchange=function(){P[key]=i.checked};var l=document.createElement('span');l.textContent=label;r.append(i,l);document.getElementById('ctls').appendChild(r)}
function button(label,fn){var b=document.createElement('button');b.textContent=label;b.onclick=function(){try{fn()}catch(e){_err(e)}};document.getElementById('btns').appendChild(b)}
function readout(label,fn){var d=document.createElement('div');d.className='out';d.innerHTML=label+': <b></b>';document.getElementById('outs').appendChild(d);_outs.push([d.lastChild,fn])}
function restart(){_t0=performance.now();_tp=0}
function clear(c){ctx.fillStyle=c||'#050a14';ctx.fillRect(0,0,W,H)}
function line(x1,y1,x2,y2,c,w){ctx.strokeStyle=c||'#e2e8f0';ctx.lineWidth=w||2;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke()}
function circle(x,y,r,c,fill){ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,6.2832);if(fill===false){ctx.strokeStyle=c||'#e2e8f0';ctx.lineWidth=2;ctx.stroke()}else{ctx.fillStyle=c||'#6366f1';ctx.fill()}}
function rect(x,y,w,h,c,fill){if(fill===false){ctx.strokeStyle=c||'#e2e8f0';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h)}else{ctx.fillStyle=c||'#334155';ctx.fillRect(x,y,w,h)}}
function text(s,x,y,c,size,align){ctx.fillStyle=c||'#e2e8f0';ctx.font=(size||14)+'px system-ui';ctx.textAlign=align||'left';ctx.fillText(String(s),x,y)}
function arrow(x1,y1,x2,y2,c){line(x1,y1,x2,y2,c,2);var a=Math.atan2(y2-y1,x2-x1);ctx.fillStyle=c||'#e2e8f0';ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2-10*Math.cos(a-.4),y2-10*Math.sin(a-.4));ctx.lineTo(x2-10*Math.cos(a+.4),y2-10*Math.sin(a+.4));ctx.fill()}
function plot(f,x0,x1,y0,y1,c,box){var X=box||[40,20,W-20,H-30],px=function(x){return X[0]+(x-x0)/(x1-x0)*(X[2]-X[0])},py=function(y){return X[3]-(y-y0)/(y1-y0)*(X[3]-X[1])};ctx.strokeStyle=c||'#34d399';ctx.lineWidth=2;ctx.beginPath();for(var i=0;i<=200;i++){var x=x0+(x1-x0)*i/200,y=f(x);i?ctx.lineTo(px(x),py(y)):ctx.moveTo(px(x),py(y))}ctx.stroke()}
function axes(x0,x1,y0,y1,xl,yl,box){var X=box||[40,20,W-20,H-30];line(X[0],X[3],X[2],X[3],'#64748b',1);line(X[0],X[1],X[0],X[3],'#64748b',1);text(xl||'',X[2],H-8,'#94a3b8',12,'right');text(yl||'',X[0]+4,X[1]+10,'#94a3b8',12)}
function loop(fn){_fn=fn}
document.getElementById('pp').onclick=function(){_paused=!_paused;this.textContent=_paused?'Play':'Pause'};
document.getElementById('rs').onclick=restart;
var _first=true;function _tick(now){if(_first){_first=false;try{parent.postMessage({simFrame:1},'*')}catch(e){}}var dt=Math.min(.05,(now-_last)/1000);_last=now;if(!_paused)_tp+=dt;if(_fn){try{_fn(_tp,dt)}catch(e){_fn=null;_err(e)}}_outs.forEach(function(o){try{var v=o[1]();o[0].textContent=typeof v==='number'?(Math.abs(v)>=100?v.toFixed(0):v.toFixed(2)):v}catch(e){}});requestAnimationFrame(_tick)}
try{(function(){${safe}\n})()}catch(e){_err(e)}
requestAnimationFrame(_tick);
</script></body></html>`;
}
