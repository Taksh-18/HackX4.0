"""Live Reddit ingestion connector.

Pulls real, public Reddit posts (text + attached images) matching disaster
keywords from a configurable list of subreddits, and feeds them into the
running CDIS API exactly the way a citizen report would arrive: one
`POST /reports` per post, with any attached image uploaded for real via
`POST /media` first (so it is genuinely hashable/analyzable downstream, not
just a filename the backend can't read).

This is deliberately the *only* live external source wired up (see the
project's own scope notes): official, free, stable read-only OAuth access -
no scraping, nothing that can break mid-demo because a platform changed its
frontend.

Setup (free, ~2 minutes):
  1. Log into Reddit, go to https://www.reddit.com/prefs/apps
  2. Click "create app" -> choose type "script"
  3. Name it anything (e.g. "cdis-connector"); redirect uri can be
     http://localhost:8080 (unused for script apps, but required by the form)
  4. Copy the string under the app name (client id) and the "secret" field
  5. Set environment variables:
       export REDDIT_CLIENT_ID=...
       export REDDIT_CLIENT_SECRET=...
       export REDDIT_USER_AGENT="cdis-disaster-intel/0.1 by u/<your-username>"
  6. pip install -e ".[reddit]"

Usage:
    python scripts/reddit_connector.py --api-url http://127.0.0.1:8000
    python scripts/reddit_connector.py --loop --interval 60
    python scripts/reddit_connector.py --dry-run --limit 5
"""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

DEFAULT_SUBREDDITS = [
    "india",
    "Chennai",
    "delhi",
    "mumbai",
    "bangalore",
    "kolkata",
    "IndiaSpeaks",
    "weather",
]

# Search terms only narrow *candidates* fetched from Reddit; the backend's
# own extraction pipeline still does the real relevance filtering.
DEFAULT_KEYWORDS = [
    "flood",
    "flooding",
    "waterlogging",
    "fire",
    "collapse",
    "collapsed",
    "trapped",
    "stranded",
    "rescue",
    "landslide",
    "earthquake",
    "cyclone",
]

SUPPORTED_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp")
DEFAULT_SEEN_IDS_PATH = (
    Path(__file__).resolve().parents[1] / "data" / "reddit_seen_ids.json"
)
REQUEST_TIMEOUT_S = 15.0


@dataclass
class Candidate:
    id: str
    author: str
    title: str
    selftext: str
    created_utc: float
    image_url: str | None
    permalink: str


def _load_seen_ids(path: Path) -> set[str]:
    try:
        return set(json.loads(path.read_text()))
    except (OSError, ValueError):
        return set()


def _save_seen_ids(path: Path, seen: set[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    # Cap growth: keep only the most recent 5000 IDs.
    path.write_text(json.dumps(sorted(seen)[-5000:]))


def _reddit_client():
    """Build a read-only PRAW client from environment credentials."""
    import praw

    client_id = os.getenv("REDDIT_CLIENT_ID", "").strip()
    client_secret = os.getenv("REDDIT_CLIENT_SECRET", "").strip()
    user_agent = os.getenv("REDDIT_USER_AGENT", "").strip()
    if not client_id or not client_secret or not user_agent:
        raise RuntimeError(
            "Set REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, and REDDIT_USER_AGENT "
            "(see the module docstring for how to get a free Reddit API app)."
        )
    reddit = praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent,
    )
    reddit.read_only = True
    return reddit


def _image_url(submission) -> str | None:
    url = getattr(submission, "url", "") or ""
    if url.lower().endswith(SUPPORTED_IMAGE_EXTENSIONS):
        return url
    # Gallery/preview posts sometimes carry a usable preview image instead.
    preview = getattr(submission, "preview", None)
    if preview:
        try:
            return preview["images"][0]["source"]["url"]
        except (KeyError, IndexError, TypeError):
            return None
    return None


def fetch_candidates(
    reddit,
    *,
    subreddits: list[str],
    keywords: list[str],
    limit: int,
    since_hours: float,
) -> list[Candidate]:
    cutoff = time.time() - since_hours * 3600
    query = " OR ".join(keywords)
    seen_in_batch: set[str] = set()
    candidates: list[Candidate] = []

    for name in subreddits:
        try:
            subreddit = reddit.subreddit(name)
            results = subreddit.search(
                query, sort="new", time_filter="day", limit=limit
            )
            for submission in results:
                if submission.id in seen_in_batch:
                    continue
                if submission.created_utc < cutoff:
                    continue
                seen_in_batch.add(submission.id)
                author = (
                    str(submission.author)
                    if submission.author
                    else "reddit_deleted_user"
                )
                candidates.append(
                    Candidate(
                        id=submission.id,
                        author=author,
                        title=submission.title or "",
                        selftext=submission.selftext or "",
                        created_utc=submission.created_utc,
                        image_url=_image_url(submission),
                        permalink=f"https://reddit.com{submission.permalink}",
                    )
                )
        except Exception as exc:  # noqa: BLE001 - one bad subreddit shouldn't kill the run
            print(f"  ! skipping r/{name}: {type(exc).__name__}: {exc}")

    return candidates


_NETWORK_ERRORS = (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError)


def _download_image(url: str) -> bytes | None:
    try:
        headers = {"User-Agent": "cdis-connector/0.1"}
        request = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_S) as response:
            return response.read()
    except _NETWORK_ERRORS as exc:
        print(f"  ! image download failed ({type(exc).__name__}): {url}")
        return None


def _upload_media(api_url: str, image_bytes: bytes, filename: str) -> str | None:
    import mimetypes

    boundary = "----cdisReddit"
    content_type = mimetypes.guess_type(filename)[0] or "image/jpeg"
    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
        f"Content-Type: {content_type}\r\n\r\n"
    ).encode() + image_bytes + f"\r\n--{boundary}--\r\n".encode()

    request = urllib.request.Request(
        f"{api_url.rstrip('/')}/media",
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_S) as response:
            return json.loads(response.read().decode())["media_url"]
    except (*_NETWORK_ERRORS, KeyError) as exc:
        print(f"  ! media upload failed ({type(exc).__name__})")
        return None


def _submit_report(api_url: str, payload: dict) -> dict | None:
    body = json.dumps(payload).encode()
    request = urllib.request.Request(
        f"{api_url.rstrip('/')}/reports",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_S) as response:
            return json.loads(response.read().decode())
    except _NETWORK_ERRORS as exc:
        print(f"  ! report submission failed ({type(exc).__name__}): {exc}")
        return None


def run_once(
    *,
    api_url: str,
    subreddits: list[str],
    keywords: list[str],
    limit: int,
    since_hours: float,
    seen_ids_path: Path,
    dry_run: bool,
) -> int:
    seen = _load_seen_ids(seen_ids_path)
    reddit = _reddit_client()

    print(f"Searching r/{', r/'.join(subreddits)} for: {', '.join(keywords)} ...")
    candidates = fetch_candidates(
        reddit,
        subreddits=subreddits,
        keywords=keywords,
        limit=limit,
        since_hours=since_hours,
    )
    new_candidates = [c for c in candidates if c.id not in seen]
    print(f"Found {len(candidates)} candidate post(s), {len(new_candidates)} new.")

    submitted = 0
    for candidate in new_candidates:
        raw_text = (candidate.title + "\n" + candidate.selftext).strip()
        if not raw_text:
            seen.add(candidate.id)
            continue

        print(f"- u/{candidate.author}: {candidate.title[:80]!r}")
        if dry_run:
            seen.add(candidate.id)
            continue

        media_url = None
        if candidate.image_url:
            image_bytes = _download_image(candidate.image_url)
            if image_bytes:
                ext = candidate.image_url.split("?")[0].rsplit(".", 1)[-1].lower()
                filename = f"reddit_{candidate.id}.{ext}"
                media_url = _upload_media(api_url, image_bytes, filename)

        timestamp = datetime.fromtimestamp(candidate.created_utc, tz=UTC).isoformat()
        result = _submit_report(
            api_url,
            {
                "source_user": f"reddit_u_{candidate.author}",
                "raw_text": raw_text,
                "media_url": media_url,
                "timestamp": timestamp,
            },
        )
        seen.add(candidate.id)
        if result is not None:
            submitted += 1
            relevant = result.get("extracted_json", {}).get("relevant")
            print(f"  -> submitted {result.get('id')} relevant={relevant}")

    _save_seen_ids(seen_ids_path, seen)
    print(f"Done: {submitted} new report(s) submitted this run.")
    return submitted


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--api-url", default="http://127.0.0.1:8000")
    parser.add_argument("--subreddits", nargs="+", default=DEFAULT_SUBREDDITS)
    parser.add_argument("--keywords", nargs="+", default=DEFAULT_KEYWORDS)
    parser.add_argument(
        "--limit", type=int, default=15, help="Max posts fetched per subreddit"
    )
    parser.add_argument(
        "--since-hours", type=float, default=24.0, help="Ignore posts older than this"
    )
    parser.add_argument("--seen-ids-file", type=Path, default=DEFAULT_SEEN_IDS_PATH)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch and print candidates, submit nothing",
    )
    parser.add_argument(
        "--loop", action="store_true", help="Poll continuously instead of once"
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=60.0,
        help="Seconds between polls in --loop mode",
    )
    args = parser.parse_args(argv)

    try:
        if args.loop:
            print(f"Polling every {args.interval}s. Ctrl+C to stop.")
            while True:
                run_once(
                    api_url=args.api_url,
                    subreddits=args.subreddits,
                    keywords=args.keywords,
                    limit=args.limit,
                    since_hours=args.since_hours,
                    seen_ids_path=args.seen_ids_file,
                    dry_run=args.dry_run,
                )
                time.sleep(args.interval)
        else:
            run_once(
                api_url=args.api_url,
                subreddits=args.subreddits,
                keywords=args.keywords,
                limit=args.limit,
                since_hours=args.since_hours,
                seen_ids_path=args.seen_ids_file,
                dry_run=args.dry_run,
            )
    except KeyboardInterrupt:
        print("\nStopped.")
    except RuntimeError as exc:
        print(f"Error: {exc}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
