# Hackathon demo video

Source for the Simuplug demo video, built with [HyperFrames](https://hyperframes.heygen.com) (HTML rendered to video).

- `script.json` – the narration, one segment per scene.
- `tts.py` – generates the voiceover segments with HeyGen text-to-speech (set `HEYGEN_API_KEY` in your environment).
- `build2.py` + `style.css` – generate `film/index.html`, timing every scene to the voiceover and to the recorded footage.
- `film/` – the HyperFrames project (`npx hyperframes render` renders it).

Screen recordings, voice files and rendered videos are generated locally and not committed.
