# SpellTable Local Volumes Setup

SpellTable persists user data on the host under a single repo-root directory: **`storage/`**.

## Directory structure

```text
SpellTable/
├── storage/
│   ├── data/              # SQLite DB + optional BYO Aurora/FC5
│   ├── logs/
│   ├── maps/
│   ├── scenes/
│   ├── sounds/
│   ├── campaign_images/
│   └── monsters/
├── scripts/migrate-to-storage.sh
└── ...
```

Docker Compose mounts `./storage:/app/storage` and sets `STORAGE_ROOT=/app/storage`.

## Setup

### Fresh install

```bash
./setup-volumes.sh
docker compose up -d
```

### Upgrading from the old layout

If you still have `maps/`, `backend/maps/`, `data/`, etc.:

```bash
./scripts/migrate-to-storage.sh
# after verifying maps/DB look correct:
./scripts/migrate-to-storage.sh --cleanup
docker compose up -d --build
```

## What gets persisted

- **Database**: `storage/data/spelltable.db`
- **Uploads**: maps, scenes, sounds, campaign images
- **Monsters**: local JSON library under `storage/monsters/`
- **Logs**: `storage/logs/`
- **Optional catalogs**: `storage/data/aurora-elements/`, `storage/data/fc5/`

## Backup

Back up the entire `storage/` tree (or use the in-app admin backup endpoints).

## Override

Set `STORAGE_ROOT` (and optionally `DATABASE_URL`) if data should live outside the repo.
