"""Perceptual image deduplication and conservative witness counting."""

import json
from pathlib import Path
from tempfile import TemporaryDirectory

import imagehash
from PIL import Image, ImageDraw, ImageOps

# Populate with verified historical images only; keys identify their source.
KNOWN_OLD_HASHES: dict[str, str] = {
    # "verified_2023_flood": "<64-bit pHash from compute_phash(old_image_path)>",
}


def compute_phash(image_path: str) -> str:
    """Return a 64-bit pHash as 16 hexadecimal characters for a local image.

    Honor EXIF orientation. Missing/unreadable files raise their Pillow/OS error.
    """
    with Image.open(image_path) as image:
        oriented = ImageOps.exif_transpose(image)
        return str(imagehash.phash(oriented.convert("RGB"), hash_size=8))


def is_duplicate(hash1: str, hash2: str, threshold: int = 5) -> bool:
    """Return whether equal-size pHashes differ by at most threshold bits."""
    if not isinstance(threshold, int) or threshold < 0:
        raise ValueError("threshold must be a nonnegative integer")
    first = imagehash.hex_to_hash(hash1)
    second = imagehash.hex_to_hash(hash2)
    if first.hash.shape != second.hash.shape:
        raise ValueError("pHashes must have the same size")
    return bool(first - second <= threshold)


class _Groups:
    """Small union-find structure for connected components."""

    def __init__(self, size: int):
        self.parents = list(range(size))

    def find(self, item: int) -> int:
        while self.parents[item] != item:
            self.parents[item] = self.parents[self.parents[item]]
            item = self.parents[item]
        return item

    def merge(self, first: int, second: int):
        first, second = self.find(first), self.find(second)
        if first != second:
            self.parents[second] = first

    def count(self) -> int:
        return len({self.find(item) for item in range(len(self.parents))})


def flag_recycled_media(report: dict, known_old_hashes: dict[str, str]) -> dict:
    """Match report['phash'] against verified historical image references.

    Without a precomputed phash, compute one from a local media_url. Remote URLs
    are never fetched: provide report['phash'] for those. A pHash match flags
    image reuse; it does not establish whether the report's claim is false.
    """
    unmatched = {"is_recycled": False, "matched_source": None}
    if not known_old_hashes:
        return unmatched

    report_hash = report.get("phash")
    if not report_hash:
        image_path = report.get("media_url")
        if not image_path:
            return unmatched
        if "://" in image_path:
            raise ValueError("Provide report['phash'] for remote media URLs")
        report_hash = compute_phash(image_path)

    # Sorted sources make the selected match independent of dictionary order.
    for source, old_hash in sorted(known_old_hashes.items()):
        if is_duplicate(report_hash, old_hash):
            return {"is_recycled": True, "matched_source": source}
    return unmatched


def calculate_corroboration(
    cluster: dict,
    reports: list[dict],
    media_hashes: dict[str, str],
) -> dict:
    """Count only the cluster's reports, authors, image groups, and reuse flags.

    Provide a hash in media_hashes for every selected report with media. Missing
    hashes raise ValueError instead of treating unverified images as independent.
    Each report must have a unique ID and a nonempty source_user.

    Witness groups merge when reports share an author OR near-duplicate images.
    Image groups merge only through near-duplicate hashes. Both are transitive:
    A matching B and B matching C produces one group even if A does not match C.
    Authors are compared case-insensitively, ignoring surrounding whitespace.
    Recycled-media count is the number of flagged reports, not distinct images.
    """
    report_by_id = {}
    for report in reports:
        report_id = report["id"]
        if report_id in report_by_id:
            raise ValueError(f"Duplicate report ID: {report_id}")
        report_by_id[report_id] = report

    report_ids = sorted(set(cluster["report_ids"]))
    selected = []
    for report_id in report_ids:
        if report_id not in report_by_id:
            raise ValueError(f"Cluster references missing report: {report_id}")
        report = report_by_id[report_id]
        source = report.get("source_user")
        if not isinstance(source, str) or not source.strip():
            raise ValueError(f"Missing source_user for report: {report_id}")
        if report.get("media_url") and not media_hashes.get(report_id):
            raise ValueError(f"Missing media hash for report: {report_id}")
        selected.append(report)

    witnesses = _Groups(len(selected))
    authors = {}
    images = []
    recycled_count = 0
    for index, report in enumerate(selected):
        author = report["source_user"].strip().casefold()
        if author in authors:
            witnesses.merge(index, authors[author])
        else:
            authors[author] = index

        report_hash = media_hashes.get(report["id"])
        if report_hash:
            # Validate even when this is the cluster's only image.
            is_duplicate(report_hash, report_hash)
            images.append((index, report_hash))
            flag = flag_recycled_media(
                {**report, "phash": report_hash}, KNOWN_OLD_HASHES
            )
            recycled_count += int(flag["is_recycled"])

    image_groups = _Groups(len(images))
    for first, (report_index, first_hash) in enumerate(images):
        for second in range(first):
            other_index, second_hash = images[second]
            if is_duplicate(first_hash, second_hash):
                witnesses.merge(report_index, other_index)
                image_groups.merge(first, second)

    return {
        "total_reports": len(selected),
        "independent_sources": witnesses.count(),
        "unique_images": image_groups.count(),
        "recycled_media_detected": recycled_count,
    }


if __name__ == "__main__":
    # Generate reproducible image fixtures without downloads or repository files.
    with TemporaryDirectory() as directory:
        first_path = str(Path(directory) / "scene_a.png")
        other_path = str(Path(directory) / "scene_b.png")

        first_image = Image.new("RGB", (128, 128), "white")
        ImageDraw.Draw(first_image).rectangle((8, 8, 58, 100), fill="black")
        first_image.save(first_path)

        other_image = Image.new("RGB", (128, 128), "white")
        ImageDraw.Draw(other_image).ellipse((50, 30, 120, 110), fill="black")
        other_image.save(other_path)

        demo_reports = [
            {"id": "rep_0001", "source_user": "@neha", "media_url": first_path},
            {"id": "rep_0002", "source_user": "@rajat", "media_url": first_path},
            {"id": "rep_0003", "source_user": "@imran", "media_url": other_path},
        ]
        hashes = {
            report["id"]: compute_phash(report["media_url"]) for report in demo_reports
        }
        assert is_duplicate(hashes["rep_0001"], hashes["rep_0002"])
        assert not is_duplicate(hashes["rep_0001"], hashes["rep_0003"])

        demo_cluster = {"report_ids": [report["id"] for report in demo_reports]}
        result = calculate_corroboration(demo_cluster, demo_reports, hashes)
        assert result == {
            "total_reports": 3,
            "independent_sources": 2,
            "unique_images": 2,
            "recycled_media_detected": 0,
        }
        print(json.dumps(result, indent=2))

        # Separate synthetic reference demonstrates Part C without claiming
        # these generated shapes are verified historical disaster photographs.
        flag = flag_recycled_media(
            {**demo_reports[0], "phash": hashes["rep_0001"]},
            {"demo_historical_reference": hashes["rep_0001"]},
        )
        assert flag["is_recycled"]
        print(json.dumps(flag, indent=2))
