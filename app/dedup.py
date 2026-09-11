"""Deterministic duplicate and near-duplicate report-TEXT detection.

Standard-library only (`difflib`). This is a misinformation-risk and
transparency signal, not a witness-counting mechanism: `app.corroboration`
already owns independent-source counting via usernames, explicit repost
attribution, and image similarity, and is left untouched so its existing
scoring contract and tests keep working unchanged. This module answers a
narrower question - "how many distinct claim origins does this cluster's
text actually reduce to" - for the evidence and misinformation views.

Grouping is on whole-text similarity only. Two reports about the same
landmark or disaster type are never merged just because they share those
words; only near-identical wording is.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from difflib import SequenceMatcher

_URL_PATTERN = re.compile(r"https?://\S+")
_USER_PATTERN = re.compile(r"@[A-Za-z0-9_]+")
_RT_PREFIX = re.compile(
    r"^\s*(?:RT|Repost|Forwarded(?:\s+update)?|Shared\s+from)\b[:\s]*", re.IGNORECASE
)
_PUNCT = re.compile(r"[^\w\s]")
_WHITESPACE = re.compile(r"\s+")

# Below this normalized length, comparing text is unreliable; such reports
# are only ever grouped with an exact (post-normalization) match.
MIN_TEXT_LENGTH = 12
NEAR_DUPLICATE_THRESHOLD = 0.85


def normalize_text(raw_text: str) -> str:
    """Lowercase; strip repost prefixes, URLs, @mentions, and punctuation."""
    text = _RT_PREFIX.sub("", raw_text or "")
    text = _URL_PATTERN.sub("", text)
    text = _USER_PATTERN.sub("", text)
    text = text.lower()
    text = _PUNCT.sub(" ", text)
    return _WHITESPACE.sub(" ", text).strip()


def is_near_duplicate(
    a: str, b: str, *, threshold: float = NEAR_DUPLICATE_THRESHOLD
) -> bool:
    """True for exact or near-identical normalized text, not merely similar topic."""
    if not a or not b:
        return False
    if len(a) < MIN_TEXT_LENGTH or len(b) < MIN_TEXT_LENGTH:
        return a == b
    if a == b:
        return True
    return SequenceMatcher(None, a, b).ratio() >= threshold


@dataclass
class DuplicateGroup:
    report_ids: list[str]
    normalized_text: str


def group_duplicate_texts(reports: list[dict]) -> list[DuplicateGroup]:
    """Transitively group reports whose text is exact or near-duplicate.

    A -> B and B -> C near-duplicate pairs land in one group even if A and C
    alone fall below the threshold, same as the image-witness grouping in
    `app.corroboration`.
    """
    normalized = [(r["id"], normalize_text(r.get("raw_text") or "")) for r in reports]
    n = len(normalized)
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(i: int, j: int) -> None:
        root_i, root_j = find(i), find(j)
        if root_i != root_j:
            parent[root_j] = root_i

    for i in range(n):
        for j in range(i + 1, n):
            if is_near_duplicate(normalized[i][1], normalized[j][1]):
                union(i, j)

    groups: dict[int, list[str]] = {}
    texts: dict[int, str] = {}
    for idx, (report_id, text) in enumerate(normalized):
        root = find(idx)
        groups.setdefault(root, []).append(report_id)
        texts.setdefault(root, text)

    return [
        DuplicateGroup(report_ids=sorted(ids), normalized_text=texts[root])
        for root, ids in groups.items()
    ]
