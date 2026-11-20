#!/usr/bin/env python3
"""Rebuild official MEU SÓCIO PWA icons from user-approved icon 01.

Exact source design: charcoal square, amber double slashes, vivid blue/cyan
ribbons and MEU SÓCIO lettering. Do not replace with icon 02.
"""
from pathlib import Path
from io import BytesIO
from hashlib import sha256
import base64
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "icon-v1-source"
SOURCE_PARTS = [SOURCE_DIR / f"part{i}.b64" for i in (1, 2, 3)]
EXPECTED_SHA256 = "441d561328c2487fd6819c9449bdd0d93cc48a5ff64d2f95c69392f1cd5839b5"

def main():
    payload = "".join(path.read_text(encoding="ascii").strip() for path in SOURCE_PARTS)
    data = base64.b64decode(payload, validate=True)
    digest = sha256(data).hexdigest()
    if digest != EXPECTED_SHA256:
        raise RuntimeError(f"Icon 01 source integrity failure: {digest}")

    with Image.open(BytesIO(data)) as image:
        source = image.convert("RGB")
        if source.size != (384, 384):
            raise RuntimeError(f"Unexpected source dimensions: {source.size}")
        targets = {
            "icon-512.png": 512,
            "icon-192.png": 192,
            "apple-touch-icon.png": 180,
        }
        folder = ROOT / "icons"
        folder.mkdir(exist_ok=True)
        for name, size in targets.items():
            destination = folder / name
            source.resize((size, size), Image.Resampling.LANCZOS).save(
                destination, format="PNG", optimize=True, compress_level=9
            )
            print(f"Icon 01 validated and rendered: {destination.relative_to(ROOT)} ({size}px)")

if __name__ == "__main__":
    main()
