# Recreating Backend Service on Render

## Step-by-Step Guide

### 1. Delete Current Service
1. Go to your backend service in Render Dashboard
2. Click **Settings** → Scroll to bottom → **Delete Service**
3. Confirm deletion

### 2. Create New Web Service

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. **Configure the service:**

   **Basic Settings:**
   - **Name**: `fantasy-predictor-api`
   - **Environment**: `Python 3`
   - **Python Version**: `3.11` ⚠️ **CRITICAL - Select 3.11, NOT 3.13!**
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: Leave empty

   **Build & Deploy:**
   - **Build Command**: 
     ```bash
     PYTHONWARNINGS=ignore pip install -r requirements.txt && cd server && PYTHONWARNINGS=ignore flask db upgrade
     ```
   - **Start Command**:
     ```bash
     cd server && gunicorn app:app --bind 0.0.0.0:$PORT
     ```

### 3. Environment Variables

Click **"Advanced"** → **"Add Environment Variable"** for each:

```
FLASK_APP = app.py
FLASK_ENV = production
SECRET_KEY = [Generate a strong random string]
DATABASE_URL = postgresql://fantasy_predictor_user:SvSSFDWawNA5mKQQQlim1ZxqEudZbIVN@dpg-d5qgtr6r433s73835s5g-a/fantasy_predictor
EXTERNAL_FIXTURES_API_URL = https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/matches?competition=8&season=2025&_limit=100
CORS_ORIGINS = [Leave empty for now]
PYTHONWARNINGS = ignore::DeprecationWarning:sqlalchemy
```

### 4. Important Notes

- **Python Version**: Must be **3.11** (not 3.13) for psycopg2-binary compatibility
- **Build Command**: Includes `PYTHONWARNINGS=ignore` to suppress SQLAlchemy warnings
- **DATABASE_URL**: Use the Internal Database URL (the one you provided)
- **SECRET_KEY**: Generate using: `python -c "import secrets; print(secrets.token_urlsafe(32))"`

### 5. After Creation

1. Wait for the build to complete
2. Check the **Logs** tab for any errors
3. **Copy your backend URL** (e.g., `https://fantasy-predictor-api.onrender.com`)
4. If migrations didn't run, use the migration endpoint:
   ```bash
   curl -X POST https://your-backend-url.onrender.com/api/v1/migrate
   ```

### 6. Update Frontend with Backend URL

1. Go to your **Frontend Static Site** service in Render
2. Click **Settings** → **Environment**
3. Update `REACT_APP_API_URL` to your new backend URL:
   ```
   REACT_APP_API_URL = https://your-new-backend-url.onrender.com
   ```
4. Click **"Save Changes"** - this will trigger a rebuild

### 7. Update CORS in Backend

1. Go back to your **Backend API** service
2. Click **Settings** → **Environment**
3. Update `CORS_ORIGINS` to your frontend URL:
   ```
   CORS_ORIGINS = https://your-frontend-url.onrender.com
   ```
4. Click **"Save Changes"** - this will trigger a redeploy

## Troubleshooting

### If Python 3.11 option doesn't appear:
- Render might auto-detect from `runtime.txt` (already created)
- Or try creating the service, then change Python version in Settings after creation

### If build still fails:
- Check the **Logs** tab for the exact error
- Verify all environment variables are set correctly
- Make sure `requirements.txt` is committed and pushed

### If you see psycopg2 errors:
- Confirm Python version is 3.11 (check Settings)
- The error means Python 3.13 is still being used
