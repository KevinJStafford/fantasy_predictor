# ✅ Production Deployment Checklist

## Pre-Deployment

- [x] Environment variables configured
- [x] `requirements.txt` created for Render
- [x] `render.yaml` created for easy deployment
- [x] Frontend API calls updated to use environment-based URLs
- [x] CORS configuration updated for production
- [x] Database configuration supports PostgreSQL
- [x] `.gitignore` updated to exclude sensitive files
- [ ] Debug print statements removed (optional - can keep for monitoring)
- [ ] Error handling reviewed
- [ ] Security review completed

## Files Created/Updated

### New Files
- ✅ `requirements.txt` - Python dependencies for Render
- ✅ `render.yaml` - Render deployment configuration
- ✅ `env.example` - Environment variables template
- ✅ `DEPLOYMENT.md` - Complete deployment guide
- ✅ `client/src/utils/api.js` - API URL utility

### Updated Files
- ✅ `server/config.py` - Now uses environment variables
- ✅ `server/app.py` - Updated to use PORT from environment
- ✅ `client/src/components/Members.js` - Uses apiUrl utility
- ✅ `client/src/components/Signup.js` - Uses apiUrl utility
- ✅ `client/src/components/Login.js` - Uses apiUrl utility
- ✅ `client/src/components/Predictions.js` - Uses apiUrl utility
- ✅ `.gitignore` - Added production build files

## Environment Variables Needed

### Backend (Render Web Service)
- `FLASK_APP` = `app.py`
- `FLASK_ENV` = `production`
- `SECRET_KEY` = (Generate strong random string)
- `DATABASE_URL` = (From Render PostgreSQL - Internal URL)
- `EXTERNAL_FIXTURES_API_URL` = (Premier League API URL)
- `CORS_ORIGINS` = (Your frontend URL)

### Frontend (Render Static Site)
- `REACT_APP_API_URL` = (Your backend URL)

## Deployment Steps

1. **Push code to GitHub**
   ```bash
   git add .
   git commit -m "Ready for production deployment"
   git push origin main
   ```

2. **Create PostgreSQL database on Render**
   - Name: `fantasy-predictor-db`
   - Save the Internal Database URL

3. **Deploy Backend API**
   - Use `render.yaml` or manual setup
   - Set all environment variables
   - Build command: `pip install -r requirements.txt && cd server && flask db upgrade`
   - Start command: `cd server && gunicorn app:app --bind 0.0.0.0:$PORT`

4. **Deploy Frontend**
   - Use `render.yaml` or manual setup
   - Set `REACT_APP_API_URL` to backend URL
   - Build command: `npm install && npm run build`
   - Publish directory: `build`

5. **Update CORS**
   - Add frontend URL to `CORS_ORIGINS` in backend

6. **Run Migrations**
   - Use Render Shell: `cd server && flask db upgrade`

7. **Test Everything**
   - Sign up
   - Login
   - Sync fixtures
   - Make predictions
   - Check results

## Post-Deployment

- [ ] Test all features
- [ ] Set up monitoring (optional)
- [ ] Configure custom domain (optional)
- [ ] Set up database backups
- [ ] Review error logs
- [ ] Test with multiple users

## Troubleshooting

See `DEPLOYMENT.md` for detailed troubleshooting guide.

## Cost Estimate

**Free Tier** (limited):
- PostgreSQL: Free (90 days, then $7/month)
- Backend: Free (spins down after inactivity)
- Frontend: Free

**Paid Tier** (recommended):
- PostgreSQL: $7/month
- Backend: $7/month (always on)
- Frontend: Free
- **Total: ~$14/month**
