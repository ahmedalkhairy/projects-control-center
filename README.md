# Projects Control Center

A desktop operations dashboard built with **Electron + React** for managing multiple software projects from a single place.

## Features

- **Multi-project management** — create and switch between projects with isolated settings
- **Jira integration** — sync tasks and notifications from Jira Cloud or self-hosted Jira Server/Data Center
- **GitHub / GitLab integration** — monitor pull requests, pipelines, commits, and branches in real time
- **Task manager** — kanban and list views, priorities, due dates, image attachments, and direct Jira issue creation
- **Inbox** — unified feed of Jira issues, PR activity, and pipeline events
- **Desktop push notifications** — get notified for critical/high priority Jira items, failed pipelines, and open PRs
- **Global search** — search across tasks, repos, and messages instantly
- **Quick actions** — shortcuts to common operations across all projects

## Tech Stack

| Layer | Technology |
|---|---|
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand (with persistence) |
| Desktop | Electron |
| Build | Vite |
| Icons | Lucide React |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

### Installation

```bash
git clone https://github.com/ahmedalkhairy/projects-control-center.git
cd projects-control-center
npm install
```

### Running

**Browser only (no Electron):**
```bash
npm run dev
```
Then open [http://localhost:3000](http://localhost:3000) in your browser.

**Desktop app (Electron + React):**
```bash
npm run dev:electron
```
This starts the Vite dev server and launches the Electron window automatically.

### Building a Windows Installer

```bash
npm run build:electron
```

Output will be in the `release/` folder as an `.exe` installer and a `win-unpacked/` portable folder.
