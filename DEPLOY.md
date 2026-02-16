# Deploying Clarity AI

Since this is a distinct Frontend + Backend MERN app, you should deploy them separately.

## 1. Backend (Render / Railway / Heroku)
The backend needs a Node.js environment.

### Steps for Render.com (easiest free tier):
1.  Push your code to GitHub.
2.  Create a new **Web Service**.
3.  Connect your repository.
4.  **Root Directory**: `server`
5.  **Build Command**: `npm install`
6.  **Start Command**: `npm start`
7.  **Environment Variables**:
    - `GEMINI_API_KEY`: (Your Google Key)
    - `PORT`: `5001` (or let Render assign one)

## 2. Frontend (Vite -> Vercel / Netlify)
The frontend is a static site (React).

### Steps for Vercel:
1.  Install Vercel CLI or use their dashboard.
2.  Import your repository.
3.  **Root Directory**: `client`
4.  **Build Command**: `npm run build`
5.  **Output Directory**: `dist`
6.  **Environment Variables**:
    - You must update `src/App.jsx` to point to your **deployed backend URL** instead of `localhost:5001`.
    - Alternatively, use `VITE_API_URL` environment variable:
      1. Challenge `App.jsx` to use `import.meta.env.VITE_API_URL`.
      2. Set `VITE_API_URL` in Vercel to your Render backend URL.

## 3. Production Readiness
- **CORS**: In `server/server.js`, you might need to restrict `cors()` to your specific frontend domain for security.
- **Secrets**: Never commit `.env` to GitHub.
