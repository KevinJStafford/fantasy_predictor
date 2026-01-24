# 🚀 Quick Start - Render Deployment

## Your Database URL
```
postgresql://fantasy_predictor_user:SvSSFDWawNA5mKQQQlim1ZxqEudZbIVN@dpg-d5qgtr6r433s73835s5g-a/fantasy_predictor
```

## Step-by-Step Deployment

### 1. Deploy Backend API

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository
4. Configure:
   - **Name**: `fantasy-predictor-api`
   - **Environment**: `Python 3`
   - **Region**: Choose closest to you
   - **Branch**: `main`
   - **Root Directory**: Leave empty
   - **Build Command**: 
     ```bash
     pip install -r requirements.txt && cd server && flask db upgrade
     ```
   - **Start Command**:
     ```bash
     cd server && gunicorn app:app --bind 0.0.0.0:$PORT
     ```

5. **Environment Variables** (click "Advanced"):
   ```
   FLASK_APP = app.py
   FLASK_ENV = production
   SECRET_KEY = [Generate a strong random string - use a password generator]
   DATABASE_URL = postgresql://fantasy_predictor_user:SvSSFDWawNA5mKQQQlim1ZxqEudZbIVN@dpg-d5qgtr6r433s73835s5g-a/fantasy_predictor
   EXTERNAL_FIXTURES_API_URL = https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/matches?competition=8&season=2025&_limit=100
   CORS_ORIGINS = [Leave empty for now - set after frontend is deployed]
   ```

6. Click **"Create Web Service"**
7. **Wait for deployment** and copy the service URL (e.g., `https://fantasy-predictor-api.onrender.com`)

### 2. Deploy Frontend

1. In Render Dashboard, click **"New +"** → **"Static Site"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `fantasy-predictor-frontend`
   - **Environment**: `Node` (IMPORTANT: Not Python!)
   - **Branch**: `main`
   - **Root Directory**: `client`
   - **Build Command**: 
     ```bash
     npm install && npm run build
     ```
   - **Publish Directory**: `build`

4. **Environment Variable**:
   ```
   REACT_APP_API_URL = [Your backend URL from step 1, e.g., https://fantasy-predictor-api.onrender.com]
   ```

5. Click **"Create Static Site"**
6. **Copy the frontend URL** (e.g., `https://fantasy-predictor-frontend.onrender.com`)

### 3. Update CORS Settings

1. Go back to your **Backend API** service
2. Click **"Environment"** tab
3. Update `CORS_ORIGINS` to your frontend URL:
   ```
   https://fantasy-predictor-frontend.onrender.com
   ```
4. Click **"Save Changes"** (this will trigger a redeploy)

### 4. Run Database Migrations (If Needed)

**Migrations should run automatically during build**, but if you need to run them manually:

1. Make a POST request to: `https://your-backend-url.onrender.com/api/v1/migrate`
2. You can use:
   - **curl**: `curl -X POST https://your-backend-url.onrender.com/api/v1/migrate`
   - Or use a tool like Postman
   - Or visit in browser (though POST is required)

**Note**: Shell access requires a paid plan. The migration endpoint works on free tier.

### 5. Test Your Deployment

1. Visit your frontend URL
2. Try creating an account
3. Test login
4. Sync fixtures
5. Make a prediction

## Important Notes

- **Database URL**: Use the Internal Database URL (the one you provided) - NOT the external URL
- **SECRET_KEY**: Generate a strong random string (at least 32 characters). You can use:
  ```bash
  python -c "import secrets; print(secrets.token_urlsafe(32))"
  ```
- **CORS_ORIGINS**: Must match your frontend URL exactly (no trailing slash)
- **First deployment** may take 5-10 minutes
- **Free tier** services spin down after 15 minutes of inactivity (first request will be slow)

## Troubleshooting

### Backend won't start
- Check the **Logs** tab
- Ensure `DATABASE_URL` is set correctly
- Verify `gunicorn` is in requirements.txt

### Database connection errors
- Make sure you're using the **Internal Database URL** (not external)
- Check that the database service is running

### CORS errors
- Verify `CORS_ORIGINS` matches your frontend URL exactly
- No trailing slashes
- Include `https://` protocol

### Frontend can't connect
- Check `REACT_APP_API_URL` is set to your backend URL
- Verify backend is running (check logs)
- Ensure CORS is configured correctly

## Your URLs (after deployment)

- **Backend**: `https://fantasy-predictor-api.onrender.com`
- **Frontend**: `https://fantasy-predictor-frontend.onrender.com`
- **Database**: Already created ✅

## Next Steps

Once deployed:
1. Test all features
2. Share with your 6 players
3. Monitor the logs for any issues
4. Consider upgrading to paid tier for always-on service ($7/month)
