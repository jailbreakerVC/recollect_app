# Recollect Chrome Extension Installation Guide

## Overview

This guide will walk you through installing the Recollect Chrome extension from a downloaded ZIP file. The extension enables intelligent bookmark search and contextual suggestions directly in your browser.

## Prerequisites

- Google Chrome browser (version 88 or later)
- Basic computer skills for file management
- Administrator access to install extensions (if required by your organization)

## Installation Steps

### Step 1: Download the Extension

1. Go to the [Recollect GitHub Releases page](https://github.com/jailbreakerVC/recollect_app/releases)
2. Find the latest release version
3. Download the `public.zip` file from the Assets section
4. Save the ZIP file to a location you can easily find (e.g., Downloads folder)

### Step 2: Extract the Extension Files

1. **Windows:**
   - Right-click on the downloaded `public.zip` file
   - Select "Extract All..." from the context menu
   - Choose a destination folder (e.g., `C:\Users\YourName\Documents\public`)
   - Click "Extract"

2. **macOS:**
   - Double-click the `public.zip` file
   - The files will automatically extract to a folder in the same location
   - Move the extracted folder to a permanent location (e.g., `~/Documents/public`)

3. **Linux:**
   - Open terminal and navigate to the download location
   - Run: `unzip public.zip -d ~/Documents/public`
   - Or use your file manager's built-in extraction tool

### Step 3: Enable Developer Mode in Chrome

1. Open Google Chrome
2. Click the three-dot menu (⋮) in the top-right corner
3. Go to **More tools** → **Extensions**
4. Alternatively, type `chrome://extensions/` in the address bar and press Enter
5. In the top-right corner of the Extensions page, toggle **Developer mode** to ON
6. You should now see additional buttons: "Load unpacked", "Pack extension", and "Update"

### Step 4: Load the Extension

1. On the Extensions page (with Developer mode enabled), click **Load unpacked**
2. Navigate to the extracted public folder
3. Select the folder containing the extension files (it should contain `manifest.json`)
4. Click **Select Folder** (Windows) or **Open** (macOS/Linux)
5. The Recollect extension should now appear in your extensions list

### Step 5: Verify Installation

1. Look for the Recollect icon (📚) in your Chrome toolbar
2. If you don't see it, click the puzzle piece icon (🧩) in the toolbar
3. Find "Recollect" in the dropdown and click the pin icon to pin it to your toolbar
4. Click the Recollect icon to open the extension popup
5. You should see the extension interface with options to connect to the web app

### Step 6: Connect to Web Application

1. Open the Recollect web application at `http://localhost:5173` (development) or https://recollect-eight.vercel.app/
2. Sign in with your Google account
3. The extension should automatically detect the web app and show "Connected" status
4. You can now sync your Chrome bookmarks with the web application

## Troubleshooting

### Extension Not Loading

**Problem:** "Load unpacked" button is grayed out or not visible
- **Solution:** Make sure Developer mode is enabled (Step 3)

**Problem:** Error message when loading extension
- **Solution:** Ensure you selected the correct folder containing `manifest.json`

### Extension Icon Not Visible

**Problem:** Can't find the Recollect icon in the toolbar
- **Solution:**
  1. Click the puzzle piece icon (🧩) in Chrome toolbar
  2. Find "Recollect" and click the pin icon
  3. The icon should now appear in your toolbar

### Connection Issues

**Problem:** Extension shows "Not Connected" or "Extension Not Available"
- **Solutions:**
  1. Make sure the web application is running and accessible
  2. Refresh the web application page
  3. Try disabling and re-enabling the extension
  4. Check that both the extension and web app are using the same domain/port

### Permission Errors

**Problem:** Extension requests permissions or shows security warnings
- **Solution:**
  1. Review the requested permissions carefully
  2. Click "Allow" for necessary permissions (bookmarks, storage, tabs)
  3. These permissions are required for the extension to function properly

## Features After Installation

Once successfully installed and connected, you can:

### Context Menu Search
- Select any text on a webpage
- Right-click and choose "Search Bookmarks for [selected text]"
- View related bookmarks in the extension popup

### Automatic Page Analysis
- The extension automatically analyzes pages you visit
- Suggests relevant bookmarks based on page content
- Shows suggestions via notifications or popup

### Bookmark Synchronization
- Sync your Chrome bookmarks with the web application
- Access bookmarks across devices through the web interface
- Intelligent search and organization features

## Updating the Extension

When a new version is released:

1. Download the new ZIP file from GitHub releases
2. Extract it to the same location (overwriting old files)
3. Go to `chrome://extensions/`
4. Find the Recollect extension
5. Click the refresh/reload icon (🔄) on the extension card
6. The extension will update to the new version

## Uninstalling the Extension

If you need to remove the extension:

1. Go to `chrome://extensions/`
2. Find the Recollect extension
3. Click **Remove**
4. Confirm the removal
5. Optionally, delete the extracted extension folder from your computer

## Security and Privacy

- The extension only accesses your bookmarks and browsing data as needed for functionality
- All data is processed locally or sent to your configured Recollect web application
- No data is sent to third-party services without your explicit consent
- Review the privacy policy and source code on GitHub for complete transparency

## Support

If you encounter issues:

1. Check the [GitHub Issues page](https://github.com/your-username/recollect/issues) for known problems
2. Create a new issue with detailed information about your problem
3. Include your Chrome version, operating system, and error messages
4. Check the browser console for additional error details

## Development Setup

For developers who want to modify the extension:

1. Follow the installation steps above
2. Make changes to the extension files
3. Go to `chrome://extensions/`
4. Click the refresh icon on the Recollect extension card
5. Test your changes
6. The extension will reload with your modifications

---

**Note:** This extension is open source and available on GitHub. Feel free to contribute, report issues, or suggest improvements!
