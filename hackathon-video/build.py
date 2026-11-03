import json
# ---------- timeline constants (seconds) ----------
A0,B0,C0,D0,E0,F0,G0,END = 0,14.2,27.2,55.7,74.9,116.0,144.6,154
vids=[]; auds=[]; els=[]; js=[]
def V(id,src,start,dur,ms,rate=1,z=1,css=""):
    vids.append(f'<video id="{id}" class="clip vid" src="assets/footage/{src}.mp4" muted playsinline data-start="{start}" data-duration="{dur}" data-media-start="{ms}"'+(f' data-playback-rate="{rate}"' if rate!=1 else '')+f' data-track-index="{z}" style="z-index:{z};{css}"></video>')
def AU(id,n,start,dur):
    auds.append(f'<audio id="{id}" src="assets/vo/{n}.wav" data-start="{start}" data-duration="{dur:.2f}" data-volume="1" data-track-index="30"></audio>')
def E(html): els.append(html)
def clip(id,start,dur,cls,inner,z=10,style=""):
    E(f'<div id="{id}" class="clip {cls}" data-start="{start}" data-duration="{dur}" data-track-index="{z}" style="z-index:{z};{style}">{inner}</div>')
def IN(sel,t,d=0.5,y=24,x=0): js.append(f'tl.fromTo("{sel}",{{opacity:0,y:{y},x:{x}}},{{opacity:1,y:0,x:0,duration:{d},ease:"power3.out"}},{t});')
def OUT(sel,t,d=0.35): js.append(f'tl.to("{sel}",{{opacity:0,duration:{d},ease:"power2.in"}},{t});')
def FADE(sel,t,d=0.4): js.append(f'tl.fromTo("{sel}",{{opacity:0}},{{opacity:1,duration:{d},ease:"power2.out"}},{t});')

# ---------- audio ----------
AU("vo1","s1",0.5,12.27); AU("vo2","s2",14.5,11.89); AU("vo3","s3",29.2,18.28)
AU("vo4","s4",56.2,18.15); AU("vo5","s5",75.4,39.27); AU("vo6","s6",117.5,15.33); AU("vo7","s7",145.0,7.29)

# ---------- A: hook ----------
V("vh","reader",0,10.8,7.5,1,1)
clip("hveil",0,10.8,"veil","",2)
V("vt","math",10.0,4.2,12.0,1,3)
FADE("#vt",10.0,0.6); OUT("#vt",13.8,0.4)
for i,(t0,t1,txt) in enumerate([(0.6,4.6,"Every student in Bangladesh<br>learns from NCTB textbooks."),(4.9,9.0,"But a textbook can only<br>show a frozen diagram."),(9.3,14.0,"What if every topic<br>could <em>move</em>?")]):
    clip(f"h{i}",t0,t1-t0,"cap big",txt,12); IN(f"#h{i}",t0,0.6,30); OUT(f"#h{i}",t1-0.4)
js.append('tl.fromTo("#vh",{scale:1.0},{scale:1.08,duration:10.8,ease:"none"},0);')

# ---------- B: title ----------
clip("bbg",B0,13.0,"bg","",1)
books=[("b1",110,150,150,200,"#60a5fa,#93c5fd"),("b2",1650,120,130,176,"#38bdf8,#bae6fd"),("b3",230,760,170,226,"#a5d8ff,#dbeeff"),("b4",1560,700,150,200,"#3b82f6,#7dd3fc"),("b5",900,40,90,122,"#93c5fd,#e0f2fe")]
bk="".join(f'<div class="book" id="{i}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:linear-gradient(135deg,{c})"></div>' for i,x,y,w,h,c in books)
clip("bbooks",B0,13.0,"scene",bk,2)
for (i,*_),(dx,dy,r) in zip(books,[(20,30,-8),(-24,26,7),(28,-30,6),(-22,-24,-7),(16,22,9)]):
    js.append(f'tl.fromTo("#{i}",{{x:0,y:0,rotation:{-r}}},{{x:{dx},y:{dy},rotation:{r},duration:13,ease:"sine.inOut"}},{B0});')
clip("btitle",B0,13.0,"scene center",'<div class="chip" id="bchip">Meta Global AI Developer Hackathon</div><div id="brand">Simuplug</div><div id="tag">Any textbook topic, as an interactive simulation.</div><div class="row" id="brow"><span class="pill">Meta Muse Wonder 1.0</span><span class="pill">OpenUI Lang</span><span class="pill">Neon pgvector</span><span class="pill">EmbeddingGemma 2</span></div><div id="built">Everything shown was built during the hackathon</div>',5)
IN("#bchip",B0+0.3,0.6); IN("#brand",B0+0.5,0.8,50); IN("#tag",B0+1.1,0.6); IN("#brow",B0+3.4,0.6); IN("#built",B0+7.0,0.6)
OUT("#btitle",B0+12.5,0.5); OUT("#bbooks",B0+12.5,0.5); OUT("#bbg",B0+12.6,0.4)

# ---------- C: physics, live ----------
V("c1","physics",C0,6.9,0.8,1,1); V("c2","physics",C0+6.9,4.2,7.73,4,1); V("c3","physics",C0+11.1,17.4,24.6,1,1)
clip("cchip",C0+0.8,27.4,"chipbar",'<b>PHYSICS</b> · Physics 9, §3.6 · Newton’s second law',12); IN("#cchip",C0+0.8,0.5); OUT("#cchip",C0+27.9)
clip("clapse",C0+6.9,4.2,"badge",'⏩ TIME-LAPSE ×4 &nbsp;·&nbsp; Muse Wonder is writing the simulation live',13); IN("#clapse",C0+6.9,0.4,-16); OUT("#clapse",C0+10.8,0.3)
clip("clive",C0+11.3,6.5,"badge ok",'✓ Generated live &nbsp;·&nbsp; validated &nbsp;·&nbsp; stored in Neon',13); IN("#clive",C0+11.3,0.4,-16); OUT("#clive",C0+17.5,0.4)

# ---------- D: every subject ----------
clip("dbg",D0,19.2,"bg","",1)
tiles=[("dt1","physics",30.7,100,48,"PHYSICS"),("dt2","chemistry",15.6,980,48,"CHEMISTRY"),("dt3","biology",12.5,100,560,"BIOLOGY"),("dt4","math",12.2,980,560,"MATHEMATICS")]
for k,(i,src,ms,x,y,lab) in enumerate(tiles):
    V(i,src,D0,3.4,ms,1,3,f"left:{x}px;top:{y}px;width:840px;height:472px;")
    clip(f"{i}l",D0,3.4,"tilelab",lab,4,f"left:{x+20}px;top:{y+20}px;")
    FADE(f"#{i}",D0+0.15+k*0.25,0.5); FADE(f"#{i}l",D0+0.5+k*0.25,0.4)
    OUT(f"#{i}",D0+3.0,0.4); OUT(f"#{i}l",D0+3.0,0.3)
full=[("df1","chemistry",16.2,D0+3.4,2.9,"CHEMISTRY","Rutherford’s atomic model"),("df2","biology",12.3,D0+6.3,3.4,"BIOLOGY","Photosynthesis inside a leaf"),("df3","math",12.2,D0+9.7,4.8,"MATHEMATICS","The Pythagorean theorem"),("df4","bangladesh",13.9,D0+14.5,4.7,"GEOGRAPHY","Land configuration of Bangladesh, on a real map")]
for i,src,ms,st,du,lab,sub in full:
    V(i,src,st,du,ms,1,5); FADE(f"#{i}",st,0.35)
    clip(f"{i}c",st+0.1,du-0.2,"chipbar",f"<b>{lab}</b> · {sub}",12); IN(f"#{i}c",st+0.15,0.45); OUT(f"#{i}c",st+du-0.55,0.3)
OUT("#dbg",D0+18.8,0.4)

# ---------- E: how it works ----------
clip("ebg",E0,41.1,"bg","",1)
rail="".join(f'<div class="rp" id="rp{i}"><span>{i+1}</span>{n}</div>' for i,n in enumerate(["Retrieve","Generate","Validate","Remember"]))
clip("erail",E0,41.1,"rail",rail,6); IN("#erail",E0+0.3,0.6,-20)
for i in range(4):
    js.append(f'tl.set("#rp{i}",{{className:"rp"}},{E0});')
act=[(2.3,13.2),(13.4,18.3),(18.4,31.8),(32.2,41.0)]
for i,(a,b) in enumerate(act):
    js.append(f'tl.to("#rp{i}",{{backgroundColor:"#3b82f6",color:"#ffffff",duration:0.4}},{E0+a});')
    if i<3: js.append(f'tl.to("#rp{i}",{{backgroundColor:"rgba(255,255,255,0.75)",color:"#1d4ed8",duration:0.4}},{E0+b});')
# panel 1
n1=[("22","textbooks","OCR’d NCTB books"),("2,647","sections","chunked by chapter"),("768-d","EmbeddingGemma 2","local embeddings"),("pgvector","Neon Postgres","HNSW cosine search")]
cards="".join(f'<div class="node" id="n1_{i}"><div class="big" id="n1v{i}">{v}</div><div class="nt">{t}</div><div class="ns">{s}</div></div>'+('<div class="arr" id="a1_%d">→</div>'%i if i<3 else '') for i,(v,t,s) in enumerate(n1))
clip("ep1",E0+2.3,10.9,"panel",f'<div class="flow">{cards}</div><div class="note" id="n1note">Retrieval finds the page… but a page is still just a page.</div>',7)
for i,t in enumerate([0.0,2.4,5.0,7.0]):
    IN(f"#n1_{i}",E0+2.4+t,0.6,30)
    if i<3: IN(f"#a1_{i}",E0+2.9+t+ [0,0,0][i],0.4,0,-12)
IN("#n1note",E0+10.6,0.6,16); OUT("#ep1",E0+13.0,0.4)
js.append(f'var c22={{v:0}},c26={{v:0}};tl.to(c22,{{v:22,duration:0.9,ease:"power2.out",onUpdate:function(){{document.getElementById("n1v0").textContent=Math.round(c22.v)}}}},{E0+2.5});tl.to(c26,{{v:2647,duration:1.3,ease:"power2.out",onUpdate:function(){{document.getElementById("n1v1").textContent=Math.round(c26.v).toLocaleString("en-US")}}}},{E0+4.9});')
# panel 2
code=["root = Stack([header, explainer, sim, points])","sim = SimCanvas(\"Push the block: force creates acceleration\",","  \"slider('F','Applied force F',0,100,5,50,'N');","   slider('m','Mass m',1,20,1,5,'kg');","   formula(function(){ return 'F = ma ⇒ a = F/m' });","   loop(function(t,dt){ clear(); var a = P.F/P.m; … })\")"]
lines="".join(f'<div class="cl" id="cl{i}">{l.replace("<","&lt;")}</div>' for i,l in enumerate(code))
clip("ep2",E0+13.4,5.0,"panel",f'<div class="gen"><div class="mw"><div class="mwt">Muse Wonder 1.0</div><div class="mws">Meta Model API</div><div class="mwp">prompt: section text + figures<br>→ OpenUI Lang program</div></div><div class="codewin"><div class="cwh">Real output · “Newton’s second law”</div>{lines}</div></div>',7)
IN("#ep2 .mw",E0+13.5,0.6,30); IN("#ep2 .codewin",E0+13.7,0.6,30)
for i in range(len(code)): IN(f"#cl{i}",E0+14.4+i*0.5,0.35,10)
OUT("#ep2",E0+18.0,0.4)
# panel 3
chk=[("Parse OpenUI Lang","valid components, no hallucinated tags","ok"),("Syntax check","the simulation script compiles","ok"),("Sandbox dry-run","crashes · NaN values · overlapping text","bad"),("Repair loop","Muse fixes its own code from the error report","fix")]
rows="".join(f'<div class="ck" id="ck{i}"><div class="ci" id="ci{i}">'+('<i class="g gw">…</i><i class="g gx">✕</i><i class="g gv">✓</i>' if k=="bad" else "✓")+f'</div><div><div class="ct">{t}</div><div class="cs">{s}</div></div></div>' for i,(t,s,k) in enumerate(chk))
clip("ep3",E0+18.4,13.4,"panel",f'<div class="checks">{rows}</div><div class="valid" id="valid">✓ Valid → stored in Neon</div>',7)
for i,t in enumerate([0.6,2.6,5.0,10.2]): IN(f"#ck{i}",E0+18.4+t,0.55,24)
F3=E0+18.4
js.append(f'tl.set("#ci2",{{backgroundColor:"#f59e0b"}},{E0});tl.set("#ci2 .gw",{{opacity:1}},{E0});tl.set("#ci2 .gx",{{opacity:0}},{E0});tl.set("#ci2 .gv",{{opacity:0}},{E0});')
js.append(f'tl.to("#ci2",{{backgroundColor:"#f43f5e",duration:0.3}},{F3+8.6});tl.to("#ci2 .gw",{{opacity:0,duration:0.2}},{F3+8.6});tl.to("#ci2 .gx",{{opacity:1,duration:0.2}},{F3+8.7});')
js.append(f'tl.to("#ci2",{{backgroundColor:"#10b981",duration:0.3}},{F3+11.9});tl.to("#ci2 .gx",{{opacity:0,duration:0.2}},{F3+11.9});tl.to("#ci2 .gv",{{opacity:1,duration:0.2}},{F3+12.0});')
IN("#valid",E0+18.4+11.6,0.5,16); OUT("#ep3",E0+31.4,0.4)
# panel 4
jr=[("Rutherford’s atomic model","Bohr’s atomic model","DIFFERENT topic","generate a new simulation","bad"),("Newton’s second law","F = ma explained","SAME topic","reuse from Neon, instantly","ok")]
jh="".join(f'<div class="jr" id="jr{i}"><div class="q">{a}</div><div class="vs">vs</div><div class="q">{b}</div><div class="verdict {k}"><b>{v}</b><span>{d}</span></div></div>' for i,(a,b,v,d,k) in enumerate(jr))
clip("ep4",E0+32.2,8.9,"panel",f'<div class="judge"><div class="jt">Cached per topic · a Muse judge decides</div>{jh}</div>',7)
IN("#ep4 .jt",E0+32.4,0.5,16); IN("#jr0",E0+33.6,0.6,24); IN("#jr1",E0+36.2,0.6,24); OUT("#ep4",E0+40.5,0.4)
OUT("#erail",E0+40.6,0.4); OUT("#ebg",E0+40.7,0.4)

# ---------- F: reader ----------
V("f1","reader",F0,15.5,4.3,1,1); V("f2","reader",F0+15.5,4.6,19.8,5,1); V("f3","reader",F0+20.1,8.5,43.0,1,1)
clip("fc1",F0+1.5,5.2,"chipbar","Upload the <b>real NCTB PDF</b>",12); IN("#fc1",F0+1.5,0.5); OUT("#fc1",F0+6.4,0.3)
clip("fc2",F0+7.4,7.2,"chipbar","Matched to word positions <b>stored in Neon</b> · no OCR in the browser",12); IN("#fc2",F0+7.4,0.5); OUT("#fc2",F0+14.3,0.3)
clip("fc3",F0+15.5,4.6,"badge","⏩ TIME-LAPSE ×5 &nbsp;·&nbsp; generating for the highlighted text",13); IN("#fc3",F0+15.6,0.4,-16); OUT("#fc3",F0+19.8,0.3)
clip("fc4",F0+20.6,7.5,"chipbar","Highlight → <b>Simulate</b> → opens beside the page",12); IN("#fc4",F0+20.6,0.5); OUT("#fc4",F0+27.6,0.3)

# ---------- G: end ----------
clip("gbg",G0,END-G0,"bg","",1)
clip("gbooks",G0,END-G0,"scene",bk.replace('id="b','id="g'),2)
for (i,*_),(dx,dy,r) in zip(books,[(20,30,-8),(-24,26,7),(28,-30,6),(-22,-24,-7),(16,22,9)]):
    js.append(f'tl.fromTo("#g{i[1:]}",{{x:0,y:0,rotation:{-r}}},{{x:{dx},y:{dy},rotation:{r},duration:9.4,ease:"sine.inOut"}},{G0});')
clip("gt",G0,END-G0,"scene center",'<div id="gbrand">Simuplug</div><div id="gline">Search it. <em>Simulate it.</em> Understand it.</div><div id="gurl">github.com/Spondon33/Simuplug</div><div class="row" id="grow"><span class="pill">Meta Muse Wonder 1.0</span><span class="pill">EmbeddingGemma 2</span><span class="pill">Neon pgvector</span><span class="pill">OpenUI Lang</span></div>',5)
FADE("#gbg",G0,0.5); IN("#gbrand",G0+0.3,0.8,40); IN("#gline",G0+1.0,0.7); IN("#gurl",G0+3.0,0.6); IN("#grow",G0+3.8,0.6)

css=open('style.css').read()
html=f'''<!doctype html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=1920, height=1080"/>
<script src="https://cdn.jsdelivr.net/npm/gsap@3.15.0/dist/gsap.min.js"></script>
<style>{css}</style></head><body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{END}" data-width="1920" data-height="1080">
{chr(10).join(vids)}
{chr(10).join(els)}
{chr(10).join(auds)}
</div>
<script>
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(js)}
window.__timelines["main"] = tl;
tl.seek(0);
</script></body></html>'''
open('film/index.html','w').write(html)
print(len(html))
