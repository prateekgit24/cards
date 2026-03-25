# Ben 10 Trump Card Game

A real-time, online multiplayer card battle game inspired by the classic Ben 10 Trump Cards. Build your ultimate alien deck and challenge players globally!

## 🚀 Features

- **Global Multiplayer Matchmaking**: Instantly queue up and battle random opponents using Socket.io for ultra-low latency.
- **Dynamic 10-Card Hands**: Battle using iconic aliens across 6 parameters (Height, Power, Speed, Strength, Intelligence, Durability).
- **Automated Highscore System**: Every multiplayer victory is tracked and saved to MongoDB, updating the live Global Leaderboard.
- **Live Categorized Avatars**: Choose from dozens of avatars (Robots, Monsters, Alphabetic, Pixel) seamlessly from a dropdown grid.
- **No-Friction Gameplay**: Zero authentication required to play. Just enter a nickname, pick an avatar, and jump into the queue.
- **Fully Responsive URL**: Looks stunning on PC browsers and mobile phones alike with a nostalgic UI.

## 🛠️ Technology Stack

**Frontend:**
- Vanilla HTML5, CSS3, JavaScript
- Glassmorphism UI combined with retro scifi Ben 10 aesthetics

**Backend:**
- Node.js (Runtime)
- Express.js (HTTP Routing)
- Socket.io (Real-time WebSocket multiplayer orchestration)
- MongoDB / Mongoose (Data persistence for Alien Cards & Leaderboards)

## 📦 Local Development

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env` file in the root directory:
   ```env
   PORT=3500
   MONGODB_URI=mongodb://localhost:27017/cards
   ```

3. **Database Seeding:**
   The `data.json` file contains over 100 fully parameter-weighted aliens. If your MongoDB `cards` database is empty upon running, the proxy server will automatically seed the entire 100-card deck for you.

4. **Run the Game Server:**
   ```bash
   npm start
   ```

## ☁️ Production Deployment (Railway)

This game is strictly designed to handle persistent state memory on cloud providers like Railway or Render. *(Do not deploy on Vercel as Serverless environments aggressively kill active WebSockets).*

1. Push your repository to GitHub.
2. Sign in to [Railway.app](https://railway.app/) and create a **New Project > Deploy from GitHub**.
3. Select this repository.
4. Go to the project **Variables** tab and set `MONGODB_URI` to your MongoDB Atlas connection string (Example: `mongodb+srv://user:pass@cluster.mongodb.net/cards?retryWrites=true&w=majority`).
5. In the **Settings > Networking** tab, generate a public domain URL or attach your custom domain!

---
*Created by Cosmics Software.*
