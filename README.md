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

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate
pip install -r requirements.txt

flask run
```

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
