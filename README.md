# Cookie Manager Pro - Chrome Extension

## Project Overview
A fully functional Chrome/Chromium browser extension for advanced cookie management with encryption, preset management, and import/export capabilities.

## Features Implemented

### Core Functionality
- **Cookie CRUD Operations**
  - View all cookies for the current domain
  - Add new cookies manually
  - Edit existing cookies (all properties)
  - Delete cookies with confirmation
  - Search and filter cookies by name/value
  - Filter by domain

- **Cookie Preset System (Account Switcher)**
  - Save current cookies as named presets
  - Load/Apply presets to switch between cookie sets
  - Delete presets
  - Rename presets
  - All presets are encrypted with AES-256-GCM

- **Import/Export**
  - Export cookies as JSON (encrypted or plain text)
  - Import cookies from JSON (encrypted or plain text)
  - Supports the provided Perplexity.ai cookie format
  - Copy to clipboard functionality
  - Toggle encryption on/off

### Security Features
- **AES-256-GCM Encryption**
  - 32-character random encryption key (auto-generated on first run)
  - All presets stored encrypted
  - Encryption key stored securely in chrome.storage.local
  - PBKDF2 key derivation for proper 256-bit security

### UI/UX
- **Modern Glassmorphic Design**
  - Purple/blue gradient background
  - Frosted glass effect cards
  - Smooth animations and transitions
  - 400px × 600px popup dimensions

- **First-Run Welcome Screen**
  - Automatic encryption key generation
  - Feature overview
  - One-time welcome experience

## Project Structure

```
.
├── manifest.json                 # Extension manifest (Manifest V3)
├── background/
│   └── service-worker.js        # Background service worker
├── popup/
│   ├── popup.html               # Popup UI structure
│   └── popup.js                 # Popup logic and event handlers
├── lib/
│   └── crypto.js                # Encryption utilities (AES-256-GCM)
├── styles/
│   └── popup.css                # Modern glassmorphic styling
└── icons/
    ├── icon16.png               # 16x16 icon
    ├── icon48.png               # 48x48 icon
    └── icon128.png              # 128x128 icon
```

## Technical Stack
- **Chrome Extension API** (Manifest V3)
- **Web Crypto API** for encryption
- **Vanilla JavaScript** (no external dependencies)
- **Modern CSS** with glassmorphic design

## How to Load and Test the Extension

### 1. Load in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top-right corner)
3. Click "Load unpacked"
4. Select this project directory
5. The extension should now appear in your extensions list

### 2. Use the Extension
1. Click the Cookie Manager Pro icon in the Chrome toolbar
2. The welcome screen will appear on first run (encryption key auto-generated)
3. Click "Get Started" to begin using the extension
4. The popup will show cookies for the current tab's domain

### 3. Test Features

**Cookie Management:**
- Add a new cookie using the "Add Cookie" button
- Edit an existing cookie by clicking the edit icon
- Delete a cookie by clicking the trash icon
- Search cookies using the search bar
- Filter by domain using the dropdown

**Preset System:**
- Click "Preset Manager" to expand the section
- Click "Save Current" to save current cookies as a preset
- Select a preset from the dropdown and click "Load" to apply it
- Use "Delete" or "Rename" to manage presets

**Import/Export:**
- Click "Export" to export current cookies
- Toggle "Encrypt with master key" to encrypt the export
- Copy the JSON to clipboard
- Click "Import" to paste and import cookies
- Toggle "Data is encrypted" if importing encrypted data

## Sample Cookie Import Format
The extension supports the standard Chrome cookie format (like the Perplexity.ai sample provided):

```json
[
  {
    "domain": ".example.com",
    "expirationDate": 1234567890,
    "hostOnly": false,
    "httpOnly": false,
    "name": "cookie_name",
    "path": "/",
    "sameSite": "lax",
    "secure": true,
    "session": false,
    "value": "cookie_value"
  }
]
```

## Security Notes
- All cookie presets are encrypted using AES-256-GCM
- Encryption key is 32 characters, randomly generated on first run
- Key is stored securely in Chrome's encrypted storage
- Import/Export encryption uses the same master key
- No data is sent to external servers - everything is local

## Recent Changes
- 2025-01-07: Initial implementation complete
  - All core features implemented
  - Modern UI with glassmorphic design
  - Full encryption system
  - Preset management
  - Import/Export functionality
  - First-run welcome screen

## Development Status
✅ Code reviewed by architect AI
✅ No LSP errors
✅ Ready for use
