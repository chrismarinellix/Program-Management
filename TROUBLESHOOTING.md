# Troubleshooting Guide

## Critical Issues & Solutions

### 1. Tauri v2 Dialog Plugin Not Working (Browse Buttons Unresponsive)

**Problem Description:**
- Browse buttons in file selection dialogs appear but don't respond to clicks
- No error messages in console
- Dialog import appears correct but `open()` function silently fails
- Other buttons (like Reset) work fine, only file dialog buttons fail

**Root Cause:**
Tauri v2 introduced a new security model with explicit capability-based permissions. Unlike Tauri v1 where plugins worked automatically once imported, Tauri v2 requires explicit permission grants in the capabilities configuration file for each plugin feature.

**Symptoms:**
1. `import { open } from '@tauri-apps/plugin-dialog'` compiles without errors
2. The `open` function is available in JavaScript
3. Calling `open()` returns a Promise that never resolves or rejects
4. No errors appear in browser console or Tauri console
5. The dialog plugin is properly initialized in Rust (`tauri_plugin_dialog::init()`)
6. The plugin is listed in `Cargo.toml` and `package.json`

**Solution:**

1. **Check if capabilities file exists:**
   ```bash
   ls -la src-tauri/capabilities/
   ```
   If not, create the directory and file.

2. **Edit `src-tauri/capabilities/default.json`:**
   ```json
   {
     "$schema": "../gen/schemas/desktop-schema.json",
     "identifier": "default",
     "description": "Capability for the main window",
     "windows": ["main"],
     "permissions": [
       "core:default",
       "opener:default",
       "core:webview:default",
       "core:window:default",
       "dialog:default",
       "dialog:allow-open",
       "dialog:allow-save",
       "dialog:allow-message",
       "dialog:allow-ask",
       "dialog:allow-confirm"
     ]
   }
   ```

3. **Restart the Tauri application** (required for capability changes):
   ```bash
   # Kill the current dev server
   # Then restart:
   cd src-tauri && cargo clean && cd ..
   npm run tauri dev
   ```

**Why This Happens:**
- Tauri v2's security model requires explicit permission grants
- Each plugin capability must be listed in the permissions array
- Without permissions, the plugin loads but all operations fail silently
- This is a security feature to prevent unauthorized system access

**Testing the Fix:**
1. Open browser developer console (F12)
2. Navigate to the file selection dialog
3. Click any browse button
4. You should see the native file dialog appear
5. Check console for any error messages

**Prevention:**
- Always check `src-tauri/capabilities/default.json` when adding new Tauri plugins
- Review Tauri v2 migration guide for each plugin's required permissions
- Test plugin functionality immediately after adding to catch permission issues early

**Related Files:**
- `src-tauri/capabilities/default.json` - Permission configuration
- `src-tauri/src/lib.rs` - Plugin initialization
- `src-tauri/Cargo.toml` - Rust dependencies
- `package.json` - JavaScript dependencies

---

### 2. Data Not Loading on Startup / Load Data Button Not Working

**Problem Description:**
- Application starts but no data appears in grids
- Status shows "Data Loaded" but tabs are empty
- Progress bars don't appear when clicking Load Data
- Loading screen may flash briefly then disappear
- No error messages but data remains empty

**Root Causes:**
1. **Cache Logic Issue**: The `forceReload` variable logic was inverted, preventing data from loading after cache was cleared
2. **Event Propagation**: The `forceReloadData` event wasn't properly triggering the load function
3. **File Paths**: Incorrect or missing file paths in Settings

**Solution:**

1. **Ensure correct file paths are set:**
   ```
   Settings → File Paths tab
   - P.xlsx: /path/to/P.xlsx
   - PT.xlsx: /path/to/PT.xlsx
   - AE.xlsx: /path/to/AE.xlsx
   - Program_Management.xlsm: /path/to/Program_Management.xlsm
   ```

2. **Click buttons in correct order:**
   - First click "Save File Paths" (if you changed paths)
   - Then click "Load Data"

3. **Check browser console for errors:**
   - Open F12 Developer Tools
   - Look for messages like:
     - "loadAllDataOnce called"
     - "Starting new data load"
     - "Loading files from paths:"
   - Check for any red error messages

4. **If still not working, restart the app:**
   ```bash
   # Kill the current session (Ctrl+C)
   # Then restart:
   npm run tauri dev
   ```

5. **Verify files exist:**
   ```bash
   ls -la /path/to/your/excel/files/
   ```

**Code Fix Applied:**
Changed from:
```typescript
const forceReload = !globalDataCache && !dataLoadPromise;
if (globalDataCache && !forceReload) { /* use cache */ }
```
To:
```typescript
if (globalDataCache) { /* use cache */ }
if (dataLoadPromise) { /* wait for existing */ }
```

**Prevention:**
- Always test data loading after cache clearing
- Add console logging to track loading states
- Verify file paths before attempting to load

---

### 3. Hot Module Replacement (HMR) Not Working

**Problem Description:**
- Changes to React components don't reflect immediately
- Need to manually refresh to see updates

**Solution:**
1. Check if Vite dev server is running
2. Verify no syntax errors in modified files
3. Clear browser cache if needed
4. Restart dev server if HMR breaks

---

### 4. Excel Files Not Being Read Correctly

**Problem Description:**
- Data appears corrupted or missing
- Wrong headers or data in wrong columns

**Common Issues:**
1. **Pipeline tab**: Headers are in row 11, not row 1
2. **Date formats**: Excel dates may parse as numbers
3. **Formula cells**: May show as errors or empty

**Solution:**
- Verify Excel file structure matches expected format
- Check for hidden rows/columns
- Ensure no merged cells in data range
- Save Excel files in .xlsx format (not .xls)

---

### 5. Rust Compilation Errors

**Problem Description:**
- `cargo` command not found
- Compilation fails with dependency errors

**Solution:**
1. **Install Rust:**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   source $HOME/.cargo/env
   ```

2. **Clear cargo cache if needed:**
   ```bash
   cd src-tauri
   cargo clean
   cargo build
   ```

3. **Update dependencies:**
   ```bash
   cargo update
   ```

---

### 6. Permission Denied Errors on macOS

**Problem Description:**
- Cannot access files in Documents or Desktop folders
- File dialog shows but cannot select files

**Solution:**
1. Grant full disk access to Terminal/IDE
2. System Preferences → Security & Privacy → Privacy → Full Disk Access
3. Add your terminal application
4. Restart the application

---

### 7. Build Failures

**Common Build Issues:**

**TypeScript Errors:**
```bash
npm run build
# If errors, check:
npx tsc --noEmit
```

**Missing Dependencies:**
```bash
npm install
cd src-tauri && cargo build
```

**Platform-Specific Issues:**
- Windows: Ensure Visual Studio Build Tools installed
- macOS: Ensure Xcode Command Line Tools installed
- Linux: Install required system libraries (see Tauri prerequisites)

---

## Debugging Tips

### Enable Verbose Logging

1. **Frontend (JavaScript):**
   ```javascript
   // Add to main component
   console.log('Component mounted');
   console.log('Current state:', state);
   ```

2. **Backend (Rust):**
   ```rust
   println!("Debug: {}", variable);
   dbg!(&variable);
   ```

3. **Tauri Commands:**
   ```rust
   #[tauri::command]
   async fn my_command() -> Result<String, String> {
       println!("Command called");
       Ok("Success".to_string())
   }
   ```

### Check Console Outputs

1. **Browser Console:** F12 → Console tab
2. **Tauri/Rust Console:** Terminal where `npm run tauri dev` is running
3. **Network Tab:** F12 → Network tab (for API calls)

### Common Console Commands for Debugging

```javascript
// In browser console:

// Test dialog directly
window.testDialog({ multiple: false }).then(console.log).catch(console.error)

// Check localStorage
localStorage.getItem('dataFilePaths')

// Trigger data reload
window.dispatchEvent(new CustomEvent('forceReloadData'))

// Check if Tauri APIs are available
window.__TAURI__
```

---

## Testing Checklist

Before reporting an issue, check:

- [ ] Tauri dev server is running (`npm run tauri dev`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Browser console shows no errors (F12)
- [ ] Correct file paths are set in Settings
- [ ] Permissions are granted (capabilities file)
- [ ] Dependencies are installed (`npm install && cd src-tauri && cargo build`)
- [ ] Using latest versions of Tauri packages

---

## Getting Help

1. Check this troubleshooting guide first
2. Review browser and terminal console for errors
3. Check Tauri v2 documentation for plugin-specific issues
4. Create detailed bug report with:
   - Error messages (full text)
   - Steps to reproduce
   - System information (OS, versions)
   - Console output from both browser and terminal