#!/usr/bin/env bash
# Re-verify the Phase 1 audit against the trees it actually describes.
#
# The audit was written against backend + legacy frontend trees carrying the `security-fix`
# patch. `backend.patch` / `legacy-frontend.patch` live at the repo root. This script applies
# them to throwaway copies (never the reference trees) and runs the citation checker against
# those copies.
#
# Usage:  ./scripts/verify-audit.sh
# Exit:   0 = every citation resolves.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # iccms-pmp/
REPO="$(dirname "$ROOT")"
SCRATCH="$(mktemp -d)"
trap 'rm -rf "$SCRATCH"' EXIT

BACKEND_PATCH="$REPO/backend.patch"
LEGACY_PATCH="$REPO/legacy-frontend.patch"

apply() {  # apply <src-tree> <patch> <dest>
  local src="$1" patch="$2" dest="$3"
  cp -a "$src" "$dest"
  if [ ! -f "$patch" ]; then
    echo "!! $patch not found — using the unpatched tree at $src" >&2
    return 0
  fi
  if git -C "$dest" apply --reverse --check "$patch" >/dev/null 2>&1; then
    echo "   $dest already carries $(basename "$patch")"
  elif git -C "$dest" apply --check "$patch" >/dev/null 2>&1; then
    git -C "$dest" apply "$patch"
    echo "   applied $(basename "$patch") to $dest"
  else
    echo "!! $(basename "$patch") neither applies nor reverse-applies to $src" >&2
  fi
}

echo "Preparing patched trees in $SCRATCH"
apply "$REPO/ecap-plus-pmp-backend" "$BACKEND_PATCH" "$SCRATCH/backend"
apply "$REPO/old-ecap-pmp"          "$LEGACY_PATCH"  "$SCRATCH/legacy"

echo
ECAP_BACKEND_DIR="$SCRATCH/backend" ECAP_LEGACY_DIR="$SCRATCH/legacy" \
  python3 "$ROOT/scripts/check-citations.py" "$@"
