# Fix for Static Site Environment Detection

## The Problem
Render is auto-detecting Python files from the root directory and trying to use pipenv for the static site.

## The Solution

When creating the Static Site in Render, make sure:

1. **Root Directory is set to `client`**
   - This is CRITICAL - it tells Render to only look in the client folder
   - Render will then see `package.json` and use Node.js

2. **Build Command**:
   ```bash
   npm install && npm run build
   ```

3. **Publish Directory**: `build`

## Configuration Checklist

When creating the Static Site, ensure these settings:

- ✅ **Root Directory**: `client` (not empty, not `.`, not `/`)
- ✅ **Build Command**: `npm install && npm run build`
- ✅ **Publish Directory**: `build`
- ✅ **Branch**: `main` (or your default branch)

## Why This Works

By setting Root Directory to `client`, Render:
- Only sees files in the `client/` folder
- Finds `package.json` in that directory
- Automatically detects Node.js environment
- Ignores Python files in the root directory

## If It Still Doesn't Work

If Render still tries to use Python after setting Root Directory to `client`:

1. Make sure you've committed and pushed the latest code
2. Try adding a `.nvmrc` file in the `client/` directory (already created)
3. Try adding `engines` field to `package.json` (already added)
4. Contact Render support - they can manually set the environment

## Alternative: Use Web Service Instead

If Static Site continues to have issues, you can deploy as a Web Service:

1. Create a **Web Service** (not Static Site)
2. Environment: **Node**
3. Build Command: `cd client && npm install && npm run build`
4. Start Command: `cd client && npx serve -s build -l $PORT`
5. Install `serve` package: Add to `client/package.json` devDependencies

But Static Site should work with Root Directory set correctly!
