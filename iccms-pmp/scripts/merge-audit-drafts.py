#!/usr/bin/env python3
"""Merge the verified per-module audit drafts into docs/audit/<module>.md.

The step-3 workflow wrote one draft per "part" into docs/audit/_drafts/step3/ (for example
households--registers.md and households--profile.md). This script assembles each module's parts
into the single file later phases read, without losing or reordering any content:

  * one title and one merged scope blockquote,
  * one merged, de-duplicated "Legacy files" table,
  * a contents list,
  * all route and component sections in part order,
  * one "Other behaviour" section and one "Open questions" section at the end, each
    sub-divided by part when the module has more than one part.

Content is carried over verbatim apart from heading levels, so the checkboxes and citations that
the readers verified survive unchanged. Re-running is safe: it always rebuilds from the drafts.

Usage:
    python3 scripts/merge-audit-drafts.py [module ...]
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass, field
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DRAFTS = ROOT / "docs" / "audit" / "_drafts" / "step3"
OUT = ROOT / "docs" / "audit"

# Module -> ordered part labels. Labels match the draft file names: <module>--<label>.md
MODULES: dict[str, list[str]] = {
    "account": ["all"],
    "analytics": ["all"],
    "assistant": ["all"],
    "auth": ["all"],
    "calendar": ["all"],
    "caregivers": ["all"],
    "caseworkers": ["all"],
    "dashboard": ["main", "widgets"],
    "data-pipeline": ["part1", "part2"],
    "districts": ["all"],
    "docs": ["all"],
    "flags": ["all"],
    "households": ["registers", "profile"],
    "hts": ["register", "risk-profile"],
    "mother-index": ["all"],
    "performance": ["all"],
    "pmtct": ["all"],
    "referrals": ["all"],
    "services": ["core", "profiles", "vca-services-dashboard"],
    "support": ["all"],
    "training-log": ["all"],
    "users": ["all"],
    "vcas": ["registers", "profile"],
}

PART_LABELS = {
    "all": "the whole module",
    "main": "the dashboard and its shared strips",
    "widgets": "the unreferenced dashboard widgets",
    "part1": "the page: hero, pipelines, run history and logs",
    "part2": "the page: tablet sync and user activity",
    "registers": "the registers",
    "profile": "the profile page",
    "register": "the register",
    "risk-profile": "the risk register and the profile",
    "core": "the shared services page",
    "profiles": "the three service profile pages",
    "vca-services-dashboard": "the unreferenced VCA services dashboard",
}

ROUTE_H2 = re.compile(r"^## (Route|Component) ")
OTHER = re.compile(r"^## (Other behaviour|Open questions for the developer)\s*$")


@dataclass
class Part:
    label: str
    title: str
    scope: list[str] = field(default_factory=list)
    legacy_rows: list[str] = field(default_factory=list)
    body: list[str] = field(default_factory=list)       # route / component / misc sections
    other: list[str] = field(default_factory=list)      # "Other behaviour" content
    questions: list[str] = field(default_factory=list)  # "Open questions" content


def parse(path: Path, label: str) -> Part:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    part = Part(label=label, title="")

    i = 0
    # Header: h1 + blockquote
    while i < len(lines) and not lines[i].startswith("# "):
        i += 1
    if i < len(lines):
        part.title = lines[i][2:].strip()
        i += 1
    while i < len(lines) and not lines[i].strip():
        i += 1
    while i < len(lines) and lines[i].lstrip().startswith(">"):
        part.scope.append(lines[i])
        i += 1

    # Split the remainder into h2 sections.
    sections: list[tuple[str | None, list[str]]] = [(None, [])]
    for line in lines[i:]:
        if line.startswith("## "):
            sections.append((line[3:].strip(), [line]))
        else:
            sections[-1][1].append(line)

    for heading, chunk in sections:
        if heading is None:
            continue
        if heading == "Legacy files":
            for row in chunk[1:]:
                if row.startswith("|") and not re.match(r"^\|\s*-+", row) and "| File |" not in row:
                    part.legacy_rows.append(row)
        elif OTHER.match("## " + heading):
            target = part.other if heading.startswith("Other behaviour") else part.questions
            target.extend(chunk[1:])
        else:
            part.body.extend(chunk)

    return part


def dedupe(rows: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for row in rows:
        key = row.split("|")[1].strip().strip("`") if "|" in row else row
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
    return out


def strip_blank_edges(lines: list[str]) -> list[str]:
    while lines and not lines[0].strip():
        lines = lines[1:]
    while lines and not lines[-1].strip():
        lines = lines[:-1]
    return lines


def demote(lines: list[str]) -> list[str]:
    return [("#" + line) if line.startswith("## ") else line for line in lines]


def build(module: str, parts: list[Part]) -> str:
    multi = len(parts) > 1
    out: list[str] = []

    scope_lines: list[str] = []
    for p in parts:
        for line in p.scope:
            body = line.lstrip(">").strip()
            if not body:
                continue
            # Drop the repeated "New module `x`" prefix; the merged header states it once.
            body = re.sub(r"^New module `[^`]+`\s*·\s*", "", body)
            if multi and body.startswith("Legacy routes → new routes"):
                body = f"{body}  \u00b7 *part `{p.label}`*"
            scope_lines.append("> " + body)
    scope_lines = dedupe_scope(scope_lines)

    out.append(f"# {module} — legacy audit")
    out.append("")
    out.extend(scope_lines)
    if multi:
        out.append(
            "> Merged from the step-3 drafts: "
            + ", ".join(f"`{p.label}`" for p in parts)
            + ". Content is carried over verbatim; only heading levels, the merged header and"
            " the shared Legacy files table were consolidated."
        )
    out.append("")

    legacy = dedupe([r for p in parts for r in p.legacy_rows])
    if legacy:
        out.append("## Legacy files")
        out.append("")
        out.append("| File | Lines | Role |")
        out.append("| --- | --- | --- |")
        out.extend(legacy)
        out.append("")

    if multi:
        out.append("## Contents")
        out.append("")
        for p in parts:
            label = PART_LABELS.get(p.label, p.label)
            out.append(f"- [{label}](#part-{p.label})")
        out.append("")

    for p in parts:
        if multi:
            out.append(f'<a id="part-{p.label}"></a>')
            out.append("")
            out.append(f"## Part: {PART_LABELS.get(p.label, p.label)}")
            out.append("")
        out.extend(strip_blank_edges(p.body))
        out.append("")

    if any(p.other for p in parts):
        out.append("## Other behaviour")
        out.append("")
        for p in parts:
            content = strip_blank_edges(p.other)
            if not content:
                continue
            if multi:
                out.append(f"### {PART_LABELS.get(p.label, p.label).capitalize()} draft")
                out.append("")
                content = demote(content)
            out.extend(content)
            out.append("")

    if any(p.questions for p in parts):
        out.append("## Open questions for the developer")
        out.append("")
        for p in parts:
            content = strip_blank_edges(p.questions)
            if not content:
                continue
            if multi:
                out.append(f"### {PART_LABELS.get(p.label, p.label).capitalize()} draft")
                out.append("")
                content = demote(content)
            out.extend(content)
            out.append("")

    text = "\n".join(out)
    text = re.sub(r"\n{4,}", "\n\n\n", text)
    return text.rstrip() + "\n"


def dedupe_scope(lines: list[str]) -> list[str]:
    """Merge the per-part '>' scope lines, keeping each distinct sentence once."""
    seen: set[str] = set()
    out: list[str] = []
    for line in lines:
        body = line.lstrip(">").strip()
        if not body:
            continue
        key = re.sub(r"\s+", " ", body.lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(line)
    return out


def main() -> int:
    wanted = sys.argv[1:] or list(MODULES)
    unknown = [m for m in wanted if m not in MODULES]
    if unknown:
        print(f"unknown module(s): {', '.join(unknown)}", file=sys.stderr)
        print(f"known: {', '.join(sorted(MODULES))}", file=sys.stderr)
        return 2

    OUT.mkdir(parents=True, exist_ok=True)
    written = 0
    for module in wanted:
        parts: list[Part] = []
        for label in MODULES[module]:
            path = DRAFTS / f"{module}--{label}.md"
            if not path.is_file():
                print(f"missing draft: {path.relative_to(ROOT)}", file=sys.stderr)
                return 1
            parts.append(parse(path, label))
        target = OUT / f"{module}.md"
        target.write_text(build(module, parts), encoding="utf-8")
        lines = target.read_text(encoding="utf-8").count("\n")
        boxes = target.read_text(encoding="utf-8").count("- [ ]")
        print(f"{target.relative_to(ROOT)}  ({lines} lines, {boxes} checkboxes)")
        written += 1

    print(f"\n{written} module file(s) written")
    return 0


if __name__ == "__main__":
    sys.exit(main())
