import json, os, time, urllib.request, subprocess, sys
import numpy as np
key=os.environ["HK"]
H={"X-Api-Key":key,"Content-Type":"application/json"}
voices=[]
tok=None
for _ in range(6):
    u="https://api.heygen.com/v3/models/audio/voices?type=public&limit=100"+(f"&token={tok}" if tok else "")
    d=json.load(urllib.request.urlopen(urllib.request.Request(u,headers=H),timeout=60))
    voices+=d["data"]
    tok=d.get("next_token")
    if not d.get("has_more") or not tok: break
print(len(voices),"voices",file=sys.stderr)
skip=("Ukrain","Spanish","Turkish","Brazil","Vietnam","Korean","Française","LatAm","CUBANA","алиса","Матр")
cand=[v for v in voices if v["language"]=="en" and not any(s in v["name"] for s in skip)]
def f0(path):
    raw=subprocess.run(["ffmpeg","-loglevel","error","-i",path,"-ac","1","-ar","16000","-f","f32le","-"],capture_output=True).stdout
    x=np.frombuffer(raw,dtype=np.float32); fs=16000; out=[]
    for i in range(0,len(x)-1024,512):
        w=x[i:i+1024]
        if np.sqrt((w**2).mean())<0.02: continue
        w=w-w.mean(); ac=np.correlate(w,w,"full")[1023:]
        lo,hi=int(fs/300),int(fs/70)
        k=lo+np.argmax(ac[lo:hi]); 
        if ac[k]/ac[0]>0.5: out.append(fs/k)
    return float(np.median(out)) if out else 0
res=[]
txt="Every student learns science from textbooks, but a textbook can only show a frozen diagram."
for v in cand[:60]:
    p=f"voicetest/{v['voice_id']}.wav"
    if not os.path.exists(p):
        for a in range(4):
            try:
                body=json.dumps({"model":"heygen-voice-1-turbo-free","voice_id":v["voice_id"],"text":txt,"language":"en"}).encode()
                r=json.load(urllib.request.urlopen(urllib.request.Request("https://api.heygen.com/v3/models/audio/tts",body,H),timeout=120))["data"]
                urllib.request.urlretrieve(r["audio_url"],p); break
            except Exception as e: time.sleep(2*(a+1))
        time.sleep(2.2)
    if os.path.exists(p): res.append((f0(p),v["name"],v["voice_id"]))
res.sort()
for r in res: print(f"{r[0]:6.0f} Hz  {r[1]}  {r[2]}")
