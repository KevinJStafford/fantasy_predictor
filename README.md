# 🏆 Fantasy Predictor

Fantasy Predictor is a web application that lets you and your friends turn match predictions into a competitive game. Create an account, spin up a private league, invite your players, and predict the scores of your favorite sports matches. Predictions are automatically scored and ranked so you can see who really knows the game.

---

## ✨ Features

* **User Accounts** – Secure sign-up and login for all players
* **Leagues** – Create private leagues and invite friends to join
* **Match Predictions** – Predict exact scores (or results) for upcoming matches
* **Automatic Scoring** – Predictions are scored based on accuracy
* **Leaderboards** – Real-time league tables showing the top predictors
* **Multi‑Sport Friendly** – Designed to support different sports with minimal changes

---

## 🧱 Tech Stack

### Frontend

* **React** (SPA)
* Modern component-based UI
* Communicates with backend via REST API

### Backend

* **Python**
* **Flask** (API layer)
* Handles authentication, leagues, predictions, scoring, and leaderboard logic

---

## 🧩 High-Level Architecture

```
React Frontend  →  Flask REST API  →  Database
```

* The React app manages UI, routing, and user interactions
* Flask exposes REST endpoints for auth, leagues, matches, and predictions
* Backend calculates scores and generates leaderboard data

---

## 🚀 Getting Started

### Prerequisites

* Node.js (v18+ recommended)
* Python (3.10+ recommended)
* pip / virtualenv

---

### Backend Setup (Flask)

This project uses **Pipenv** (see `Pipfile` in the repo root). Flask is installed in the Pipenv environment, so the `flask` command is only available when that environment is active.

**From the project root:**

```bash
pipenv install
cd server
FLASK_APP=app.py pipenv run flask run
```

Or activate the shell first, then run any Flask commands:

```bash
pipenv shell
cd server
export FLASK_APP=app.py
flask run
flask db upgrade   # run migrations
```

If you see "flask: command not found" in the `server` folder, you're not in the Pipenv environment—run the commands above from the repo root using `pipenv run` or after `pipenv shell`.

By default the API will be available at:

```
http://localhost:5000
```

---

### Frontend Setup (React)

```bash
cd frontend
npm install
npm start
```

The app will be available at:

```
http://localhost:3000
```

---

## 🔐 Authentication

* Users must create an account or log in to access leagues
* Authenticated users can:

  * Create leagues
  * Join leagues via invite link or code
  * Submit predictions

---

## 🎮 How It Works

1. **Create an Account**
2. **Create a League** and invite your friends
3. **Add Matches** (manually or via integration)
4. **Submit Predictions** before kickoff
5. **Scores Are Calculated** once results are final
6. **Leaderboard Updates** to show the most accurate predictors

---

## 🧮 Scoring Logic (Example)

> *(Customize as needed)*

* Exact score prediction: **3 points**
* Correct result (win/draw/loss): **1 point**
* Incorrect prediction: **0 points**

---

## ☀️ Keep-warm for Render

If your API is on Render’s free (or spin-down) tier, the first request after idle can be slow while the service starts. To keep it awake:

1. **Endpoint:** The API exposes `GET /api/v1/health` (no auth). It returns `{"status":"ok"}`.
2. **Cron:** Use a free external cron to hit that URL every 10–14 minutes.

**Option A – cron-job.org (free):**

1. Go to [cron-job.org](https://cron-job.org) and create an account.
2. Create a new cron job:
   - **URL:** `https://YOUR-RENDER-API-URL.onrender.com/api/v1/health`
   - **Schedule:** Every 10 minutes (or “every 14 minutes”).
   - **Request method:** GET.
3. Save. The job will ping your API on schedule so it doesn’t spin down.

**Option B – UptimeRobot (free):**

1. Go to [uptimerobot.com](https://uptimerobot.com) and create an account.
2. Add a monitor:
   - **Monitor type:** HTTP(s).
   - **URL:** `https://YOUR-RENDER-API-URL.onrender.com/api/v1/health`
   - **Monitoring interval:** 5 minutes (free tier).
3. Save. UptimeRobot will request the URL on the interval and your API stays warm.

Replace `YOUR-RENDER-API-URL` with your actual Render API hostname (e.g. `fantasy-predictor-api`).

---

## 🗂️ Project Structure

```
/
├── frontend/        # React application
│   ├── src/
│   └── package.json
│
├── backend/         # Flask API
│   ├── app/
│   ├── requirements.txt
```
