# VetBuddy Desktop Overlay

Always-on-top Electron overlay for veterinary consultations. Records audio, transcribes, generates clinical notes, and smart-pastes them into any EHR using AI screen detection.

## Quick Start

```bash
npm install
npm run dev
```

Backend must be running at `http://localhost:8001` (see `/apis`).

Copy `.env.example` → `.env` and set `VITE_API_BASE_URL`.

---

## Keyboard Shortcuts

### Global (work even when the overlay is hidden)

| Shortcut | Action |
|---|---|
| `Cmd+Shift+Space` | Show / Hide overlay |
| `Cmd+Shift+M` | Minimise / Restore overlay |
| `Cmd+Shift+1` | Switch to **Active Consultations** tab |
| `Cmd+Shift+2` | Switch to **Patients** tab |
| `Cmd+Shift+3` | Switch to **Notes** tab |
| `Cmd+Shift+4` | Switch to **Templates** tab |
| `Cmd+Shift+5` | Switch to **Paste Lab** tab |

> On Windows/Linux replace `Cmd` with `Ctrl`.

### Local (when overlay is focused)

| Shortcut | Action |
|---|---|
| `Cmd+1` | Switch to **Active Consultations** tab |
| `Cmd+2` | Switch to **Patients** tab |
| `Cmd+3` | Switch to **Notes** tab |
| `Cmd+4` | Switch to **Templates** tab |
| `Cmd+5` | Switch to **Paste Lab** tab |
| `Cmd+M` | Minimise |
| `Cmd+W` | Close |

### Title Bar Controls

| Control | Action |
|---|---|
| 📌 Pin button | Toggle always-on-top |
| `−` Minimise | Minimise to taskbar |
| `✕` Close | Close app |
| Opacity slider | Adjust window transparency |

---

## Features

### Tabs

| Tab | Shortcut | Description |
|---|---|---|
| Active | `Cmd+1` | View and resume in-progress consultations |
| Patients | `Cmd+2` | Search, create, manage patients |
| Notes | `Cmd+3` | Generate and copy clinical notes |
| Templates | `Cmd+4` | Manage SOAP note templates |
| Paste Lab | `Cmd+5` | Test AI screen detection + auto-paste |

### Smart Paste (Paste Lab)
1. Open your EHR to a patient record page
2. Switch to **Paste Lab** tab (`Cmd+Shift+5`)
3. Edit the mock note sections (or leave defaults)
4. Click **Capture & Detect** — AI identifies matching EHR fields
5. Toggle which sections to include
6. Click **Paste Now** — notes are pasted into detected fields automatically

**macOS permissions required:**
- System Settings → Privacy → **Screen Recording** → VetBuddy
- System Settings → Privacy → **Accessibility** → VetBuddy

### AI Chatbot
A floating chat button (bottom-right corner) appears when a consultation is selected in the Notes tab. Tap it to ask the AI anything about the active consultation.

### Copy to Clipboard
In the Notes tab, after generating a note, **Copy Note to Clipboard** copies all sections formatted as plain text. Switch to your EHR and paste with `Cmd+V`.

---

## Build

```bash
npm run build          # Production build → out/
npm run package:mac    # Signed .dmg for macOS
npm run package:win    # .exe for Windows
```

---

## Architecture

```
src/
├── main/index.ts        # Electron main process
│   ├── Window management
│   ├── Global shortcuts (globalShortcut)
│   ├── screen:capture   (desktopCapturer)
│   ├── screen:paste-at  (AppleScript click + Cmd+V)
│   └── clipboard:write  (pbcopy)
├── preload/index.ts     # Context bridge → window.electron.*
└── renderer/src/
    ├── App.tsx          # Router + local keyboard shortcuts
    ├── components/
    │   ├── AuthPanel.tsx
    │   ├── PatientList.tsx
    │   ├── ActiveConsultations.tsx
    │   ├── RecordingWidget.tsx
    │   ├── SOAPNoteGenerator.tsx
    │   ├── SOAPNoteList.tsx
    │   ├── TemplateManager.tsx
    │   ├── PasteLab.tsx       ← Smart Paste test UI
    │   ├── ChatInterface.tsx  ← Floating AI chatbot
    │   └── EzyVetSettings.tsx
    └── services/
        ├── soapPasteService.ts   ← Copy-to-clipboard
        ├── patientService.ts
        ├── consultationService.ts
        ├── soapNoteService.ts
        └── templateService.ts
```
