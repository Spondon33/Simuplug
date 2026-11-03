import json, os, time, urllib.request
key = os.environ["HEYGEN_API_KEY"]
voice = "bc89672906f04b44ba272705593e8030"  # Ryan - Smooth & Warm (US)
for seg in json.load(open("script.json")):
    out = f"vo/{seg['id']}.wav"
    if os.path.exists(out): continue
    body = json.dumps({"model":"heygen-voice-1-turbo-free","voice_id":voice,"text":seg["text"],"language":"en-US","with_timestamps":True}).encode()
    for attempt in range(6):
        try:
            req = urllib.request.Request("https://api.heygen.com/v3/models/audio/tts", body, {"X-Api-Key":key,"Content-Type":"application/json"})
            d = json.load(urllib.request.urlopen(req, timeout=120))["data"]
            urllib.request.urlretrieve(d["audio_url"], out)
            json.dump(d, open(f"vo/{seg['id']}.json","w"))
            print(seg["id"], d["duration"]); break
        except Exception as e:
            print(seg["id"], "retry", e); time.sleep(2 ** attempt)
