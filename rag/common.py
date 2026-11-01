import os
from sentence_transformers import SentenceTransformer

MODEL_ID = "google/embeddinggemma-2"
DIM = 768  # native dimension of EmbeddingGemma 2


def load_model():
    # text-only variant: switch off the vision/audio encoders (see the EmbeddingGemma 2 guide)
    m = SentenceTransformer(MODEL_ID, device=os.environ.get("EMBED_DEVICE") or None, config_kwargs={"vision_config": None, "audio_config": None})
    m.max_seq_length = 2048
    return m


def env(name):
    """Read a variable from .env / .env.local without extra dependencies."""
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    val = os.environ.get(name)
    for f in (".env", ".env.local"):
        p = os.path.join(root, f)
        if val is None and os.path.exists(p):
            for line in open(p):
                if line.startswith(name + "="):
                    val = line.split("=", 1)[1].strip().strip('"')
    return val


def vec_literal(v):
    return "[" + ",".join(f"{x:.6f}" for x in v) + "]"
