#!/usr/bin/env bash
# Builds dist/llm-memory_<version>_all.deb from app/ and linux/debian/.
# Needs dpkg-deb (package dpkg, present on every Debian/Ubuntu). lintian is optional.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
VERSION="${1:-$(grep -m1 '"version"' "$ROOT/app/package.json" | cut -d'"' -f4)}"
STAGE="$(mktemp -d)"
PKG="$STAGE/llm-memory"
OUT="$ROOT/dist"

mkdir -p "$PKG/DEBIAN" "$PKG/usr/lib/llm-memory" "$PKG/usr/bin" "$PKG/usr/share/doc/llm-memory" "$OUT"
cp -r "$ROOT/app" "$PKG/usr/lib/llm-memory/app"
rm -rf "$PKG/usr/lib/llm-memory/app/test"
install -m 0755 "$HERE/llm-memory" "$PKG/usr/bin/llm-memory"
install -m 0644 "$ROOT/README.md" "$ROOT/README.fr.md" "$PKG/usr/share/doc/llm-memory/"
install -m 0644 "$ROOT/LICENSE" "$PKG/usr/share/doc/llm-memory/copyright"
sed "s/@VERSION@/$VERSION/" "$HERE/debian/control" > "$PKG/DEBIAN/control"
install -m 0755 "$HERE/debian/postinst" "$PKG/DEBIAN/postinst"
find "$PKG/usr/lib/llm-memory" -type f -exec chmod 0644 {} +
find "$PKG/usr/lib/llm-memory" -type d -exec chmod 0755 {} +
chmod 0755 "$PKG/usr/lib/llm-memory/app/cli.cjs"

DEB="$OUT/llm-memory_${VERSION}_all.deb"
dpkg-deb --build --root-owner-group "$PKG" "$DEB" >/dev/null
rm -rf "$STAGE"
echo "built $DEB"
if command -v lintian >/dev/null 2>&1; then lintian --no-tag-display-limit "$DEB" || true; fi
