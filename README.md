# 🚀 Arrow Skip — Premium Playback Controller

A high-performance Chrome extension designed to give you precise control over short-form video content. Perfect for **YouTube Shorts**, **Instagram Reels**, **TikTok**, and **Facebook**.

---

## ✨ Features
- **Arrow Key Seeking:** Skip forward and backward with custom precision (default: 1s).
- **Sticky Speed:** Set a default playback speed per site (e.g., 1.5x for TikTok). The extension remembers your setting even as you scroll!
- **Quick Add Menu:** Right-click anywhere on a website to instantly add it to your whitelist.
- **HUD Interface:** Visual pop-up feedback on the left, right, or center of your screen.
- **Hands-Free Auto-Scroll:** Automatically jump to the next video when the current one ends. (Special optimizations for Facebook & Instagram).
- **Midnight Orange Theme:** A modern, high-contrast UI that looks premium in both light and dark modes.
- **Custom Site Support:** Add any website that uses HTML5 video and customize its behavior.
- **Precision Steppers:** Granular control over speed (0.1x increments) and skip duration.
  
---

## 📖 Keyboard Shortcuts (Default)
| Key | Action |
|-----|--------|
| **→** | Skip Forward |
| **←** | Skip Backward |
| **Shift + ↑** | Speed Up |
| **Shift + ↓** | Speed Down |
| **↑** | Volume Up |
| **↓** | Volume Down |
| **s** | Toggle Auto-Scroll |

---

## 🔒 Permissions & Justification
For Chrome Web Store transparency, here is why I need each permission:

1. **`storage`**:
   - **Why:** To save your custom keyboard shortcuts, site-specific skip intervals, and default speed settings. Without this, your settings would reset every time you close the browser.

2. **`scripting`**:
   - **Why:** This allows the extension to interact with the `<video>` elements on the page. It is required to change the `playbackRate` (speed) and `currentTime` (skip) of the videos you are watching.

3. **`contextMenus`**:
   - **Why:** Enables the "Right-click to add this site" feature, making it much faster to enable controls on new websites without opening the popup.

4. **`host_permissions`**:
   - **Why:** I include standard permissions for YouTube, Instagram, TikTok, and Facebook. The broad `*://*/*` permission is necessary to allow the **"Add Custom Site"** feature to work. It ensures the extension can function on any domain you choose to add.

---

## 🛡️ Privacy Policy
Arrow Skip respects your privacy:
- **No Data Collection:** I do not track your browsing history or collect any personal data.
- **Local Processing:** All your settings and site configurations are stored locally on your machine via Chrome Sync.
- **No External Servers:** The extension does not communicate with any external servers.

---

