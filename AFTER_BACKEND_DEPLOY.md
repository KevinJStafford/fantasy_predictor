# After Backend is Deployed - Update Frontend

## Step 1: Get Your Backend URL

After your backend service is created and deployed:
1. Go to your backend service in Render
2. Copy the service URL (e.g., `https://fantasy-predictor-api.onrender.com`)
3. **Save this URL** - you'll need it for the frontend

## Step 2: Update Frontend Environment Variable

1. Go to your **Frontend Static Site** service in Render Dashboard
2. Click **Settings** tab
3. Scroll to **Environment Variables**
4. Find `REACT_APP_API_URL`
5. Update it to your new backend URL:
   ```
   REACT_APP_API_URL = https://your-backend-url.onrender.com
   ```
6. Click **"Save Changes"**
7. Render will automatically rebuild the frontend

## Step 3: Update CORS in Backend

1. Go back to your **Backend API** service
2. Click **Settings** → **Environment**
3. Find `CORS_ORIGINS`
4. Update it to your frontend URL:
   ```
   CORS_ORIGINS = https://your-frontend-url.onrender.com
   ```
5. Click **"Save Changes"**
6. Render will automatically redeploy the backend

## Step 4: Test Everything

1. Visit your frontend URL
2. Try creating an account
3. Test login
4. Try syncing fixtures
5. Make a prediction

## Important Notes

- **No trailing slashes** in URLs (e.g., use `https://example.com` not `https://example.com/`)
- **Include `https://`** protocol
- Both services will automatically redeploy after you save the environment variables
- Wait for both deployments to complete before testing

## Quick Checklist

- [ ] Backend is deployed and running
- [ ] Copied backend URL
- [ ] Updated `REACT_APP_API_URL` in frontend
- [ ] Updated `CORS_ORIGINS` in backend
- [ ] Both services finished redeploying
- [ ] Tested the app
