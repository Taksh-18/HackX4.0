"""Generate the four synthetic placeholder images the demo dataset references.

These are flat geometric shapes, not photographs of any real event. They exist
so the perceptual-hash stage (deduplication, recycled-media detection) can be
demonstrated and tested offline without shipping or downloading imagery.

    python scripts/generate_demo_media.py

`reused_flood_image.jpg` is a resized, re-encoded copy of `flood_scene_1.jpg`,
which is what a recycled upload looks like to a pHash. Its hash is written to
data/known_old_hashes.json so the pipeline flags reports that reuse it.
"""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
MEDIA_DIR = ROOT / "media"
KNOWN_HASHES_PATH = ROOT / "data" / "known_old_hashes.json"

SIZE = (480, 320)


def _flood_scene_1() -> Image.Image:
    image = Image.new("RGB", SIZE, "#dfe6ec")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 200, 480, 320), fill="#3b6ea5")  # water
    draw.rectangle((60, 90, 170, 210), fill="#1d2a35")  # shopfront
    draw.rectangle((300, 60, 340, 220), fill="#4a4f55")  # pillar
    return image


def _flood_scene_2() -> Image.Image:
    image = Image.new("RGB", SIZE, "#e8e2d6")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 170, 480, 320), fill="#2f5d8a")
    draw.ellipse((90, 120, 230, 240), fill="#101820")
    draw.polygon([(350, 240), (420, 120), (470, 240)], fill="#6b7280")
    return image


def _bridge_incident() -> Image.Image:
    image = Image.new("RGB", SIZE, "#cfd8e3")
    draw = ImageDraw.Draw(image)
    draw.rectangle((0, 230, 480, 320), fill="#37506b")
    draw.polygon([(20, 150), (250, 130), (250, 190), (20, 205)], fill="#3a3f44")
    draw.polygon([(280, 190), (460, 140), (460, 200), (300, 230)], fill="#2b2f33")
    return image


SCENES = {
    "flood_scene_1.jpg": _flood_scene_1,
    "flood_scene_2.jpg": _flood_scene_2,
    "bridge_incident.jpg": _bridge_incident,
}


def main() -> int:
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    for name, build in SCENES.items():
        build().save(MEDIA_DIR / name, quality=88)
        print(f"wrote media/{name}")

    # A recycled upload: same picture, different file (resized + re-encoded).
    recycled = Image.open(MEDIA_DIR / "flood_scene_1.jpg").resize((360, 240))
    recycled_path = MEDIA_DIR / "reused_flood_image.jpg"
    recycled.save(recycled_path, quality=72)
    print("wrote media/reused_flood_image.jpg")

    from app.corroboration import compute_phash

    KNOWN_HASHES_PATH.write_text(
        json.dumps(
            {
                "demo_recycled_flood_photo": compute_phash(str(recycled_path)),
            },
            indent=2,
        )
        + "\n"
    )
    print(f"wrote {KNOWN_HASHES_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
