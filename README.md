# 🔮 **Project: SpellTable - WORK IN PROGESS!**

A modern, local web-based virtual tabletop designed for in-person D&D sessions with a physical screen on the table. Built to give Dungeon Masters full control while providing players with an immersive experience on a 4K display.

## ✨ Features

- Grid-aligned map display on a 4K TV
- Admin view for Dungeon Master with map preview and controls
- Player view for full-screen display (TV/table)
- Initiative tracker (text-based)
- Load, scale and position maps easily
- Hide/reveal maps and elements at will
- Area of Effect markers (coming soon)
- Distance measurement tools (planned)
- Future: Camera-based mini tracking, effects, and interactive rulers

---

## ✅ MVP Checklist

> The goal: a working tabletop with map display, grid, initiative, and admin/player view separation.

### 🎯 Core Features

- [ ] Upload and manage maps (scale, position)
- [ ] Toggle grid overlay on maps
- [ ] Initiative tracker (text-based list)
- [ ] Separate Admin and Player views
  - [ ] Admin preview mode
  - [ ] Player full-screen display mode
- [ ] Show/hide maps and overlays on player screen
- [ ] Sync state via WebSocket

---

## 🚀 Roadmap

### 🟢 MVP (Minimum Viable Product)

- Local web app (Next.js + FastAPI backend)
- Basic file system for storing maps and sessions
- UI for uploading and positioning maps
- Toggleable grid overlay
- Initiative order list
- Admin/Player view sync
- WebSocket communication

### 🔵 Post-MVP

- AoE Markers (cones, circles, templates)
- Distance measuring tool (click-drag ruler)
- Token system (drag & drop elements, snap to grid)
- Fog of War / hidden regions
- Multiple map layers (e.g. background, tokens, effects)
- UI polish for touch/table usage

### 🔮 Future Features

- Camera-based tracking for minis (e.g. using ArUco or AprilTags)
- Automatic status/effect display from mini positions
- Animated effects (fire, fog, magic circles)
- Player journal web app (campaign log, character notes, maps)
- Multi-session management with save/load

---

## 🧱 Tech Stack

- **Frontend:** Next.js (React, TailwindCSS)
- **Backend:** FastAPI (Python)
- **WebSocket:** `fastapi-socketio` or `websockets`
- **Local Storage:** JSON + static file storage
- **Deployment:** Local server (Synaptics SL1680, Raspberry Pi, laptop, etc.)

---

## 📁 Folder Structure (planned)

spelltable/
├── backend/                  # FastAPI backend
│   ├── main.py               # Entry point for the API and WebSocket server
│   ├── routes/               # API route definitions (map handling, session control, etc.)
│   ├── services/             # Business logic (map scaling, session state)
│   ├── models/               # Pydantic models for data structures
│   ├── maps/                 # Uploaded and processed map images
│   ├── sessions/             # Saved game/session state files (e.g. JSON)
│   └── config.py             # Config settings (paths, debug, etc.)
│
├── frontend/                 # Next.js frontend (Admin + Player View)
│   ├── pages/                # React pages (e.g. /admin, /player)
│   ├── components/           # Shared UI components (map view, toolbar, etc.)
│   ├── styles/               # Tailwind config or custom styles
│   ├── public/               # Static files (e.g. icons, fonts)
│   └── utils/                # Frontend utilities (WebSocket client, helpers)
│
├── shared/                   # Shared code between frontend and backend
│   └── types.ts              # Shared type definitions (TypeScript)
│
├── scripts/                  # Helper scripts (e.g. dev server start, image pre-processing)
│
├── .env                      # Environment config for local dev
├── requirements.txt          # Python dependencies
├── package.json              # JS/TS dependencies
├── README.md                 # Project description
└── spelltable.code-workspace # (Optional) VSCode workspace config


---

## 🧙‍♂️ About the Name

**SpellTable** reflects the idea of combining spellcasting (D&D magic) with a literal "digital table" setup – perfect for a tech-enhanced fantasy experience.

---

## 🧑‍💻 Contributors

Built by a group of friends for their in-person D&D games. Contributions welcome!

---

## 📜 License

MIT – feel free to hack, improve, and share.
