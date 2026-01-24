# 🚀 Deployment Guide for Render

This guide will help you deploy your Fantasy Predictor app to Render.

## Prerequisites

1. A [Render account](https://render.com) (free tier available)
2. Your code pushed to a GitHub repository
3. Basic understanding of environment variables

## Step 1: Prepare Your Repository

Make sure all your code is committed and pushed to GitHub:

```bash
git add .
git commit -m "Prepare for production deployment"
git push origin main
```

## Step 2: Deploy Database (PostgreSQL)

1. Go to your [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"PostgreSQL"**
3. Configure:
   - **Name**: `fantasy-predictor-db`
   - **Database**: `fantasy_predictor`
   - **User**: `fantasy_predictor_user`
   - **Region**: Choose closest to you
   - **Plan**: Free (for small scale)
4. Click **"Create Database"**
5. **Save the Internal Database URL** - you'll need it later

## Step 3: Deploy Backend API

1. In Render Dashboard, click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure the service:
   - **Name**: `fantasy-predictor-api`
   - **Environment**: `Python 3`
   - **Region**: Same as database
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: Leave empty (or `server` if you want)
   - **Build Command**: 
     ```bash
     pip install -r requirements.txt && cd server && flask db upgrade
     ```
   - **Start Command**:
     ```bash
     cd server && gunicorn app:app --bind 0.0.0.0:$PORT
     ```
4. Click **"Advanced"** and add Environment Variables:
   - `FLASK_APP` = `app.py`
   - `FLASK_ENV` = `production`
   - `SECRET_KEY` = Generate a strong random string (use a password generator)
   - `DATABASE_URL` = (Use the Internal Database URL from Step 2)
   - `EXTERNAL_FIXTURES_API_URL` = `https://sdp-prem-prod.premier-league-prod.pulselive.com/api/v2/matches?competition=8&season=2025&_limit=100`
   - `CORS_ORIGINS` = (Leave empty for now, we'll set after frontend is deployed)
5. Click **"Create Web Service"**
6. **Copy the service URL** (e.g., `https://fantasy-predictor-api.onrender.com`)

## Step 4: Deploy Frontend

1. In Render Dashboard, click **"New +"** → **"Static Site"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: `fantasy-predictor-frontend`
   - **Environment**: `Node` (IMPORTANT: Make sure it's set to Node, not Python!)
   - **Branch**: `main`
   - **Root Directory**: `client`
   - **Build Command**: 
     ```bash
     npm install && npm run build
     ```
   - **Publish Directory**: `build`
   
   **⚠️ Important**: If Render auto-detects Python, manually change the Environment to "Node" in the settings.
4. Click **"Advanced"** and add Environment Variable:
   - `REACT_APP_API_URL` = Your backend URL from Step 3 (e.g., `https://fantasy-predictor-api.onrender.com`)
5. Click **"Create Static Site"**
6. **Copy the frontend URL** (e.g., `https://fantasy-predictor-frontend.onrender.com`)

## Step 5: Update CORS Settings

1. Go back to your **Backend API** service
2. Click **"Environment"**
3. Update `CORS_ORIGINS` to your frontend URL:
   ```
   https://fantasy-predictor-frontend.onrender.com
   ```
4. Click **"Save Changes"** - this will trigger a redeploy

## Step 6: Run Database Migrations

**Option 1: Automatic (Recommended)**
- Migrations run automatically during build (already configured in build command)
- Check the build logs to confirm migrations ran successfully

**Option 2: Manual via API Endpoint (Free Tier)**
If migrations didn't run during build, you can trigger them manually:

1. Make a POST request to: `https://your-backend-url.onrender.com/api/v1/migrate`
2. You can use:
   - **curl**: `curl -X POST https://your-backend-url.onrender.com/api/v1/migrate`
   - **Browser extension** (like REST Client)
   - **Postman** or similar tool
   - Or visit the URL in browser (though POST is required)

**Option 3: Shell (Paid Tier Only)**
- Shell access requires a paid plan ($7/month)
- If you upgrade, you can use: `cd server && flask db upgrade`

## Step 7: Test Your Deployment

1. Visit your frontend URL
2. Try creating an account
3. Test the login
4. Try syncing fixtures
5. Make a prediction

## Troubleshooting

### Backend won't start
- Check the **Logs** tab in Render
- Ensure `requirements.txt` has all dependencies
- Verify `gunicorn` is in requirements.txt
- Check that `DATABASE_URL` is set correctly

### Database connection errors
- Verify `DATABASE_URL` uses the **Internal Database URL** (not external)
- Check that the database is running
- Ensure `psycopg2-binary` is in requirements.txt

### Frontend can't connect to backend
- Verify `REACT_APP_API_URL` is set correctly
- Check `CORS_ORIGINS` includes your frontend URL
- Ensure backend is running and accessible

### CORS errors
- Make sure `CORS_ORIGINS` in backend includes your frontend URL
- Check browser console for exact error
- Verify no trailing slashes in URLs

## Using render.yaml (Alternative Method)

If you prefer, you can use the `render.yaml` file for easier setup:

1. In Render Dashboard, click **"New +"** → **"Blueprint"**
2. Connect your repository
3. Render will automatically detect `render.yaml`
4. Review and deploy all services at once

**Note**: You'll still need to:
- Set `CORS_ORIGINS` after frontend is deployed
- Set `REACT_APP_API_URL` in frontend environment
- Run database migrations

## Environment Variables Summary

### Backend
- `FLASK_APP` = `app.py`
- `FLASK_ENV` = `production`
- `SECRET_KEY` = (Generate a strong random string)
- `DATABASE_URL` = (Internal PostgreSQL URL from Render)
- `EXTERNAL_FIXTURES_API_URL` = (Premier League API URL)
- `CORS_ORIGINS` = (Your frontend URL)

### Frontend
- `REACT_APP_API_URL` = (Your backend URL)

## Cost Estimate

**Free Tier** (for small scale):
- PostgreSQL: Free (limited to 90 days, then $7/month)
- Backend API: Free (spins down after 15 min inactivity)
- Frontend: Free

**Paid Tier** (recommended for production):
- PostgreSQL: $7/month
- Backend API: $7/month (always on)
- Frontend: Free
- **Total: ~$14/month**

## Next Steps

1. Set up a custom domain (optional)
2. Enable HTTPS (automatic on Render)
3. Set up monitoring/alerts
4. Configure automated backups for database
5. Set up CI/CD for automatic deployments

## Support

- [Render Documentation](https://render.com/docs)
- [Render Community](https://community.render.com)
