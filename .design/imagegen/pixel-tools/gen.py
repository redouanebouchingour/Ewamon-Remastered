"""One gpt-image-2 call (1024x1024, medium by default) with the official openai SDK. Reads OPENAI_API_KEY from ~/.env
and never prints it. Prints the token usage so the cost of every call is visible.

    python gen.py [--size=1536x1024] [--quality=low] <prompt.txt> <out.png> [ref.png ...]

With reference images it uses the edits endpoint (style reference, or the front sprite when drawing a back). Without
them it uses generations with moderation "low", the only route that takes a moderation setting.
"""
import base64, json, os, sys
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path.home() / ".env", override=False)
if not os.environ.get("OPENAI_API_KEY"):
    sys.exit("OPENAI_API_KEY missing (put it in ~/.env)")

opts = dict(a[2:].split("=", 1) for a in sys.argv[1:] if a.startswith("--"))
args = [a for a in sys.argv[1:] if not a.startswith("--")]
prompt = Path(args[0]).read_text(encoding="utf8")
out = Path(args[1])
refs = args[2:]
client = OpenAI()
kw = dict(model="gpt-image-2", prompt=prompt, size=opts.get("size", "1024x1024"), quality=opts.get("quality", "medium"), n=1)
if refs:
    files = [open(r, "rb") for r in refs]
    res = client.images.edit(image=files, **kw)
else:
    res = client.images.generate(moderation="low", **kw)
out.write_bytes(base64.b64decode(res.data[0].b64_json))
u = res.usage.model_dump() if getattr(res, "usage", None) else {}
print(json.dumps({"out": str(out), "usage": u}))
