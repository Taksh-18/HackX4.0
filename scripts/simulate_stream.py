"""Local high-volume report-stream simulator.

Stands in for the social-platform ingestion connectors explicitly out of
scope for this hackathon (Gap 3 in the backend review): it replays
`data/simulated_reports.json` against a running API, one `POST /reports`
call per report, so the demo can show "a burst of citizen reports arriving"
without any real platform credentials or network dependency beyond the
local API itself.

Examples:

    # Real-time-ish replay, spaced by the dataset's own timestamps
    python scripts/simulate_stream.py --api-url http://127.0.0.1:8000

    # Fixed 0.5s delay between each report, ignoring dataset timing
    python scripts/simulate_stream.py --delay 0.5

    # As fast as possible
    python scripts/simulate_stream.py --immediate

    # Deterministic shuffle, useful for showing out-of-order arrival
    python scripts/simulate_stream.py --shuffle --seed 7
"""

from __future__ import annotations

import argparse
import json
import random
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATASET = ROOT / "data" / "simulated_reports.json"
# Generous: run_pipeline reprocesses every stored report on each new
# submission, so later requests in a large batch take noticeably longer
# than earlier ones. A short timeout here previously caused spurious
# client-side timeouts and SQLite lock contention under load.
REQUEST_TIMEOUT_S = 90.0


def _load_reports(path: Path) -> list[dict]:
    reports = json.loads(path.read_text())
    if not isinstance(reports, list):
        raise ValueError(f"{path} must contain a JSON array of reports")
    return reports


def _submit(api_url: str, report: dict) -> dict:
    payload = {
        "source_user": report["source_user"],
        "raw_text": report["raw_text"],
        "media_url": report.get("media_url"),
        "timestamp": report.get("timestamp"),
        "gps_lat": report.get("gps_lat"),
        "gps_lon": report.get("gps_lon"),
    }
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{api_url.rstrip('/')}/reports",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=REQUEST_TIMEOUT_S) as response:
        return json.loads(response.read().decode("utf-8"))


def _dataset_delay(previous: dict | None, current: dict) -> float:
    """Seconds between two reports' own timestamps; 0 if unavailable."""
    if previous is None:
        return 0.0
    try:
        prev_time = datetime.fromisoformat(previous["timestamp"])
        curr_time = datetime.fromisoformat(current["timestamp"])
    except (KeyError, ValueError):
        return 0.0
    return max(0.0, (curr_time - prev_time).total_seconds())


def run(
    reports: list[dict],
    *,
    api_url: str,
    delay: float | None,
    immediate: bool,
    max_delay: float,
) -> tuple[int, list[str]]:
    """Submit every report in order; return (ok_count, failure_messages)."""
    ok = 0
    failures: list[str] = []
    previous: dict | None = None

    for index, report in enumerate(reports, start=1):
        if not immediate:
            wait = delay if delay is not None else _dataset_delay(previous, report)
            wait = min(wait, max_delay)
            if wait > 0:
                time.sleep(wait)
        previous = report

        label = report.get("id", f"#{index}")
        try:
            result = _submit(api_url, report)
        except (
            urllib.error.URLError,
            urllib.error.HTTPError,
            TimeoutError,
            OSError,
        ) as exc:
            failures.append(f"{label}: {exc}")
            print(f"[{index}/{len(reports)}] FAILED {label}: {exc}")
            continue
        except (ValueError, KeyError) as exc:
            failures.append(f"{label}: malformed response ({exc})")
            print(f"[{index}/{len(reports)}] FAILED {label}: malformed response")
            continue

        ok += 1
        relevant = result.get("extracted_json", {}).get("relevant")
        report_id = result.get("id", "?")
        print(f"[{index}/{len(reports)}] OK {report_id} relevant={relevant}")

    return ok, failures


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--api-url", default="http://127.0.0.1:8000")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=DEFAULT_DATASET,
        help="JSON array of reports to replay (default: data/simulated_reports.json)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=None,
        help="Fixed seconds between submissions (default: replay dataset timing)",
    )
    parser.add_argument(
        "--max-delay",
        type=float,
        default=5.0,
        help="Cap on any inferred delay from dataset timestamps, in seconds",
    )
    parser.add_argument(
        "--immediate", action="store_true", help="No delay between submissions"
    )
    parser.add_argument(
        "--shuffle",
        action="store_true",
        help="Shuffle submission order (deterministic)",
    )
    parser.add_argument(
        "--seed", type=int, default=42, help="Shuffle seed (default 42)"
    )
    args = parser.parse_args(argv)

    reports = _load_reports(args.dataset)
    if args.shuffle:
        random.Random(args.seed).shuffle(reports)

    print(f"Simulating {len(reports)} reports against {args.api_url} ...")
    ok, failures = run(
        reports,
        api_url=args.api_url,
        delay=args.delay,
        immediate=args.immediate,
        max_delay=args.max_delay,
    )

    print()
    print(f"Done: {ok} submitted, {len(failures)} failed.")
    if failures:
        print("Failures:")
        for line in failures:
            print(f"  - {line}")

    return 1 if failures and ok == 0 else 0


if __name__ == "__main__":
    raise SystemExit(main())
