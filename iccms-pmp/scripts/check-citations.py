#!/usr/bin/env python3
"""Verify the citations in the audit drafts against the legacy and backend sources.

Every claim in docs/audit/ is written as `legacy:<path>:<line>` or `backend:<path>:<line>`
(or a line range `<start>-<end>`). This script re-opens each cited file and checks that:

  1. the file exists,
  2. the cited line numbers are inside the file,
  3. (--strict) the cited range is non-empty (a citation to blank lines points nowhere), and
  4. (--strict) the cited range is not implausibly large (> MAX_SPAN lines), which usually
     means a range was mistyped.

Usage:
    python3 scripts/check-citations.py [--strict] [--json] [files...]

With no files, checks every *.md under docs/audit/. Exit code 1 if any citation is invalid.
This is a development aid for Phase 1; it is not part of `pnpm check`.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
REPO = ROOT.parent
# Overridable so the audit can be re-verified against *patched* scratch copies of the reference
# trees without ever touching them. See scripts/verify-audit.sh.
SOURCES = {
    "legacy": Path(os.environ.get("ECAP_LEGACY_DIR") or REPO / "old-ecap-pmp"),
    "backend": Path(os.environ.get("ECAP_BACKEND_DIR") or REPO / "ecap-plus-pmp-backend"),
}

# legacy:src/App.tsx:112-133   legacy:src/App.tsx:146,214-224   backend:index.js:23-26
CITATION = re.compile(
    r"\b(?P<src>legacy|backend):(?P<path>[A-Za-z0-9_@./-]+\.[A-Za-z0-9]+)"
    r"(?P<lines>:(?:\d+(?:-\d+)?)(?:\s*,\s*\d+(?:-\d+)?)*)"
)

MAX_SPAN = 120

STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "from", "into", "when", "where", "which",
    "have", "been", "they", "their", "there", "then", "than", "also", "only", "every",
    "some", "such", "each", "other", "more", "most", "must", "does", "not", "but", "are",
    "was", "were", "will", "would", "can", "could", "should", "its", "it's", "has", "had",
    "all", "any", "one", "two", "use", "used", "uses", "via", "per", "see", "set", "get",
}


@dataclass
class Problem:
    file: str
    line: int
    citation: str
    kind: str
    detail: str = ""


def parse_ranges(spec: str) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    for part in spec.lstrip(":").split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            a, b = part.split("-", 1)
            out.append((int(a), int(b)))
        else:
            n = int(part)
            out.append((n, n))
    return out


_line_cache: dict[Path, list[str]] = {}


def read_lines(path: Path) -> list[str] | None:
    if path not in _line_cache:
        try:
            _line_cache[path] = path.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            _line_cache[path] = None  # type: ignore[assignment]
    return _line_cache[path]


def resolvable(src: str, rel: str) -> tuple[Path | None, str | None]:
    base = SOURCES[src]
    if not base.is_dir():
        return None, f"source tree {src} not found at {base}"
    if rel.startswith("../") or rel.startswith("/"):
        # A legacy:/backend: citation must live inside its own tree. Pointing at the *new*
        # project (e.g. legacy:../iccms-pmp/docs/...) is always an authoring mistake.
        return None, f"citation escapes the {src} tree (relative path: {rel})"
    candidate = base / rel
    if candidate.is_file():
        return candidate, None
    # Be tolerant of citations that prefix the tree name (legacy:old-ecap-pmp/src/...)
    stripped = rel.split("/", 1)[1] if "/" in rel and rel.split("/", 1)[0] in {"old-ecap-pmp", "ecap-plus-pmp-backend"} else None
    if stripped:
        candidate = base / stripped
        if candidate.is_file():
            return candidate, None
    return None, f"no such file: {rel}"


def tokens(text: str) -> set[str]:
    words = re.findall(r"[A-Za-z_][A-Za-z0-9_]{3,}", text)
    return {w.lower() for w in words if w.lower() not in STOPWORDS}


def check_file(md: Path, strict: bool) -> list[Problem]:
    problems: list[Problem] = []
    rel_md = str(md.relative_to(ROOT))
    for lineno, text in enumerate(read_lines(md) or [], start=1):
        for m in CITATION.finditer(text):
            src, rel, spec = m.group("src"), m.group("path"), m.group("lines")
            cite = f"{src}:{rel}{spec}"
            path, err = resolvable(src, rel)
            if path is None:
                problems.append(Problem(rel_md, lineno, cite, "missing-file", err or ""))
                continue
            lines = read_lines(path) or []
            ranges = parse_ranges(spec)
            for a, b in ranges:
                if a < 1 or b > len(lines) or b < a:
                    problems.append(
                        Problem(rel_md, lineno, cite, "out-of-range",
                                f"{rel} has {len(lines)} lines; cited {a}-{b}")
                    )
                    continue
                if strict:
                    window = "\n".join(lines[a - 1: b]).strip()
                    if not window:
                        problems.append(
                            Problem(rel_md, lineno, cite, "blank",
                                    f"{rel} lines {a}-{b} are empty")
                        )
                    elif b - a + 1 > MAX_SPAN:
                        problems.append(
                            Problem(rel_md, lineno, cite, "wide-range",
                                    f"cites {b - a + 1} lines")
                        )
    return problems


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("files", nargs="*", help="markdown files (default: docs/AUDIT.md + docs/audit/**/*.md)")
    ap.add_argument("--strict", action="store_true", help="also flag citations to blank lines and implausibly wide ranges")
    ap.add_argument("--json", action="store_true", help="machine-readable output")
    args = ap.parse_args()

    if args.files:
        targets = [Path(f).resolve() for f in args.files]
    else:
        targets = [ROOT / "docs" / "AUDIT.md", *sorted((ROOT / "docs" / "audit").rglob("*.md"))]

    problems: list[Problem] = []
    for md in targets:
        problems.extend(check_file(md, args.strict))

    if args.json:
        print(json.dumps([asdict(p) for p in problems], indent=2))
    else:
        for p in problems:
            print(f"{p.file}:{p.line}: {p.kind}: {p.citation} -- {p.detail}")
        total = sum(1 for _ in targets)
        kinds: dict[str, int] = {}
        for p in problems:
            kinds[p.kind] = kinds.get(p.kind, 0) + 1
        summary = ", ".join(f"{k}={v}" for k, v in sorted(kinds.items())) or "none"
        print(f"\n{total} file(s) checked, {len(problems)} problem(s) ({summary})")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
