"""app.dedup: deterministic text normalization and near-duplicate grouping."""

from app.dedup import group_duplicate_texts, is_near_duplicate, normalize_text


def test_normalize_strips_repost_prefix_urls_mentions_and_punctuation():
    text = "RT @amit_mv: Water is rising near Pillar 42!! See http://pic.example/x"
    normalized = normalize_text(text)
    assert "rt" not in normalized
    assert "@amit_mv" not in normalized
    assert "http" not in normalized
    assert "!!" not in normalized
    assert "water is rising near pillar 42 see" == normalized


def test_exact_duplicate_text_is_grouped():
    reports = [
        {"id": "a", "raw_text": "Water is rising fast near Metro Pillar 42."},
        {"id": "b", "raw_text": "Water is rising fast near Metro Pillar 42."},
        {"id": "c", "raw_text": "Completely unrelated report about a fire downtown."},
    ]
    groups = group_duplicate_texts(reports)
    sizes = sorted(len(g.report_ids) for g in groups)
    assert sizes == [1, 2]
    duplicate_group = next(g for g in groups if len(g.report_ids) == 2)
    assert duplicate_group.report_ids == ["a", "b"]


def test_near_duplicate_repost_is_grouped_with_original():
    reports = [
        {
            "id": "orig",
            "raw_text": "Serious flooding beside Pillar 42, water almost waist deep.",
        },
        {
            "id": "repost",
            "raw_text": "RT @someone: Serious flooding beside Pillar 42, water "
            "almost waist deep.",
        },
    ]
    groups = group_duplicate_texts(reports)
    assert len(groups) == 1
    assert groups[0].report_ids == ["orig", "repost"]


def test_unrelated_same_landmark_reports_are_not_merged():
    """Sharing a landmark word is never sufficient; only whole-text similarity is."""
    reports = [
        {
            "id": "x",
            "raw_text": (
                "Water rising fast near Metro Pillar 42, shop owners moving stock."
            ),
        },
        {
            "id": "y",
            "raw_text": "A small fire started near Metro Pillar 42 electrical box, "
            "smoke visible from the road.",
        },
    ]
    groups = group_duplicate_texts(reports)
    assert len(groups) == 2
    assert all(len(g.report_ids) == 1 for g in groups)


def test_short_text_only_merges_on_exact_match():
    reports = [
        {"id": "a", "raw_text": "Help now"},
        {"id": "b", "raw_text": "Help fast"},
    ]
    groups = group_duplicate_texts(reports)
    assert len(groups) == 2


def test_transitive_grouping_chains_near_duplicates():
    reports = [
        {"id": "a", "raw_text": "Water rising fast near Metro Pillar 42 right now."},
        {
            "id": "b",
            "raw_text": "Water rising fast near Metro Pillar 42 right now, urgent.",
        },
        {
            "id": "c",
            "raw_text": (
                "Water rising fast near Metro Pillar 42 right now, urgent, send help."
            ),
        },
    ]
    groups = group_duplicate_texts(reports)
    assert len(groups) == 1
    assert groups[0].report_ids == ["a", "b", "c"]


def test_is_near_duplicate_respects_threshold():
    a = normalize_text("floodwater is entering the ground floor shops near pillar 42")
    b = normalize_text("floodwater is entering the ground floor shops near pillar 99")
    assert is_near_duplicate(a, b) is True  # one-word difference, still near-identical

    c = normalize_text("a completely different sentence describing a fire incident")
    assert is_near_duplicate(a, c) is False


def test_empty_reports_list_returns_no_groups():
    assert group_duplicate_texts([]) == []
