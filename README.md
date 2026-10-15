# RecordingBot 🤖🎙️

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-AI%20Minutes-8E75B2?logo=google&logoColor=white)](https://ai.google.dev/)

An enterprise-ready, autonomous meeting assistant and intelligence platform for **Google Meet**. RecordingBot automatically joins scheduled meetings, records high-definition audio/video with virtual audio sinks, captures real-time closed captions with speaker diarization, generates structured executive meeting minutes using **Google Gemini AI**, and synchronizes recordings to **Google Drive**.

Includes a full-featured multi-tenant **Web Dashboard** built with React, Vite, and Tailwind CSS.

🌐 **Live Production Application:** [recordingbot.josueortiz.dev](https://recordingbot.josueortiz.dev)

---

## 🌟 Key Features

- **🤖 Autonomous Meeting Attendant**
  - Continuous calendar synchronization via Google Calendar API.
  - Automatically dispatches headless Chromium workers to join meetings 5 minutes prior to scheduled start.
  - Smart lobby bypass, admission detection, lone-participant auto-exit, and inactivity timers.
  - On-demand manual join interface for ad-hoc meetings.

- **🎙️ Real-time Captions & Speaker Diarization**
  - Custom `MutationObserver` engine injected into Google Meet's DOM.
  - Captures high-fidelity closed captions with millisecond timestamps and participant speaker tags.
  - Full transcript export and in-app synchronized playback search.

- **🧠 Google Gemini AI Executive Minutes**
  - Automatically transforms raw multi-speaker transcripts into executive-ready meeting minutes.
  - Structures output into **Executive Summaries**, **Key Decisions Made**, **Action Items with Assignees**, and **Topic Breakdowns**.
  - Supports user-level custom system prompts and multiple model tiers (`gemini-2.5-flash`, `gemini-3.5-flash-lite`).

- **👥 Multi-Tenant Architecture & Smart Deduplication**
  - Multi-user authentication via Google OAuth 2.0 with JWT session management.
  - **Deduplication Engine**: Groups identical calendar events across co-workers into a single recording session, preventing multiple bots from entering the same room while linking the recording to all attendees.
  - Granular RBAC (Admin, Standard User) and customizable meeting blocklists (e.g., skip recurring Dailies or 1-on-1s).

- **📺 Full-Stack Web Dashboard & Media Player**
  - Built with React 18, Vite, TypeScript, and Tailwind CSS (Dark/Light mode support).
  - Real-time active recording monitor banners with live duration counters.
  - Built-in media streaming engine with **HTTP 206 Partial Content (Range requests)** for instantaneous audio/video scrubbing without downloading entire files.
  - Secure public share links (`/r/:token`) with customizable access permissions.

- **🔒 Enterprise Security & Google API Compliance**
  - Fully compliant with **Google API Services User Data Policy** (Limited Use requirements).
  - Domain-based signup restrictions and encrypted OAuth token management.
  - Sandboxed headless browser containers with strict resource isolation.

---

## 🏗️ System Architecture

```
                                    ┌────────────────────────┐
                                    │  Google Calendar API   │
                                    └───────────┬────────────┘
                                                │ (Polling every 2m)
                                                ▼
┌─────────────────────────┐         ┌────────────────────────┐
│  Multi-Tenant Web UI    │◄───────►│  Calendar Scheduler    │
│  (React 18 + Tailwind)  │  Auth/  └───────────┬────────────┘
└───────────┬─────────────┘  Jobs               │ Dispatches Job
            │                                   ▼
            ▼                       ┌────────────────────────┐
┌─────────────────────────┐         │   Redis Queue Service  │
│   Dashboard REST API    │         └───────────┬────────────┘
│  (Express + PostgreSQL) │                     │ Consumes Job
└───────────┬─────────────┘                     ▼
            │                       ┌────────────────────────┐
            │                       │  Meeting Bot Worker    │
            │                       └─────┬────────────┬─────┘
            │                             │            │
            ▼                             ▼            ▼
┌─────────────────────────┐       ┌──────────────┐   ┌───────────────────────┐
│   Google Gemini AI      │       │ Chrome CDP   │   │ PulseAudio Sink       │
│  (Minutes Generation)   │       │ Virtual Xvfb │   │ FFmpeg Audio/Video    │
└─────────────────────────┘       └──────┬───────┘   └───────────┬───────────┘
                                         │                       │
                                         ▼                       ▼
                                  ┌──────────────────────────────────────────┐
                                  │ Direct Google Drive & Local Storage Sync │
                                  └──────────────────────────────────────────┘
```

---

## 📂 Repository Structure

```
RecordingBot/
├── dashboard-frontend/     # React 18 + Vite + Tailwind CSS web dashboard
├── dashboard-api/          # Node.js Express REST API, auth & media streaming
├── meeting-bot/            # Core Puppeteer/CDP worker, audio sinks & DOM scrapers
├── scheduler/              # Calendar poller, deduplication engine & job dispatcher
├── database/               # PostgreSQL schema migrations (init.sql)
├── docker-compose.yml      # Multi-container orchestration definition
└── .env.example            # Environment configuration template
```

---

## 🛠️ Tech Stack

| Component | Technologies |
|:---|:---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons |
| **Backend API** | Node.js, Express, TypeScript, JWT, OAuth2, pg (PostgreSQL driver) |
| **Bot Automation** | Puppeteer, Chrome DevTools Protocol (CDP), Xvfb, PulseAudio, FFmpeg |
| **Data & Storage** | PostgreSQL 16, Redis 7, Google Drive API v3 |
| **Artificial Intelligence** | Google Gemini API (`@google/genai` / REST) |
| **Infrastructure** | Docker, Docker Compose, Caddy / Nginx Reverse Proxy, Linux (Ubuntu/Debian) |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)
- Node.js 20+ (for local development)
- A [Google Cloud Console](https://console.cloud.google.com/) project with:
  - Google Calendar API enabled
  - Google Drive API enabled
  - OAuth 2.0 Web Client ID configured

### 1. Clone & Configure

```bash
# Clone the repository
git clone https://github.com/JosueOrtizV/RecordingBot.git
cd RecordingBot

# Create your environment file from template
cp .env.example .env
```

Edit `.env` and fill in your credentials:
```env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_client_secret
JWT_SECRET=your_super_secret_jwt_random_key
FRONTEND_URL=http://localhost:3000
ALLOWED_EMAIL_DOMAINS=yourcompany.com
POSTGRES_PASSWORD=your_secure_postgres_password
GEMINI_API_KEY=your_gemini_api_key
```

### 2. Launch with Docker Compose

Build and launch all services in detached mode:

```bash
docker compose up -d --build
```

The stack will initialize:
- **Web Frontend**: `http://localhost:3000`
- **Dashboard API**: `http://localhost:3002`
- **PostgreSQL Database**: `localhost:5432`
- **Redis Queue**: `localhost:6379`
- **Chrome CDP Worker & Meeting Bot**

### 3. Verify Service Health

```bash
# Check status of running containers
docker compose ps

# Follow logs across services
docker compose logs -f meeting-bot dashboard-api scheduler
```

---

## ⚙️ Environment Variables Reference

| Variable | Description | Default |
|:---|:---|:---|
| `BOT_DISPLAY_NAME` | Visible participant name when the bot joins calls | `AI Meeting Notetaker` |
| `MAX_CONCURRENT_JOBS` | Maximum simultaneous meetings recorded per instance | `4` |
| `MAX_RECORDING_DURATION_MINUTES` | Safety limit before automatically disconnecting | `180` |
| `MEETING_INACTIVITY_MINUTES` | Exit call if alone in meeting for X minutes | `3` |
| `CALENDAR_POLL_INTERVAL_MINUTES` | Frequency of checking Google Calendar for upcoming events | `2` |
| `LEAD_TIME_MINUTES` | Dispatch bot X minutes before meeting start time | `5` |
| `STORAGE_PROVIDER` | Recording storage destination (`drive`, `s3`, `local`) | `drive` |
| `GOOGLE_DRIVE_FOLDER_NAME` | Target folder name in Google Drive | `RecordingBot` |
| `ALLOWED_EMAIL_DOMAINS` | Restrict logins to specific domain (comma-separated, or empty for any) | *None* |
| `GEMINI_API_KEY` | Google Gemini API key for meeting summaries | *Required for AI* |
| `GEMINI_MODEL` | Gemini model ID used for intelligence extraction | `gemini-2.5-flash` |

---

## 🔒 Security & Privacy

RecordingBot is built with strict adherence to privacy and data protection principles:
- **Minimal Scopes**: Requests only required OAuth scopes (`calendar.readonly`, `drive.file`, `userinfo.email`).
- **No Model Training**: Transcripts and user data are never used to train third-party or generalized AI models.
- **Token Isolation**: Refresh and access tokens are encrypted and isolated per user in PostgreSQL.
- **Compliance**: Fully complies with the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

- **V2 Platform & Dashboard Architecture:** Copyright (c) 2026 [Josue Ortiz](https://github.com/JosueOrtizV).
- **Core Meeting Bot Runner:** Portions Copyright (c) 2025 [ScreenApp.io](https://screenapp.io).
