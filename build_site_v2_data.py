# =============================================================================
# build_site_v2_data.py — Rebuild atlasnlp-site's Core data files to match the
# camera-ready paper (AtlasNLP_CameraReady.pdf) and the post-audit content-
# country re-extraction in Post_audit_analysis/.
#
# The camera-ready paper redefines AtlasNLP-Core: it is no longer the raw
# 18,035 initial extractions, but the 13,462 records that survive the
# post-audit eligibility criteria (paper introduced / materially extended /
# new compilation), with country attribution replaced by the re-extracted,
# evidence-gated v2 pipeline (Post_audit_analysis/). This script rebuilds the
# two site data files that drive every chart/table on the site, IN PLACE,
# keeping their exact existing column contracts so no JS needs to change:
#
#   automated_full_set_with_audited_languages.csv
#     -> filtered to the 13,462 eligible records; all_countries_covered /
#        num_content_countries / best_country_list_valid / Task Category
#        replaced with the v2-corrected, normalized values.
#
#   worldbench_country_task_expanded.csv
#     -> rebuilt one row per (dataset x explicit content_country) pair from
#        the corrected file above (paper's "main analysis" = explicit only).
#
# Run from atlasnlp-site/:
#   python build_site_v2_data.py
# =============================================================================
import csv
import json
from pathlib import Path

SITE_DIR = Path(__file__).parent
POST_AUDIT_DIR = SITE_DIR.parent / "Post_audit_analysis"

LIVE_CORE_PATH = SITE_DIR / "automated_full_set_with_audited_languages.csv"
ELIGIBLE_PATH = POST_AUDIT_DIR / "atlasnlp_core_v2_eligible.csv"

OUT_CORE_PATH = SITE_DIR / "automated_full_set_with_audited_languages.csv"
OUT_EXPANDED_PATH = SITE_DIR / "worldbench_country_task_expanded.csv"

BACKUP_CORE_PATH = SITE_DIR / "automated_full_set_with_audited_languages.PRE_V2.csv.bak"

# Always rebuild from the untouched pre-v2 backup once it exists, so the script
# is safely re-runnable even after OUT_CORE_PATH has already been overwritten.
OLD_CORE_PATH = BACKUP_CORE_PATH if BACKUP_CORE_PATH.exists() else LIVE_CORE_PATH


def parse_listish(value):
    if value is None:
        return []
    s = str(value).strip()
    if not s or s in {"[]", "None", "nan"}:
        return []
    try:
        obj = json.loads(s)
        if isinstance(obj, list):
            return [str(x).strip() for x in obj if str(x).strip()]
    except Exception:
        pass
    return [s]


def load_csv(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        r = csv.DictReader(f)
        return r.fieldnames or [], list(r)


def write_csv(path, rows, fields):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fields, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)


def main():
    old_fields, old_rows = load_csv(OLD_CORE_PATH)
    eligible_fields, eligible_rows = load_csv(ELIGIBLE_PATH)

    # Keep an unmodified backup of the pre-v2 site data before overwriting (once).
    if not BACKUP_CORE_PATH.exists():
        with open(LIVE_CORE_PATH, "rb") as src, open(BACKUP_CORE_PATH, "wb") as dst:
            dst.write(src.read())
        print(f"Backed up pre-v2 Core CSV to {BACKUP_CORE_PATH}")

    old_by_id = {r["source_row_index"]: r for r in old_rows}
    eligible_by_id = {r["source_row_index"]: r for r in eligible_rows}

    missing = set(eligible_by_id) - set(old_by_id)
    if missing:
        raise ValueError(f"{len(missing)} eligible rows have no match in old Core CSV: {sorted(missing)[:10]}")

    new_core_rows = []
    for rid, elig in eligible_by_id.items():
        base = dict(old_by_id[rid])  # preserve every original column (audited_languages etc.)

        explicit = parse_listish(elig.get("explicit_content_countries_normalized", "[]"))
        task = (elig.get("normalized_task_category") or base.get("Task Category") or "").strip()
        status = elig.get("content_country_status_normalized", "")

        # Old 'Country Attribution Method' reflected the pre-audit label and is now
        # stale relative to the re-extracted country evidence — replace it with the
        # v2 status so every downstream chart grouping by this field stays truthful.
        ATTRIBUTION_LABELS = {
            "EXPLICIT": "Explicit (post-audit)",
            "INFERRED_ONLY": "Inferred (language/community)",
            "UNATTRIBUTED": "Not stated / unattributed",
        }

        base["Task Category"] = task or "Not stated"
        base["all_countries_covered"] = "; ".join(explicit) if explicit else ""
        base["best_country_list_valid"] = "; ".join(explicit) if explicit else ""
        base["num_content_countries"] = str(len(explicit))
        base["Country Attribution Method"] = ATTRIBUTION_LABELS.get(status, status or "Not stated")
        base["v2_content_country_status"] = status
        base["v2_dataset_relationship"] = elig.get("v2_dataset_relationship", "")
        new_core_rows.append(base)

    core_fields = old_fields + [
        c for c in ["v2_content_country_status", "v2_dataset_relationship"] if c not in old_fields
    ]
    write_csv(OUT_CORE_PATH, new_core_rows, core_fields)
    print(f"Wrote {OUT_CORE_PATH}: {len(new_core_rows)} rows (was {len(old_rows)})")

    # ---- Expanded CSV: one row per (dataset x explicit content_country) ----
    expanded_fields = [
        "Task Category", "Dataset name", "Country Attribution Method", "Year created",
        "Language coverage type", "content_country", "producer_countries", "languages_in_dataset",
    ]
    expanded_rows = []
    for r in new_core_rows:
        countries = [c.strip() for c in (r.get("all_countries_covered") or "").split(";") if c.strip()]
        if not countries:
            continue
        languages = r.get("audited_languages") or r.get("canonical_language_string_cleaned") or ""
        for c in countries:
            expanded_rows.append({
                "Task Category": r.get("Task Category", ""),
                "Dataset name": r.get("Dataset name", ""),
                "Country Attribution Method": r.get("Country Attribution Method", ""),
                "Year created": r.get("Year created", ""),
                "Language coverage type": r.get("Language coverage type", ""),
                "content_country": c,
                "producer_countries": r.get("producer_countries", ""),
                "languages_in_dataset": languages,
            })

    write_csv(OUT_EXPANDED_PATH, expanded_rows, expanded_fields)
    print(f"Wrote {OUT_EXPANDED_PATH}: {len(expanded_rows)} rows")

    # ---- Sanity summary ----
    n_with_country = sum(1 for r in new_core_rows if r["all_countries_covered"])
    print(f"\nCore records: {len(new_core_rows)}")
    print(f"  with explicit country attribution: {n_with_country} ({n_with_country/len(new_core_rows)*100:.1f}%)")
    all_langs = set()
    for r in new_core_rows:
        for l in (r.get("audited_languages") or "").split(";"):
            l = l.strip()
            if l:
                all_langs.add(l)
    print(f"  unique audited languages: {len(all_langs)}")
    all_tasks = set(r["Task Category"] for r in new_core_rows if r["Task Category"] and r["Task Category"] != "Not stated")
    print(f"  unique task categories: {len(all_tasks)}")
    all_countries = set()
    for r in new_core_rows:
        for c in (r.get("all_countries_covered") or "").split(";"):
            c = c.strip()
            if c:
                all_countries.add(c)
    print(f"  unique countries represented (explicit): {len(all_countries)}")


GOLD_FINAL_PATH = POST_AUDIT_DIR / "atlasnlp_gold_final_1480.csv"
OLD_GOLD_PATH = SITE_DIR / "human_validated_set_with_audited_languages.csv"
GOLD_BACKUP_PATH = SITE_DIR / "human_validated_set_with_audited_languages.PRE_1480.csv.bak"


def build_gold():
    """Replace the site's Gold data with the canonical final 1,480-entry release
    population (atlasnlp_gold_final_1480.csv), matching the camera-ready paper's
    "1,480 entries / 989 normalized dataset groups" exactly.

    The final-1480 file doesn't carry the separate LLM-audited language-normalization
    layer (audited_languages/num_audited_languages) that the old 1,661-row Gold file
    had — a reliable per-row join between the two isn't possible (composite paper+
    dataset-name keys are ambiguous on both sides: many rows share the same pair from
    multi-country splitting). Since Gold's own 'Languages covered' field is already
    human-curated, we derive audited_languages directly from it (split/trim/dedupe)
    rather than leaving it blank or fabricating a join.
    """
    if not GOLD_BACKUP_PATH.exists() and OLD_GOLD_PATH.exists():
        with open(OLD_GOLD_PATH, "rb") as src, open(GOLD_BACKUP_PATH, "wb") as dst:
            dst.write(src.read())
        print(f"Backed up pre-1480 Gold CSV to {GOLD_BACKUP_PATH}")

    fields, rows = load_csv(GOLD_FINAL_PATH)

    out_rows = []
    for r in rows:
        langs_raw = r.get("Languages covered (separate using semicolon)", "") or ""
        langs = []
        for l in langs_raw.split(";"):
            l = l.strip()
            if l and l.lower() not in {"nan", "not stated"} and l not in langs:
                langs.append(l)
        out = dict(r)
        out["audited_language_list"] = json.dumps(langs, ensure_ascii=False)
        out["audited_languages"] = "; ".join(langs)
        out["num_audited_languages"] = str(len(langs))
        out_rows.append(out)

    out_fields = fields + ["audited_language_list", "audited_languages", "num_audited_languages"]
    write_csv(OLD_GOLD_PATH, out_rows, out_fields)
    print(f"Wrote {OLD_GOLD_PATH}: {len(out_rows)} rows (canonical final Gold population)")


if __name__ == "__main__":
    main()
    build_gold()
