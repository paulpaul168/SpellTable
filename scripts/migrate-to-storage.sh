#!/usr/bin/env bash
# Migrate SpellTable user data into repo-root storage/ (issue #18).
# Idempotent: safe to re-run. Prefer backend/<dir> over repo-root stubs.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
STORAGE="$ROOT_DIR/storage"
CLEANUP=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [--cleanup]

Move maps, scenes, sounds, campaign_images, monsters, logs, and data/
into storage/ without data loss.

  --cleanup   After a successful migrate, remove emptied legacy directories
              (backend/<dir>, root stubs, data/) when they only contain
              .gitkeep / empty leftovers.
EOF
}

for arg in "$@"; do
  case "$arg" in
    -h|--help) usage; exit 0 ;;
    --cleanup) CLEANUP=1 ;;
    *) echo "Unknown option: $arg" >&2; usage; exit 2 ;;
  esac
done

dir_has_content() {
  local d="$1"
  [[ -d "$d" ]] || return 1
  # Any entry other than .gitkeep counts as content
  local found
  found="$(find "$d" -mindepth 1 ! -name '.gitkeep' -print -quit || true)"
  [[ -n "$found" ]]
}

ensure_dirs() {
  mkdir -p \
    "$STORAGE/maps" \
    "$STORAGE/scenes" \
    "$STORAGE/sounds" \
    "$STORAGE/campaign_images" \
    "$STORAGE/monsters" \
    "$STORAGE/data" \
    "$STORAGE/logs"
  for d in maps scenes sounds campaign_images monsters data logs; do
    touch "$STORAGE/$d/.gitkeep"
  done
}

# Move contents of $src into $dest (merge). Prefer mv when dest empty of real files.
migrate_tree() {
  local label="$1"
  local src="$2"
  local dest="$3"

  if ! dir_has_content "$src"; then
    echo "  skip $label: no content at $src"
    return 0
  fi

  mkdir -p "$dest"

  if ! dir_has_content "$dest"; then
    echo "  move $label: $src -> $dest"
    # Move children (including hidden except . / ..)
    shopt -s dotglob nullglob
    for item in "$src"/*; do
      base="$(basename "$item")"
      [[ "$base" == ".gitkeep" ]] && continue
      mv "$item" "$dest/"
    done
    shopt -u dotglob nullglob
    return 0
  fi

  echo "  merge $label: $src -> $dest (destination already has files)"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --ignore-existing "$src"/ "$dest"/
  else
    # Fallback: copy missing files only
    shopt -s dotglob nullglob
    for item in "$src"/*; do
      base="$(basename "$item")"
      [[ "$base" == ".gitkeep" ]] && continue
      if [[ ! -e "$dest/$base" ]]; then
        cp -a "$item" "$dest/"
      fi
    done
    shopt -u dotglob nullglob
  fi
  echo "    note: left source in place; re-run with --cleanup after verifying"
}

migrate_file() {
  local label="$1"
  local src="$2"
  local dest="$3"
  if [[ ! -f "$src" ]]; then
    echo "  skip $label: missing $src"
    return 0
  fi
  if [[ -f "$dest" ]]; then
    echo "  skip $label: already at $dest"
    return 0
  fi
  mkdir -p "$(dirname "$dest")"
  echo "  move $label: $src -> $dest"
  mv "$src" "$dest"
}

echo "SpellTable storage migration"
echo "  root:    $ROOT_DIR"
echo "  storage: $STORAGE"
ensure_dirs

echo "Migrating content directories..."
for name in maps scenes sounds campaign_images monsters logs; do
  # Prefer backend/ (live local data under run.sh cwd)
  if dir_has_content "$ROOT_DIR/backend/$name"; then
    migrate_tree "$name (backend)" "$ROOT_DIR/backend/$name" "$STORAGE/$name"
  elif dir_has_content "$ROOT_DIR/$name"; then
    migrate_tree "$name (root)" "$ROOT_DIR/$name" "$STORAGE/$name"
  else
    echo "  skip $name: no backend/ or root content"
  fi
done

echo "Migrating data/ ..."
migrate_file "spelltable.db" \
  "$ROOT_DIR/data/spelltable.db" \
  "$STORAGE/data/spelltable.db"

# Also catch DB left under backend/data from older cwd-relative defaults
migrate_file "spelltable.db (backend)" \
  "$ROOT_DIR/backend/data/spelltable.db" \
  "$STORAGE/data/spelltable.db"

migrate_tree "aurora-elements" \
  "$ROOT_DIR/data/aurora-elements" \
  "$STORAGE/data/aurora-elements"

migrate_tree "fc5" \
  "$ROOT_DIR/data/fc5" \
  "$STORAGE/data/fc5"

if [[ "$CLEANUP" -eq 1 ]]; then
  echo "Cleanup legacy empties..."
  for name in maps scenes sounds campaign_images monsters logs; do
    for base in "$ROOT_DIR/backend/$name" "$ROOT_DIR/$name"; do
      if [[ -d "$base" ]] && ! dir_has_content "$base"; then
        echo "  remove empty $base"
        rm -rf "$base"
      fi
    done
  done
  if [[ -d "$ROOT_DIR/data" ]] && ! dir_has_content "$ROOT_DIR/data"; then
    echo "  remove empty $ROOT_DIR/data"
    rm -rf "$ROOT_DIR/data"
  fi
  if [[ -d "$ROOT_DIR/backend/data" ]] && ! dir_has_content "$ROOT_DIR/backend/data"; then
    echo "  remove empty $ROOT_DIR/backend/data"
    rm -rf "$ROOT_DIR/backend/data"
  fi
fi

echo ""
echo "Done. storage/ layout:"
find "$STORAGE" -maxdepth 2 \( -type d -o -name '*.db' -o -name 'monsters.json' \) | sort | sed "s|^$ROOT_DIR/||"
echo ""
echo "Next: start the app with run.sh or docker compose (mounts ./storage)."
