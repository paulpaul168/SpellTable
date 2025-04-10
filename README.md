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

## 🚀 Developer - Quick Start

### Prerequisites
- Python 3.x
- Node.js (latest LTS version recommended)
- npm or yarn

### Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/paulpaul168/spelltable.git
   cd spelltable
   ```

2. Run the development servers:
   ```bash
   chmod +x run.sh  # Only needed once
   ./run.sh
   ```

3. Access the application:
   - Backend API: http://localhost:8010
   - Frontend: http://localhost:3000

### Manual Setup (Alternative)

If you prefer to run the servers separately:

1. Backend:
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   uvicorn main:app --reload --host 0.0.0.0 --port 8010
   ```

2. Frontend:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

---

## 🧙‍♂️ About the Name

**SpellTable** reflects the idea of combining spellcasting (D&D magic) with a literal "digital table" setup – perfect for a tech-enhanced fantasy experience.

---

## 🧑‍💻 Contributors

Built by a group of friends for their in-person D&D games. Contributions welcome!

---

## 👥 Contributing

We welcome contributions from the community! Here's how you can help make SpellTable better:

### 🛠️ Development Workflow

1. **Fork the Repository**
   - Click the "Fork" button on the top right of the repository page
   - Clone your fork locally:
     ```bash
     git clone https://github.com/your-username/spelltable.git
     cd spelltable
     ```

2. **Set Up Development Environment**
   - Follow the [Quick Start](#-developer---quick-start) guide
   - Make sure all tests pass before making changes

3. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

4. **Make Your Changes**
   - Follow the existing code style
   - Write clear commit messages
   - Add tests for new features
   - Update documentation as needed

5. **Testing**
   - Run backend tests:
     ```bash
     cd backend
     pytest
     ```
   - Run frontend tests:
     ```bash
     cd frontend
     npm test
     ```

6. **Submit a Pull Request**
   - Push your branch to your fork
   - Create a PR to the main repository
   - Fill out the PR template with:
     - Description of changes
     - Screenshots (if applicable)
     - Related issues
     - Testing performed

### 📝 Code Style Guidelines

- **Python (Backend)**
  - Follow PEP 8 style guide
  - Use type hints
  - Document functions with docstrings
  - Keep functions small and focused

- **TypeScript/React (Frontend)**
  - Use functional components
  - Follow ESLint rules
  - Use TypeScript for type safety
  - Keep components modular

### 🐛 Reporting Bugs

1. Check if the issue already exists
2. Create a new issue with:
   - Clear title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details
   - Screenshots (if applicable)

### 💡 Suggesting Features

1. Check if the feature is already requested
2. Create a new issue with:
   - Clear description
   - Use case
   - Proposed implementation
   - Benefits

### 📚 Documentation

- Keep documentation up to date
- Add comments for complex logic
- Update README for new features
- Document API changes

### 🏷️ Commit Message Format

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation changes
- style: Code style changes
- refactor: Code refactoring
- test: Test changes
- chore: Maintenance tasks

### 🤝 Code of Conduct

- Be respectful and inclusive
- Give constructive feedback
- Be open to suggestions
- Help others learn

### 🎯 Getting Help

- Ask questions in GitHub Discussions
- Review existing issues

---

## 📜 License

MIT – feel free to hack, improve, and share.
