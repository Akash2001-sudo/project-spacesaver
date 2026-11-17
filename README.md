# 🚀 SpaceSaver

A beautiful Windows desktop tool to **free up disk space** and **organize files** by type.

Built with **Electron** and a modern dark-themed UI.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Electron](https://img.shields.io/badge/Electron-28-47848F?logo=electron)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

| Feature | Description |
|---|---|
| 📂 **Folder Selection** | Pick any folder to analyze |
| 🧹 **Smart Cleanup** | Detects junk files (`.tmp`, `.log`, `Thumbs.db`), large files, and duplicates |
| 📁 **File Organizer** | Sorts files into categorized subfolders — Images, Videos, Software, Documents, Audio, Archives, Code |
| ⚠️ **Safety First** | Disclaimer & confirmation before every delete/move operation. Deletions go to Recycle Bin |
| 🛑 **Stop Anytime** | Cancel any running operation mid-way |
| 🎨 **Beautiful UI** | Modern dark theme with gradient accents and smooth animations |

---

## 🛠️ Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)

### Install & Run

```bash
# Clone the repo
git clone https://github.com/Akash2001-sudo/project-spacesaver.git
cd project-spacesaver

# Install dependencies
npm install

# Launch the app
npm start
```

---

## 📸 How It Works

1. **Home** → Click **"Choose a Folder"** to select the target directory
2. **Cleanup** → Scan the folder → Review files in Junk / Large / Duplicates tabs → Select & delete
3. **Organize** → Pick categories (Images, Videos, Software, etc.) → Click Organize to sort into subfolders

---

## 📁 Project Structure

```
SpaceSaver/
├── main.js          # Electron main process — scanning, deletion, sorting
├── preload.js       # Secure IPC bridge between main & renderer
├── index.html       # UI layout
├── styles.css       # Dark theme styles
├── renderer.js      # Frontend logic & interactions
├── package.json     # Project config & dependencies
└── .gitignore
```

---

## 📄 License

MIT License — feel free to use, modify, and distribute.
