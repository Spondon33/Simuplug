import json, re
T=json.load(open('footage/timings.json'))
def words(sid):
    d=json.load(open(f'vo/{sid}.json'))
    w=d['original_words']; w=json.loads(w) if isinstance(w,str) else w
    return [(re.sub(r'[^a-z0-9]','',x['text'].lower()),float(x['start_time']),float(x['end_time'])) for x in w], float(d['duration'])
def tw(sid,word,occ=0):
    ws,_=words(sid); hits=[s for t,s,e in ws if t==word]
    return hits[occ]
DUR={f's{i}':words(f's{i}')[1] for i in range(1,8)}
vids=[]; auds=[]; els=[]; js=[]
r2=lambda x: round(x,2)
def V(id,src,start,dur,ms,rate=1,z=1,css=""):
    vids.append(f'<video id="{id}" class="clip vid" src="assets/footage/{src}.mp4" muted playsinline data-start="{r2(start)}" data-duration="{r2(dur)}" data-media-start="{r2(ms)}"'+(f' data-playback-rate="{rate}"' if rate!=1 else '')+f' data-track-index="{z}" style="z-index:{z};{css}"></video>')
def AU(id,n,start): auds.append(f'<audio id="{id}" src="assets/vo/{n}.wav" data-start="{r2(start)}" data-duration="{DUR[n]:.2f}" data-volume="1" data-track-index="30"></audio>')
def clip(id,start,dur,cls,inner,z=10,style=""):
    els.append(f'<div id="{id}" class="clip {cls}" data-start="{r2(start)}" data-duration="{r2(dur)}" data-track-index="{z}" style="z-index:{z};{style}">{inner}</div>')
def IN(sel,t,d=0.5,y=24,x=0): js.append(f'tl.fromTo("{sel}",{{opacity:0,y:{y},x:{x}}},{{opacity:1,y:0,x:0,duration:{d},ease:"power3.out"}},{r2(t)});')
def OUT(sel,t,d=0.35): js.append(f'tl.to("{sel}",{{opacity:0,duration:{d},ease:"power2.in"}},{r2(t)});')
def FADE(sel,t,d=0.4): js.append(f'tl.fromTo("{sel}",{{opacity:0}},{{opacity:1,duration:{d},ease:"power2.out"}},{r2(t)});')

# ================= timeline =================
V1=0.4                       # s1 voice start
A_END=V1+DUR['s1']+0.8       # hook end
B0=A_END; B_DUR=0.3+DUR['s2']+1.0; V2=B0+0.3
C0=B0+B_DUR
P=T['physics']
c1=P['submitted']-0.8; c2=(P['ready']-P['submitted'])/4; c3=P['end']-P['ready']
C_DUR=c1+c2+c3; V3=C0+2.2
D0=C0+C_DUR; V4=D0+0.5; D_DUR=0.5+DUR['s4']+0.8
E0=D0+D_DUR; V5=E0+0.6; E_DUR=0.6+DUR['s5']+1.0
F0=E0+E_DUR; R=T['reader']
UP=R['upload']; DS=R['dragStart']; CK=R['clickAt']+0.05
VOFF=0.5                                                  # voice starts this long after the scene
da=VOFF+tw('s6','select')-0.15                            # footage up to the drag ends as the voice says "Select"
db=VOFF+tw('s6','simulate')+0.15-da                        # drag + click ends as the voice says "Simulate"
ra=(DS-UP)/da; rb=(CK-DS)/db
f4=min(R['end']-CK,11.0)
F_DUR=da+db+f4
V6=F0+VOFF
print('reader rates',round(ra,2),round(rb,2),'F_DUR',round(F_DUR,1))
G0=F0+F_DUR; V7=G0+0.4; G_DUR=0.4+DUR['s7']+1.4; END=round(G0+G_DUR+0.1,1)
print('scenes',[round(x,1) for x in (B0,C0,D0,E0,F0,G0,END)])
AU("vo1","s1",V1);AU("vo2","s2",V2);AU("vo3","s3",V3);AU("vo4","s4",V4);AU("vo5","s5",V5);AU("vo6","s6",V6);AU("vo7","s7",V7)
auds.append(f'<audio id="bgm" src="assets/music.wav" data-start="0" data-duration="{END}" data-volume="0.2" data-fade-in="1.5" data-fade-out="4" data-track-index="31"></audio>')

# ================= A hook =================
tBut=V1+tw('s1','but'); tWhat=V1+tw('s1','what')
V("vh","reader",0,A_END,7.5,1,1)
clip("hveil",0,A_END,"veil","",2)
for i,(t0,t1,txt) in enumerate([(V1+0.1,tBut-0.1,"Every student in Bangladesh<br>learns from NCTB textbooks."),(tBut-0.05,tWhat-0.1,"But a textbook can only<br>show a frozen diagram.")]):
    clip(f"h{i}",t0,t1-t0,"cap big",txt,12); IN(f"#h{i}",t0,0.6,30); OUT(f"#h{i}",t1-0.4)
clip("h2",tWhat-0.1,A_END-tWhat+0.1,"cap side2","What if every topic<br>could <em>move</em>?",12); IN("#h2",tWhat-0.1,0.6,30,-30)
V("vt","math",tWhat+0.2,A_END-tWhat-0.2,T['math']['interactStart']+0.3,1,3,"left:900px;top:240px;width:960px;height:540px;border-radius:28px;border:3px solid #fff;box-shadow:0 30px 80px rgba(59,130,246,0.35);")
FADE("#vt",tWhat+0.2,0.6)

# ================= B title =================
clip("bbg",B0,B_DUR,"bg","",1)
books=[("b1",110,150,150,200,"#60a5fa,#93c5fd"),("b2",1650,120,130,176,"#38bdf8,#bae6fd"),("b3",230,760,170,226,"#a5d8ff,#dbeeff"),("b4",1560,700,150,200,"#3b82f6,#7dd3fc"),("b5",900,40,90,122,"#93c5fd,#e0f2fe")]
bk="".join(f'<div class="book" id="{{p}}{i[1:]}" style="left:{x}px;top:{y}px;width:{w}px;height:{h}px;background:linear-gradient(135deg,{c})"></div>' for i,x,y,w,h,c in books)
mv=[(20,30,-8),(-24,26,7),(28,-30,6),(-22,-24,-7),(16,22,9)]
clip("bbooks",B0,B_DUR,"scene",bk.replace("{p}","b"),2)
for k,(dx,dy,r) in enumerate(mv): js.append(f'tl.fromTo("#b{k+1}",{{x:0,y:0,rotation:{-r}}},{{x:{dx},y:{dy},rotation:{r},duration:{r2(B_DUR)},ease:"sine.inOut"}},{r2(B0)});')
clip("btitle",B0,B_DUR,"scene center",'<div class="chip" id="bchip">Meta Global AI Developer Hackathon</div><div id="brand">Simuplug</div><div id="tag">Any textbook topic, as an interactive simulation.</div><div class="row" id="brow"><span class="pill">Meta Muse Wonder 1.0</span><span class="pill">OpenUI Lang</span><span class="pill">Neon pgvector</span><span class="pill">EmbeddingGemma 2</span></div><div id="built">Everything shown was built during the hackathon</div>',5)
IN("#bchip",B0+0.3,0.6); IN("#brand",B0+0.5,0.8,50); IN("#tag",B0+1.1,0.6); IN("#brow",V2+tw('s2','muse')-0.2,0.6); IN("#built",V2+tw('s2','everything')-0.1,0.6)
OUT("#btitle",B0+B_DUR-0.5,0.45); OUT("#bbooks",B0+B_DUR-0.5,0.45); OUT("#bbg",B0+B_DUR-0.4,0.4)

# ================= C physics (live) =================
V("c1","physics",C0,c1,0.8,1,1); V("c2","physics",C0+c1,c2,P['submitted'],4,1); V("c3","physics",C0+c1+c2,c3,P['ready'],1,1)
clip("cchip",C0+1.5,C_DUR-1.9,"side","<b>PHYSICS</b><br>Refraction of light<span>Science 9–10 · §5.2</span>",12); IN("#cchip",C0+1.5,0.5,0,-30); OUT("#cchip",C0+C_DUR-0.7)
clip("clapse",C0+c1,c2,"sideb","⏩ <b>TIME-LAPSE ×4</b><br>Muse Wonder is writing the simulation, live",13); IN("#clapse",C0+c1,0.4,0,30); OUT("#clapse",C0+c1+c2-0.4,0.3)
clip("clive",C0+c1+c2+0.5,6.5,"sideb ok","✓ <b>Generated live</b><br>validated and stored in Neon",13); IN("#clive",C0+c1+c2+0.5,0.4,0,30); OUT("#clive",C0+c1+c2+6.4,0.4)

# ================= D every subject =================
cuts={'chem':V4+tw('s4','chemistry')-0.35,'bio':V4+tw('s4','biology')-0.35,'math':V4+tw('s4','mathematics')-0.35,'geo':V4+tw('s4','geography')-0.45}
gs=D0; ge=cuts['chem']
clip("dbg",D0,D_DUR,"bg","",1)
tiles=[("dt1","physics",P['interactStart']+0.5,100,70,"PHYSICS"),("dt2","chemistry",T['chemistry']['interactStart']+0.5,1020,70,"CHEMISTRY"),("dt3","biology",T['biology']['interactStart']+0.5,100,594,"BIOLOGY"),("dt4","math",T['math']['interactStart']+0.5,1020,594,"MATHEMATICS")]
for k,(i,src,ms,x,y,lab) in enumerate(tiles):
    V(i,src,gs,ge-gs,ms,1,3,f"left:{x}px;top:{y}px;width:800px;height:450px;")
    clip(f"{i}l",gs,ge-gs,"tilelab",lab,4,f"left:{x}px;top:{y-48}px;")
    FADE(f"#{i}",gs+0.1+k*0.22,0.5); FADE(f"#{i}l",gs+0.3+k*0.22,0.4)
    OUT(f"#{i}",ge-0.4,0.4); OUT(f"#{i}l",ge-0.4,0.3)
full=[("df1","chemistry",T['chemistry']['interactStart'],ge,cuts['bio'],"CHEMISTRY","Rutherford’s atomic model"),("df2","biology",T['biology']['interactStart'],cuts['bio'],cuts['math'],"BIOLOGY","Photosynthesis inside a leaf"),("df3","math",T['math']['interactStart'],cuts['math'],cuts['geo'],"MATHEMATICS","The Pythagorean theorem"),("df4","bangladesh",T['bangladesh']['interactStart'],cuts['geo'],E0-0.0,"GEOGRAPHY","Land configuration of Bangladesh, on a real map")]
for i,src,ms,st,en,lab,sub in full:
    du=en-st
    V(i,src,st,du,ms,1,5); FADE(f"#{i}",st,0.35)
    clip(f"{i}c",st+0.1,du-0.2,"side",f"<b>{lab}</b><br>{sub}",12); IN(f"#{i}c",st+0.15,0.45,0,-30); OUT(f"#{i}c",en-0.55,0.3)
OUT("#dbg",E0-0.45,0.4)
print('D cuts',{k:round(v-D0,1) for k,v in cuts.items()},'Ddur',round(D_DUR,1))

# ================= E how it works =================
S5=lambda w,o=0: V5+tw('s5',w,o)
clip("ebg",E0,E_DUR,"bg","",1)
rail="".join(f'<div class="rp" id="rp{i}"><span>{i+1}</span>{n}</div>' for i,n in enumerate(["Retrieve","Generate","Validate","Remember"]))
clip("erail",E0,E_DUR,"rail",rail,6); IN("#erail",E0+0.3,0.6,-20)
p=[S5('split')-0.4,S5('real')-0.6,S5('trust')-0.9,S5('then')-0.35,E0+E_DUR-0.6]
# the 'and' of "And we don't just trust it" is the 2nd 'and'? resolve by locating 'trust'
p[2]=S5('trust')-0.9
for i in range(4):
    js.append(f'tl.to("#rp{i}",{{backgroundColor:"#3b82f6",color:"#ffffff",duration:0.4}},{r2(p[i])});')
    if i<3: js.append(f'tl.to("#rp{i}",{{backgroundColor:"rgba(255,255,255,0.75)",color:"#1d4ed8",duration:0.4}},{r2(p[i+1])});')
n1=[("22","textbooks","OCR’d NCTB books"),("2,647","sections","chunked by chapter"),("768-d","EmbeddingGemma 2","local embeddings"),("pgvector","Neon Postgres","HNSW cosine search")]
cards="".join(f'<div class="node" id="n1_{i}"><div class="big" id="n1v{i}">{v}</div><div class="nt">{t}</div><div class="ns">{s}</div></div>'+('<div class="arr" id="a1_%d">→</div>'%i if i<3 else '') for i,(v,t,s) in enumerate(n1))
clip("ep1",p[0],p[1]-p[0],"panel",f'<div class="flow">{cards}</div><div class="note" id="n1note">Retrieval finds the page… but a page is still just a page.</div>',7)
nt=[S5('twenty')-0.1,S5('thousand')-0.4,S5('embedded')-0.1,S5('neon')-0.6]
for i,t in enumerate(nt):
    IN(f"#n1_{i}",t,0.6,30)
    if i<3: IN(f"#a1_{i}",t+0.5,0.4,0,-12)
IN("#n1note",S5('but')+0.2,0.6,16); OUT("#ep1",p[1]-0.45,0.4)
js.append(f'var c22={{v:0}},c26={{v:0}};tl.to(c22,{{v:22,duration:0.9,ease:"power2.out",onUpdate:function(){{document.getElementById("n1v0").textContent=Math.round(c22.v)}}}},{r2(nt[0]+0.2)});tl.to(c26,{{v:2647,duration:1.3,ease:"power2.out",onUpdate:function(){{document.getElementById("n1v1").textContent=Math.round(c26.v).toLocaleString("en-US")}}}},{r2(nt[1]+0.2)});')
code=["root = Stack([header, explainer, sim, points])","sim = SimCanvas(\"Bending at the air–water boundary\",","  \"slider('i','Angle of incidence i',0,80,1,38,'deg');","   toggle('Show unbent path',true);","   formula(function(){ return 'n1 sin i = n2 sin r' });","   loop(function(t,dt){ clear(); drawRays(); drawGraph(); })\")"]
lines="".join(f'<div class="cl" id="cl{i}">{l.replace("<","&lt;")}</div>' for i,l in enumerate(code))
clip("ep2",p[1],p[2]-p[1],"panel",f'<div class="gen"><div class="mw"><div class="mwt">Muse Wonder 1.0</div><div class="mws">Meta Model API</div><div class="mwp">prompt: section text + figures<br>→ OpenUI Lang program</div></div><div class="codewin"><div class="cwh">Real output · “Refraction of light”</div>{lines}</div></div>',7)
IN("#ep2 .mw",p[1]+0.1,0.6,30); IN("#ep2 .codewin",p[1]+0.3,0.6,30)
step=max(0.28,(p[2]-p[1]-1.7)/len(code))
for i in range(len(code)): IN(f"#cl{i}",p[1]+0.9+i*step,0.35,10)
OUT("#ep2",p[2]-0.45,0.4)
chk=[("Parse OpenUI Lang","valid components, no hallucinated tags","ok"),("Syntax check","the simulation script compiles","ok"),("Sandbox dry-run","crashes · NaN values · overlapping text","bad"),("Repair loop","Muse fixes its own code from the error report","fix")]
rows="".join(f'<div class="ck" id="ck{i}"><div class="ci" id="ci{i}">'+('<i class="g gw">…</i><i class="g gx">✕</i><i class="g gv">✓</i>' if k=="bad" else "✓")+f'</div><div><div class="ct">{t}</div><div class="cs">{s}</div></div></div>' for i,(t,s,k) in enumerate(chk))
clip("ep3",p[2],p[3]-p[2],"panel",f'<div class="checks">{rows}</div><div class="valid" id="valid">✓ Valid → stored in Neon</div>',7)
ct=[S5('parsed')-0.2,S5('syntax')-0.2,S5('dry')-0.3,S5('if')-0.1]
for i,t in enumerate(ct): IN(f"#ck{i}",t,0.55,24)
fail=S5('overlapping')+0.5; fix=S5('repairs')+0.1
js.append(f'tl.set("#ci2",{{backgroundColor:"#f59e0b"}},{r2(E0)});tl.set("#ci2 .gw",{{opacity:1}},{r2(E0)});tl.set("#ci2 .gx",{{opacity:0}},{r2(E0)});tl.set("#ci2 .gv",{{opacity:0}},{r2(E0)});')
js.append(f'tl.to("#ci2",{{backgroundColor:"#f43f5e",duration:0.3}},{r2(fail)});tl.to("#ci2 .gw",{{opacity:0,duration:0.2}},{r2(fail)});tl.to("#ci2 .gx",{{opacity:1,duration:0.2}},{r2(fail+0.1)});')
js.append(f'tl.to("#ci2",{{backgroundColor:"#10b981",duration:0.3}},{r2(fix)});tl.to("#ci2 .gx",{{opacity:0,duration:0.2}},{r2(fix)});tl.to("#ci2 .gv",{{opacity:1,duration:0.2}},{r2(fix+0.1)});')
IN("#valid",fix+0.3,0.5,16); OUT("#ep3",p[3]-0.45,0.4)
jr=[("Rutherford’s atomic model","Bohr’s atomic model","DIFFERENT topic","generate a new simulation","bad"),("Refraction of light","bending of light, explained","SAME topic","reuse from Neon, instantly","ok")]
jh="".join(f'<div class="jr" id="jr{i}"><div class="q">{a}</div><div class="vs">vs</div><div class="q">{b}</div><div class="verdict {k}"><b>{v}</b><span>{d}</span></div></div>' for i,(a,b,v,d,k) in enumerate(jr))
clip("ep4",p[3],p[4]-p[3],"panel",f'<div class="judge"><div class="jt">Cached per topic · a Muse judge decides</div>{jh}</div>',7)
IN("#ep4 .jt",p[3]+0.2,0.5,16); IN("#jr0",S5('judge')-0.1,0.6,24); IN("#jr1",S5('judge')+2.4,0.6,24); OUT("#ep4",p[4]-0.45,0.4)
OUT("#erail",E0+E_DUR-0.45,0.4); OUT("#ebg",E0+E_DUR-0.4,0.4)
print('E phases',[round(x-E0,1) for x in p],'Edur',round(E_DUR,1))

# ================= F reader =================
V("f1","reader",F0,da,UP,round(ra,3),1)
V("f2","reader",F0+da,db,DS,round(rb,3),1)
V("f3","reader",F0+da+db,f4,CK,1,1)
clip("fc1",F0+0.4,2.9,"chipbar","Upload the <b>real NCTB PDF</b>",12); IN("#fc1",F0+0.4,0.5); OUT("#fc1",F0+3.0,0.3)
clip("fc2",F0+3.6,da-3.6-0.3,"chipbar","Matched to word positions <b>stored in Neon</b> · no OCR in the browser",12); IN("#fc2",F0+3.6,0.5); OUT("#fc2",F0+da-0.6,0.3)
clip("fc4",F0+da+db+0.3,f4-0.6,"chipbar","Highlight → <b>Simulate</b> → opens beside the page",12); IN("#fc4",F0+da+db+0.3,0.5); OUT("#fc4",F0+F_DUR-0.8,0.3)
RD=R["ready"]-CK
clip("fc3",F0+da+db+RD,3.9,"sideb","✓ <b>Reused from Neon</b><br>same topic, instant",13); IN("#fc3",F0+da+db+RD+0.2,0.4,0,30); OUT("#fc3",F0+da+db+RD+3.6,0.3)

# ================= G end =================
clip("gbg",G0,G_DUR,"bg","",1)
clip("gbooks",G0,G_DUR,"scene",bk.replace("{p}","g"),2)
for k,(dx,dy,r) in enumerate(mv): js.append(f'tl.fromTo("#g{k+1}",{{x:0,y:0,rotation:{-r}}},{{x:{dx},y:{dy},rotation:{r},duration:{r2(G_DUR)},ease:"sine.inOut"}},{r2(G0)});')
clip("gt",G0,G_DUR,"scene center",'<div id="gbrand">Simuplug</div><div id="gline">Search it. <em>Simulate it.</em> Understand it.</div><div id="gurl">github.com/Spondon33/Simuplug</div><div class="row" id="grow"><span class="pill">Meta Muse Wonder 1.0</span><span class="pill">EmbeddingGemma 2</span><span class="pill">Neon pgvector</span><span class="pill">OpenUI Lang</span></div>',5)
FADE("#gbg",G0,0.5); IN("#gbrand",G0+0.3,0.8,40); IN("#gline",G0+1.0,0.7); IN("#gurl",G0+2.6,0.6); IN("#grow",G0+3.4,0.6)

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
print('total',END)
