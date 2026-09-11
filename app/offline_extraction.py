"""Deterministic keyword extraction used when no LLM provider is configured.

`app.extraction` is the real relevance/fact-extraction stage and needs an
OpenAI-compatible endpoint. This module is the offline stand-in so the whole
pipeline (geolocation, clustering, corroboration, scoring, persistence) can be
demonstrated and regression-tested without network access or an API key.

It is intentionally conservative and rule-based: it never invents a landmark or
a victim count that is not literally present in the text. Output validates
against the same `ExtractedReport` contract the LLM path produces, so every
downstream stage sees one shape.
"""

from __future__ import annotations

import re

from app.extraction import ExtractedReport, _irrelevant_fallback
from app.scoring import calculate_severity

# Ordered: the first matching hazard wins, so an explicit structural failure is
# not relabelled FLOOD just because floodwater is mentioned as the cause.
HAZARD_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    (
        "COLLAPSE",
        re.compile(
            r"\b(collaps\w*|caved?\s+in|given?\s+way|rubble|debris|"
            r"broken\s+concrete|concrete\s+pieces|fallen\s+(?:wall|slab|railing)|"
            r"crack\w*|structural\w*)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "FIRE",
        re.compile(
            r"\b(fire|blaze|burning|flames?|smoke|short\s*circuit\s+spark\w*)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "FLOOD",
        re.compile(
            r"\b(flood\w*|waterlog\w*|water\s+(?:rising|rises?|level|is|has|near|"
            r"entered|entering|flowing|above)|"
            r"submerged|inundat\w*|knee[- ]deep|waist[- ]deep|chest[- ]level|"
            r"overflow\w*|drown\w*)\b",
            re.IGNORECASE,
        ),
    ),
    (
        "OTHER",
        re.compile(
            r"\b(gas\s+leak|landslide|electrocut\w*|live\s+wire|building\s+lean\w*|"
            r"road\s+blocked|accident|injured|casualt\w*|trapped|stranded|stuck|"
            r"unsafe|evacuat\w*)\b",
            re.IGNORECASE,
        ),
    ),
]

# Phrases that look hazardous but carry no actionable claim on their own.
NOISE_PATTERN = re.compile(
    r"^(?:[^\w]*|\W*(?:thoughts|prayers|stay\s+safe|sending|keep\s+believing|"
    r"positive\s+energy)\b.*)$",
    re.IGNORECASE,
)

PEOPLE = (
    r"people|persons?|residents?|children|kids|students?|families|men|women|"
    r"shopkeepers?|passengers?|patients?|elderly|workers?|commuters?"
)
TRAPPED_VERBS = re.compile(
    r"\b(trapped|stuck|stranded|waiting\s+for\s+rescue|cannot\s+(?:cross|leave|"
    r"get\s+out)|unable\s+to\s+(?:cross|leave|move)|need\s+rescue|on\s+a?\s*"
    r"(?:shop\s+)?roof|shouting\s+for)\b",
    re.IGNORECASE,
)
NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7,
    "eight": 8, "nine": 9, "ten": 10, "eleven": 11, "twelve": 12, "a dozen": 12,
    "fifteen": 15, "twenty": 20,
}
COUNT_PATTERN = re.compile(
    rf"\b(\d{{1,3}}|{'|'.join(NUMBER_WORDS)})\s+(?:\w+\s+)?(?:{PEOPLE})\b",
    re.IGNORECASE,
)

# Canonical resource tokens shared with the LLM prompt vocabulary.
RESOURCE_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("rescue_boat", re.compile(r"\b(boats?|rescue\s+boat|raft)\b", re.I)),
    ("life_jackets", re.compile(r"\b(life\s*jackets?|buoys?)\b", re.I)),
    ("rope", re.compile(r"\bropes?\b", re.I)),
    ("first_aid", re.compile(r"\bfirst\s*aid\b", re.I)),
    ("ambulance", re.compile(r"\bambulances?\b", re.I)),
    ("medical_evac", re.compile(r"\b(medical\s+(?:help|team|evac\w*)|paramedics?|"
                                r"hospital\s+support)\b", re.I)),
    ("fire_engine", re.compile(r"\b(fire\s+(?:engine|brigade|tender))\b", re.I)),
    ("water_pump", re.compile(r"\b(pumps?|dewater\w*)\b", re.I)),
    ("police_barricade", re.compile(r"\b(police\s+barricade|barricades?|"
                                    r"traffic\s+control)\b", re.I)),
    ("drinking_water", re.compile(r"\b(drinking\s+water|clean\s+water)\b", re.I)),
    ("food", re.compile(r"\b(food|rations?|meals?)\b", re.I)),
    ("power_restoration", re.compile(r"\b(generator|power\s+(?:supply|backup|"
                                     r"restor\w*)|electric\w+\s+team)\b", re.I)),
    ("technical_team", re.compile(r"\b(technical\s+(?:team|help)|engineers?)\b", re.I)),
]

ACCESS_PATTERN = re.compile(
    r"\b(road\s+(?:blocked|closed)|blocked|not\s+passable|impassable|no\s+access|"
    r"cut\s+off|cannot\s+cross|unable\s+to\s+cross|diverted|jammed|barricade\w*|"
    r"turning\s+back|avoid\s+(?:the\s+)?(?:route|road|bridge)|entry\s+closed|"
    r"route\s+should\s+be\s+avoided|approach\s+lane\s+is\s+no\s+longer)\b",
    re.IGNORECASE,
)

TIME_HINT_PATTERN = re.compile(
    r"\b(just\s+now|right\s+now|a\s+few\s+minutes\s+ago|\d+\s+minutes?\s+ago|"
    r"\d+\s+hours?\s+ago|since\s+morning|since\s+last\s+night|this\s+morning|"
    r"this\s+afternoon|last\s+night|earlier\s+today)\b",
    re.IGNORECASE,
)

# Hyper-local names this scenario is anchored to, matched before generic
# preposition parsing so "near Metro Pillar 42, Mayur Vihar" keeps the pillar.
NAMED_LANDMARKS = [
    re.compile(r"\b((?:metro\s+)?pillar\s+\d+)\b", re.I),
    re.compile(r"\b(sector\s+\d+\s+(?:bridge|crossing))\b", re.I),
    re.compile(
        r"\b(mayur\s+vihar(?:\s+phase[\s-]*\d|\s+metro(?:\s+station)?)?)\b",
        re.I,
    ),
]
PREPOSITION_LANDMARK = re.compile(
    r"\b(?:near|beside|next\s+to|outside|opposite|in\s+front\s+of|at|by|close\s+to)\s+"
    r"(?:the\s+)?([A-Za-z0-9][\w'’\- ]{2,40})",
    re.IGNORECASE,
)
STOP_LANDMARKS = {
    "the", "this", "that", "here", "there", "home", "it", "me", "us", "least",
    "lowest point", "night", "moment",
}


def _strip_repost_prefix(text: str) -> str:
    """Reposts carry the original claim; drop only the attribution prefix."""
    return re.sub(
        r"^\s*(?:RT|Repost|Forwarded(?:\s+update)?|Shared\s+from)\s*"
        r"(?:@[A-Za-z0-9_]+)?\s*:?\s*",
        "",
        text,
        flags=re.IGNORECASE,
    )


def _detect_hazard(text: str) -> str | None:
    for hazard, pattern in HAZARD_PATTERNS:
        if pattern.search(text):
            return hazard
    return None


def _detect_trapped(text: str) -> int | None:
    if not TRAPPED_VERBS.search(text):
        return None
    counts = []
    for match in COUNT_PATTERN.finditer(text):
        token = match.group(1).lower()
        value = NUMBER_WORDS.get(token)
        if value is None:
            try:
                value = int(token)
            except ValueError:
                continue
        counts.append(value)
    return max(counts) if counts else None


def _detect_landmark(text: str) -> str | None:
    for pattern in NAMED_LANDMARKS:
        match = pattern.search(text)
        if match:
            return " ".join(match.group(1).split()).title()
    match = PREPOSITION_LANDMARK.search(text)
    if not match:
        return None
    # Cut the match back to the name itself: stop at the first verb or clause
    # word, then keep at most four words so a whole sentence never becomes a
    # "landmark" the geocoder would then have to reject.
    candidate = re.split(
        r"\s+(?:is|are|was|were|has|have|had|and|but|because|while|so|that|which|"
        r"after|due|looks?|seems?|getting|gets|goes|going|will|can|cannot|"
        r"under|with|for)\b",
        match.group(1),
        flags=re.IGNORECASE,
    )[0]
    candidate = " ".join(candidate.split()[:4]).strip(" .,;:-")
    if not candidate or candidate.lower() in STOP_LANDMARKS or len(candidate) < 3:
        return None
    return candidate


def _detect_resources(text: str) -> list[str]:
    return [name for name, pattern in RESOURCE_PATTERNS if pattern.search(text)]


def heuristic_extract(report: dict) -> ExtractedReport:
    """Return a validated `ExtractedReport` from keyword rules alone."""
    raw_text = report.get("raw_text")
    if not isinstance(raw_text, str) or not raw_text.strip():
        return _irrelevant_fallback()

    text = _strip_repost_prefix(raw_text).strip()
    if NOISE_PATTERN.match(text):
        return _irrelevant_fallback()

    hazard = _detect_hazard(text)
    if hazard is None:
        return _irrelevant_fallback()

    facts = {
        "disaster_type": hazard,
        "trapped_count": _detect_trapped(text),
        "resource_demands": _detect_resources(text),
        "access_impediment": bool(ACCESS_PATTERN.search(text)),
    }
    time_hint = TIME_HINT_PATTERN.search(text)
    return ExtractedReport(
        relevant=True,
        disaster_type=hazard,
        claim=text,
        landmark=_detect_landmark(text),
        trapped_count=facts["trapped_count"],
        resource_demands=facts["resource_demands"],
        access_impediment=facts["access_impediment"],
        # Reuse the shared severity heuristic so offline and LLM extractions
        # land on the same scale; the scoring stage recomputes it anyway.
        severity=max(1, min(10, round(calculate_severity(facts)))),
        event_time_hint=time_hint.group(0) if time_hint else None,
    )
