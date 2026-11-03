#!/usr/bin/env python3
"""Draft the sanitised test fixtures in test/fixtures/ from the endpoint catalogue.

AUDIT.md section 3.2 gives, for each of the 69 DQA endpoints, the exact response envelope and a
field table (name, JSON type, nullability). This script turns that into JSON fixtures so the MSW
handlers in Phase 2+ have realistic, contract-accurate data to serve.

Rules (MIGRATION_PLAN.md section 0, CLAUDE.md hard rule 2):
  * **Test-only.** These files are never imported by `pnpm dev` or the build.
  * **Invented data.** Every name, phone number, ID and date is fake. Field names, types and nulls
    are kept exactly, because they are the API contract.
  * **Deterministic.** A seeded RNG means re-running produces the same file, so diffs stay small.

Re-running is safe and always regenerates from AUDIT.md.

Usage:
    python3 scripts/draft-fixtures.py            # write test/fixtures/*.json
    python3 scripts/draft-fixtures.py --check    # exit 1 if any fixture is out of date
"""

from __future__ import annotations

import json
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIT = ROOT / "docs" / "AUDIT.md"
OUT = ROOT / "test" / "fixtures"

SEED = 20261103
rng = random.Random(SEED)

DISTRICTS = ["Chibombo", "Kabwe", "Kapiri Mposhi", "Mkushi", "Mumbwa", "Chisamba", "Serenje",
             "Livingstone", "Mazabuka", "Monze", "Choma", "Kazungula"]
PROVINCE_BY_DISTRICT = {d: ("Central Province" if i < 7 else "Southern Province")
                        for i, d in enumerate(DISTRICTS)}
FACILITIES = ["Mukonchi Rural Health Centre", "Kabwe General Hospital", "Monze Mission Clinic",
              "Choma District Hospital", "Serenje Health Post", "Mazabuka Urban Clinic"]
WARDS = ["Ward 1", "Ward 2", "Ward 3", "Ward 7", "Ward 12"]
SERVICES = ["Schooled", "Healthy", "Safe", "Stable"]
FIRST = ["Chipo", "Misozi", "Thandiwe", "Kondwani", "Mutinta", "Bwalya", "Lweendo", "Nchimunya",
         "Mapalo", "Twalumba", "Chileshe", "Mwansa"]
LAST = ["Banda", "Phiri", "Mulenga", "Sakala", "Tembo", "Zulu", "Chanda", "Mwale", "Nyirenda"]
CAREGIVER_LABEL = "Caregiver Name - Confidential"


def uid(prefix: str, n: int) -> str:
    return f"{prefix}-{n:05d}"


def pick_date(fy: int = 2026) -> str:
    """Backend stores dates as text in DD-MM-YYYY or ISO; use DD-MM-YYYY for text columns."""
    month = rng.randint(1, 12)
    day = rng.randint(1, 28)
    year = fy - rng.choice([0, 0, 0, 1])
    return f"{day:02d}-{month:02d}-{year}"


def iso_ts(fy: int = 2026) -> str:
    month = rng.randint(1, 12)
    return f"{fy}-{month:02d}-{rng.randint(1,28):02d}T{rng.randint(0,23):02d}:{rng.randint(0,59):02d}:00.000Z"


def bigint(v: int) -> str:
    """pg returns COUNT()/bigint as a JSON string."""
    return str(v)


# ---------------------------------------------------------------------------
# Row builders, one per table the catalogue documents.
# ---------------------------------------------------------------------------

def household_row(active: bool = True, n: int = 1) -> dict:
    d = rng.choice(DISTRICTS)
    row = {
        "household_id": uid("HH", n),
        "district": d,
        "province": PROVINCE_BY_DISTRICT[d],
        "facility": rng.choice(FACILITIES),
        "ward": rng.choice(WARDS),
        "community": rng.choice(["Chibombo Central", "Kabwe East", "Monze Rural", "Choma Town"]),
        "caseworker_name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
        "caregiver_name": CAREGIVER_LABEL,
        "caregiver_phone": f"097{rng.randint(1000000, 9999999)}",
        "case_status": rng.choice(["Active", "1"]) if active else rng.choice(["Closed", "closed"]),
        "date_enrolled": pick_date(),
        "de_registration_date": None if active else pick_date(),
        "de_registration_reason": None if active else rng.choice(
            ["Graduated", "Migrated", "Death", "Refused services"]),
        "screened": rng.choice(["Yes", "No", "true", "false"]),
        "partner": rng.choice(["Partner A", "Partner B", "Partner C"]),
        "pregnant_woment": rng.choice(["Yes", "No", None]),
        "caregiver_hiv_status": rng.choice(["Positive", "Negative", "Unknown"]),
        "is_mother_virally_suppressed_wlhiv": rng.choice(["Yes", "No", "Unknown", None]),
        "homeaddress": f"Plot {rng.randint(1, 400)}",
        "last_service_date": pick_date(),
        # Sub-population flags used by the register filters.
        "calhiv": rng.choice(["Yes", "No"]),
        "hei": rng.choice(["Yes", "No"]),
        "cwlhiv": rng.choice(["Yes", "No"]),
        "agyw": rng.choice(["Yes", "No"]),
        "csv": rng.choice(["Yes", "No"]),
        "cfsw": rng.choice(["Yes", "No"]),
        "abym": rng.choice(["Yes", "No"]),
    }
    return row


def child_row(n: int = 1) -> dict:
    d = rng.choice(DISTRICTS)
    return {
        "unique_id": uid("VCA", n),
        "household_id": uid("HH", rng.randint(1, 40)),
        "firstname": rng.choice(FIRST),
        "lastname": rng.choice(LAST),
        "sex": rng.choice(["Male", "Female"]),
        "date_of_birth": pick_date(2026 - rng.randint(1, 17)),
        "age": bigint(rng.randint(1, 17)),
        "district": d,
        "province": PROVINCE_BY_DISTRICT[d],
        "facility": rng.choice(FACILITIES),
        "ward": rng.choice(WARDS),
        "caseworker_name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
        "caregiver_name": CAREGIVER_LABEL,
        "case_status": rng.choice(["Active", "1"]),
        "date_enrolled": pick_date(),
        "de_registration_date": None,
        "de_registration_reason": None,
        "calhiv": rng.choice(["Yes", "No"]),
        "hei": rng.choice(["Yes", "No"]),
        "cwlhiv": rng.choice(["Yes", "No"]),
        "agyw": rng.choice(["Yes", "No"]),
        "csv": rng.choice(["Yes", "No"]),
        "cfsw": rng.choice(["Yes", "No"]),
        "abym": rng.choice(["Yes", "No"]),
        "caahh": rng.choice(["Yes", "No"]),
        "caichh": rng.choice(["Yes", "No"]),
        "caich": rng.choice(["Yes", "No"]),
        "calwd": rng.choice(["Yes", "No"]),
        "caifhh": rng.choice(["Yes", "No"]),
        "muc": rng.choice(["Yes", "No"]),
        "pbfw": rng.choice(["Yes", "No"]),
    }


def service_row(kind: str, n: int) -> dict:
    row = {
        "household_id": uid("HH", rng.randint(1, 40)),
        "district": rng.choice(DISTRICTS),
        "service": rng.choice(SERVICES),
        "form_name": rng.choice(["Schooled Form", "Healthy Form", "Safe Form", "Stable Form"]),
        "service_date": pick_date(),
        "caseworker_name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
        "caregiver_name": CAREGIVER_LABEL,
        "facility": rng.choice(FACILITIES),
        "ward": rng.choice(WARDS),
        "verified": rng.choice(["Yes", "No"]),
        "date_created": iso_ts(),
    }
    if kind == "vca":
        row["vcaid"] = uid("VCA", n)
        row["unique_id"] = uid("VCA", n)
        row["firstname"] = rng.choice(FIRST)
        row["lastname"] = rng.choice(LAST)
    if kind == "caregiver":
        row["caregiver_id"] = uid("CG", n)
    return row


def referral_row(n: int) -> dict:
    return {
        "household_id": uid("HH", rng.randint(1, 40)),
        "unique_id": uid("VCA", n),
        "district": rng.choice(DISTRICTS),
        "facility": rng.choice(FACILITIES),
        "caseworker_name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
        "referred_date": pick_date(),
        "receiving_organization": rng.choice(["Org A", "Org B", "Org C"]),
        "services_referred": rng.choice(["School fees", "ART refill", "Counselling", "GBV support"]),
        "services_provided": rng.choice(["", "School fees", "Counselling"]),
        "case_status": "Active",
    }


def mother_row(n: int) -> dict:
    d = rng.choice(DISTRICTS)
    return {
        "household_id": uid("HH", rng.randint(1, 40)),
        "mother_id": uid("MI", n),
        "firstname": rng.choice(FIRST),
        "lastname": rng.choice(LAST),
        "district": d,
        "facility": rng.choice(FACILITIES),
        "date_enrolled": pick_date(),
        "child_count": bigint(rng.randint(1, 6)),
        "age": bigint(rng.randint(16, 49)),
    }


def pmtct_row(kind: str, n: int) -> dict:
    d = rng.choice(DISTRICTS)
    return {
        ("hei_id" if kind == "child" else "mother_id"): uid("PMTCT", n),
        "household_id": uid("HH", rng.randint(1, 40)),
        "firstname": rng.choice(FIRST),
        "lastname": rng.choice(LAST),
        "district": d,
        "facility": rng.choice(FACILITIES),
        "date_enrolled": pick_date(),
        "art_start_date": pick_date(),
        "final_outcome": rng.choice(["Negative", "Positive", "Unknown", ""]),
        "age": bigint(rng.randint(0, 40)),
    }


def etl_run(n: int = 1) -> dict:
    return {
        "run_id": uid("RUN", n),
        "pipeline": rng.choice(["households", "vcas", "services", "pmtct"]),
        "status": rng.choice(["success", "success", "running", "failed", "pending"]),
        "started_at": iso_ts(),
        "finished_at": iso_ts(),
        "duration_seconds": bigint(rng.randint(5, 900)),
        "triggered_by": "api",
        "log_excerpt": "INFO  extracted 12,345 rows\nINFO  loaded all_households\nINFO  done",
    }


# ---------------------------------------------------------------------------
# Fixture bodies, keyed by the exact key AUDIT.md uses.
# ---------------------------------------------------------------------------

def households() -> dict:
    return {
        "GET /household/households-count/:district(*)": {"status": "success", "count": bigint(1284)},
        "GET /household/all-households/:district(*)": {
            "status": "success", "data": [household_row(True, i) for i in range(1, 9)]},
        "GET /household/all-households-archived/:district(*)": {
            "status": "success", "data": [household_row(False, i) for i in range(1, 6)]},
        "GET /household/all-household-members-register": {
            "status": "success", "data": [child_row(i) for i in range(1, 9)]},
        "GET /household/members/:household_id(*)": {
            "status": "success", "data": [child_row(i) for i in range(1, 5)]},
        "GET /household/household-services-by-district/:district(*)": {
            "status": "success", "data": [service_row("household", i) for i in range(1, 9)]},
        "GET /household/households-count/:district(*)#not-found": {
            "status": "error", "message": "An error occurred while retrieving assessed households count.",
            "error": "relation \"all_households\" does not exist"},
    }


def caregiver() -> dict:
    return {
        "GET /household/caregiver-services/:household_id(*)": {
            "status": "success", "data": [service_row("caregiver", i) for i in range(1, 5)]},
        "GET /household/caregiver-services-by-district/:district(*)": {
            "status": "success", "data": [service_row("caregiver", i) for i in range(1, 9)]},
        "GET /household/caregiver-services-by-month/:district(*)": {
            "status": "success", "data": [
                {"district": d, "service_count": bigint(rng.randint(10, 400)), "service_month": f"{m:02d}-2026"}
                for d in DISTRICTS[:3] for m in (1, 2, 3)]},
        "GET /household/caregiver-referrals/:household_id(*)": {
            "status": "success", "data": [referral_row(i) for i in range(1, 4)]},
        "GET /household/caregiver-referrals-by-month/:district(*)": {
            "status": "success", "data": [
                {"district": d, "referral_count": bigint(rng.randint(1, 90)), "referral_month": f"{m:02d}-2026"}
                for d in DISTRICTS[:3] for m in (1, 2, 3)]},
        "GET /household/caregiver-caseplans/:household_id(*)": {
            "status": "success", "data": [
                {"household_id": uid("HH", i), "case_plan_id": uid("CP", i),
                 "plan_date": pick_date(), "status": rng.choice(["Open", "Closed"]),
                 "caseworker_name": f"{rng.choice(FIRST)} {rng.choice(LAST)}"} for i in range(1, 4)]},
        "GET /household/caregiver-caseplan-domains/:household_id(*)": {
            "status": "success", "data": [
                {"household_id": uid("HH", 1), "domain": s,
                 "is_provided": rng.choice(["Yes", "No"]), "notes": ""} for s in SERVICES]},
        "GET /household/caregiver-referrals/:household_id(*)#empty": {
            "status": "success", "data": []},
    }


def vcas() -> dict:
    return {
        "GET /child/vcas-count/:district(*)": {"status": "success", "count": bigint(2417)},
        "GET /child/vcas-assessed-register/:district(*)": {
            "status": "success", "data": [child_row(i) for i in range(1, 9)]},
        "GET /child/vcas-archived-register/:district(*)": {
            "status": "success",
            "data": [{**child_row(i), "case_status": "Closed", "de_registration_date": pick_date(),
                      "de_registration_reason": rng.choice(["Graduated", "Migrated", "Death"])}
                     for i in range(1, 6)]},
        "GET /child/vca-profile/:unique_id(*)": {"status": "success", "data": []},
        "GET /child/vca-services/:vcaid(*)": {
            "status": "success", "data": [service_row("vca", i) for i in range(1, 5)]},
        "GET /child/vca-services-by-district/:district(*)": {
            "status": "success", "data": [service_row("vca", i) for i in range(1, 9)]},
        "GET /child/vca-services-by-month/:district(*)": {
            "status": "success", "data": [
                {"district": d, "service_count": bigint(rng.randint(10, 500)), "service_month": f"{m:02d}-2026"}
                for d in DISTRICTS[:3] for m in (1, 2, 3)]},
        "GET /child/vca-referrals/:unique_id(*)": {
            "status": "success", "data": [referral_row(i) for i in range(1, 4)]},
        "GET /child/vca-referrals-by-month/:district(*)": {
            "status": "success", "data": [
                {"district": d, "referral_count": bigint(rng.randint(1, 120)), "referral_month": f"{m:02d}-2026"}
                for d in DISTRICTS[:3] for m in (1, 2, 3)]},
        "GET /child/vca-caseplans/:unique_id(*)": {
            "status": "success", "data": [
                {"unique_id": uid("VCA", i), "case_plan_id": uid("CP", i), "plan_date": pick_date(),
                 "status": rng.choice(["Open", "Closed"]),
                 "caseworker_name": f"{rng.choice(FIRST)} {rng.choice(LAST)}"} for i in range(1, 4)]},
        "GET /child/vca-caseplan-domains/:unique_id(*)": {
            "status": "success", "data": [
                {"unique_id": uid("VCA", 1), "domain": s, "is_provided": rng.choice(["Yes", "No"])}
                for s in SERVICES]},
    }


def mothers() -> dict:
    return {
        "GET /mother/total/count": {"status": "success", "count": rng.randint(800, 3000)},
        "GET /mother/count/:district(*)": {"status": "success", "count": rng.randint(40, 400)},
        "GET /mother/members-count/:district(*)": {"status": "success", "count": rng.randint(40, 400)},
        "GET /mother/district/count/:district(*)": {"status": "success", "count": rng.randint(40, 400)},
        "GET /mother/district/:district(*)": {
            "status": "success", "data": [mother_row(i) for i in range(1, 9)]},
        "GET /mother/district/:district(*)/filtered": {
            "status": "success", "data": [mother_row(i) for i in range(1, 9)]},
        "GET /mother/district/count/:district(*)#shadowed": {"status": "success", "data": []},
    }


def pmtct() -> dict:
    return {
        "GET /etl/pmtct-child-register/:district": {
            "status": "success", "data": [pmtct_row("child", i) for i in range(1, 7)]},
        "GET /etl/pmtct-mother-register/:district": {
            "status": "success", "data": [pmtct_row("mother", i) for i in range(1, 7)]},
    }


def hts() -> dict:
    return {
        "GET /household/hts-register-by-district/:district(*)": {
            "status": "success",
            "data": [{
                "client_id": uid("HTS", i),
                "household_id": uid("HH", rng.randint(1, 40)),
                "unique_id": uid("VCA", i),
                "firstname": rng.choice(FIRST),
                "lastname": rng.choice(LAST),
                "sex": rng.choice(["Male", "Female"]),
                "age": bigint(rng.randint(10, 24)),
                "district": rng.choice(DISTRICTS),
                "facility": rng.choice(FACILITIES),
                "test_date": pick_date(),
                "test_result": rng.choice(["Negative", "Positive", "Negative"]),
                "entry_point": rng.choice(["Community", "Facility", "Index testing"]),
                "caseworker_name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
                "linked_to_care": rng.choice(["Yes", "No"]),
            } for i in range(1, 9)],
        },
    }


def etl_pipeline() -> dict:
    return {
        "GET /etl/last-success": {"status": "success", "last_success_at": iso_ts()},
        "GET /etl/pipelines": {
            "status": "success",
            "pipelines": [
                {"key": k, "name": k.replace("-", " ").title(), "description": f"{k} extract"}
                for k in ("households", "vcas", "services", "pmtct", "hts")],
        },
        "GET /etl/files/:pipeline": {
            "status": "success",
            "files": [{"file_name": f"{p}_extract.csv", "size_bytes": bigint(rng.randint(1000, 90000)),
                       "modified_at": iso_ts(), "exists": True}
                      for p in ("households", "vcas")]},
        "GET /etl/runs": {"status": "success", "data": [etl_run(i) for i in range(1, 6)]},
        "GET /etl/runs/:runId": {"status": "success", "data": etl_run(1)},
        "POST /etl/run": {"status": "success", "data": {**etl_run(9), "status": "pending"}},
        "POST /etl/cancel/:runId": {"status": "success", "message": "Cancellation requested."},
        "POST /etl/send-report": {"status": "success", "message": "Report queued for delivery."},
        "GET /etl/download/:pipeline/:fileName": "<CSV stream>",
        "GET /etl/tablet-sync": {
            "status": "success",
            "data": {"last_sync_at": iso_ts(), "providers": [
                {"provider": f"Provider {i}", "tablet_id": uid("TAB", i),
                 "last_seen": iso_ts(), "synced": rng.choice([True, False])} for i in range(1, 4)]}},
        "GET /etl/tablet-sync/stream": "<SSE stream: event: sync\\ndata: {...}\\n\\n>",
        "POST /etl/tablet-sync/notify": {"status": "success", "message": "Notified 2 SSE clients."},
    }


def etl_performance() -> dict:
    return {
        "GET /etl/facility-performance": {
            "status": "success",
            "data": [{"facility": f, "district": DISTRICTS[i % len(DISTRICTS)],
                      "enrolments": bigint(rng.randint(10, 300)),
                      "services_this_month": bigint(rng.randint(10, 600)),
                      "services_last_month": bigint(rng.randint(10, 600)),
                      "tier": rng.choice(["A", "B", "C"])}
                     for i, f in enumerate(FACILITIES)]},
        "GET /etl/caseworker-performance": {
            "status": "success",
            "data": [{"caseworker_name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
                      "district": rng.choice(DISTRICTS),
                      "households": bigint(rng.randint(5, 80)),
                      "vcas": bigint(rng.randint(5, 160)),
                      "services": bigint(rng.randint(10, 400)),
                      "coverage": f"{rng.randint(40, 100)}%",
                      "tier": rng.choice(["A", "B", "C"])} for _ in range(6)]},
        "GET /etl/service-performance": {
            "status": "success",
            "data": [{"service": s, "provided": bigint(rng.randint(100, 5000)),
                      "coverage": f"{rng.randint(40, 100)}%",
                      "tier": rng.choice(["A", "B", "C"])} for s in SERVICES]},
    }


def etl_caseworkers() -> dict:
    return {
        "GET /etl/caseworker-journeys": {
            "status": "success",
            "data": [{"caseworker_name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
                      "latitude": round(-15 + rng.random() * 3, 5),
                      "longitude": round(27 + rng.random() * 3, 5),
                      "district": rng.choice(DISTRICTS),
                      "facility": rng.choice(FACILITIES),
                      "event_type": rng.choice(["visit", "service", "registration"]),
                      "dateCreated": iso_ts()} for _ in range(12)]},
        "GET /etl/caseworker-list": {
            "status": "success",
            "data": [{"caseworker_name": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
                      "district": rng.choice(DISTRICTS),
                      "facility": rng.choice(FACILITIES),
                      "has_gps": rng.choice([True, False]),
                      "last_seen": iso_ts()} for _ in range(8)]},
    }


def etl_dqa() -> dict:
    return {
        "GET /etl/facility-list": {
            "status": "success", "data": [{"ward": w, "district": DISTRICTS[i]}
                                          for i, w in enumerate(WARDS)]},
        "GET /etl/duplicates": {
            "status": "success",
            "data": {"summary": {"groups": bigint(12), "records": bigint(31)},
                     "groups": [{"household_id": uid("HH", i),
                                 "match_key": f"{rng.choice(LAST).lower()}-{rng.randint(100,999)}",
                                 "records": bigint(rng.randint(2, 5))} for i in range(1, 6)]}},
        "GET /etl/dqa-checks": {
            "status": "success",
            "data": [{"check": f"check_{i}", "label": f"Data quality check {i}",
                      "count": bigint(rng.randint(0, 400))} for i in range(1, 19)]},
        "GET /etl/dqa-records": {
            "status": "success",
            "data": [{"check": "check_1", "household_id": uid("HH", i),
                      "unique_id": uid("VCA", i), "district": rng.choice(DISTRICTS),
                      "issue": "Missing date of birth"} for i in range(1, 6)]},
        "GET /etl/action-queue": {
            "status": "success",
            "data": [{"household_id": uid("HH", i), "priority": rng.choice(["high", "medium", "low"]),
                      "description": "Service recorded without a case plan",
                      "due_date": pick_date()} for i in range(1, 7)]},
    }


def etl_duplicates() -> dict:
    return {
        "GET /etl/duplicates/reviews": {
            "status": "success",
            "data": [{"run_key": f"dup-{i}", "status": rng.choice(["ignored", "resolved"]),
                      "reviewed_by": f"{rng.choice(FIRST)} {rng.choice(LAST)}",
                      "reviewed_at": iso_ts()} for i in range(1, 4)]},
        "POST /etl/duplicates/review": {"status": "success", "message": "Review saved."},
        "DELETE /etl/duplicates/review/:run_key": {"status": "success", "message": "Review deleted."},
    }


def etl_services_summary() -> dict:
    return {
        "GET /etl/services/:type/summary [type=vca]": {
            "status": "success",
            "data": {"type": "vca", "district": "All",
                     "totals": {s.lower(): bigint(rng.randint(100, 4000)) for s in SERVICES},
                     "beneficiaries": bigint(2417), "households": bigint(1284),
                     "period": {"from": "2025-10-01", "to": "2026-09-30"}}},
        "GET /etl/services/:type/timeseries": {
            "status": "success",
            "data": [{"month": f"2026-{m:02d}", "count": bigint(rng.randint(50, 900))}
                     for m in range(1, 13)]},
        "GET /etl/services/:type/distribution": {
            "status": "success",
            "data": [{"service": s, "count": bigint(rng.randint(50, 900))} for s in SERVICES]},
    }


def etl_service_records() -> dict:
    recs = [service_row("vca", i) for i in range(1, 9)]
    return {
        "GET /etl/services/:type/records#vca": {
            "status": "success",
            "data": recs,
            "stats": {"total": bigint(len(recs)), "page": 1, "page_size": 50,
                      "verified": bigint(len(recs) - 2)},
        },
        "GET /etl/services/:type/record-detail#vca": {
            "status": "success", "data": recs[0]},
        "GET /etl/services/:type/export#vca": "<CSV stream>",
    }


def agent() -> dict:
    return {
        "POST /agent/chat": {
            "status": "success",
            "response": "Household HH-00001 has 4 members and received the Schooled service this month.",
            "model": "llama3.1:8b",
        },
        "GET /agent/health": {"status": "success", "model_reachable": True, "uptime_seconds": 86400},
    }


def superset() -> dict:
    ok = {"status": "success", "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.FIXTURE.signature"}
    return {
        "POST /superset/guest-token": ok,
        "POST /superset/guest-token#not-configured": {
            "status": "error", "message": "Superset is not configured on this server."},
        "POST /superset/guest-token#auth-missing-token": {
            "status": "fail", "message": "You are not logged in! Please log in to get access."},
        "POST /superset/guest-token#auth-expired-token": {
            "status": "fail", "message": "Your session has expired, please log in again."},
        "POST /superset/guest-token#no-user-log-mode": {
            "status": "fail", "message": "A signed-in user is required to embed a dashboard."},
        "POST /superset/guest-token#unknown-dashboard": {
            "status": "fail", "message": "Dashboard is not in the allowlist."},
        "POST /superset/guest-token#missing-dashboard-id": {
            "status": "fail", "message": "dashboardId is required."},
        "POST /superset/guest-token#no-scope": {
            "status": "fail", "message": "No data scope is assigned to your account."},
        "POST /superset/guest-token#upstream-failure": {
            "status": "error", "message": "Could not obtain a guest token from Superset."},
    }


def errors() -> dict:
    return {
        "GET /": "<JPEG bytes>",
        "ALL *": {"status": "error", "message": "Can't find /unknown/path on this server"},
    }


def directus() -> dict:
    user = {
        "id": "00000000-0000-4000-8000-000000000001",
        "email": "district.user@example.org",
        "first_name": "Chanda",
        "last_name": "Mulenga",
        "role": {"id": "00000000-0000-4000-8000-0000000000aa", "name": "ECAP+ User"},
        "description": "District User",
        "title": "Central Province",
        "location": "Kabwe",
        "facility": None,
        "district": None,
        "avatar": None,
        "status": "active",
        "last_access": iso_ts(),
        "password_change_required": False,
    }
    admin = {**user, "id": "00000000-0000-4000-8000-000000000002",
             "email": "admin@example.org", "description": "Administrator",
             "role": {"id": "00000000-0000-4000-8000-0000000000bb", "name": "Administrator"},
             "location": "All", "title": "All"}
    province = {**user, "id": "00000000-0000-4000-8000-000000000003",
                "email": "provincial.user@example.org", "description": "Provincial User",
                "title": "Southern Province", "location": "All"}
    support = {**user, "id": "00000000-0000-4000-8000-000000000004",
               "email": "support@example.org", "description": "Support User",
               "role": {"id": "00000000-0000-4000-8000-0000000000cc", "name": "ECAP+ Support"},
               "location": "All", "title": "All"}
    district_user = user
    return {
        "POST /auth/login": {"data": {
            "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.FIXTURE.signature",
            "refresh_token": "FIXTURE-REFRESH-TOKEN",
            "expires": 900000}},
        "POST /auth/password/request": {"data": {}},
        "POST /auth/password/reset": {"data": {}},
        "GET /users/me": {"data": district_user},
        "GET /users/me?fields=id": {"data": {"id": district_user["id"]}},
        "GET /users": {"data": [district_user, admin, province, support]},
        "GET /users?limit=-1": {"data": [district_user, admin, province, support]},
        "GET /users/:id": {"data": district_user},
        "POST /users/invite": {"data": {"id": "00000000-0000-4000-8000-0000000000ff"}},
        "PATCH /users/:id": {"data": district_user},
        "GET /roles": {"data": [
            {"id": "00000000-0000-4000-8000-0000000000aa", "name": "ECAP+ User"},
            {"id": "00000000-0000-4000-8000-0000000000bb", "name": "Administrator"},
            {"id": "00000000-0000-4000-8000-0000000000cc", "name": "ECAP+ Support"}]},
        "GET /notifications": {"data": [{
            "id": "00000000-0000-4000-8000-000000000010",
            "status": "inbox",
            "timestamp": iso_ts(),
            "sender": province["id"],
            "recipient": district_user["id"],
            "subject": "Normal",
            "message": "Fixture chat message body.",
            "collection": "support_chat",
            "item": None}]},
        "POST /notifications": {"data": {"id": "00000000-0000-4000-8000-000000000011"}},
        "DELETE /notifications/:id": {"data": None},
        "GET /activity": {"data": [{
            "id": "00000000-0000-4000-8000-000000000020",
            "action": "update", "collection": "all_households", "timestamp": iso_ts(),
            "user": {"id": district_user["id"], "first_name": "Chanda", "last_name": "Mulenga",
                     "email": district_user["email"], "district": None,
                     "facility": None, "location": "Kabwe", "title": "Central Province",
                     "description": "District User"}}]},
        "GET /items/flagged_forms_ecapplus_pmp": {"data": [{
            "id": 1, "household_id": uid("HH", 1), "vca_id": uid("VCA", 1),
            "verifier": "Chanda Mulenga", "comment": "Fixture flag comment.",
            "status": "open", "date_created": iso_ts()}]},
        "GET /items/flagged_forms_ecapii": {"data": []},
        "GET /items/weekly_extracts": {"data": [{
            "id": 1, "file": "00000000-0000-4000-8000-000000000030",
            "title": "Weekly extract", "date_created": iso_ts()}]},
        "POST /files": {"data": {"id": "00000000-0000-4000-8000-000000000031"}},
        "GET /assets/:id": "<binary asset>",
        # One fixture user per legacy role pattern (see AUDIT.md §4.4):
        "#role-patterns": {
            "district": {"description": "District User", "title": "Central Province", "location": "Kabwe"},
            "province": {"description": "Provincial User", "title": "Southern Province", "location": "All"},
            "admin": {"description": "Administrator", "title": "All", "location": "All"},
            "support": {"description": "Support User", "title": "All", "location": "All"},
            "lowercase-admin": {"description": "administrator", "title": "All", "location": "All"},
            "no-description-with-role": {"description": "", "title": "All", "location": "All"},
            "unscoped": {"description": "", "title": "", "location": ""},
        },
    }


FIXTURES = {
    "dqa-households.json": households,
    "dqa-caregiver.json": caregiver,
    "dqa-vcas.json": vcas,
    "dqa-mothers.json": mothers,
    "dqa-pmtct.json": pmtct,
    "dqa-hts.json": hts,
    "dqa-etl-pipeline.json": etl_pipeline,
    "dqa-etl-performance.json": etl_performance,
    "dqa-etl-caseworkers.json": etl_caseworkers,
    "dqa-etl-dqa.json": etl_dqa,
    "dqa-etl-duplicate-reviews.json": etl_duplicates,
    "dqa-etl-services-summary.json": etl_services_summary,
    "dqa-etl-service-records.json": etl_service_records,
    "dqa-agent.json": agent,
    "dqa-superset.json": superset,
    "dqa-errors.json": errors,
    "directus-users.json": directus,
}


def main() -> int:
    check = "--check" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    stale = []
    for name, build in FIXTURES.items():
        rng.seed(f"{SEED}:{name}")
        payload = build()
        text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
        path = OUT / name
        if check:
            if not path.exists() or path.read_text(encoding="utf-8") != text:
                stale.append(name)
        else:
            path.write_text(text, encoding="utf-8")
            print(f"{path.relative_to(ROOT)}  ({len(payload)} keys)")
    if check:
        if stale:
            print("out of date: " + ", ".join(stale))
            return 1
        print(f"{len(FIXTURES)} fixtures up to date")
        return 0
    print(f"\n{len(FIXTURES)} fixture files written to {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
