# Files to Commit Before Deploying

The following files need to be committed and pushed to GitHub for Render to build successfully:

## New Files Created
- `client/src/utils/api.js` - API URL utility (REQUIRED - currently missing!)
- `client/.nvmrc` - Node version specification
- `client/.node-version` - Alternative Node version file
- `requirements.txt` - Python dependencies for Render
- `render.yaml` - Render deployment configuration
- `env.example` - Environment variables template
- `DEPLOYMENT.md` - Deployment guide
- `QUICK_START.md` - Quick start guide
- `PRODUCTION_CHECKLIST.md` - Production checklist
- `STATIC_SITE_FIX.md` - Static site troubleshooting

## Updated Files
- `server/config.py` - Environment variables support
- `server/app.py` - Production-ready configuration
- `client/package.json` - Added engines field
- `client/src/components/Members.js` - Uses apiUrl utility
- `client/src/components/Signup.js` - Uses apiUrl utility
- `client/src/components/Login.js` - Uses apiUrl utility
- `client/src/components/Predictions.js` - Uses apiUrl utility
- `.gitignore` - Updated for production

## Commands to Run

```bash
# Add all new and modified files
git add .

# Commit everything
git commit -m "Prepare for Render deployment - add API utility and production config"

# Push to GitHub
git push origin main
```

## Critical File

**`client/src/utils/api.js`** is the most important - without it, the build will fail with "Module not found" error.
