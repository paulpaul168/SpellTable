# 🔮 SpellTable

A modern, local web-based virtual tabletop designed for in-person D&D sessions with a physical screen on the table. Built to give Dungeon Masters full control while providing players with an immersive experience on a 4K display.

## 📋 Table of Contents

- [Features](#-features)
- [Project Status](#-project-status)
- [Getting Started](#-getting-started)
- [Development](#-development)
- [Contributing](#-contributing)
- [License](#-license)
- [About](#-about)

## ✨ Features

### Core Features
- Grid-aligned map display on a 4K TV
- Admin view for Dungeon Master with map preview and controls
- Player view for full-screen display (TV/table)
- Initiative tracker (text-based)
- Load, scale and position maps easily
- Hide/reveal maps and elements at will

### Planned Features
- Area of Effect markers (cones, circles, templates)
- Distance measurement tools
- Camera-based mini tracking
- Animated effects (fire, fog, magic circles)
- Interactive rulers
- Fog of War / hidden regions
- Multiple map layers
- Player journal web app

## 📊 Project Status

### MVP Checklist
- [X] Upload and manage maps (scale, position)
- [X] Toggle grid overlay on maps
- [X] Initiative tracker (text-based list)
- [X] Separate Admin and Player views
  - [ ] Admin preview mode
  - [ ] Player full-screen display mode
- [X] Show/hide maps and overlays on player screen
- [X] Sync state via WebSocket

### Development Roadmap

#### 🟢 MVP Phase
- Local web app (Next.js + FastAPI backend)
- Basic file system for storing maps and sessions
- UI for uploading and positioning maps
- Toggleable grid overlay
- Initiative order list
- Admin/Player view sync
- WebSocket communication

#### 🔵 Post-MVP Phase
- AoE Markers
- Distance measuring tool
- Token system
- Fog of War
- Multiple map layers
- UI polish for touch/table usage

#### 🔮 Future Phase
- Camera-based tracking for minis
- Automatic status/effect display
- Animated effects
- Player journal web app
- Multi-session management

## 🚀 Getting Started

### Prerequisites
- Python 3.x
- Node.js (latest LTS version recommended)
- npm or yarn

### Quick Start

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

### Manual Setup

#### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8010
```

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

## 🧱 Development

### Tech Stack
- **Frontend:** Next.js (React, TailwindCSS)
- **Backend:** FastAPI (Python)
- **WebSocket:** `fastapi-socketio`
- **Local Storage:** JSON + static file storage
- **Deployment:** Local server (Synaptics SL1680, Raspberry Pi, laptop, etc.)

### Project Structure
```
spelltable/
├── backend/                  # FastAPI backend
│   ├── main.py              # Entry point
│   ├── routes/              # API routes
│   ├── services/            # Business logic
│   ├── models/              # Pydantic models
│   ├── maps/                # Map storage
│   ├── sessions/            # Session files
│   └── config.py            # Configuration
|   
│
├── frontend/                # Next.js frontend
│   ├── pages/               # React pages
│   ├── components/          # UI components
│   ├── styles/              # Tailwind config
│   ├── public/              # Static files
│   └── utils/               # Utilities
│
├── shared/                  # Shared code
│   └── types.ts             # Type definitions
│
└── scripts/                 # Helper scripts
```

### Code Style Guidelines

#### Python (Backend)
- Follow PEP 8 style guide
- Use type hints
- Document functions with docstrings
- Keep functions small and focused

#### TypeScript/React (Frontend)
- Use functional components
- Follow ESLint rules
- Use TypeScript for type safety
- Keep components modular

### Commit Message Format
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

## 👥 Contributing

### Important Note for Contributors
By contributing to this project, you agree that your contributions will be licensed under the AGPL v3 license. This means:
- Your contributions must be compatible with AGPL v3
- You retain copyright of your contributions
- You grant the project the right to use your contributions under AGPL v3
- You understand that your contributions may be used in commercial versions of the software

### Development Workflow

1. **Fork the Repository**
   ```bash
   git clone https://github.com/your-username/spelltable.git
   cd spelltable
   ```

2. **Set Up Development Environment**
   - Follow the [Quick Start](#-getting-started) guide
   - Ensure all tests pass before making changes

3. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make Your Changes**
   - Follow code style guidelines
   - Write clear commit messages
   - Add tests for new features
   - Update documentation

5. **Testing**
   ```bash
   # Backend tests
   cd backend
   pytest

   # Frontend tests
   cd frontend
   npm test
   ```

6. **Submit a Pull Request**
   - Push your branch to your fork
   - Create a PR to the main repository
   - Include:
     - Description of changes
     - Screenshots (if applicable)
     - Related issues
     - Testing performed

### Issue Reporting
1. Check for existing issues
2. Create a new issue with:
   - Clear title
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details
   - Screenshots (if applicable)

### Code of Conduct
- Be respectful and inclusive
- Give constructive feedback
- Be open to suggestions
- Help others learn

## 📜 License

SpellTable is dual-licensed under the GNU Affero General Public License v3 (AGPL v3) and a commercial license.

### Open Source License (AGPL v3)
- You may use, modify, and distribute the source code for free
- Any modifications must also be licensed under AGPL v3
- The source code must be made available to users
- You may not sell the software without a commercial license

### Commercial License
To obtain a commercial license for selling the software as a finished product, please contact the copyright holder. The commercial license grants you the right to:
- Sell the software as a finished product
- Use the software without AGPL requirements
- Receive additional features and support
- Customize the software for your needs

All rights not expressly granted under either license are reserved by the copyright holder.

For more details, see the [LICENSE.md](LICENSE.md) file.

## 🧙‍♂️ About

### The Name
**SpellTable** reflects the idea of combining spellcasting (D&D magic) with a literal "digital table" setup – perfect for a tech-enhanced fantasy experience.

### Contributors
Built by a group of friends for their in-person D&D games. Contributions welcome!

### Getting Help
- Ask questions in GitHub Discussions
- Review existing issues
- Check the documentation
