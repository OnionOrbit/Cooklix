<div align="center">

# 🍪 Cooklix

<img src="icons/icon128.png" alt="Cooklix Icon" width="128" height="128">

**Minimalist Cookie Manager with AES-256-GCM Encryption**

A Chrome/Chromium extension for advanced cookie management with encryption, preset management, and seamless import/export.

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green.svg)](https://chrome.google.com/webstore)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 🔐 **AES-256-GCM Encryption** | Auto-generated master key, PBKDF2 derivation, secure local storage |
| 🔄 **Preset System** | Save/load cookie sets for quick account switching |
| 📦 **Import/Export** | JSON format with optional encryption |
| 🎨 **Dark Theme** | Clean, minimalistic interface optimized for productivity |
| ⚡ **Zero Dependencies** | Pure JavaScript, no external libraries |

---

## 🚀 Quick Start

### Installation
```bash
1. Navigate to chrome://extensions/
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked" → Select this directory
4. Done! Click the Cooklix icon to begin
```

### First Use
On first launch, Cooklix automatically:
- Generates a 32-character encryption key
- Initializes secure storage
- Displays welcome screen with feature overview

---

## 🏗️ Architecture

### Extension Structure
```
Cooklix/
├── manifest.json              # Manifest V3 configuration
├── background/
│   └── service-worker.js     # Cookie operations & encryption
├── popup/
│   ├── popup.html            # UI structure
│   └── popup.js              # Event handlers & state
├── lib/
│   └── crypto.js             # AES-256-GCM encryption
├── styles/
│   └── popup.css             # Dark theme styling
└── icons/                    # Extension icons (16/48/128)
```

---

## 📊 System Flowcharts

### Encryption System Architecture

```mermaid
flowchart TD
    A[First Run] --> B{Master Key Exists?}
    B -->|No| C[Generate 32-char Key]
    B -->|Yes| D[Load Key from Storage]
    C --> E[Derive PBKDF2 Key]
    D --> E
    E --> F[Initialize WebCrypto]
    F --> G[Ready for Operations]
    
    G --> H[Encrypt Preset]
    G --> I[Decrypt Preset]
    
    H --> J[PBKDF2 Derivation]
    J --> K[AES-256-GCM Encrypt]
    K --> L[Store Encrypted Data]
    
    I --> M[Retrieve Encrypted Data]
    M --> N[PBKDF2 Derivation]
    N --> O[AES-256-GCM Decrypt]
    O --> P[Return Plain Data]
```

### Cookie Preset Management Flow

```mermaid
flowchart LR
    A[User Action] --> B{Operation Type}
    
    B -->|Save| C[Get Current Cookies]
    C --> D[Encrypt Cookie Data]
    D --> E[Store as Preset]
    E --> F[Update UI]
    
    B -->|Load| G[Select Preset]
    G --> H[Decrypt Preset Data]
    H --> I[Apply Cookies to Domain]
    I --> J{Protocol Check}
    J -->|HTTPS| K[Try HTTPS First]
    J -->|HTTP Fallback| L[Try HTTP]
    K --> M[Cookie Applied]
    L --> M
    M --> F
    
    B -->|Delete| N[Confirm Action]
    N --> O[Remove Preset]
    O --> F
    
    B -->|Rename| P[Validate New Name]
    P --> Q[Update Preset Key]
    Q --> F
```

### Cookie CRUD Operations

```mermaid
flowchart TD
    A[User Interaction] --> B{Action}
    
    B -->|Create| C[Open Cookie Form]
    C --> D[Validate Input]
    D --> E[Construct URL]
    E --> F{Protocol}
    F -->|HTTPS| G[Set Secure Cookie]
    F -->|HTTP| H[Set Non-Secure Cookie]
    G --> I[Refresh Cookie List]
    H --> I
    
    B -->|Read| J[Fetch Cookies for Domain]
    J --> K[Apply Filters]
    K --> L[Render Cookie List]
    
    B -->|Update| M[Load Cookie Data]
    M --> N[Edit in Form]
    N --> D
    
    B -->|Delete| O[Confirm Deletion]
    O --> P{Cookie Secure?}
    P -->|Yes| Q[Delete via HTTPS URL]
    P -->|No| R[Try HTTPS → HTTP Fallback]
    Q --> I
    R --> I
```

### Import/Export Process

```mermaid
flowchart LR
    A[User Action] --> B{Direction}
    
    B -->|Export| C[Fetch Domain Cookies]
    C --> D{Encrypt?}
    D -->|Yes| E[Encrypt with Master Key]
    D -->|No| F[Format as JSON]
    E --> G[Output Encrypted String]
    F --> G
    G --> H[Copy to Clipboard]
    
    B -->|Import| I[Paste JSON Data]
    I --> J{Encrypted?}
    J -->|Yes| K[Decrypt with Master Key]
    J -->|No| L[Parse JSON]
    K --> M[Validate Cookie Format]
    L --> M
    M --> N[Apply Each Cookie]
    N --> O[Show Success Count]
```

---

## 🔒 Security Model

### Encryption Pipeline
1. **Key Generation**: Cryptographically secure 32-character key on first run
2. **Key Derivation**: PBKDF2 with 100,000 iterations
3. **Encryption**: AES-256-GCM with random IV per operation
4. **Storage**: Master key in Chrome's encrypted `storage.local`

### Race Condition Prevention
- **Operation Lock**: Global mutex prevents concurrent preset operations
- **Atomic Operations**: Each cookie operation completes before next begins
- **State Validation**: Checks operation lock before critical sections

### URL Protocol Handling
```javascript
// HTTPS-first approach with HTTP fallback
1. Attempt HTTPS URL construction
2. If fails AND cookie is non-secure → Retry with HTTP
3. Report detailed error on failure
```

---

## 🎯 Use Cases

| Scenario | Solution |
|----------|----------|
| **Multi-Account Management** | Save cookies for each account as presets, switch instantly |
| **Development Testing** | Export production cookies, import to local environment |
| **Session Backup** | Encrypt and export critical session cookies |
| **Cross-Browser Sync** | Export from one browser, import to another |

---

## 🛠️ Technical Stack

- **Platform**: Chrome Extension (Manifest V3)
- **Language**: Vanilla JavaScript (ES6+)
- **Crypto**: Web Crypto API (AES-256-GCM, PBKDF2)
- **Storage**: Chrome Storage API
- **UI**: Custom CSS (Dark Theme)

---

## 📝 Cookie Format

Cooklix supports standard Chrome cookie format:

```json
[
  {
    "domain": ".example.com",
    "expirationDate": 1234567890,
    "hostOnly": false,
    "httpOnly": false,
    "name": "session_id",
    "path": "/",
    "sameSite": "lax",
    "secure": true,
    "session": false,
    "value": "abc123xyz"
  }
]
```

---

## 🧪 Testing Checklist

- [ ] Load extension in `chrome://extensions/`
- [ ] Verify welcome screen on first run
- [ ] Test cookie CRUD operations
- [ ] Save preset with multiple cookies
- [ ] Load preset to different domain
- [ ] Export cookies (encrypted & plain)
- [ ] Import cookies from JSON
- [ ] Verify operation locking (rapid clicks)
- [ ] Test HTTPS/HTTP protocol fallback

---

## 🔄 Recent Updates

**2025-10-07** - Cooklix Rebrand & Enhancements
- ✅ Rebranded from "Cookie Manager Pro" to "Cooklix"
- ✅ Implemented minimalistic dark theme UI
- ✅ Fixed preset manager race conditions with operation locking
- ✅ Improved URL construction with HTTPS-first approach
- ✅ Enhanced error handling and user feedback
- ✅ Added comprehensive flowchart documentation

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

---

<div align="center">

**Built with ❤️ for Cookie Management**

[Report Bug](https://github.com/yourusername/cooklix/issues) · [Request Feature](https://github.com/yourusername/cooklix/issues)

</div>
